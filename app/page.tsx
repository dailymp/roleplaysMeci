"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Evaluation, RoleplaySession } from "@/lib/types";
import { FASE_LABEL, bandaColor } from "@/lib/rubrica";
import EvolutionChart, { EvolutionPoint } from "@/components/EvolutionChart";

export default function DashboardPage() {
  const [evaluations, setEvaluations] = useState<(Evaluation & { created_at: string })[]>([]);
  const [sessions, setSessions] = useState<RoleplaySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: evals } = await supabase
        .from("evaluations")
        .select("*")
        .order("created_at", { ascending: true });
      const { data: sess } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });
      setEvaluations((evals ?? []) as any);
      setSessions((sess ?? []) as RoleplaySession[]);
      setLoading(false);
    })();
  }, []);

  const chartData: EvolutionPoint[] = useMemo(
    () =>
      evaluations.slice(-12).map((e) => ({
        fecha: e.created_at,
        m: e.m_score,
        e: e.e_score,
        c: e.c_score,
        i: e.i_score,
      })),
    [evaluations]
  );

  const ultima = evaluations[evaluations.length - 1];
  const penultima = evaluations[evaluations.length - 2];

  const faseDebilRepetida =
    ultima && penultima && ultima.fase_debil === penultima.fase_debil ? ultima.fase_debil : null;

  const sesionesEstaSemana = useMemo(() => {
    const unaSemanaAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return sessions.filter((s) => new Date(s.created_at).getTime() >= unaSemanaAtras).length;
  }, [sessions]);

  const promedioReciente = useMemo(() => {
    const ult5 = evaluations.slice(-5);
    if (!ult5.length) return null;
    return Math.round(ult5.reduce((s, e) => s + e.total_score, 0) / ult5.length);
  }, [evaluations]);

  if (loading) return <p className="text-sm text-muted">Cargando…</p>;

  if (sessions.length === 0) {
    return (
      <div className="card p-10 text-center">
        <h1 className="text-lg font-bold">Bienvenida a tu entrenador MECI</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-secondary">
          Practica llamadas de venta con prospectos de voz realistas y evalúate con la rúbrica oficial de Top
          Closing. Empieza tu primer roleplay.
        </p>
        <Link href="/roleplay" className="btn-primary mt-5 inline-block">
          Empezar mi primer roleplay
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Tu progreso</h1>
        <Link href="/roleplay" className="btn-primary">
          Nuevo roleplay
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Sesiones totales" value={String(sessions.length)} />
        <StatTile
          label="Esta semana"
          value={`${sesionesEstaSemana} / 5`}
          tone={sesionesEstaSemana >= 5 ? "good" : sesionesEstaSemana > 0 ? "warning" : "critical"}
        />
        <StatTile
          label="Promedio (últimas 5)"
          value={promedioReciente != null ? `${promedioReciente}/85` : "—"}
          tone={promedioReciente != null ? undefined : undefined}
          color={promedioReciente != null ? bandaColor(promedioReciente) : undefined}
        />
        <StatTile
          label="Fase más débil"
          value={ultima ? FASE_LABEL[ultima.fase_debil] : "—"}
        />
      </div>

      {faseDebilRepetida && (
        <div className="card mt-4 border-critical/30 bg-critical/5 p-4 text-sm">
          <p className="font-bold text-critical">Regla de oro DailyMP</p>
          <p className="mt-1 text-ink-secondary">
            <strong>{FASE_LABEL[faseDebilRepetida]}</strong> ha sido tu fase más débil dos veces seguidas. Practícala
            aislada esta semana con <code className="rounded bg-hairline px-1">solo fase {faseDebilRepetida}</code>.
          </p>
        </div>
      )}

      <div className="card mt-4 p-5">
        <h2 className="text-sm font-bold">Evolución por fase (% de su máximo)</h2>
        <div className="mt-4">
          <EvolutionChart data={chartData} />
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Últimas sesiones</h2>
          <Link href="/sesiones" className="text-xs font-semibold text-ink-secondary hover:text-ink">
            Ver todas →
          </Link>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {sessions.slice(0, 5).map((s) => (
            <Link key={s.id} href={`/sesiones/${s.id}`} className="card flex items-center justify-between p-3 text-sm hover:border-ink">
              <span className="text-ink-secondary">
                {new Date(s.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
              </span>
              <span className="tag bg-hairline text-ink-secondary">
                {s.status === "evaluada" ? "Evaluada" : s.status === "finalizada" ? "Sin evaluar" : "En curso"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  color,
}: {
  label: string;
  value: string;
  tone?: "good" | "warning" | "critical";
  color?: string;
}) {
  const toneColor = tone === "good" ? "#0ca30c" : tone === "warning" ? "#fab219" : tone === "critical" ? "#d03b3b" : undefined;
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold" style={{ color: color ?? toneColor }}>
        {value}
      </p>
    </div>
  );
}
