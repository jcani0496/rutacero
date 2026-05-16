import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
  title: {
    default: "RutaCero | Tu camino a la libertad financiera",
    template: "%s | RutaCero",
  },
  description:
    "Organiza tus deudas, compara estrategias y sigue un plan claro para avanzar hacia tu libertad financiera.",
  keywords: [
    "deudas",
    "finanzas personales",
    "libertad financiera",
    "plan de pagos",
    "Guatemala",
  ],
  authors: [{ name: "RutaCero" }],
  creator: "RutaCero",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
