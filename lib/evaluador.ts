import {
  AutoEvaluationInput,
  MetricasTranscripcion,
  Persona,
  TranscriptTurn,
} from "./types";
import { RUBRICA, FASE_LABEL, calcularTotales } from "./rubrica";
import { analizarTranscripcion, formatearTranscripcion } from "./analisis-transcripcion";

/**
 * Evaluador automático. Siempre devuelve una evaluación completa y un feedback:
 * si hay LLM configurado se usa para leer la transcripción ítem a ítem, y si no
 * (o si falla) se cae a una puntuación heurística basada en las métricas
 * deterministas. Nunca deja a Daily sin devolución.
 */

interface RespuestaLLM {
  item_scores: Record<string, number>;
  evidencias: Record<string, string>;
  puntos_fuertes: string[];
  puntos_debiles: string[];
  momento_clave_positivo: string | null;
  momento_clave_negativo: string | null;
  frase_dolor_real: string | null;
  ejercicio_siguiente: string | null;
  resumen: string;
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function textoDaily(transcript: TranscriptTurn[]): string {
  return transcript.filter((t) => t.role === "user").map((t) => t.message).join(" \n");
}

/**
 * Bandas de duración para el ítem 21 (manejo del tiempo). La hoja de origen no fija un
 * número exacto de minutos, así que esto es un criterio propio de DailyMP (llamada de
 * venta 1:1 estilo Top Closing), documentado aquí para poder ajustarlo si hace falta.
 */
function puntuarDuracion(segundos: number | null | undefined): { score: number; evidencia: string } {
  if (segundos == null) return { score: 3, evidencia: "No hay duración registrada de la llamada." };
  const min = segundos / 60;
  let score: number;
  if (min >= 20 && min <= 45) score = 5;
  else if ((min >= 12 && min < 20) || (min > 45 && min <= 60)) score = 4;
  else if ((min >= 7 && min < 12) || (min > 60 && min <= 75)) score = 3;
  else score = 2;
  return { score, evidencia: `Duración total de la llamada: ${Math.round(min)} min.` };
}

/** Puntuación de respaldo: sólo mira señales objetivas, es conservadora a propósito. */
export function puntuacionHeuristica(
  transcript: TranscriptTurn[],
  m: MetricasTranscripcion,
  duracionSegundos?: number | null
): { scores: Record<string, number>; evidencias: Record<string, string> } {
  const daily = textoDaily(transcript);
  const scores: Record<string, number> = {};
  const evidencias: Record<string, string> = {};

  const set = (id: number, score: number, evidencia: string) => {
    scores[String(id)] = clamp(score);
    evidencias[String(id)] = evidencia;
  };

  const hay = (re: RegExp) => re.test(daily);

  // M — Mapeo
  const precioTemprano = m.precio_mencionado_secs != null && m.precio_mencionado_secs < 120;
  set(1, precioTemprano ? 2 : 4, precioTemprano
    ? "Se habló de precio en los primeros 2 minutos: no hubo tiempo real de romper el hielo."
    : "No se fue a vender en los primeros 2 minutos.");
  set(2, hay(/(agenda|vamos a hacer|te propongo|al final de la llamada|te parece si|20 minutos|media hora)/i) ? 4 : 2,
    "Se busca si enmarcó la llamada (agenda, duración, qué pasa al final).");

  const ratio = m.ratio_habla;
  const scoreRatio = ratio == null ? 3 : ratio <= 0.3 ? 5 : ratio <= 0.4 ? 4 : ratio <= 0.5 ? 3 : ratio <= 0.6 ? 2 : 1;
  set(3, scoreRatio, ratio == null ? "Sin datos de reparto de habla." : `Daily habló el ${Math.round(ratio * 100)}% del texto (objetivo ≤30%).`);

  set(4, m.preguntas_daily >= 6 ? 4 : m.preguntas_daily >= 3 ? 3 : 2,
    `${m.preguntas_daily} preguntas de Daily en toda la llamada.`);
  set(5, hay(/(has probado|has intentado|conoces|qué has hecho|antes de esto|por qué crees)/i) ? 3 : 2,
    "Se busca indagación sobre el nivel de consciencia del prospecto.");

  const dailyTurnos = transcript.filter((t) => t.role === "user");
  const segundaMitad = dailyTurnos.slice(Math.floor(dailyTurnos.length / 2)).map((t) => t.message).join(" \n");
  const controlSostenido = /(retomando|volvamos a|como te (comentaba|decía)|antes de seguir|te propongo que|dejame resumir|dejame que resuma|déjame resumir|déjame que resuma)/i.test(segundaMitad);
  set(19, controlSostenido ? 4 : 2,
    controlSostenido
      ? "Se detectan redirecciones o resúmenes de control en la segunda mitad de la llamada."
      : "No se detecta que retomara las riendas de la llamada más allá del arranque.");

  // E — Empuje
  set(6, hay(/(cada mes|si no haces nada|estás perdiendo|te cuesta|dejar de|seguir igual)/i) ? 3 : 2,
    "Se busca amplificación del coste de no actuar.");
  set(7, hay(/(un cliente|un caso|hace poco|te cuento|igual que tú|me pasó)/i) ? 3 : 2,
    "Se busca storytelling o caso real.");
  set(8, hay(/(dentro de (un año|12 meses)|imagina|cómo sería|en seis meses|te ves)/i) ? 3 : 2,
    "Se busca proyección al futuro deseado.");
  set(9, 3, "La calidad de la oferta como puente no se puede medir sin lectura semántica.");

  const sil = m.silencio_tras_precio_secs;
  const scorePrecio = m.precio_mencionado_secs == null ? 1 : sil == null ? 3 : sil >= 3 ? 5 : sil >= 2 ? 4 : sil > 0 ? 3 : 2;
  set(10, scorePrecio, m.precio_mencionado_secs == null
    ? "No se detectó que llegara a dar el precio."
    : `Precio en el minuto ${Math.floor(m.precio_mencionado_secs / 60)}:${String(m.precio_mencionado_secs % 60).padStart(2, "0")}; silencio posterior ≈ ${sil ?? "?"}s.`);

  set(20, m.tie_downs_count === 0 ? 2 : m.tie_downs_count <= 2 ? 3 : 4,
    `${m.tie_downs_count} tie-down(s) detectados ("¿me sigues?", "¿tiene sentido?"...).`);

  // C — Cierre
  set(11, m.pidio_cierre ? 4 : 1, m.pidio_cierre ? "Hubo petición directa de cierre." : "No se detectó ninguna petición directa de cierre.");

  const hayValidacion = hay(/(entiendo (que|tu|tú)|lo entiendo|tiene sentido lo que dices|es normal (que sientas|pensar))/i);
  const hayAislamiento = hay(/(es lo único que te (frena|preocupa|detiene)|aparte de (eso|esto)|solo por eso|es la única raz[oó]n)/i);
  set(
    12,
    hayValidacion && hayAislamiento ? 4 : hayValidacion || hayAislamiento ? 3 : 2,
    hayValidacion && hayAislamiento
      ? "Se detectan frases de validación y de aislamiento de la objeción."
      : hayValidacion || hayAislamiento
      ? "Se detecta solo una parte del patrón validar → aislar → responder."
      : "No se detecta ni validación ni aislamiento explícitos de una objeción."
  );

  const RE_PENSARLO = /(me lo (tengo que|voy a) pensar|lo tengo que consultar|necesito pensarlo|lo hablo con)/i;
  const RE_PROFUNDIZA = /(qué es concretamente|qué te genera (esa )?duda|cuéntame (más|qué)|es lo único que te|aparte de eso)/i;
  const RE_CEDE = /(sin problema|tómate tu tiempo|tomate tu tiempo|cuando (lo )?decidas|te dejo pensarlo|cuando quieras me (dices|escribes))/i;
  const idxPensarlo = transcript.findIndex((t) => t.role === "agent" && RE_PENSARLO.test(t.message));
  if (idxPensarlo < 0) {
    set(13, 3, "No se presentó un «me lo tengo que pensar» explícito del prospecto.");
  } else {
    const siguienteDaily = transcript.slice(idxPensarlo + 1).find((t) => t.role === "user");
    const texto = siguienteDaily?.message ?? "";
    if (RE_PROFUNDIZA.test(texto)) set(13, 4, "Tras el «me lo tengo que pensar», Daily siguió indagando el motivo real.");
    else if (RE_CEDE.test(texto)) set(13, 2, "Tras el «me lo tengo que pensar», Daily cedió sin llevarlo al motivo real.");
    else set(13, 3, "Hubo «me lo tengo que pensar», pero la respuesta de Daily no encaja con un patrón claro.");
  }

  set(14, hay(/(plazas|solo quedan|hasta el|este mes|bonus|se acaba)/i) ? 3 : 2,
    "Se busca urgencia o escasez legítima.");

  set(18, m.dos_opciones_detectado ? 4 : 2,
    m.dos_opciones_detectado
      ? "Se detecta una elección entre dos opciones concretas de cierre."
      : "No se detecta que ofreciera dos opciones concretas: parece un sí/no genérico.");

  // I — Implementación
  set(15, hay(/(tarjeta|enlace de pago|depósito|deposito|reserva|primer pago|lo dejamos pagado)/i) ? 3 : 1,
    "Se busca compromiso de pago dentro de la llamada.");
  set(16, m.agendo_siguiente_paso ? 4 : 1,
    m.agendo_siguiente_paso ? "Se detectó una cita concreta antes de colgar." : "No se detectó fecha y hora para el siguiente paso.");
  set(17, m.agendo_siguiente_paso ? 4 : 1,
    m.agendo_siguiente_paso ? "Se detectó cita de seguimiento." : "No se detectó segunda llamada agendada.");

  const tiempo = puntuarDuracion(duracionSegundos);
  set(21, tiempo.score, tiempo.evidencia);

  return { scores, evidencias };
}

function feedbackHeuristico(
  m: MetricasTranscripcion,
  duracionSegundos?: number | null
): Pick<RespuestaLLM, "puntos_fuertes" | "puntos_debiles" | "ejercicio_siguiente" | "resumen"> {
  const fuertes: string[] = [];
  const debiles: string[] = [];

  if (m.ratio_habla != null && m.ratio_habla <= 0.3) fuertes.push("Dejaste hablar al prospecto: tu ratio de habla está dentro del objetivo.");
  else if (m.ratio_habla != null) debiles.push(`Hablaste el ${Math.round(m.ratio_habla * 100)}% del tiempo: el objetivo es ≤30%.`);

  if (m.monologo_mas_largo_secs != null && m.monologo_mas_largo_secs > 60)
    debiles.push(`Tu monólogo más largo duró ~${m.monologo_mas_largo_secs}s. A partir de 60s el prospecto desconecta.`);

  if (m.pidio_cierre) fuertes.push("Pediste la venta de forma directa.");
  else debiles.push("No hubo una petición de cierre clara.");

  if (m.silencio_tras_precio_secs != null && m.silencio_tras_precio_secs >= 3)
    fuertes.push("Sostuviste el silencio después de dar el precio.");
  else if (m.precio_mencionado_secs != null)
    debiles.push("Después del precio no aguantaste el silencio: quien habla primero, pierde.");
  else debiles.push("No llegaste a poner el precio encima de la mesa.");

  if (m.agendo_siguiente_paso) fuertes.push("Cerraste con un siguiente paso concreto.");
  else debiles.push("Colgaste sin fecha ni hora para el siguiente paso.");

  if (m.dos_opciones_detectado) fuertes.push("Ofreciste una elección entre dos opciones concretas de cierre, no un sí/no genérico.");
  else debiles.push("No ofreciste dos opciones de cierre: es el punto marcado como Crítico en la hoja de evaluación.");

  if (duracionSegundos != null) {
    const min = Math.round(duracionSegundos / 60);
    if (min > 60) debiles.push(`La llamada duró ${min} min: se alargó más de lo razonable para una venta 1:1.`);
    else if (min < 8) debiles.push(`La llamada duró solo ${min} min: probablemente no diste tiempo a completar las fases.`);
  }

  const ejercicio = !m.pidio_cierre
    ? "Haz un roleplay entero cuyo único objetivo sea pedir la venta de forma directa antes del minuto 15."
    : m.ratio_habla != null && m.ratio_habla > 0.4
    ? "Roleplay de fase M: no puedes soltar más de dos frases seguidas sin devolver una pregunta."
    : "Tras dar el precio, cuenta 10 segundos en silencio antes de decir nada.";

  return {
    puntos_fuertes: fuertes,
    puntos_debiles: debiles,
    ejercicio_siguiente: ejercicio,
    resumen:
      "Evaluación calculada sólo con las señales medibles de la transcripción (reparto de habla, silencios, cierre y agenda). " +
      "Los ítems que dependen de interpretar lo que dijiste se han dejado en un valor neutro.",
  };
}

function construirPrompt(
  persona: Persona,
  transcript: TranscriptTurn[],
  m: MetricasTranscripcion,
  duracionSegundos?: number | null
): string {
  const rubrica = RUBRICA.map((r) => `${r.id}. [${r.fase} — ${FASE_LABEL[r.fase]}] ${r.texto}`).join("\n");
  const metricas = [
    `- Ratio de habla de Daily: ${m.ratio_habla != null ? `${Math.round(m.ratio_habla * 100)}%` : "desconocido"} (objetivo ≤30%)`,
    `- Monólogo más largo de Daily: ${m.monologo_mas_largo_secs ?? "?"} s`,
    `- Turnos: Daily ${m.turnos_daily} / prospecto ${m.turnos_prospecto}`,
    `- Preguntas de Daily: ${m.preguntas_daily}`,
    `- Precio mencionado en el segundo: ${m.precio_mencionado_secs ?? "nunca"}`,
    `- Silencio sostenido tras el precio: ${m.silencio_tras_precio_secs ?? "?"} s`,
    `- Petición de cierre detectada: ${m.pidio_cierre ? "sí" : "no"}`,
    `- Siguiente paso agendado: ${m.agendo_siguiente_paso ? "sí" : "no"}`,
    `- Dos opciones de cierre detectadas: ${m.dos_opciones_detectado ? "sí" : "no"}`,
    `- Tie-downs detectados: ${m.tie_downs_count}`,
    `- Duración total de la llamada: ${duracionSegundos != null ? `${Math.round(duracionSegundos / 60)} min` : "desconocida"}`,
  ].join("\n");

  return `Eres un coach de ventas que evalúa una llamada de entrenamiento con la metodología MECI (Mapeo, Empuje, Cierre, Implementación) de Top Closing.

DAILY es la comercial que está entrenando. El prospecto es un personaje simulado llamado ${persona.nombre}: ${persona.situacion}
Su dolor real (que Daily debía descubrir) era: ${persona.dolor_real}
Su condición para cerrar era: ${persona.condicion_cierre}

RÚBRICA — puntúa cada ítem de 1 a 5, donde 1 = no lo hizo, 3 = lo intentó de forma incompleta, 5 = lo ejecutó de manual:
${rubrica}

MÉTRICAS OBJETIVAS YA CALCULADAS (no las contradigas, son medidas, no opiniones):
${metricas}

TRANSCRIPCIÓN:
${formatearTranscripcion(transcript, persona.nombre)}

Reglas de evaluación:
- Sé exigente. Un 5 exige evidencia literal en la transcripción.
- Si un ítem no aplica porque la llamada no llegó ahí (p. ej. no hubo cierre), puntúalo bajo, no neutro.
- Cada evidencia debe ser una cita literal breve de la transcripción, o "sin evidencia en la transcripción".
- Escribe todo en español, tuteando a Daily, directo y sin adornos.

Responde SOLO con un objeto JSON válido con esta forma exacta:
{
  "item_scores": { "1": 1-5, ..., "${RUBRICA[RUBRICA.length - 1].id}": 1-5 },
  "evidencias": { "1": "cita o motivo", ..., "${RUBRICA[RUBRICA.length - 1].id}": "..." },
  "puntos_fuertes": ["2-4 frases"],
  "puntos_debiles": ["2-4 frases"],
  "momento_clave_positivo": "dónde ganó la llamada, con cita",
  "momento_clave_negativo": "dónde la perdió, con cita",
  "frase_dolor_real": "frase literal del prospecto que revela su dolor real, o null",
  "ejercicio_siguiente": "un único ejercicio concreto para la próxima sesión",
  "resumen": "3-5 frases de feedback global dirigidas a Daily"
}`;
}

interface CuerpoChatCompletions {
  model: string;
  response_format: { type: "json_object" };
  messages: { role: "user"; content: string }[];
  temperature?: number;
}

async function llamarLLM(prompt: string): Promise<{ respuesta: RespuestaLLM; modelo: string }> {
  const baseUrl = process.env.EVAL_LLM_BASE_URL ?? "https://api.moonshot.ai/v1";
  const apiKey = process.env.EVAL_LLM_API_KEY ?? process.env.MOONSHOT_API_KEY;
  const modelo = process.env.EVAL_LLM_MODEL ?? "kimi-k2-turbo-preview";

  if (!apiKey) throw new Error("Sin EVAL_LLM_API_KEY: no hay modelo para leer la transcripción.");

  // `temperature` va omitido por defecto: los modelos nuevos de OpenAI (gpt-5.x) sólo
  // aceptan el valor por defecto y devuelven 400 con cualquier otro, así que mandar 0.2
  // tumbaba la autoevaluación entera. Sólo se envía si EVAL_LLM_TEMPERATURE trae un
  // número finito, para modelos que sí lo admiten (p. ej. Kimi).
  const temperaturaCruda = process.env.EVAL_LLM_TEMPERATURE?.trim();
  const temperatura = temperaturaCruda ? Number(temperaturaCruda) : NaN;

  const cuerpo: CuerpoChatCompletions = {
    model: modelo,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  };
  if (Number.isFinite(temperatura)) cuerpo.temperature = temperatura;

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(cuerpo),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`El evaluador respondió ${res.status}: ${detalle.slice(0, 200)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const contenido = data.choices?.[0]?.message?.content ?? "";
  const inicio = contenido.indexOf("{");
  const fin = contenido.lastIndexOf("}");
  if (inicio < 0 || fin < inicio) throw new Error("El evaluador no devolvió JSON.");

  return { respuesta: JSON.parse(contenido.slice(inicio, fin + 1)) as RespuestaLLM, modelo };
}

function comoLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  if (typeof valor === "string" && valor.trim()) return [valor.trim()];
  return [];
}

function comoTexto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

export async function evaluarSesion(
  sessionId: string,
  userId: string,
  persona: Persona,
  transcript: TranscriptTurn[],
  duracionSegundos?: number | null
): Promise<AutoEvaluationInput> {
  const metricas = analizarTranscripcion(transcript);
  const respaldo = puntuacionHeuristica(transcript, metricas, duracionSegundos);
  const feedbackBase = feedbackHeuristico(metricas, duracionSegundos);

  let scores = respaldo.scores;
  let evidencias = respaldo.evidencias;
  let feedback: Pick<
    RespuestaLLM,
    "puntos_fuertes" | "puntos_debiles" | "ejercicio_siguiente" | "resumen"
  > = feedbackBase;
  let momentoPositivo: string | null = null;
  let momentoNegativo: string | null = null;
  let fraseDolor: string | null = null;
  let modelo: string | null = null;
  let error: string | null = null;

  if (transcript.length < 2) {
    error = "La transcripción está vacía o es demasiado corta para evaluar la llamada.";
  } else {
    try {
      const { respuesta, modelo: usado } = await llamarLLM(construirPrompt(persona, transcript, metricas, duracionSegundos));
      modelo = usado;

      // Se rellena ítem a ítem: lo que el LLM no devuelva se queda con la heurística.
      scores = { ...respaldo.scores };
      evidencias = { ...respaldo.evidencias };
      for (const item of RUBRICA) {
        const clave = String(item.id);
        const valor = respuesta.item_scores?.[clave];
        if (typeof valor === "number") scores[clave] = clamp(valor);
        const ev = comoTexto(respuesta.evidencias?.[clave]);
        if (ev) evidencias[clave] = ev;
      }

      feedback = {
        puntos_fuertes: comoLista(respuesta.puntos_fuertes).length
          ? comoLista(respuesta.puntos_fuertes)
          : feedbackBase.puntos_fuertes,
        puntos_debiles: comoLista(respuesta.puntos_debiles).length
          ? comoLista(respuesta.puntos_debiles)
          : feedbackBase.puntos_debiles,
        ejercicio_siguiente: comoTexto(respuesta.ejercicio_siguiente) ?? feedbackBase.ejercicio_siguiente,
        resumen: comoTexto(respuesta.resumen) ?? feedbackBase.resumen,
      };
      momentoPositivo = comoTexto(respuesta.momento_clave_positivo);
      momentoNegativo = comoTexto(respuesta.momento_clave_negativo);
      fraseDolor = comoTexto(respuesta.frase_dolor_real);
    } catch (e) {
      // El feedback heurístico ya está preparado: la evaluación sale igual.
      error = e instanceof Error ? e.message : "Fallo desconocido del evaluador.";
    }
  }

  const totales = calcularTotales(scores);

  return {
    session_id: sessionId,
    user_id: userId,
    item_scores: scores,
    evidencias,
    m_score: totales.m,
    e_score: totales.e,
    c_score: totales.c,
    i_score: totales.i,
    total_score: totales.total,
    banda: totales.banda,
    fase_debil: totales.faseDebil,
    metricas,
    puntos_fuertes: feedback.puntos_fuertes,
    puntos_debiles: feedback.puntos_debiles,
    momento_clave_positivo: momentoPositivo,
    momento_clave_negativo: momentoNegativo,
    frase_dolor_real: fraseDolor,
    ejercicio_siguiente: feedback.ejercicio_siguiente,
    resumen: feedback.resumen,
    error,
    modelo,
  };
}
