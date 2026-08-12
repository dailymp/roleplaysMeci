import { Fase } from "./types";

export interface RubricaItem {
  id: number;
  fase: Fase;
  texto: string;
}

// Rúbrica oficial MECI™ Top Closing — 17 ítems, extraída de
// CUESTIONARIO_AUTOEVALUACION_MECI_DailyMP.pdf
export const RUBRICA: RubricaItem[] = [
  { id: 1, fase: "M", texto: "Rompí el hielo y generé confianza en los primeros 2 minutos (sin ir directa a vender)." },
  { id: 2, fase: "M", texto: "Tomé el control del marco: expliqué agenda, duración y qué pasaría al final." },
  { id: 3, fase: "M", texto: "Descubrí su situación actual con preguntas abiertas (hablé menos del 30% del tiempo)." },
  { id: 4, fase: "M", texto: "Identifiqué su dolor real (no el superficial) y lo verbalizó con sus palabras. Mínimo 3 indagaciones." },
  { id: 5, fase: "M", texto: "Detecté su nivel de consciencia (¿sabe que tiene el problema? ¿conoce soluciones?)." },
  { id: 6, fase: "E", texto: "Amplifiqué el coste de no actuar (qué pierde cada mes que pasa)." },
  { id: 7, fase: "E", texto: "Usé storytelling o un caso real para activar el cerebro límbico (emoción antes que lógica)." },
  { id: 8, fase: "E", texto: "Pinté la visión del futuro deseado y se proyectó en ella (\"¿cómo sería tu vida en 12 meses?\")." },
  { id: 9, fase: "E", texto: "Presenté la oferta como puente entre dolor y meta (resultados, no lista de servicios/herramientas)." },
  { id: 10, fase: "E", texto: "Di el precio con seguridad, sin justificarme ni bajar la voz, y después guardé silencio." },
  { id: 11, fase: "C", texto: "Pedí la venta de forma directa y clara (no esperé a que el cliente se ofreciera)." },
  { id: 12, fase: "C", texto: "Ante cada objeción: validé, aislé (\"¿es lo único que te frena?\") y respondí sin discutir." },
  { id: 13, fase: "C", texto: "Mantuve la calma con el «me lo tengo que pensar» y llevé la objeción al motivo real." },
  { id: 14, fase: "C", texto: "Usé urgencia o escasez legítima (plazas, bonus, precio) sin sonar agresiva." },
  { id: 15, fase: "I", texto: "Si cerré: cobré o dejé el pago/depósito comprometido EN la llamada (no \"te paso el enlace luego\")." },
  { id: 16, fase: "I", texto: "Agendé el siguiente paso concreto (bienvenida/onboarding) con fecha y hora antes de colgar." },
  { id: 17, fase: "I", texto: "Si NO cerré: agendé segunda llamada con fecha y hora, y dejé una razón para volver." },
];

export const FASE_LABEL: Record<Fase, string> = {
  M: "Mapeo",
  E: "Empuje",
  C: "Cierre",
  I: "Implementación",
};

export const FASE_MAX: Record<Fase, number> = { M: 25, E: 25, C: 20, I: 15 };
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

  let banda: string;
  if (total >= 68) banda = "Dominas la estructura. Céntrate en matices: silencios, tonalidad, urgencia elegante.";
  else if (total >= 50) banda = "Buena base. Localiza tu fase más débil y practícala aislada esta semana.";
  else if (total >= 34) banda = "Usas trozos del método, no el método. Vuelve al guión v2 y hazlo con él delante.";
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
  if (total >= 68) return "#0ca30c"; // good
  if (total >= 50) return "#fab219"; // warning
  if (total >= 34) return "#ec835a"; // serious
  return "#d03b3b"; // critical
}
