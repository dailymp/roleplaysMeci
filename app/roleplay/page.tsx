"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Persona, Modo } from "@/lib/types";

const DIFICULTAD_LABEL: Record<string, string> = {
  facil: "Fácil",
  media: "Media",
  dificil: "Difícil",
};

const MODOS: { value: Modo; label: string; desc: string }[] = [
  { value: "completo", label: "Llamada completa", desc: "De la apertura al cierre o despedida" },
  { value: "solo_M", label: "Solo Mapeo", desc: "Romper el hielo + indagar el dolor" },
  { value: "solo_E", label: "Solo Empuje", desc: "Visión, storytelling y precio" },
  { value: "solo_C", label: "Solo Cierre", desc: "Silencio, objeciones y pedir la venta" },
  { value: "solo_I", label: "Solo Implementación", desc: "Cobro, agenda y seguimiento" },
];

export default function RoleplayPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>("completo");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("personas")
      .select("*")
      .order("orden")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setPersonas(data as Persona[]);
        setLoading(false);
      });
  }, []);

  async function empezar() {
    if (!selected) return;
    setStarting(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Sesión no válida, vuelve a iniciar sesión.");
      setStarting(false);
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: userData.user.id,
        persona_id: selected,
        modo,
        status: "en_curso",
      })
      .select()
      .single();

    if (error || !data) {
      setError(error?.message ?? "No se pudo crear la sesión.");
      setStarting(false);
      return;
    }

    router.push(`/roleplay/${data.id}`);
  }

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Elige tu prospecto</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Cada personaje entrena una fase distinta de MECI. Rota entre ellos a lo largo de la semana.
      </p>

      {loading && <p className="mt-6 text-sm text-muted">Cargando prospectos…</p>}
      {error && <p className="mt-4 text-sm font-medium text-critical">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {personas.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            type="button"
            aria-pressed={selected === p.id}
            className="card p-4 text-left transition hover:border-ink"
            style={selected === p.id ? { borderColor: p.color, boxShadow: `0 0 0 2px ${p.color}` } : undefined}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">{p.nombre}</span>
              <span
                className="tag"
                style={{ backgroundColor: `${p.color}1a`, color: p.color }}
              >
                {DIFICULTAD_LABEL[p.dificultad]}
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-secondary">{p.situacion}</p>
            <p className="mt-2 text-xs italic text-muted">"{p.dolor_superficial}"</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-8">
          <h2 className="text-sm font-bold">Modo de práctica</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {MODOS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setModo(m.value)}
                aria-pressed={modo === m.value}
                className="card p-3 text-left text-xs transition hover:border-ink"
                style={
                  modo === m.value
                    ? { borderColor: "#0b0b0b", boxShadow: "0 0 0 2px #0b0b0b", background: "#f0efec" }
                    : undefined
                }
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{m.label}</span>
                  {modo === m.value && (
                    <span className="font-bold text-ink" aria-hidden>
                      ✓
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-muted">{m.desc}</span>
              </button>
            ))}
          </div>

          <button onClick={empezar} disabled={starting} className="btn-primary mt-6">
            {starting ? "Preparando llamada…" : "Empezar roleplay"}
          </button>
        </div>
      )}
    </div>
  );
}
