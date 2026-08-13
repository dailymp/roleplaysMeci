import { Fase, MetricasTranscripcion, TranscriptTurn } from "./types";

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

/**
 * Precio = siempre una cifra. Sin el número, palabras como "inversión" o "precio"
 * daban falsos positivos ("estás gastando mucho en inversión de publicidad") y
 * marcaban precio en llamadas donde nunca se llegó a darlo.
 */
const RE_PRECIO =
  /(\d[\d.,]*\s*(€|euros?\b|eur\b))|((precio|inversión|coste|cuesta|vale|sale|son)\D{0,15}\d[\d.,]*)/i;

const RE_CIERRE =
  /(¿?\s*(empezamos|arrancamos|lo hacemos|damos el paso|cerramos)\b)|(te (apunto|inscribo|reservo|dejo la plaza))|(quieres que (lo )?(empecemos|arranquemos|hagamos))|(cuál de las dos)|(¿te (parece|encaja|va) bien.*\?)|(firmamos)/i;

const RE_AGENDA =
  /((lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b)|(\bmañana\b)|(\bpasado mañana\b)|(\bel (día )?\d{1,2}\b)|(\ba las \d{1,2}([:.]\d{2})?\b)/i;

/** Elegir entre dos opciones concretas, no un sí/no genérico: "cuál de las dos", "prefieres X o Y". */
const RE_DOS_OPCIONES =
  /(cuál de las dos|cual de las dos|prefieres (el|la|los|las)?\s*\S+\s+o\s+\S+|te (viene|va) mejor\s+\S+.{0,20}\so\s.{0,20}\?|opci[oó]n (a|1)\b.{0,40}opci[oó]n (b|2)\b)/i;

/** Tie-downs: preguntas cortas para comprobar que el prospecto sigue alineado antes de avanzar. */
const RE_TIE_DOWN_G =
  /(¿\s*(me sigues|tiene sentido|estamos de acuerdo|estás? de acuerdo|te hace sentido|está claro|queda claro|no crees)\s*\?)|(\b(verdad|cierto)\s*\?)/gi;

/** Primera señal de que Daily entró en Empuje: coste de no actuar, storytelling o visión de futuro. */
const RE_EMPUJE_INICIO =
  /(cada mes|si no haces nada|estás perdiendo|te cuesta|dejar de|seguir igual|un cliente|un caso|hace poco|te cuento|igual que tú|me pasó|dentro de (un año|12 meses)|imagina|cómo sería|en seis meses|te ves)/i;

/** Señal de que Daily entró en Implementación: pidió el cierre, cobró o agendó (buscada sólo después del precio). */
const RE_CIERRE_O_PAGO = new RegExp(
  `${RE_CIERRE.source}|(tarjeta|enlace de pago|dep[oó]sito|reserva|primer pago|lo dejamos pagado|agendo|agendamos)`,
  "i"
);

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

function primerIndiceEnRango(transcript: TranscriptTurn[], desde: number, hasta: number, re: RegExp): number {
  const limite = hasta < 0 ? transcript.length : hasta;
  for (let i = Math.max(0, desde); i < limite; i++) {
    if (transcript[i].role === "user" && re.test(transcript[i].message)) return i;
  }
  return -1;
}

/**
 * Segmenta la llamada en M/E/C/I por tiempo, usando las mismas señales de texto que ya
 * detectan precio/cierre/agenda. Es una estimación, no marcadores exactos: si una fase no
 * deja ninguna señal detectable, su tiempo se reparte en la fase anterior o siguiente según
 * corresponda (p. ej. ir directa al precio sin pasar por Empuje da E = 0, lo cual es en sí
 * mismo una señal real, no un fallo del cálculo).
 */
function analizarFasesPorTiempo(transcript: TranscriptTurn[]): Record<Fase, number> {
  if (!transcript.length) return { M: 0, E: 0, C: 0, I: 0 };

  const tiempos = marcasDeTiempo(transcript);
  const ultimo = transcript.length - 1;
  const finLlamada = tiempos[ultimo] + duracionEstimada(transcript[ultimo]);

  const idxC = transcript.findIndex((t) => t.role === "user" && RE_PRECIO.test(t.message));
  const idxE = primerIndiceEnRango(transcript, 0, idxC, RE_EMPUJE_INICIO);
  const idxI = idxC >= 0 ? primerIndiceEnRango(transcript, idxC + 1, -1, RE_CIERRE_O_PAGO) : -1;

  const b4 = finLlamada;
  const b3 = idxI >= 0 ? tiempos[idxI] : b4;
  const b2 = idxC >= 0 ? tiempos[idxC] : b3;
  const b1 = idxE >= 0 ? tiempos[idxE] : b2;

  return {
    M: Math.max(0, b1),
    E: Math.max(0, b2 - b1),
    C: Math.max(0, b3 - b2),
    I: Math.max(0, b4 - b3),
  };
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
    dos_opciones_detectado: false,
    tie_downs_count: 0,
    tiempo_por_fase: { M: 0, E: 0, C: 0, I: 0 },
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
    dos_opciones_detectado: turnosDaily.some((t) => RE_DOS_OPCIONES.test(t.message)),
    tie_downs_count: turnosDaily.reduce((s, t) => s + (t.message.match(RE_TIE_DOWN_G)?.length ?? 0), 0),
    tiempo_por_fase: analizarFasesPorTiempo(transcript),
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
