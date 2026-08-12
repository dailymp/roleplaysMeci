"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useRef, useState } from "react";
import { Persona, Modo, TranscriptTurn } from "@/lib/types";
import { buildSystemPrompt, buildFirstMessage } from "@/lib/persona-prompt";

type StartSessionArgs = Parameters<ReturnType<typeof useConversation>["startSession"]>[0];
type SessionOverrides = NonNullable<StartSessionArgs["overrides"]>;

interface Props {
  persona: Persona;
  modo: Modo;
  onConnected: (conversationId: string) => void;
  onEnded: (transcript: TranscriptTurn[]) => void;
}

export default function ConversationWidget({ persona, modo, onConnected, onEnded }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const startRef = useRef<number>(0);

  const conversation = useConversation({
    onConnect: () => {
      transcriptRef.current = [];
    },
    onDisconnect: () => {
      onEnded(transcriptRef.current);
    },
    onMessage: (message: any) => {
      const role = message?.source === "user" ? "user" : "agent";
      const text = message?.message ?? message?.text ?? "";
      if (!text) return;
      transcriptRef.current = [
        ...transcriptRef.current,
        {
          role,
          message: text,
          time_in_call_secs: Math.round((Date.now() - startRef.current) / 1000),
        },
      ];
    },
    onError: (err: unknown) => {
      console.error("ElevenLabs error:", err);
      setError("Se cortó la conexión de voz. Puedes reintentar.");
    },
  });

  const start = useCallback(async () => {
    setError(null);
    setNotConfigured(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await fetch("/api/elevenlabs/signed-url");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 500 && body?.missingConfig) {
          setNotConfigured(true);
          return;
        }
        throw new Error(body?.error ?? "No se pudo iniciar la llamada.");
      }
      const { signedUrl } = await res.json();

      startRef.current = Date.now();
      // La voz NO va dentro de `agent`: es un override hermano (`tts`). Si la persona
      // no tiene voice_id se cae a la voz por defecto del agente.
      const overrides: SessionOverrides = {
        agent: {
          prompt: { prompt: buildSystemPrompt(persona, modo) },
          firstMessage: buildFirstMessage(persona),
          language: "es",
        },
      };
      if (persona.voice_id) {
        overrides.tts = { voiceId: persona.voice_id };
      }

      const conversationId = await conversation.startSession({ signedUrl, overrides } as StartSessionArgs);

      if (typeof conversationId === "string") {
        onConnected(conversationId);
      }
    } catch (e: any) {
      console.error(e);
      if (e?.name === "NotAllowedError") {
        setError("Necesito permiso para usar tu micrófono. Revisa los permisos del navegador.");
      } else {
        setError(e?.message ?? "No se pudo iniciar la llamada.");
      }
    }
  }, [conversation, persona, modo, onConnected]);

  const stop = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  if (notConfigured) {
    return (
      <div className="card border-warning/40 bg-warning/5 p-6 text-sm">
        <p className="font-bold text-ink">Falta configurar ElevenLabs</p>
        <p className="mt-2 text-ink-secondary">
          Añade <code className="rounded bg-hairline px-1">ELEVENLABS_API_KEY</code> y{" "}
          <code className="rounded bg-hairline px-1">ELEVENLABS_AGENT_ID</code> como variables de entorno en
          Vercel (Project Settings → Environment Variables) y vuelve a desplegar. Necesitas un Agent de
          Conversational AI creado en tu cuenta de ElevenLabs.
        </p>
      </div>
    );
  }

  const status = conversation.status;
  const isConnected = status === "connected";

  return (
    <div className="card flex flex-col items-center gap-4 p-8">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl transition ${
          isConnected ? (conversation.isSpeaking ? "animate-pulse bg-fase-e/20" : "bg-good/15") : "bg-hairline"
        }`}
        style={{ color: persona.color }}
      >
        🎙️
      </div>

      <p className="text-sm font-semibold text-ink-secondary">
        {status === "connecting"
          ? "Conectando…"
          : isConnected
          ? conversation.isSpeaking
            ? `${persona.nombre} está hablando…`
            : "Te escucha…"
          : "Lista para empezar"}
      </p>

      {!isConnected ? (
        <button onClick={start} disabled={status === "connecting"} className="btn-primary">
          {status === "connecting" ? "Conectando…" : "Empezar llamada"}
        </button>
      ) : (
        <button onClick={stop} className="btn-secondary border-critical text-critical hover:bg-critical/5">
          Finalizar roleplay
        </button>
      )}

      {error && <p className="text-xs font-medium text-critical">{error}</p>}
    </div>
  );
}
