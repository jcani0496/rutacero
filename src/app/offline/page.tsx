import Link from "next/link";
import type { Metadata } from "next";
import { rcFontVariables } from "@/lib/theme/rc-fonts";

export const metadata: Metadata = {
  title: "Sin conexión",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main
      className={`rc-surface rc-app flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center ${rcFontVariables}`}
    >
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--rc-teal-text)]">
          RutaCero
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Estás sin conexión
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          No pudimos cargar esta página. Revisá tu internet e intentá de nuevo.
          Tus deudas y planes no se guardan en el dispositivo.
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary-strong px-5 py-2.5 text-sm font-medium text-primary-strong-foreground transition hover:bg-primary-strong/90"
          >
            Reintentar
          </Link>
        </div>
      </div>
    </main>
  );
}
