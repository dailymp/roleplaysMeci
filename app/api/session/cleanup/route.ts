import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RoleplaySession, TranscriptTurn } from "@/lib/types";
import { recuperarConversacion, speakRatio } from "@/lib/elevenlabs";
import { generarYGuardarAutoevaluacion } from "@/lib/autoevaluacion-server";

export const maxDuration = 120;

/**
 * Minutos tras los que una sesión `en_curso` se da por abandonada. Ninguna
 * llamada de entrenamiento dura tanto, así que pasado ese tiempo es que Daily
 * cerró la pestaña: `handleEnded` sólo corre en el cliente y esas sesiones se
 * quedaban colgadas para siempre.
 */
const MINUTOS_ABANDONO = 30;

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const limite = new Date(Date.now() - MINUTOS_ABANDONO * 60 * 1000).toISOString();

  const { data: huerfanas, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("status", "en_curso")
    .lt("started_at", limite);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cerradas: string[] = [];

  for (const sesion of (huerfanas ?? []) as RoleplaySession[]) {
    const recuperada = await recuperarConversacion(sesion.elevenlabs_conversation_id);
    const transcript: TranscriptTurn[] = recuperada.transcript ?? sesion.transcript ?? [];

    await supabase
      .from("sessions")
      .update({
        ended_at: sesion.ended_at ?? new Date().toISOString(),
        transcript,
        duration_seconds: recuperada.durationSeconds ?? sesion.duration_seconds,
        daily_speak_ratio: speakRatio(transcript),
        status: "finalizada",
      })
      .eq("id", sesion.id);

    cerradas.push(sesion.id);

    // Sin conversación real no hay nada que evaluar: se queda como finalizada vacía.
    if (transcript.length >= 2) {
      try {
        await generarYGuardarAutoevaluacion(
          supabase,
          sesion.id,
          user.id,
          transcript,
          sesion.persona_id,
          recuperada.durationSeconds ?? sesion.duration_seconds
        );
      } catch {
        // La sesión ya está cerrada; se puede reintentar desde /api/session/evaluate.
      }
    }
  }

  return NextResponse.json({ ok: true, cerradas });
}
