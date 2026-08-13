import { AutoEvaluation, Fase } from "./types";
import { RUBRICA, FASE_LABEL, FASE_MAX, TOTAL_MAX } from "./rubrica";

const FASES: Fase[] = ["M", "E", "C", "I"];

function segundosATexto(v: number | null | undefined): string {
  if (v == null) return "—";
  const s = Math.round(v);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * Genera y descarga el informe del sistema en PDF. Se carga jsPDF con import
 * dinámico para no meter la librería en el bundle inicial de las páginas que
 * no lo usan (solo se necesita al pulsar "Descargar PDF").
 */
export async function generarInformePDF(auto: AutoEvaluation, nombreProspecto: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margen = 48;
  const anchoUtil = doc.internal.pageSize.getWidth() - margen * 2;
  const altoPagina = doc.internal.pageSize.getHeight();
  let y = margen;

  const salto = (alturaNecesaria = 16) => {
    if (y + alturaNecesaria > altoPagina - margen) {
      doc.addPage();
      y = margen;
    }
  };

  const titulo = (texto: string, tam = 13) => {
    salto(tam + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(tam);
    doc.text(texto, margen, y);
    y += tam + 8;
  };

  const parrafo = (texto: string, tam = 10, negrita = false) => {
    doc.setFont("helvetica", negrita ? "bold" : "normal");
    doc.setFontSize(tam);
    const lineas = doc.splitTextToSize(texto, anchoUtil) as string[];
    for (const linea of lineas) {
      salto(tam + 5);
      doc.text(linea, margen, y);
      y += tam + 5;
    }
  };

  const espacio = (h = 8) => {
    y += h;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Informe del sistema — MECI Top Closing", margen, y);
  y += 22;
  parrafo(`Roleplay con ${nombreProspecto} · generado el ${new Date().toLocaleString("es-ES")}`, 9);
  espacio(6);

  titulo(`Puntuación total: ${auto.total_score} / ${TOTAL_MAX}`, 14);
  parrafo(`Fase más débil: ${FASE_LABEL[auto.fase_debil]}`, 10, true);
  parrafo(auto.banda, 10);
  espacio(6);

  titulo("Desglose por fase");
  for (const f of FASES) {
    const score = auto[`${f.toLowerCase()}_score` as "m_score" | "e_score" | "c_score" | "i_score"];
    parrafo(`${FASE_LABEL[f]} (${f}): ${score} / ${FASE_MAX[f]}`);
  }
  espacio(6);

  const m = auto.metricas;
  if (m) {
    titulo("Métricas objetivas");
    parrafo(`Ratio de habla: ${m.ratio_habla != null ? `${Math.round(m.ratio_habla * 100)}%` : "—"} (objetivo ≤30%)`);
    parrafo(`Monólogo más largo: ${segundosATexto(m.monologo_mas_largo_secs)} (límite 60s)`);
    parrafo(`Preguntas de Daily: ${m.preguntas_daily}`);
    parrafo(`Precio: ${m.precio_mencionado_secs != null ? segundosATexto(m.precio_mencionado_secs) : "no llegó a darlo"}`);
    parrafo(`Silencio sostenido tras el precio: ${segundosATexto(m.silencio_tras_precio_secs)}`);
    parrafo(`Pidió el cierre: ${m.pidio_cierre ? "Sí" : "No"}`);
    parrafo(`Dos opciones de cierre: ${m.dos_opciones_detectado ? "Sí" : "No"}`);
    parrafo(`Tie-downs detectados: ${m.tie_downs_count ?? 0}`);
    parrafo(`Siguiente paso agendado: ${m.agendo_siguiente_paso ? "Sí" : "No"}`);
    espacio(6);

    const totalTiempo = FASES.reduce((s, f) => s + (m.tiempo_por_fase?.[f] ?? 0), 0);
    if (totalTiempo > 0) {
      titulo("Tiempo por fase (estimado por patrones de texto)");
      for (const f of FASES) {
        const segs = m.tiempo_por_fase[f] ?? 0;
        const pct = Math.round((segs / totalTiempo) * 100);
        const objetivo = Math.round((FASE_MAX[f] / TOTAL_MAX) * 100);
        parrafo(`${FASE_LABEL[f]}: ${segundosATexto(segs)} — ${pct}% (objetivo ${objetivo}%)`);
      }
      espacio(6);
    }
  }

  if (auto.puntos_fuertes?.length) {
    titulo("Puntos fuertes");
    auto.puntos_fuertes.forEach((p) => parrafo(`+ ${p}`));
    espacio(6);
  }

  if (auto.puntos_debiles?.length) {
    titulo("Puntos débiles");
    auto.puntos_debiles.forEach((p) => parrafo(`- ${p}`));
    espacio(6);
  }

  if (auto.momento_clave_positivo || auto.momento_clave_negativo || auto.frase_dolor_real) {
    titulo("Momentos clave");
    if (auto.momento_clave_positivo) parrafo(`Ganaste la llamada: ${auto.momento_clave_positivo}`);
    if (auto.momento_clave_negativo) parrafo(`La perdiste (o casi): ${auto.momento_clave_negativo}`);
    if (auto.frase_dolor_real) parrafo(`Dolor real del prospecto: "${auto.frase_dolor_real}"`);
    espacio(6);
  }

  if (auto.ejercicio_siguiente) {
    titulo("Ejercicio para la próxima sesión");
    parrafo(auto.ejercicio_siguiente);
    espacio(6);
  }

  if (auto.resumen) {
    titulo("Resumen");
    parrafo(auto.resumen);
    espacio(6);
  }

  titulo("Detalle por ítem");
  for (const item of RUBRICA) {
    const clave = String(item.id);
    const score = auto.item_scores?.[clave] ?? "—";
    parrafo(`${item.id}. [${item.fase}] ${item.texto} — ${score}/5`, 10, true);
    const evidencia = auto.evidencias?.[clave];
    if (evidencia) parrafo(evidencia, 9);
    espacio(3);
  }

  if (auto.error) {
    espacio(6);
    parrafo(`Nota: el análisis semántico no pudo completarse (${auto.error}). Las métricas objetivas siguen siendo válidas.`, 9);
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const slugProspecto = nombreProspecto.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  doc.save(`informe-meci-${slugProspecto || "prospecto"}-${fecha}.pdf`);
}
