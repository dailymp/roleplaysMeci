import { Fase } from "./types";

export interface RubricaItem {
  id: number;
  fase: Fase;
  texto: string;
}

// Rúbrica oficial MECI™ Top Closing — 17 ítems base extraídos de
// CUESTIONARIO_AUTOEVALUACION_MECI_DailyMP.pdf, más 4 ítems (18-21) añadidos
// tras contrastar contra la hoja madre "QA - Top Closing" (23-25 ítems): esa
// hoja marca "dos opciones de cierre" como Crítico y mide manejo del tiempo,
// tie-downs y control sostenido de la llamada, ninguno de los cuales se
// puntuaba antes aunque parte de esos datos (duration_seconds, el checkbox
// subjetivo "¿Presenté dos opciones?") ya existían sin usarse para puntuar.
export const RUBRICA: RubricaItem[] = [
  { id: 1, fase: "M", texto: "Rompí el hielo y generé confianza en los primeros 2 minutos (sin ir directa a vender)." },
  { id: 2, fase: "M", texto: "Tomé el control del marco: expliqué agenda, duración y qué pasaría al final." },
  { id: 3, fase: "M", texto: "Descubrí su situación actual con preguntas abiertas (hablé menos del 30% del tiempo)." },
  { id: 4, fase: "M", texto: "Identifiqué su dolor real (no el superficial) y lo verbalizó con sus palabras. Mínimo 3 indagaciones." },
  { id: 5, fase: "M", texto: "Detecté su nivel de consciencia (¿sabe que tiene el problema? ¿conoce soluciones?)." },
  { id: 19, fase: "M", texto: "Mantuve el control de la llamada de principio a fin, no solo al arrancarla (redirigí, resumí, marqué el siguiente paso)." },
  { id: 6, fase: "E", texto: "Amplifiqué el coste de no actuar (qué pierde cada mes que pasa)." },
  { id: 7, fase: "E", texto: "Usé storytelling o un caso real para activar el cerebro límbico (emoción antes que lógica)." },
  { id: 8, fase: "E", texto: "Pinté la visión del futuro deseado y se proyectó en ella (\"¿cómo sería tu vida en 12 meses?\")." },
  { id: 9, fase: "E", texto: "Presenté la oferta como puente entre dolor y meta (resultados, no lista de servicios/herramientas)." },
  { id: 10, fase: "E", texto: "Di el precio con seguridad, sin justificarme ni bajar la voz, y después guardé silencio." },
  { id: 20, fase: "E", texto: "Usé tie-downs (\"¿me sigues?\", \"¿tiene sentido?\") para comprobar que seguía alineado antes de avanzar." },
  { id: 11, fase: "C", texto: "Pedí la venta de forma directa y clara (no esperé a que el cliente se ofreciera)." },
  { id: 12, fase: "C", texto: "Ante cada objeción: validé, aislé (\"¿es lo único que te frena?\") y respondí sin discutir." },
  { id: 13, fase: "C", texto: "Mantuve la calma con el «me lo tengo que pensar» y llevé la objeción al motivo real." },
  { id: 14, fase: "C", texto: "Usé urgencia o escasez legítima (plazas, bonus, precio) sin sonar agresiva." },
  { id: 18, fase: "C", texto: "Ofrecí dos opciones concretas de cierre (no un sí/no genérico) y dejé que eligiera entre ellas." },
  { id: 15, fase: "I", texto: "Si cerré: cobré o dejé el pago/depósito comprometido EN la llamada (no \"te paso el enlace luego\")." },
  { id: 16, fase: "I", texto: "Agendé el siguiente paso concreto (bienvenida/onboarding) con fecha y hora antes de colgar." },
  { id: 17, fase: "I", texto: "Si NO cerré: agendé segunda llamada con fecha y hora, y dejé una razón para volver." },
  { id: 21, fase: "I", texto: "Manejé bien el tiempo: ni corté la llamada antes de completar las fases, ni la alargué de más." },
];

export const FASE_LABEL: Record<Fase, string> = {
  M: "Mapeo",
  E: "Empuje",
  C: "Cierre",
  I: "Implementación",
};

export const FASE_MAX: Record<Fase, number> = { M: 30, E: 30, C: 25, I: 20 };

/** Suma de FASE_MAX: el total posible, derivado de la rúbrica en vez de hardcodeado en cada pantalla. */
export const TOTAL_MAX = Object.values(FASE_MAX).reduce((a, b) => a + b, 0);
export const FASE_COLOR: Record<Fase, string> = {
  M: "#2a78d6",
  E: "#eb6834",
  C: "#1baf7a",
  I: "#eda100",
};

export function faseDeItems(items: Record<string, number>, fase: Fase): number {
  return RUBRICA.filter((r) => r.fase === fase).reduce(
    (sum, r) => sum + (items[String(r.id)] ?? 0),
    0
  );
}

export interface Totales {
  m: number;
  e: number;
  c: number;
  i: number;
  total: number;
  banda: string;
  faseDebil: Fase;
}

export function calcularTotales(items: Record<string, number>): Totales {
  const m = faseDeItems(items, "M");
  const e = faseDeItems(items, "E");
  const c = faseDeItems(items, "C");
  const i = faseDeItems(items, "I");
  const total = m + e + c + i;

  // Umbrales proporcionales a los originales (68/50/34 sobre un máximo de 85 = 80% / 58,8% / 40%),
  // recalculados sobre TOTAL_MAX tras ampliar la rúbrica de 17 a 21 ítems.
  let banda: string;
  if (total >= 84) banda = "Dominas la estructura. Céntrate en matices: silencios, tonalidad, urgencia elegante.";
  else if (total >= 62) banda = "Buena base. Localiza tu fase más débil y practícala aislada esta semana.";
  else if (total >= 42) banda = "Usas trozos del método, no el método. Vuelve al guión v2 y hazlo con él delante.";
  else banda = "Todavía improvisas. 3 roleplays seguidos solo de fase M antes de la próxima llamada real.";

  const porcentajes: Record<Fase, number> = {
    M: m / FASE_MAX.M,
    E: e / FASE_MAX.E,
    C: c / FASE_MAX.C,
    I: i / FASE_MAX.I,
  };
  const faseDebil = (Object.keys(porcentajes) as Fase[]).reduce((min, f) =>
    porcentajes[f] < porcentajes[min] ? f : min
  , "M" as Fase);

  return { m, e, c, i, total, banda, faseDebil };
}

export function bandaColor(total: number): string {
  if (total >= 84) return "#0ca30c"; // good
  if (total >= 62) return "#fab219"; // warning
  if (total >= 42) return "#ec835a"; // serious
  return "#d03b3b"; // critical
}
