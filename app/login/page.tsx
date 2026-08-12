"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    } else {
      const { error, data } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push("/");
        router.refresh();
      } else {
        setNotice("Cuenta creada. Revisa tu email para confirmar el acceso y luego inicia sesión.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-bold tracking-tight">
          Roleplay <span className="text-fase-e">MECI</span>
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {mode === "login" ? "Entra para practicar tus llamadas." : "Crea tu cuenta (solo la primera vez)."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-secondary">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm outline-none focus:border-ink"
              placeholder="dailymp@gmail.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-secondary">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm outline-none focus:border-ink"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs font-medium text-critical">{error}</p>}
          {notice && <p className="text-xs font-medium text-good">{notice}</p>}

          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full">
            {loading ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setNotice(null);
          }}
          className="mt-4 w-full text-center text-xs font-medium text-ink-secondary hover:text-ink"
        >
          {mode === "login" ? "¿Primera vez? Crea tu cuenta" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </div>
    </div>
  );
}
