"use client";

export default function PuntuacionSelector({
  value,
  onChange,
  color,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="flex h-8 w-8 items-center justify-center rounded-md border text-xs font-bold transition"
          style={
            value === n
              ? { backgroundColor: color, borderColor: color, color: "#fff" }
              : { borderColor: "#e1e0d9", color: "#898781" }
          }
        >
          {n}
        </button>
      ))}
    </div>
  );
}
