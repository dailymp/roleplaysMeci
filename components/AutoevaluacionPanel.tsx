"use client";

import { useState } from "react";
import { AutoEvaluation } from "@/lib/types";
import { RUBRICA, FASE_COLOR, FASE_MAX, TOTAL_MAX, bandaColor } from "@/lib/rubrica";

const FASES = ["M", "E", "C", "I"] as const;

function segundos(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v < 60) return `${v}s`;
  return `${Math.floor(v / 60)}m ${v % 60}s`;
}

/** Los hechos medidos en la transcripción. No dependen del LLM, se muestran siempre. */
export function MetricasPanel({ auto }: { auto: AutoEvaluation }) {
  const m = auto.metricas;
  if (!m) return null;
  return (
    <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
      <Metrica
        label="Tu ratio de habla"
        valor={m.ratio_habla != null ? `${Math.round(m.ratio_habla * 100)}%` : "—"}
        nota="objetivo ≤30%"
        malo={m.ratio_habla != null && m.ratio_habla > 0.3}
      />
      <Metrica
        label="Monólogo más largo"
        valor={segundos(m.monologo_mas_largo_secs)}
        nota="límite 60s"
        malo={m.monologo_mas_largo_secs != null && m.monologo_mas_largo_secs > 60}
      />
      <Metrica label="Preguntas que hiciste" valor={String(m.preguntas_daily)} nota="mínimo 3 indagaciones" malo={m.preguntas_daily < 3} />
      <Metrica
        label="Precio"
        valor={m.precio_mencionado_secs != null ? segundos(m.precio_mencionado_secs) : "no llegaste"}
        nota="momento de la llamada"
        malo={m.precio_mencionado_secs == null}
      />
      <Metrica
        label="Silencio tras el precio"
        valor={segundos(m.silencio_tras_precio_secs)}
        nota="objetivo 3-4s"
        malo={m.silencio_tras_precio_secs == null || m.silencio_tras_precio_secs < 3}
      />
      <Metrica
        label="Pediste el cierre"
        valor={m.pidio_cierre ? "Sí" : "No"}
        nota={m.agendo_siguiente_paso ? "con siguiente paso agendado" : "sin siguiente paso"}
        malo={!m.pidio_cierre}
      />
      <Metrica
        label="Dos opciones de cierre"
        valor={m.dos_opciones_detectado ? "Sí" : "No"}
        nota="crítico en la hoja MECI"
        malo={!m.dos_opciones_detectado}
      />
      <Metrica
        label="Tie-downs"
        valor={String(m.tie_downs_count ?? 0)}
        nota={'"¿me sigues?", "¿tiene sentido?"...'}
        malo={!m.tie_downs_count}
      />
    </div>
  );
}

function Metrica({ label, valor, nota, malo }: { label: string; valor: string; nota: string; malo: boolean }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: malo ? "#d03b3b12" : "#0ca30c12" }}>
      <p className="text-muted">{label}</p>
      <p className="text-sm font-bold" style={{ color: malo ? "#d03b3b" : "#0ca30c" }}>
        {valor}
      </p>
      <p className="text-[10px] text-muted">{nota}</p>
    </div>
  );
}

interface Props {
  auto: AutoEvaluation;
  /** En la página de autoevaluación se oculta la puntuación para no condicionarla. */
  puntuacionOculta?: boolean;
}

