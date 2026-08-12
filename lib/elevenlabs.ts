import { TranscriptTurn } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ConversacionRecuperada {
  transcript: TranscriptTurn[] | null;
  durationSeconds: number | null;
}

/**
 * Recupera la transcripción y la duración reales de ElevenLabs. La conversación
 * tarda unos segundos en procesarse al colgar, de ahí los reintentos.
 * Devuelve nulls si no hay clave, no hay id o la API falla: quien llama se queda
 * con lo que ya tuviera guardado del cliente.
 */
export async function recuperarConversacion(
  conversationId: string | null,
  intentos = 3
): Promise<ConversacionRecuperada> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const vacio: ConversacionRecuperada = { transcript: null, durationSeconds: null };
  if (!apiKey || !conversationId) return vacio;

  for (let intento = 0; intento < intentos; intento++) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) return vacio;

      const data = await res.json();
      if (data.status === "processing") {
        await sleep(1500);
        continue;
      }

      const transcript: TranscriptTurn[] | null =
        Array.isArray(data.transcript) && data.transcript.length
          ? data.transcript.map((t: { role?: string; message?: string; time_in_call_secs?: number }) => ({
              role: t.role === "user" ? ("user" as const) : ("agent" as const),
              message: t.message ?? "",
              time_in_call_secs: t.time_in_call_secs,
            }))
          : null;

      return {
        transcript,
        durationSeconds:
          typeof data?.metadata?.call_duration_secs === "number" ? data.metadata.call_duration_secs : null,
      };
    } catch {
      return vacio;
    }
  }

  return vacio;
}

/** Reparto de habla de Daily sobre el total de texto. Objetivo del método: ≤0,30. */
export function speakRatio(transcript: TranscriptTurn[]): number | null {
  if (!transcript.length) return null;
  const dailyChars = transcript.filter((t) => t.role === "user").reduce((s, t) => s + t.message.length, 0);
  const totalChars = transcript.reduce((s, t) => s + t.message.length, 0);
  if (totalChars === 0) return null;
  return Math.round((dailyChars / totalChars) * 100) / 100;
}
