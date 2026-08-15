import { Fase, MetricasTranscripcion, SenalesNivel3, TranscriptTurn } from "./types";

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

/* ─────────────────── Señales de la hoja de Revisión Nivel 3 ───────────────────
 *
 * Todo esto se detecta por patrón, sin LLM, por el mismo motivo que el resto
 * del fichero: son hechos que se pueden contrastar. Un patrón que no encaja da
 * `false`, y el evaluador por LLM puede subir la marca si lee la evidencia en
 * la transcripción — nunca al revés: los tiempos medidos no se discuten.
 */

const RE_HOJA_VIDA =
  /(hoja de vida|comparto (mi )?pantalla|compartir (la )?pantalla|te comparto|ves mi pantalla|voy a compartir|¿ves (esto|la pantalla))/i;
const RE_PREGUNTA_AYUDA = /¿?\s*(c[oó]mo|en qu[eé])\s+(te|os|le)?\s*(podemos|puedo|podr[ií]a(mos)?)\s+ayudar/i;
const RE_AGRADECE_TIEMPO =
  /(gracias por (tu |el |todo el )?(tiempo|puntualidad|conectarte|estar aqu[ií]|sacar (el )?tiempo|acompa[ñn]arme))|(te agradezco (mucho )?(el|tu) tiempo)/i;
const RE_TOMADOR_DECISIONES =
  /((tomas?|tomar[ií]as?) (t[uú] )?(la|las|esta|esa)? ?decisi[oó]n)|(qui[eé]n decide)|(decides t[uú])|(hay (alguien|alguna persona) m[aá]s)|(socio|socia|tu pareja|comit[eé]|junta)\b.{0,30}(decid|particip|consult)/i;
const RE_AUTORIDAD =
  /(llevo \d+ años)|(hemos (ayudado|trabajado con) (a )?(m[aá]s de )?\d+)|(nos dedicamos a)|(mi nombre es|me llamo)\b.{0,80}(y (soy|trabajo|ayudo|llevo))|(soy \w+.{0,40}\b(fundador|fundadora|ceo|directora?|consultora?|especialista)\b)/i;
const RE_PROPOSITO =
  /(el (objetivo|prop[oó]sito|motivo) de (esta|la) llamada)|(la llamada de hoy va a)|(vamos a hacer lo siguiente)|(te (cuento|explico) c[oó]mo (va|funciona) (esto|la llamada))|(al final de (esta|la) llamada)/i;
const RE_TRES_RAZONES = /((tres|3) (razones|motivos))|(por (tres|3) (razones|motivos))|(la primera raz[oó]n)/i;
const RE_SENTIMIENTO =
  /(c[oó]mo te (hace sentir|sientes|sienta))|(qu[eé] (sientes|sensaci[oó]n))|(te (frustra|agobia|preocupa|angustia|quita el sue[ñn]o))|(c[oó]mo lo (vives|llevas))/i;
const RE_OTRAS_AREAS =
  /(otras [aá]reas)|(tu vida (personal|familiar))|(a tu (familia|pareja|salud))|(fuera del trabajo)|(en casa)|(te (afecta|repercute) en)|(al descanso|a tu descanso|duermes)/i;
const RE_RECOPILA =
  /((entonces|o sea|resumiendo|si lo he entendido)\b.{0,60}\b(tenemos|ser[ií]an|hay|me dices|me has (dicho|contado)))|(por (un|una) lado.{0,80}(por (otro|otra)))|(d[eé]jame (que )?resum)/i;
const RE_HISTORIA =
  /(c[oó]mo (empezaste|empez[oó]|llegaste|naci[oó]))|(por qu[eé] (empezaste|montaste|decidiste))|(cu[eé]ntame (tu|un poco) (historia|c[oó]mo))|(desde cu[aá]ndo (llevas|est[aá]s))/i;
const RE_CUADRO =
  /(cuadro comparativo|comparativa)|(d[oó]nde est[aá]s (hoy|ahora).{0,60}d[oó]nde quieres)|(situaci[oó]n actual.{0,40}(situaci[oó]n )?(deseada|objetivo))|(esto es lo que tienes.{0,40}esto lo que quieres)/i;
const RE_COMPROMISO =
  /(est[aá]s dispuesta?o?\b)|(estar[ií]as dispuesta?o?)|(te comprometes)|(si te (doy|enseño|presento) (la|una) (soluci[oó]n|forma|manera))|(qu[eé] estar[ií]as dispuesta?o? a hacer)|(har[ií]as lo que (haga falta|hiciera falta))/i;
const RE_CONTEXTO_CLOSING =
  /(al final de (esta|la) llamada)|(cuando (terminemos|acabemos))|(si (ves|vemos) que (encaja|tiene sentido))|(te (voy a |ir[eé] a )?(presentar|explicar|ense[ñn]ar).{0,40}(propuesta|opciones|c[oó]mo lo har[ií]amos))|(tomar (una|la) decisi[oó]n (hoy|al final))/i;
const RE_CALCULADORA =
  /(calculadora)|(vamos a (calcular|hacer (n[uú]meros|cuentas)))|(hagamos (n[uú]meros|cuentas))|(cu[aá]nto (facturas|ingresas|necesitas facturar))|(hacemos el c[aá]lculo)/i;
