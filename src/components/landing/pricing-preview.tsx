'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Check, Crown, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProVariant, monthlyEquivalent } from '@/lib/billing/plans';

// Landing preview lists: strict subsets of the canonical /pricing page lists.
// 5–6 of the highest-value bullets per plan; full detail lives on /pricing.
const PLAN_FEATURES = {
    free: [
        'Hasta 5 deudas',
        'Plan de pagos único',
        'Análisis de salud financiera',
        'Presupuestos por categoría',
        'Soporte por tickets',
    ],
    pro: [
        'Deudas ilimitadas',
        'Simulador What-If',
        'Exportar reportes CSV',
        'Analíticas avanzadas',
        'Alertas y metas por deuda',
        'Soporte prioritario',
    ],
};

// Derive numbers from the catalog so landing stays in sync with future changes.
const PRO_MONTHLY = getProVariant('PRO_MONTHLY');
const PRO_QUARTERLY = getProVariant('PRO_QUARTERLY');
const PRO_ANNUAL = getProVariant('PRO_ANNUAL');
const MONTHLY_EQ_ANNUAL = monthlyEquivalent('PRO_ANNUAL');
const PRO_PRICE_DISPLAY = `Q${MONTHLY_EQ_ANNUAL.toFixed(2)}`;
const PRO_PRICE_DETAIL_LINE = `Q${PRO_MONTHLY.priceQ}/mes · Q${PRO_QUARTERLY.priceQ} cada 3 meses · Q${PRO_ANNUAL.priceQ}/año`;

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
    proDescription = 'Para quienes necesitan más contexto, escenarios y seguimiento.',
    proCtaLabel = 'Ver planes PRO',
    proCtaHref = '/pricing',
}: PricingSectionProps) {
    return (
        <section id="pricing" className="scroll-mt-20 py-24 bg-muted/30 relative overflow-hidden">
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

                {/* Pricing cards: FREE + PRO (teaser). Detailed variants live on /pricing. */}
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* FREE card */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        whileHover={{ y: -5, transition: { duration: 0.2 } }}
                        className="relative p-8 rounded-2xl border-2 transition-all duration-300 bg-card border-border hover:border-primary/30"
                    >
                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-bold text-foreground mb-2">Free</h3>
                            <div className="flex items-baseline justify-center gap-1">
                                <motion.span
                                    className="text-5xl font-bold text-foreground"
                                    initial={{ scale: 0.5 }}
                                    whileInView={{ scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ type: 'spring', delay: 0.2 }}
                                >
                                    Q0
                                </motion.span>
                                <span className="text-muted-foreground">para siempre</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                Para empezar a ordenar tus deudas
                            </p>
                        </div>

                        <ul className="space-y-3 mb-8">
                            {PLAN_FEATURES.free.map((feature, i) => (
                                <motion.li
                                    key={feature}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.1 * i }}
                                    className="flex items-center gap-3 text-foreground"
                                >
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center bg-green-500">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                    {feature}
                                </motion.li>
                            ))}
                        </ul>

                        <Button size="lg" className="w-full py-6 text-lg bg-muted hover:bg-muted/80" asChild>
                            <Link href={freeCtaHref}>{freeCtaLabel}</Link>
                        </Button>
                    </motion.div>

                    {/* PRO card */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        whileHover={{ y: -5, transition: { duration: 0.2 } }}
                        className="relative p-8 rounded-2xl border-2 transition-all duration-300 bg-gradient-to-br from-card to-primary/5 border-primary shadow-xl shadow-primary/10"
                    >
                        {/* Popular badge */}
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

                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-bold text-foreground mb-3">PRO</h3>

                            {/* Variants chip */}
                            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                <Sparkles className="h-3 w-3" />
                                3 variantes disponibles
                            </div>

                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-sm text-muted-foreground">Desde</span>
                                <motion.span
                                    className="text-5xl font-bold text-foreground"
                                    initial={{ scale: 0.5 }}
                                    whileInView={{ scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ type: 'spring', delay: 0.2 }}
                                >
                                    {PRO_PRICE_DISPLAY}
                                </motion.span>
                                <span className="text-muted-foreground">/mes</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {PRO_PRICE_DETAIL_LINE}
                            </p>
                            <p className="text-sm text-muted-foreground mt-3">
                                {proDescription}
                            </p>
                        </div>

                        <ul className="space-y-3 mb-8">
                            {PLAN_FEATURES.pro.map((feature, i) => (
                                <motion.li
                                    key={feature}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.1 * i }}
                                    className="flex items-center gap-3 text-foreground"
                                >
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center bg-primary">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                    {feature}
                                </motion.li>
                            ))}
                        </ul>

                        <Button
                            size="lg"
                            className="w-full py-6 text-lg bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 text-white shadow-lg shadow-primary/25"
                            asChild
                        >
                            <Link href={proCtaHref}>
                                <Zap className="w-5 h-5 mr-2" />
                                {proCtaLabel}
                            </Link>
                        </Button>
                    </motion.div>
                </div>

                {/* Manual payment hint */}
                <p className="text-center text-sm text-muted-foreground mt-8">
                    También aceptamos pago por transferencia bancaria.{' '}
                    <Link href="/pago-manual" className="underline underline-offset-2 font-medium hover:text-foreground">
                        Ver opciones
                    </Link>
                    .
                </p>
            </div>
        </section>
    );
}
