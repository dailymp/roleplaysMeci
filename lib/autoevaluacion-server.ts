import type { SupabaseClient } from "@supabase/supabase-js";
import { AutoEvaluationInput, Persona, TranscriptTurn } from "./types";
import { evaluarSesion } from "./evaluador";

/**
 * Genera la autoevaluación del sistema y la guarda. Se llama desde `finalize`
 * (para que toda sesión terminada tenga feedback sin que Daily haga nada) y
 * desde `/api/session/evaluate` para reintentar si el LLM estaba caído.
 */
export async function generarYGuardarAutoevaluacion(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  transcript: TranscriptTurn[],
  personaId: string,
  duracionSegundos?: number | null
): Promise<AutoEvaluationInput> {
  const { data: persona, error: personaError } = await supabase
    .from("personas")
    .select("*")
    .eq("id", personaId)
    .single();

  if (personaError || !persona) {
    throw new Error("No se encontró la persona de la sesión.");
  }

  const evaluacion = await evaluarSesion(sessionId, userId, persona as Persona, transcript, duracionSegundos);

  const { error: upsertError } = await supabase
    .from("auto_evaluations")
    .upsert(evaluacion, { onConflict: "session_id" });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return evaluacion;
}
