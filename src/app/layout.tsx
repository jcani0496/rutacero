import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "@/components/ui/toast";
import { SWRegister } from "@/components/sw-register";
import { CookieBanner } from "@/components/legal/cookie-banner";
import "./globals.css";

// RutaCero Brand Font - Geist Sans (Vercel)
// Wired into Tailwind via --font-geist-sans in globals.css.

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * A malformed NEXT_PUBLIC_APP_URL (e.g. a bare domain without protocol,
 * editable at any time in the Vercel dashboard) must degrade to the
 * fallback — never crash the build. This module evaluates during
 * page-data collection for every route, so an unguarded `new URL()`
 * here takes down `next build` for the whole app.
 */
function resolveMetadataBase(): URL {
  const fallback = "http://localhost:3000";
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return new URL(fallback);
  try {
    return new URL(raw);
  } catch {
    // Bare domains ("rutacero.com") are the most likely dashboard typo.
    try {
      return new URL(`https://${raw}`);
    } catch {
      console.warn(
        `[layout] NEXT_PUBLIC_APP_URL is not a valid URL ("${raw}"); falling back to ${fallback}`
      );
      return new URL(fallback);
    }
  }
}

export const metadata: Metadata = {
  title: {
    default: "RutaCero | Organiza tus deudas en quetzales",
    template: "%s | RutaCero",
  },
  description:
    "Organiza tus deudas, compara estrategias y sigue un plan claro de pagos. Herramienta de planificación — no asesoría ni promesa de resultado.",
  keywords: [
    "deudas",
    "finanzas personales",
    "plan de pagos",
    "Guatemala",
    "quetzales",
  ],
  authors: [{ name: "RutaCero" }],
  creator: "RutaCero",
  metadataBase: resolveMetadataBase(),
  openGraph: {
    type: "website",
    locale: "es_GT",
    siteName: "RutaCero",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Opt every route into dynamic rendering so the per-request CSP nonce
  // from `src/proxy.ts` matches the nonce Next stamps onto <script> tags.
  // Static prerender embeds a build-time nonce that never matches the
  // response header → browser blocks hydration (blank /login, dead
  // CookieBanner on marketing pages, etc.).
  await headers();

  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <SWRegister />
        {children}
        <Toaster />
        <CookieBanner />
      </body>
    </html>
  );
}
