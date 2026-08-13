import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TranscriptTurn } from "@/lib/types";
import { recuperarConversacion, speakRatio } from "@/lib/elevenlabs";
import { generarYGuardarAutoevaluacion } from "@/lib/autoevaluacion-server";

// Recuperar la transcripción de ElevenLabs y luego evaluarla con el LLM.
export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { sessionId } = (await req.json()) as { sessionId?: string };
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

  const recuperada = await recuperarConversacion(session.elevenlabs_conversation_id as string | null);
  if (recuperada.transcript) transcript = recuperada.transcript;
  if (recuperada.durationSeconds != null) durationSeconds = recuperada.durationSeconds;

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
    await generarYGuardarAutoevaluacion(supabase, sessionId, user.id, transcript, session.persona_id as string, durationSeconds);
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
