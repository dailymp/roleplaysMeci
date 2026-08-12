"use client";

import { useMemo, useState } from "react";
import { FASE_COLOR, FASE_LABEL, FASE_MAX } from "@/lib/rubrica";

export interface EvolutionPoint {
  fecha: string;
  m: number;
  e: number;
  c: number;
  i: number;
}

const FASES = ["m", "e", "c", "i"] as const;
const WIDTH = 640;
const HEIGHT = 220;
const PAD_L = 32;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;

export default function EvolutionChart({ data }: { data: EvolutionPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo(() => {
    const innerW = WIDTH - PAD_L - PAD_R;
    const innerH = HEIGHT - PAD_T - PAD_B;
    const n = data.length;

    return FASES.map((fase) => {
      const maxVal = FASE_MAX[fase.toUpperCase() as "M" | "E" | "C" | "I"];
      const coords = data.map((d, i) => {
        const pct = d[fase] / maxVal;
        const x = n === 1 ? PAD_L + innerW / 2 : PAD_L + (i / (n - 1)) * innerW;
        const y = PAD_T + innerH * (1 - pct);
        return { x, y, pct, raw: d[fase] };
      });
      return { fase, coords };
    });
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-muted">
        Todavía no hay evaluaciones para graficar.
      </div>
    );
  }

  const innerW = WIDTH - PAD_L - PAD_R;
  const gridY = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="viz-root">
      <div className="mb-2 flex flex-wrap gap-3 text-xs">
        {FASES.map((f) => (
          <span key={f} className="flex items-center gap-1.5 font-semibold">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FASE_COLOR[f.toUpperCase() as "M" | "E" | "C" | "I"] }} />
            <span style={{ color: FASE_COLOR[f.toUpperCase() as "M" | "E" | "C" | "I"] }}>
              {f.toUpperCase()} · {FASE_LABEL[f.toUpperCase() as "M" | "E" | "C" | "I"]}
            </span>
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
          const n = data.length;
          const idx = n === 1 ? 0 : Math.round(((x - PAD_L) / innerW) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, idx)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {gridY.map((g) => (
          <line
            key={g}
            x1={PAD_L}
            x2={WIDTH - PAD_R}
            y1={PAD_T + (HEIGHT - PAD_T - PAD_B) * (1 - g)}
            y2={PAD_T + (HEIGHT - PAD_T - PAD_B) * (1 - g)}
            stroke="#e1e0d9"
            strokeWidth={1}
          />
        ))}
        <text x={4} y={PAD_T + 4} fontSize={9} fill="#898781">100%</text>
        <text x={4} y={HEIGHT - PAD_B + 4} fontSize={9} fill="#898781">0%</text>

        {points.map(({ fase, coords }) => (
          <g key={fase}>
            <polyline
              points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
              fill="none"
              stroke={FASE_COLOR[fase.toUpperCase() as "M" | "E" | "C" | "I"]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {coords.length > 0 && (
              <circle
                cx={coords[coords.length - 1].x}
                cy={coords[coords.length - 1].y}
                r={4}
                fill={FASE_COLOR[fase.toUpperCase() as "M" | "E" | "C" | "I"]}
              />
            )}
          </g>
        ))}

        {hover !== null && (
          <line
            x1={points[0].coords[hover].x}
            x2={points[0].coords[hover].x}
            y1={PAD_T}
            y2={HEIGHT - PAD_B}
            stroke="#c3c2b7"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
      </svg>

      {hover !== null && (
        <div className="mt-1 rounded-lg border border-hairline bg-surface p-2 text-xs">
          <p className="font-semibold text-ink-secondary">
            {new Date(data[hover].fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
          </p>
          <div className="mt-1 flex gap-3">
            {FASES.map((f) => (
              <span key={f} style={{ color: FASE_COLOR[f.toUpperCase() as "M" | "E" | "C" | "I"] }} className="font-bold">
                {f.toUpperCase()} {data[hover][f]}/{FASE_MAX[f.toUpperCase() as "M" | "E" | "C" | "I"]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
