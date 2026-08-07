import type { Metadata } from 'next';
import { BrandLogo } from '@/components/brand-logo';
import { rcFontVariables } from '@/lib/theme/rc-fonts';

export const metadata: Metadata = {
    title: 'Iniciar sesión | RutaCero',
    description: 'Accede a tu cuenta para gestionar tus deudas',
};

/**
 * Force dynamic rendering for the whole (auth) group.
 *
 * `src/proxy.ts` issues a fresh nonce on every request for the
 * `Content-Security-Policy` script-src directive. Next.js only stamps that
 * per-request nonce onto <script> tags when the page is rendered fresh — a
 * statically prerendered/cached page ships <script> tags with a stale nonce
 * that never matches the CSP header. The browser blocks every script,
 * React never hydrates, and Suspense-gated forms stay blank.
 */
export const dynamic = 'force-dynamic';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`rc-surface rc-app min-h-screen bg-background ${rcFontVariables}`}>
            <div className="flex min-h-screen">
                {/* Editorial brand panel — paper, not dark SaaS gradient */}
                <aside className="relative hidden overflow-hidden border-r border-border lg:flex lg:w-1/2 xl:w-3/5">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_18%,rgba(13,148,136,0.12),transparent_55%),radial-gradient(ellipse_at_88%_82%,rgba(27,24,18,0.04),transparent_50%)]"
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-border"
                    />

                    <div className="relative z-10 flex w-full flex-col justify-between px-12 py-12 xl:px-20">
                        <BrandLogo height={48} priority variant="light" />

                        <div className="max-w-lg">
                            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--rc-teal-text)]">
                                Hoja de ruta en quetzales
                            </p>
                            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-foreground xl:text-5xl">
                                Organiza lo que debes.
                                <br />
                                Ve exactamente lo que te falta.
                            </h1>
                            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                                Entra a tu plan, actualiza pagos y sigue tu ruta — sin conectar tu banco.
                            </p>
                        </div>

                        <ul className="max-w-md space-y-4 text-sm text-muted-foreground">
                            {[
                                {
                                    title: 'Tu información se queda contigo',
                                    desc: 'No pedimos acceso a tu banca',
                                },
                                {
                                    title: 'Un plan claro en quetzales',
                                    desc: 'Prioridades y fechas, no jerga',
                                },
                                {
                                    title: 'Alertas cuando importa',
                                    desc: 'Para no perder un pago',
                                },
                            ].map((item) => (
                                <li
                                    key={item.title}
                                    className="border-l-2 border-primary/40 pl-4"
                                >
                                    <p className="font-medium text-foreground">{item.title}</p>
                                    <p className="mt-0.5">{item.desc}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* Form column */}
                <div className="relative flex w-full items-center justify-center lg:w-1/2 xl:w-2/5">
                    <div className="relative z-10 w-full max-w-md px-6 py-12 sm:px-8">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
