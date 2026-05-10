'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Check, Crown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLAN_FEATURES = {
    free: [
        'Hasta 5 deudas',
        'Plan de pago básico',
        'Dashboard con estadísticas',
        'Análisis de salud financiera',
        'Historial de 3 meses',
        'Presupuestos por categoría',
        'Registro de gasto real',
        'Detalle de deuda por categoría',
    ],
    pro: [
        'Deudas ilimitadas',
        'Análisis de salud financiera',
        'Simulador What-If',
        'Exportar escenarios What-If',
        'Exportación a CSV',
        'Historial completo',
        'Etiquetas personalizadas',
        'Recordatorios por email',
        'Soporte prioritario',
        'Alertas y resumen avanzado de presupuesto',
        'Metas por deuda y plan ajustado',
        'Detalle de deuda por categoría',
    ],
};

interface PricingSectionProps {
    freeCtaLabel?: string;
    freeCtaHref?: string;
    proDescription?: string;
    proCtaLabel?: string;
    proCtaHref?: string;
}

export function PricingSection({
    freeCtaLabel = 'Empezar Gratis',
    freeCtaHref = '/signup',
    proDescription = 'Para quienes necesitan más contexto para decidir y ejecutar el plan.',
    proCtaLabel = 'Comenzar PRO',
    proCtaHref = '/pricing',
}: PricingSectionProps) {
    const plans = [
        {
            name: 'Gratis',
            price: 'Q0',
            period: 'para siempre',
            description: 'Para ordenar tus primeras deudas y validar si RutaCero te sirve.',
            features: PLAN_FEATURES.free,
            cta: freeCtaLabel,
            href: freeCtaHref,
            popular: false,
        },
        {
            name: 'PRO',
            price: 'Q49',
            period: '/mes',
            description: proDescription,
            features: PLAN_FEATURES.pro,
            cta: proCtaLabel,
            href: proCtaHref,
            popular: true,
        },
    ];

    return (
        <section className="py-24 bg-muted/30 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-primary/5 to-amber-500/5 rounded-full blur-3xl" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
                        Planes simples,{' '}
                        <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                            sin sorpresas
                        </span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Comienza gratis en GTQ. Actualiza cuando quieras comparar escenarios,
                        definir metas y trabajar tu plan con más contexto.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="mx-auto mb-10 grid max-w-4xl gap-3 rounded-3xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground shadow-sm sm:grid-cols-3"
                >
                    <div className="rounded-2xl bg-card/80 p-4">
                        <p className="font-semibold text-foreground">Cobro local</p>
                        <p>PRO se cobra en quetzales a través de Recurrente.</p>
                    </div>
                    <div className="rounded-2xl bg-card/80 p-4">
                        <p className="font-semibold text-foreground">Sin banca conectada</p>
                        <p>No pedimos credenciales bancarias para generar tu plan.</p>
                    </div>
                    <div className="rounded-2xl bg-card/80 p-4">
                        <p className="font-semibold text-foreground">Upgrade cuando haga sentido</p>
                        <p>Empiezas gratis y subes a PRO solo si necesitas más seguimiento.</p>
                    </div>
                </motion.div>

                {/* Pricing cards */}
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.2 }}
                            whileHover={{ y: -5, transition: { duration: 0.2 } }}
                            className={`relative p-8 rounded-2xl border-2 transition-all duration-300 ${plan.popular
                                    ? 'bg-gradient-to-br from-card to-primary/5 border-primary shadow-xl shadow-primary/10'
                                    : 'bg-card border-border hover:border-primary/30'
                                }`}
                        >
                            {/* Popular badge */}
                            {plan.popular && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    whileInView={{ scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ type: 'spring', delay: 0.3 }}
                                    className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-full flex items-center gap-1 shadow-lg"
                                >
                                    <Crown className="w-4 h-4" />
                                    Más Popular
                                </motion.div>
                            )}

                            {/* Plan header */}
                            <div className="text-center mb-8">
                                <h3 className="text-2xl font-bold text-foreground mb-2">
                                    {plan.name}
                                </h3>
                                <div className="flex items-baseline justify-center gap-1">
                                    <motion.span
                                        className="text-5xl font-bold text-foreground"
                                        initial={{ scale: 0.5 }}
                                        whileInView={{ scale: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ type: 'spring', delay: 0.2 }}
                                    >
                                        {plan.price}
                                    </motion.span>
                                    <span className="text-muted-foreground">{plan.period}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {plan.description}
                                </p>
                            </div>

                            {/* Features */}
                            <ul className="space-y-3 mb-8">
                                {plan.features.map((feature, i) => (
                                    <motion.li
                                        key={feature}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.1 * i }}
                                        className="flex items-center gap-3 text-foreground"
                                    >
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${plan.popular ? 'bg-primary' : 'bg-green-500'
                                            }`}>
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                        {feature}
                                    </motion.li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <Button
                                size="lg"
                                className={`w-full py-6 text-lg ${plan.popular
                                        ? 'bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 text-white shadow-lg shadow-primary/25'
                                        : 'bg-muted hover:bg-muted/80'
                                    }`}
                                asChild
                            >
                                <Link href={plan.href}>
                                    {plan.popular && <Zap className="w-5 h-5 mr-2" />}
                                    {plan.cta}
                                </Link>
                            </Button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
