"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { bandaColor } from "@/lib/rubrica";

interface Row {
  id: string;
  persona_nombre: string;
  persona_color: string;
  created_at: string;
  status: string;
  total_score: number | null;
}

export default function SesionesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // Cierra por servidor las sesiones que quedaron colgadas al cerrar la pestaña.
      await fetch("/api/session/cleanup", { method: "POST" }).catch(() => undefined);

      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, created_at, status, persona_id")
        .order("created_at", { ascending: false });

      const { data: personas } = await supabase.from("personas").select("id, nombre, color");
      const { data: evals } = await supabase.from("evaluations").select("session_id, total_score");

      const personaMap = new Map((personas ?? []).map((p) => [p.id, p]));
      const evalMap = new Map((evals ?? []).map((e) => [e.session_id, e.total_score]));

      setRows(
        (sessions ?? []).map((s) => ({
          id: s.id,
          persona_nombre: personaMap.get(s.persona_id)?.nombre ?? "—",
          persona_color: personaMap.get(s.persona_id)?.color ?? "#898781",
          created_at: s.created_at,
          status: s.status,
          total_score: evalMap.get(s.id) ?? null,
        }))
      );
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Tus sesiones</h1>
      <p className="mt-1 text-sm text-ink-secondary">Historial de roleplays y evaluaciones.</p>

      {loading && <p className="mt-6 text-sm text-muted">Cargando…</p>}
      {!loading && rows.length === 0 && (
        <div className="card mt-6 p-8 text-center">
          <p className="text-sm text-ink-secondary">Aún no tienes roleplays. Empieza el primero.</p>
          <Link href="/roleplay" className="btn-primary mt-4 inline-block">
            Practicar ahora
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/sesiones/${r.id}`}
            className="card flex items-center justify-between p-4 transition hover:border-ink"
          >
            <div className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: r.persona_color }}
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold">{r.persona_nombre}</p>
                <p className="text-xs text-muted">
                  {new Date(r.created_at).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {r.status !== "evaluada" ? (
                <span className="tag bg-hairline text-ink-secondary">
                  {r.status === "en_curso" ? "En curso" : "Sin evaluar"}
                </span>
              ) : (
                <span
                  className="tag"
                  style={{
                    backgroundColor: `${bandaColor(r.total_score ?? 0)}1a`,
                    color: bandaColor(r.total_score ?? 0),
                  }}
                >
                  {r.total_score} / 85
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
