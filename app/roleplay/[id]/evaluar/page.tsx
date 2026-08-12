"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RoleplaySession, Persona, Objecion } from "@/lib/types";
import { RUBRICA, FASE_LABEL, FASE_COLOR, calcularTotales } from "@/lib/rubrica";
import PuntuacionSelector from "@/components/PuntuacionSelector";

const FASES = ["M", "E", "C", "I"] as const;

export default function EvaluarPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<RoleplaySession | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [sobreexplico, setSobreexplico] = useState<boolean | null>(null);
  const [pidioCierre, setPidioCierre] = useState<boolean | null>(null);
  const [sostuvoSilencio, setSostuvoSilencio] = useState<boolean | null>(null);
  const [dosOpciones, setDosOpciones] = useState<boolean | null>(null);
  const [momentoPositivo, setMomentoPositivo] = useState("");
  const [momentoNegativo, setMomentoNegativo] = useState("");
  const [fraseDolor, setFraseDolor] = useState("");
  const [objeciones, setObjeciones] = useState<Objecion[]>([{ objecion: "", manejo: "", vac: false }]);
  const [ejercicio, setEjercicio] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setSession(data as RoleplaySession);
          const { data: p } = await supabase.from("personas").select("*").eq("id", data.persona_id).single();
          setPersona(p as Persona);
        }
        setLoading(false);
      });
  }, [sessionId]);

  const totales = useMemo(() => calcularTotales(scores), [scores]);
  const itemsCompletos = RUBRICA.every((r) => scores[String(r.id)] >= 1);

  function setScore(id: number, v: number) {
    setScores((prev) => ({ ...prev, [id]: v }));
  }

  function addObjecion() {
    setObjeciones((prev) => [...prev, { objecion: "", manejo: "", vac: false }]);
  }
  function updateObjecion(i: number, patch: Partial<Objecion>) {
    setObjeciones((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  async function handleSubmit() {
    if (!itemsCompletos) {
      setError("Puntúa los 17 ítems antes de guardar.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Sesión no válida.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("evaluations").insert({
      session_id: sessionId,
      user_id: userData.user.id,
      item_scores: scores,
      m_score: totales.m,
      e_score: totales.e,
      c_score: totales.c,
      i_score: totales.i,
      total_score: totales.total,
      banda: totales.banda,
      fase_debil: totales.faseDebil,
      sobreexplico,
      pidio_cierre: pidioCierre,
      sostuvo_silencio: sostuvoSilencio,
      dos_opciones: dosOpciones,
      momento_clave_positivo: momentoPositivo || null,
      momento_clave_negativo: momentoNegativo || null,
      frase_dolor_real: fraseDolor || null,
      ejercicio_siguiente: ejercicio || null,
      notas: JSON.stringify(objeciones.filter((o) => o.objecion.trim())),
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    await supabase.from("sessions").update({ status: "evaluada" }).eq("id", sessionId);
    router.push(`/sesiones/${sessionId}`);
  }

  if (loading) return <p className="text-sm text-muted">Cargando…</p>;
  if (!session) return <p className="text-sm text-critical">No se encontró la sesión.</p>;

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <h1 className="text-xl font-bold tracking-tight">Autoevaluación MECI</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Roleplay con {persona?.nombre ?? "tu prospecto"} · hazlo con la memoria fresca, sé honesta: un 5 se gana.
      </p>

      {(session.duration_seconds || session.daily_speak_ratio) && (
        <div className="card mt-4 flex flex-wrap gap-6 p-4 text-sm">
          {session.duration_seconds != null && (
            <div>
              <p className="text-xs text-muted">Duración</p>
              <p className="font-bold">
                {Math.floor(session.duration_seconds / 60)}m {session.duration_seconds % 60}s
              </p>
            </div>
          )}
          {session.daily_speak_ratio != null && (
            <div>
              <p className="text-xs text-muted">Tu ratio de habla (aprox.)</p>
              <p className="font-bold">
                {Math.round(session.daily_speak_ratio * 100)}%{" "}
                <span className="font-normal text-muted">(objetivo ≤30%)</span>
              </p>
            </div>
          )}
        </div>
      )}

      {FASES.map((fase) => (
        <div key={fase} className="card mt-6 p-5">
          <h2 className="text-sm font-bold" style={{ color: FASE_COLOR[fase] }}>
            {fase} — {FASE_LABEL[fase]}
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            {RUBRICA.filter((r) => r.fase === fase).map((item) => (
              <div key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-secondary sm:max-w-[70%]">{item.texto}</p>
                <PuntuacionSelector
                  value={scores[String(item.id)] ?? 0}
                  onChange={(v) => setScore(item.id, v)}
                  color={FASE_COLOR[fase]}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card mt-6 p-5">
        <h2 className="text-sm font-bold">🚨 Vigilancia DailyMP</h2>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <SiNoRow label="¿Sobreexpliqué? (monólogos largos, jerga técnica)" value={sobreexplico} onChange={setSobreexplico} invert />
          <SiNoRow label="¿Pedí el cierre de forma directa?" value={pidioCierre} onChange={setPidioCierre} />
          <SiNoRow label="¿Sostuve el silencio tras dar el precio?" value={sostuvoSilencio} onChange={setSostuvoSilencio} />
          <SiNoRow label="¿Presenté dos opciones?" value={dosOpciones} onChange={setDosOpciones} />
        </div>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="text-sm font-bold">Momentos clave</h2>
        <div className="mt-4 flex flex-col gap-3">
          <TextField label="✅ ¿Dónde gané la llamada?" value={momentoPositivo} onChange={setMomentoPositivo} />
          <TextField label="❌ ¿Dónde la perdí (o casi)?" value={momentoNegativo} onChange={setMomentoNegativo} />
          <TextField
            label="💬 Frase del prospecto que reveló su dolor real"
            value={fraseDolor}
            onChange={setFraseDolor}
          />
        </div>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="text-sm font-bold">Objeciones</h2>
        <div className="mt-4 flex flex-col gap-3">
          {objeciones.map((o, i) => (
            <div key={i} className="rounded-lg border border-hairline p-3">
              <input
                placeholder="Objeción lanzada"
                value={o.objecion}
                onChange={(e) => updateObjecion(i, { objecion: e.target.value })}
                className="w-full border-b border-hairline pb-1 text-sm outline-none"
              />
              <textarea
                placeholder="Cómo la manejé"
                value={o.manejo}
                onChange={(e) => updateObjecion(i, { manejo: e.target.value })}
                className="mt-2 w-full resize-none text-sm outline-none"
                rows={2}
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-secondary">
                <input type="checkbox" checked={o.vac} onChange={(e) => updateObjecion(i, { vac: e.target.checked })} />
                Validé → Aislé → Respondí
              </label>
            </div>
          ))}
          <button onClick={addObjecion} type="button" className="btn-secondary self-start text-xs">
            + Añadir objeción
          </button>
        </div>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="text-sm font-bold">🎯 Un ejercicio para la próxima sesión</h2>
        <textarea
          value={ejercicio}
          onChange={(e) => setEjercicio(e.target.value)}
          placeholder='Ej: "Tras dar el precio, cuenta 10 segundos en silencio."'
          className="mt-3 w-full resize-none rounded-lg border border-hairline p-2 text-sm outline-none"
          rows={2}
        />
      </div>

      <div className="card sticky bottom-4 mt-6 flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted">Total</p>
          <p className="text-lg font-bold">{totales.total} / 85</p>
        </div>
        <div className="flex items-center gap-3">
          {error && <p className="text-xs font-medium text-critical">{error}</p>}
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? "Guardando…" : "Guardar evaluación"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SiNoRow({
  label,
  value,
  onChange,
  invert,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  invert?: boolean;
}) {
  const goodValue = invert ? false : true;
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-ink-secondary">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className="rounded-md border px-3 py-1 text-xs font-semibold"
          style={
            value === true
              ? { backgroundColor: true === goodValue ? "#0ca30c" : "#d03b3b", color: "#fff", borderColor: "transparent" }
              : { borderColor: "#e1e0d9" }
          }
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className="rounded-md border px-3 py-1 text-xs font-semibold"
          style={
            value === false
              ? { backgroundColor: false === goodValue ? "#0ca30c" : "#d03b3b", color: "#fff", borderColor: "transparent" }
              : { borderColor: "#e1e0d9" }
          }
        >
          No
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink-secondary">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg border border-hairline p-2 text-sm outline-none focus:border-ink"
      />
    </div>
  );
}
