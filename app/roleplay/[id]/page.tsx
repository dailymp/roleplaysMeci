"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Persona, RoleplaySession, TranscriptTurn } from "@/lib/types";
import ConversationWidget from "@/components/ConversationWidget";

export default function ActiveRoleplayPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<RoleplaySession | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          setLoading(false);
          return;
        }
        setSession(data as RoleplaySession);
        const { data: p } = await supabase
          .from("personas")
          .select("*")
          .eq("id", (data as RoleplaySession).persona_id)
          .single();
        setPersona(p as Persona);
        setLoading(false);
      });
  }, [sessionId]);

  async function handleConnected(conversationId: string) {
    const supabase = createClient();
    await supabase.from("sessions").update({ elevenlabs_conversation_id: conversationId }).eq("id", sessionId);
  }

  async function handleEnded(transcript: TranscriptTurn[]) {
    setFinalizing(true);
    const supabase = createClient();
    const endedAt = new Date().toISOString();

    await supabase
      .from("sessions")
      .update({ ended_at: endedAt, transcript, status: "finalizada" })
      .eq("id", sessionId);

    try {
      await fetch("/api/session/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch (e) {
      console.error("No se pudo enriquecer la sesión con datos de ElevenLabs:", e);
    }

    router.push(`/roleplay/${sessionId}/evaluar`);
  }

  if (loading) return <p className="text-sm text-muted">Cargando…</p>;
  if (!session || !persona) return <p className="text-sm text-critical">No se encontró la sesión.</p>;

  if (finalizing) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm font-semibold text-ink-secondary">Guardando tu llamada…</p>
        <p className="text-xs text-muted">Te llevamos a la autoevaluación en un segundo.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <span className="tag" style={{ backgroundColor: `${persona.color}1a`, color: persona.color }}>
          {persona.nombre}
        </span>
        <h1 className="mt-2 text-lg font-bold">Roleplay en curso</h1>
        <p className="mt-1 text-xs text-muted">
          Habla con naturalidad, como en una llamada real. {persona.nombre} reacciona a lo que hagas.
        </p>
      </div>

      <ConversationWidget persona={persona} modo={session.modo} onConnected={handleConnected} onEnded={handleEnded} />

      <p className="mt-6 text-center text-xs text-muted">
        Cuando termines, pulsa "Finalizar roleplay" — te llevará directo a autoevaluarte con la rúbrica MECI.
      </p>
    </div>
  );
}