const RE_TRANSICION_PITCH =
  /(bas[aá]ndome en|basado en|con (todo )?lo que (hemos|me has))\b.{0,60}(hablado|contado|visto|comentado)|(estoy (100% )?segura?\b.{0,40}(te (podemos|puedo) ayudar))|(por todo (esto|lo que me has contado))/i;

/** Cifra "de metas": un número con magnitud, no un "tengo 2 hijos". */
const RE_CIFRA_META =
  /(\d[\d.,]*\s*(€|euros?\b|eur\b|k\b|mil\b|millones?\b))|(\d{3,}[\d.,]*)/i;

function primerSegundoQueCumple(
  transcript: TranscriptTurn[],
  tiempos: number[],
  re: RegExp,
  rol: "user" | "agent" = "user"
): number | null {
  for (let i = 0; i < transcript.length; i++) {
    if (transcript[i].role === rol && re.test(transcript[i].message)) return tiempos[i];
  }
  return null;
}

function senalesNivel3(transcript: TranscriptTurn[], tiempos: number[]): SenalesNivel3 {
  const deDaily = transcript.filter((t) => t.role === "user");
  const hay = (re: RegExp) => deDaily.some((t) => re.test(t.message));

  const idxAyuda = transcript.findIndex(
    (t) => t.role === "user" && RE_PREGUNTA_AYUDA.test(t.message)
  );
  // "La PRIMERA pregunta": el coach marcó esto como Mejorable justamente por
  // llegar tarde, así que no basta con que aparezca. Se compara contra el
  // primer turno de Daily que contiene una interrogación de verdad.
  const idxPrimeraPregunta = transcript.findIndex(
    (t) => t.role === "user" && t.message.includes("?")
  );
  const ayudaFuePrimera =
    idxAyuda < 0 ? null : idxPrimeraPregunta < 0 ? true : idxAyuda <= idxPrimeraPregunta;

  // Sugerir un valor: ¿quién dijo la primera cifra después de abrir la
  // calculadora? Si fue Daily, el número ya no es del prospecto.
  const idxCalculadora = transcript.findIndex(
    (t) => t.role === "user" && RE_CALCULADORA.test(t.message)
  );
  let sugirioValor = false;
  if (idxCalculadora >= 0) {
    for (let i = idxCalculadora; i < transcript.length; i++) {
      if (!RE_CIFRA_META.test(transcript[i].message)) continue;
      sugirioValor = transcript[i].role === "user";
      break;
    }
  }

  // Descubrimiento: desde el arranque hasta que se abre el pitch. Sin
  // transición al pitch se usa el precio, y si tampoco lo hay queda null —
  // "no se sabe" y no un cero que parecería un descubrimiento instantáneo.
  const finPitch = primerSegundoQueCumple(transcript, tiempos, RE_TRANSICION_PITCH);
  const finPrecio = primerSegundoQueCumple(transcript, tiempos, RE_PRECIO);
  const finDescubrimiento = finPitch ?? finPrecio;

  return {
    hoja_vida_secs: primerSegundoQueCumple(transcript, tiempos, RE_HOJA_VIDA),
    pregunta_ayuda_secs: idxAyuda >= 0 ? tiempos[idxAyuda] : null,
    ayuda_fue_primera_pregunta: ayudaFuePrimera,
    descubrimiento_secs: finDescubrimiento,
    agradecio_tiempo: hay(RE_AGRADECE_TIEMPO),
    pregunto_tomador_decisiones: hay(RE_TOMADOR_DECISIONES),
    presentacion_con_autoridad: hay(RE_AUTORIDAD),
    dio_proposito: hay(RE_PROPOSITO),
    tres_razones: hay(RE_TRES_RAZONES),
    pregunto_sentimiento: hay(RE_SENTIMIENTO),
    pregunto_otras_areas: hay(RE_OTRAS_AREAS),
    recopilo_problemas: hay(RE_RECOPILA),
    historia_personal: hay(RE_HISTORIA),
    cuadro_comparativo: hay(RE_CUADRO),
    pregunta_compromiso: hay(RE_COMPROMISO),
    contexto_closing: hay(RE_CONTEXTO_CLOSING),
    uso_calculadora: idxCalculadora >= 0,
    transicion_pitch: hay(RE_TRANSICION_PITCH),
    sugirio_valor: sugirioValor,
  };
}

const SENALES_VACIAS: SenalesNivel3 = {
  hoja_vida_secs: null,
  pregunta_ayuda_secs: null,
  ayuda_fue_primera_pregunta: null,
  descubrimiento_secs: null,
  agradecio_tiempo: false,
  pregunto_tomador_decisiones: false,
  presentacion_con_autoridad: false,
  dio_proposito: false,
  tres_razones: false,
  pregunto_sentimiento: false,
  pregunto_otras_areas: false,
  recopilo_problemas: false,
  historia_personal: false,
  cuadro_comparativo: false,
  pregunta_compromiso: false,
  contexto_closing: false,
  uso_calculadora: false,
  transicion_pitch: false,
  sugirio_valor: false,
};

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
    nivel3: SENALES_VACIAS,
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
    nivel3: senalesNivel3(transcript, tiempos),
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
