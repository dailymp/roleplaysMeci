import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TranscriptTurn } from "@/lib/types";
import { generarYGuardarAutoevaluacion } from "@/lib/autoevaluacion-server";

// Recuperar la transcripción de ElevenLabs y luego evaluarla con el LLM.
export const maxDuration = 120;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function speakRatio(transcript: TranscriptTurn[]): number | null {
  if (!transcript.length) return null;
  const userChars = transcript.filter((t) => t.role === "user").reduce((s, t) => s + t.message.length, 0);
  const totalChars = transcript.reduce((s, t) => s + t.message.length, 0);
  if (totalChars === 0) return null;
  return Math.round((userChars / totalChars) * 100) / 100;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "Falta sessionId." }, { status: 400 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });
  }

  let transcript: TranscriptTurn[] = session.transcript ?? [];
  let durationSeconds: number | null = null;

  if (session.started_at && session.ended_at) {
    durationSeconds = Math.round(
      (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const conversationId = session.elevenlabs_conversation_id as string | null;

  if (apiKey && conversationId) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
          headers: { "xi-api-key": apiKey },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "processing") {
            await sleep(1500);
            continue;
          }
          if (Array.isArray(data.transcript) && data.transcript.length) {
            transcript = data.transcript.map((t: any) => ({
              role: t.role === "user" ? "user" : "agent",
              message: t.message ?? "",
              time_in_call_secs: t.time_in_call_secs,
            }));
          }
          if (typeof data?.metadata?.call_duration_secs === "number") {
            durationSeconds = data.metadata.call_duration_secs;
          }
          break;
        }
      } catch {
        // se queda con lo que ya tenemos guardado del cliente
        break;
      }
    }
  }

  const ratio = speakRatio(transcript);

  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      transcript,
      duration_seconds: durationSeconds,
      daily_speak_ratio: ratio,
      status: "finalizada",
    })
    .eq("id", sessionId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // La autoevaluación del sistema es obligatoria: toda sesión terminada tiene
  // feedback, con o sin autoevaluación manual de Daily. Si falla, la sesión ya
  // está guardada y se puede reintentar desde /api/session/evaluate.
  let autoevaluacionError: string | null = null;
  try {
    await generarYGuardarAutoevaluacion(supabase, sessionId, user.id, transcript, session.persona_id as string);
  } catch (e) {
    autoevaluacionError = e instanceof Error ? e.message : "No se pudo generar la autoevaluación.";
  }

  return NextResponse.json({
    ok: true,
    durationSeconds,
    speakRatio: ratio,
    turns: transcript.length,
    autoevaluacionError,
  });
}
