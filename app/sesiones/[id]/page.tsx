"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RoleplaySession, Evaluation, Persona, Objecion, AutoEvaluation } from "@/lib/types";
import { RUBRICA, FASE_LABEL, FASE_COLOR, FASE_MAX, TOTAL_MAX, bandaColor } from "@/lib/rubrica";
import { construirContraste, resumirContraste, type ResumenContraste } from "@/lib/contraste";
import type { ContrasteItem } from "@/lib/types";
import AutoevaluacionPanel from "@/components/AutoevaluacionPanel";

const FASES = ["M", "E", "C", "I"] as const;

export default function SesionDetallePage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<RoleplaySession | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [auto, setAuto] = useState<AutoEvaluation | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: s } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      if (s) {
        setSession(s as RoleplaySession);
        const { data: p } = await supabase.from("personas").select("*").eq("id", s.persona_id).single();
        setPersona(p as Persona);
      }
      const { data: e } = await supabase.from("evaluations").select("*").eq("session_id", sessionId).maybeSingle();
      setEvaluation(e as Evaluation | null);
      const { data: a } = await supabase
        .from("auto_evaluations")
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();
      setAuto(a as AutoEvaluation | null);
      setLoading(false);
    })();
  }, [sessionId]);

  if (loading) return <p className="text-sm text-muted">Cargando…</p>;
  if (!session) return <p className="text-sm text-critical">No se encontró la sesión.</p>;

  let objeciones: Objecion[] = [];
  try {
    objeciones = evaluation?.notas ? JSON.parse(evaluation.notas) : [];
  } catch {
    objeciones = [];
  }

  let contraste: ContrasteItem[] | null = null;
  let resumen: ResumenContraste | null = null;
  if (auto && evaluation) {
    contraste = construirContraste(auto, evaluation);
    resumen = resumirContraste(contraste, auto.total_score, evaluation.total_score);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        {persona && (
          <span className="tag" style={{ backgroundColor: `${persona.color}1a`, color: persona.color }}>
            {persona.nombre}
          </span>
        )}
        <span className="text-xs text-muted">
          {new Date(session.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
        </span>
      </div>

      {auto && (
        <div className="mt-4">
          <AutoevaluacionPanel auto={auto} nombreProspecto={persona?.nombre} />
        </div>
      )}

      {!evaluation ? (
        <div className="card mt-4 p-8 text-center">
          <p className="text-sm text-ink-secondary">
            {auto
              ? "Falta tu autoevaluación. Puntúate y el sistema te dirá dónde tu lectura y la suya no coinciden."
              : "Esta sesión aún no tiene evaluación."}
          </p>
          <a href={`/roleplay/${sessionId}/evaluar`} className="btn-primary mt-4 inline-block">
            Autoevaluarme
          </a>
        </div>
      ) : (
        <>
          <div className="card mt-4 p-6 text-center">
            <p className="text-xs text-muted">Tu puntuación</p>
            <p className="text-4xl font-bold" style={{ color: bandaColor(evaluation.total_score) }}>
              {evaluation.total_score} <span className="text-lg text-muted">/ {TOTAL_MAX}</span>
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs text-ink-secondary">{evaluation.banda}</p>
          </div>

          {contraste && resumen && (
            <div className="card mt-4 p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-sm font-bold">Tú vs. el sistema</h2>
                <p className="text-sm font-bold" style={{ color: Math.abs(resumen.desvioTotal) <= 5 ? "#0ca30c" : "#eb6834" }}>
                  {resumen.desvioTotal > 0 ? "+" : ""}
                  {resumen.desvioTotal} pts
                </p>
              </div>
              <p className="mt-2 text-sm text-ink-secondary">{resumen.lectura}</p>

              {resumen.sobrevalorados.length > 0 && (
                <>
                  <p className="mt-4 text-xs font-bold text-critical">Donde te perdonaste</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {resumen.sobrevalorados.map((i) => (
                      <FilaContraste key={i.id} item={i} />
                    ))}
                  </div>
                </>
              )}

              {resumen.infravalorados.length > 0 && (
                <>
                  <p className="mt-4 text-xs font-bold text-good">Donde fuiste más dura de la cuenta</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {resumen.infravalorados.map((i) => (
                      <FilaContraste key={i.id} item={i} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-4 gap-2">
            {FASES.map((f) => (
              <div key={f} className="card p-3 text-center">
                <p className="text-xs font-bold" style={{ color: FASE_COLOR[f] }}>
                  {f}
                </p>
                <p className="text-sm font-bold">
                  {evaluation[`${f.toLowerCase()}_score` as keyof Evaluation] as number}/{FASE_MAX[f]}
                </p>
                {evaluation.fase_debil === f && <p className="mt-1 text-[10px] font-semibold text-critical">más débil</p>}
              </div>
            ))}
          </div>

          <div className="card mt-4 p-5">
            <h2 className="text-sm font-bold">🚨 Vigilancia DailyMP</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <VigilanciaFlag label="Sobreexplicó" value={evaluation.sobreexplico} bad />
              <VigilanciaFlag label="Pidió el cierre" value={evaluation.pidio_cierre} />
              <VigilanciaFlag label="Sostuvo el silencio" value={evaluation.sostuvo_silencio} />
              <VigilanciaFlag label="Dos opciones" value={evaluation.dos_opciones} />
            </div>
          </div>

          {(evaluation.momento_clave_positivo || evaluation.momento_clave_negativo || evaluation.frase_dolor_real) && (
            <div className="card mt-4 p-5 text-sm">
              <h2 className="text-sm font-bold">Momentos clave</h2>
              {evaluation.momento_clave_positivo && (
                <p className="mt-3">
                  <span className="font-semibold text-good">✅ </span>
                  {evaluation.momento_clave_positivo}
                </p>
              )}
              {evaluation.momento_clave_negativo && (
                <p className="mt-2">
                  <span className="font-semibold text-critical">❌ </span>
                  {evaluation.momento_clave_negativo}
                </p>
              )}
              {evaluation.frase_dolor_real && (
                <p className="mt-2 italic text-ink-secondary">💬 "{evaluation.frase_dolor_real}"</p>
              )}
            </div>
          )}

          {objeciones.length > 0 && (
            <div className="card mt-4 p-5">
              <h2 className="text-sm font-bold">Objeciones</h2>
              <div className="mt-3 flex flex-col gap-3 text-sm">
                {objeciones.map((o, i) => (
                  <div key={i} className="rounded-lg border border-hairline p-3">
                    <p className="font-semibold">"{o.objecion}"</p>
                    <p className="mt-1 text-ink-secondary">{o.manejo}</p>
                    <p className={`mt-1 text-xs font-semibold ${o.vac ? "text-good" : "text-critical"}`}>
                      {o.vac ? "✓ Validó → Aisló → Respondió" : "✗ No siguió el patrón Validó → Aisló → Respondió"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {evaluation.ejercicio_siguiente && (
            <div className="card mt-4 border-fase-e/30 bg-fase-e/5 p-5">
              <h2 className="text-sm font-bold">🎯 Ejercicio para la próxima sesión</h2>
              <p className="mt-2 text-sm text-ink-secondary">{evaluation.ejercicio_siguiente}</p>
            </div>
          )}

          <div className="card mt-4 p-5">
            <h2 className="text-sm font-bold">Detalle por ítem</h2>
            <div className="mt-3 flex flex-col gap-2">
              {RUBRICA.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                  <p className="text-ink-secondary">{item.texto}</p>
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md font-bold text-white"
                    style={{ backgroundColor: FASE_COLOR[item.fase] }}
                  >
                    {evaluation.item_scores[String(item.id)] ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {session.transcript && session.transcript.length > 0 && (
        <div className="card mt-4 p-5">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="text-sm font-bold"
          >
            {showTranscript ? "Ocultar transcripción ▲" : "Ver transcripción ▼"}
          </button>
          {showTranscript && (
            <div className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto text-xs">
              {session.transcript.map((t, i) => (
                <p key={i} className={t.role === "user" ? "text-ink" : "text-ink-secondary"}>
                  <span className="font-semibold">{t.role === "user" ? "Daily: " : `${persona?.nombre ?? "Prospecto"}: `}</span>
                  {t.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilaContraste({ item }: { item: ContrasteItem }) {
  return (
    <div className="rounded-lg border border-hairline p-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-secondary">{item.texto}</p>
        <p className="flex-shrink-0 font-bold">
          <span className="text-muted">tú </span>
          {item.propia}
          <span className="text-muted"> · sistema </span>
          <span style={{ color: FASE_COLOR[item.fase] }}>{item.auto}</span>
        </p>
      </div>
      {item.evidencia && <p className="mt-1 italic text-muted">{item.evidencia}</p>}
    </div>
  );
}

function VigilanciaFlag({ label, value, bad }: { label: string; value: boolean | null; bad?: boolean }) {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-hairline/50 px-3 py-2">
        <span className="text-ink-secondary">{label}</span>
        <span className="text-muted">—</span>
      </div>
    );
  }
  const positive = bad ? !value : value;
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: positive ? "#0ca30c1a" : "#d03b3b1a" }}>
      <span className="text-ink-secondary">{label}</span>
      <span className="font-bold" style={{ color: positive ? "#0ca30c" : "#d03b3b" }}>
        {value ? "Sí" : "No"}
      </span>
    </div>
  );
}
