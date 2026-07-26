import type { Metadata } from 'next';
import { BrandLogo } from '@/components/brand-logo';

export const metadata: Metadata = {
    title: 'Iniciar Sesión | RutaCero',
    description: 'Accedé a tu cuenta para gestionar tus deudas',
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex">
            {/* Left panel - Branding (hidden on mobile, visible on lg+) */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-[#0B1220] via-[#0F1A2A] to-[#0B1220] relative overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-15" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(13,148,136,0.28),transparent_55%)]" />

                {/* Soft brand washes (no decorative amber blobs) */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/25 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/15 rounded-full blur-3xl" />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 py-12">
                    {/* Logo — dark variant: this panel uses a slate-950 hero
                        gradient, so the standard light wordmark would render
                        "Ruta" (slate-900) invisible on the same dark slate. */}
                    <div className="mb-12">
                        <BrandLogo height={60} priority variant="dark" />
                    </div>

                    {/* Hero text */}
                    <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
                        Tu camino hacia la<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-300">
                            libertad financiera
                        </span>
                    </h1>

                    <p className="text-lg text-slate-300 mb-12 max-w-md">
                        Organizá tus deudas, recibí un plan personalizado y alcanzá tus metas financieras paso a paso.
                    </p>

                    {/* Features */}
                    <ul className="space-y-4 text-slate-300">
                        {[
                            { title: 'Seguro y privado', desc: 'Tu información está protegida' },
                            { title: 'Paga menos intereses', desc: 'Estrategias optimizadas' },
                            { title: 'Alertas inteligentes', desc: 'Nunca pierdas un pago' },
                        ].map((feature) => (
                            <li key={feature.title} className="border-l-2 border-primary/40 pl-4">
                                <h3 className="font-medium text-white">{feature.title}</h3>
                                <p className="text-sm text-slate-300">{feature.desc}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Right panel - Form */}
            <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center bg-background relative">
                {/* Mobile background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-muted/40 lg:hidden" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 lg:hidden" />

                {/* Form container */}
                <div className="relative z-10 w-full max-w-md px-6 py-12 sm:px-8">
                    {children}
                </div>
            </div>
        </div>
    );
}
