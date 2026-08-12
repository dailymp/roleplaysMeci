import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Roleplay MECI · DailyMP",
  description: "Practica y evalúa tus llamadas de ventas con la metodología MECI de Top Closing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans antialiased">
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
