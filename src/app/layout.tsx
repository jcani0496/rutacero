import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { SWRegister } from "@/components/sw-register";
import { CookieBanner } from "@/components/legal/cookie-banner";
import "./globals.css";

// RutaCero Brand Font - Inter
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

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
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <SWRegister />
        {children}
        <Toaster />
        <CookieBanner />
      </body>
    </html>
  );
}
