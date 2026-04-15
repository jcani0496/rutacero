import type { Metadata } from 'next';
import { Shield, TrendingDown, Bell } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export const metadata: Metadata = {
    title: 'Iniciar Sesión | RutaCero',
    description: 'Accede a tu cuenta para gestionar tus deudas',
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex">
            {/* Left panel - Branding (hidden on mobile, visible on lg+) */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-15" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.22),transparent_55%)]" />

                {/* Gradient orbs */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl" />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 py-12">
                    {/* Logo */}
                    <div className="mb-12">
                        <BrandLogo height={60} priority />
                    </div>

                    {/* Hero text */}
                    <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
                        Tu camino hacia la<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-sky-300">
                            libertad financiera
                        </span>
                    </h1>

                    <p className="text-lg text-slate-300 mb-12 max-w-md">
                        Organiza tus deudas, recibe un plan personalizado y alcanza tus metas financieras paso a paso.
                    </p>

                    {/* Features */}
                    <div className="space-y-6">
                        {[
                            { icon: Shield, title: 'Seguro y privado', desc: 'Tu información está protegida' },
                            { icon: TrendingDown, title: 'Paga menos intereses', desc: 'Estrategias optimizadas' },
                            { icon: Bell, title: 'Alertas inteligentes', desc: 'Nunca pierdas un pago' },
                        ].map((feature, i) => (
                            <div key={i} className="flex items-start gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 border border-white/10">
                                    <feature.icon className="h-5 w-5 text-emerald-300" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-white">{feature.title}</h3>
                                    <p className="text-sm text-slate-300">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel - Form */}
            <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center bg-slate-50 relative">
                {/* Mobile background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 lg:hidden" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 lg:hidden" />

                {/* Form container */}
                <div className="relative z-10 w-full max-w-md px-6 py-12 sm:px-8">
                    {children}
                </div>
            </div>
        </div>
    );
}
