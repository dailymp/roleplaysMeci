import { AutoEvaluation, ContrasteItem, Evaluation } from "./types";
import { RUBRICA } from "./rubrica";

/** Umbral a partir del cual la diferencia deja de ser ruido y merece señalarse. */
export const DESVIO_RELEVANTE = 2;

export function construirContraste(auto: AutoEvaluation, propia: Evaluation): ContrasteItem[] {
  return RUBRICA.map((item) => {
    const clave = String(item.id);
    const a = auto.item_scores?.[clave] ?? null;
    const p = propia.item_scores?.[clave] ?? null;
    return {
      id: item.id,
      fase: item.fase,
      texto: item.texto,
      auto: a,
      propia: p,
      desvio: a != null && p != null ? p - a : null,
      evidencia: auto.evidencias?.[clave] ?? null,
    };
  });
}

export interface ResumenContraste {
  /** propia - auto sobre TOTAL_MAX (lib/rubrica.ts). */
  desvioTotal: number;
  /** Ítems donde se puntuó bastante más alto de lo que respalda la transcripción. */
  sobrevalorados: ContrasteItem[];
  /** Ítems donde fue más dura consigo misma de lo que hacía falta. */
  infravalorados: ContrasteItem[];
  /** Frase de cabecera para la tarjeta de contraste. */
  lectura: string;
}

export function resumirContraste(items: ContrasteItem[], totalAuto: number, totalPropio: number): ResumenContraste {
  const sobrevalorados = items
    .filter((i) => i.desvio != null && i.desvio >= DESVIO_RELEVANTE)
    .sort((a, b) => (b.desvio ?? 0) - (a.desvio ?? 0));
  const infravalorados = items
    .filter((i) => i.desvio != null && i.desvio <= -DESVIO_RELEVANTE)
    .sort((a, b) => (a.desvio ?? 0) - (b.desvio ?? 0));

  const desvioTotal = totalPropio - totalAuto;
  let lectura: string;
  if (Math.abs(desvioTotal) <= 5) {
    lectura = "Tu lectura de la llamada coincide con la del sistema. Puedes fiarte de tu criterio.";
  } else if (desvioTotal > 0) {
    lectura = `Te has puesto ${desvioTotal} puntos por encima de lo que respalda la transcripción. Mira los ítems marcados: ahí es donde te estás perdonando.`;
  } else {
    lectura = `Te has puesto ${Math.abs(desvioTotal)} puntos por debajo del sistema. Estás siendo más dura contigo de lo que dice la llamada.`;
  }

  return { desvioTotal, sobrevalorados, infravalorados, lectura };
}
