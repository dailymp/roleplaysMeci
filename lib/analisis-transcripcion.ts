import { MetricasTranscripcion, TranscriptTurn } from "./types";

/**
 * Análisis determinista de la transcripción. Nada de esto pasa por un LLM: son
 * hechos medibles que sirven tanto para puntuar como para contrastar la
 * autoevaluación de Daily con lo que realmente ocurrió en la llamada.
 *
 * Convención de roles en la transcripción de ElevenLabs:
 *   role "user"  -> Daily (la comercial)
 *   role "agent" -> el prospecto simulado
 */

/** Velocidad de habla media en español conversacional, para estimar duraciones. */
const CARACTERES_POR_SEGUNDO = 14;

const RE_PRECIO =
  /(\d[\d.\s]*\s*(€|euros?|eur\b))|(\bprecio\b|\binversión\b|\bcuesta\b|\bson\s+\d[\d.]*\b)/i;

const RE_CIERRE =
  /(¿?\s*(empezamos|arrancamos|lo hacemos|damos el paso|cerramos)\b)|(te (apunto|inscribo|reservo|dejo la plaza))|(quieres que (lo )?(empecemos|arranquemos|hagamos))|(cuál de las dos)|(¿te (parece|encaja|va) bien.*\?)|(firmamos)/i;

const RE_AGENDA =
  /((lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b)|(\bmañana\b)|(\bpasado mañana\b)|(\bel (día )?\d{1,2}\b)|(\ba las \d{1,2}([:.]\d{2})?\b)/i;

function duracionEstimada(turno: TranscriptTurn): number {
  return Math.max(1, Math.round(turno.message.length / CARACTERES_POR_SEGUNDO));
}

/** Segundo en que arranca el turno; si no viene marca de tiempo se reconstruye acumulando. */
function marcasDeTiempo(transcript: TranscriptTurn[]): number[] {
  let acumulado = 0;
  return transcript.map((t) => {
    if (typeof t.time_in_call_secs === "number") {
      acumulado = t.time_in_call_secs;
      return t.time_in_call_secs;
    }
    const inicio = acumulado;
    acumulado += duracionEstimada(t);
    return inicio;
  });
}

export function analizarTranscripcion(transcript: TranscriptTurn[]): MetricasTranscripcion {
  const vacio: MetricasTranscripcion = {
    ratio_habla: null,
    monologo_mas_largo_secs: null,
    turnos_daily: 0,
    turnos_prospecto: 0,
    precio_mencionado_secs: null,
    silencio_tras_precio_secs: null,
    pidio_cierre: false,
    agendo_siguiente_paso: false,
    preguntas_daily: 0,
  };
  if (!transcript.length) return vacio;

  const tiempos = marcasDeTiempo(transcript);

  const charsDaily = transcript
    .filter((t) => t.role === "user")
    .reduce((s, t) => s + t.message.length, 0);
  const charsTotal = transcript.reduce((s, t) => s + t.message.length, 0);

  // Monólogo: bloques seguidos de turnos de Daily sin que el prospecto entre.
  let monologoMax = 0;
  let bloqueInicio: number | null = null;
  transcript.forEach((turno, i) => {
    if (turno.role === "user") {
      if (bloqueInicio === null) bloqueInicio = tiempos[i];
      const fin = tiempos[i] + duracionEstimada(turno);
      monologoMax = Math.max(monologoMax, fin - bloqueInicio);
    } else {
      bloqueInicio = null;
    }
  });

  // Precio: primera vez que Daily lo pone encima de la mesa.
  const idxPrecio = transcript.findIndex((t) => t.role === "user" && RE_PRECIO.test(t.message));
  let silencioTrasPrecio: number | null = null;
  if (idxPrecio >= 0) {
    const finPrecio = tiempos[idxPrecio] + duracionEstimada(transcript[idxPrecio]);
    const siguiente = transcript[idxPrecio + 1];
    if (!siguiente) {
      silencioTrasPrecio = null;
    } else if (siguiente.role === "user") {
      // Siguió hablando ella misma: no sostuvo el silencio.
      silencioTrasPrecio = 0;
    } else {
      silencioTrasPrecio = Math.max(0, tiempos[idxPrecio + 1] - finPrecio);
    }
  }

  const turnosDaily = transcript.filter((t) => t.role === "user");

  return {
    ratio_habla: charsTotal > 0 ? Math.round((charsDaily / charsTotal) * 100) / 100 : null,
    monologo_mas_largo_secs: monologoMax || null,
    turnos_daily: turnosDaily.length,
    turnos_prospecto: transcript.length - turnosDaily.length,
    precio_mencionado_secs: idxPrecio >= 0 ? tiempos[idxPrecio] : null,
    silencio_tras_precio_secs: silencioTrasPrecio,
    pidio_cierre: turnosDaily.some((t) => RE_CIERRE.test(t.message)),
    agendo_siguiente_paso: turnosDaily.some(
      (t) => RE_AGENDA.test(t.message) && /(llamada|hablamos|nos vemos|te llamo|quedamos|agendo|reunión|reunion|sesión|sesion)/i.test(t.message)
    ),
    preguntas_daily: turnosDaily.reduce((s, t) => s + (t.message.match(/\?/g)?.length ?? 0), 0),
  };
}

/** Transcripción en texto plano numerada, para meterla en el prompt del evaluador. */
export function formatearTranscripcion(transcript: TranscriptTurn[], nombreProspecto: string): string {
  const tiempos = marcasDeTiempo(transcript);
  return transcript
    .map((t, i) => {
      const min = Math.floor(tiempos[i] / 60);
      const seg = tiempos[i] % 60;
      const quien = t.role === "user" ? "DAILY" : nombreProspecto.toUpperCase();
      return `[${min}:${String(seg).padStart(2, "0")}] ${quien}: ${t.message}`;
    })
    .join("\n");
}