export default function AutoevaluacionPanel({ auto, puntuacionOculta = false }: Props) {
  const [abierto, setAbierto] = useState(!puntuacionOculta);
  const [detalle, setDetalle] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold">Análisis del sistema</h2>
          <p className="mt-1 text-xs text-muted">
            {auto.modelo
              ? `Leído de la transcripción · ${auto.modelo}`
              : "Calculado sólo con las señales medibles de la transcripción"}
          </p>
        </div>
        {!puntuacionOculta && (
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: bandaColor(auto.total_score) }}>
              {auto.total_score}
              <span className="text-sm text-muted"> / {TOTAL_MAX}</span>
            </p>
          </div>
        )}
      </div>

      {auto.error && (
        <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-ink-secondary">
          El análisis semántico no pudo completarse ({auto.error}). Las métricas de abajo siguen siendo válidas.
        </p>
      )}

      <div className="mt-4">
        <MetricasPanel auto={auto} />
      </div>

      {puntuacionOculta && !abierto && (
        <button onClick={() => setAbierto(true)} className="btn-secondary mt-4 w-full text-xs">
          Ver la puntuación del sistema (mejor después de puntuarte tú)
        </button>
      )}

      {abierto && (
        <>
          {puntuacionOculta && (
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-xs text-muted">El sistema te pone</p>
              <p className="text-xl font-bold" style={{ color: bandaColor(auto.total_score) }}>
                {auto.total_score} <span className="text-sm text-muted">/ {TOTAL_MAX}</span>
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-4 gap-2">
            {FASES.map((f) => (
              <div key={f} className="rounded-lg border border-hairline p-2 text-center">
                <p className="text-xs font-bold" style={{ color: FASE_COLOR[f] }}>
                  {f}
                </p>
                <p className="text-sm font-bold">
                  {auto[`${f.toLowerCase()}_score` as "m_score" | "e_score" | "c_score" | "i_score"]}/{FASE_MAX[f]}
                </p>
                {auto.fase_debil === f && <p className="mt-1 text-[10px] font-semibold text-critical">más débil</p>}
              </div>
            ))}
          </div>

          {auto.resumen && <p className="mt-4 text-sm text-ink-secondary">{auto.resumen}</p>}

          {auto.puntos_fuertes?.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {auto.puntos_fuertes.map((p, i) => (
                <li key={i} className="text-ink-secondary">
                  <span className="font-semibold text-good">+ </span>
                  {p}
                </li>
              ))}
            </ul>
          )}

          {auto.puntos_debiles?.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {auto.puntos_debiles.map((p, i) => (
                <li key={i} className="text-ink-secondary">
                  <span className="font-semibold text-critical">− </span>
                  {p}
                </li>
              ))}
            </ul>
          )}

          {(auto.momento_clave_positivo || auto.momento_clave_negativo || auto.frase_dolor_real) && (
            <div className="mt-4 rounded-lg border border-hairline p-3 text-sm">
              {auto.momento_clave_positivo && (
                <p>
                  <span className="font-semibold text-good">✅ </span>
                  {auto.momento_clave_positivo}
                </p>
              )}
              {auto.momento_clave_negativo && (
                <p className="mt-2">
                  <span className="font-semibold text-critical">❌ </span>
                  {auto.momento_clave_negativo}
                </p>
              )}
              {auto.frase_dolor_real && (
                <p className="mt-2 italic text-ink-secondary">💬 &quot;{auto.frase_dolor_real}&quot;</p>
              )}
            </div>
          )}

          {auto.ejercicio_siguiente && (
            <div className="mt-4 rounded-lg border border-fase-e/30 bg-fase-e/5 p-3">
              <p className="text-xs font-bold">🎯 Ejercicio que propone el sistema</p>
              <p className="mt-1 text-sm text-ink-secondary">{auto.ejercicio_siguiente}</p>
            </div>
          )}

          <button onClick={() => setDetalle((v) => !v)} className="mt-4 text-xs font-bold">
            {detalle ? "Ocultar detalle por ítem ▲" : "Ver detalle por ítem con evidencias ▼"}
          </button>

          {detalle && (
            <div className="mt-3 flex flex-col gap-2">
              {RUBRICA.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 border-b border-hairline pb-2 text-xs">
                  <div>
                    <p className="text-ink-secondary">{item.texto}</p>
                    {auto.evidencias?.[String(item.id)] && (
                      <p className="mt-1 italic text-muted">{auto.evidencias[String(item.id)]}</p>
                    )}
                  </div>
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md font-bold text-white"
                    style={{ backgroundColor: FASE_COLOR[item.fase] }}
                  >
                    {auto.item_scores?.[String(item.id)] ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
