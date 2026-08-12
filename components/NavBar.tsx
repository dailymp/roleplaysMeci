"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/roleplay", label: "Practicar" },
  { href: "/sesiones", label: "Sesiones" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [pathname]);

  if (pathname === "/login") return null;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-hairline bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="text-sm font-bold tracking-tight">
            Roleplay <span className="text-fase-e">MECI</span>
          </span>
          <nav className="flex gap-4">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium ${
                  pathname === l.href ? "text-ink" : "text-ink-secondary hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        {email && (
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">{email}</span>
            <button onClick={handleLogout} className="text-xs font-semibold text-ink-secondary hover:text-ink">
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
