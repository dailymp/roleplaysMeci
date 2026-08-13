import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TranscriptTurn } from "@/lib/types";
import { generarYGuardarAutoevaluacion } from "@/lib/autoevaluacion-server";

// La llamada al LLM puede tardar; el límite por defecto de Next se queda corto.
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

  const transcript = (session.transcript ?? []) as TranscriptTurn[];

  try {
    const evaluacion = await generarYGuardarAutoevaluacion(
      supabase,
      sessionId,
      user.id,
      transcript,
      session.persona_id as string,
      session.duration_seconds as number | null
    );
    return NextResponse.json({ ok: true, evaluacion });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo evaluar la sesión." },
      { status: 500 }
    );
  }
}
