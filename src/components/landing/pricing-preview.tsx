'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Check } from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';
import { Button } from '@/components/ui/button';
import { getProVariant, monthlyEquivalent } from '@/lib/billing/plans';

// Landing preview: strict subset of the canonical /pricing page lists.
const PRO_FEATURES = [
    'Deudas ilimitadas',
    'Simulador what-if',
    'Exportar reportes en CSV',
    'Análisis avanzados de tu progreso',
    'Alertas y metas por deuda',
    'Soporte prioritario',
];

const FREE_FEATURES = [
    'Hasta 5 deudas',
    'Plan de pagos único',
    'Presupuestos por categoría',
];

const PRO_MONTHLY = getProVariant('PRO_MONTHLY');
const PRO_QUARTERLY = getProVariant('PRO_QUARTERLY');
const PRO_ANNUAL = getProVariant('PRO_ANNUAL');
const PRO_ANNUAL_MONTHLY_DISPLAY = Math.round(monthlyEquivalent('PRO_ANNUAL'));

interface PricingSectionProps {
    freeCtaLabel?: string;
    freeCtaHref?: string;
    proDescription?: string;
    proCtaLabel?: string;
    proCtaHref?: string;
}

export function PricingSection({
    freeCtaLabel = 'Empezar gratis',
    freeCtaHref = '/signup',
    proDescription = 'Para cuando necesitas más contexto, escenarios y seguimiento.',
    proCtaLabel = 'Ver planes PRO',
    proCtaHref = '/pricing',
}: PricingSectionProps) {
    return (
        <section id="pricing" className="scroll-mt-24 border-b border-border py-20 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <motion.div
                    data-motion
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="max-w-xl">
                        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                            PRO desde Q{PRO_ANNUAL_MONTHLY_DISPLAY}/mes, facturado anual
                        </h2>
                        <p className="mt-3 text-lg text-muted-foreground">
                            Empieza gratis. Sube a PRO cuando quieras comparar estrategias y llevar más seguimiento.
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Herramienta de planificación: no promete ahorros exactos ni resultados garantizados.
                        </p>
                    </div>

                    <div className="mt-12 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
                        {/* PRO — protagonist */}
                        <div className="rounded-2xl border-2 border-[#111111] bg-card p-8">
                            <div className="flex flex-wrap items-baseline justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--rc-teal-text)]">PRO</p>
                                    <div className="mt-2 flex items-baseline gap-1.5">
                                        <span className="font-money text-4xl font-bold text-foreground">
                                            Q{PRO_ANNUAL_MONTHLY_DISPLAY}
                                        </span>
                                        <span className="text-muted-foreground">/mes</span>
                                    </div>
                                    <p className="mt-1 font-money text-sm text-muted-foreground">
                                        Facturado anual (Q{PRO_ANNUAL.priceQ}) · también Q{PRO_MONTHLY.priceQ}/mes o Q{PRO_QUARTERLY.priceQ} cada 3 meses
                                    </p>
                                </div>
                                <Button
                                    size="lg"
                                    className="bg-[#111111] text-white hover:bg-[#2A2A2A]"
                                    asChild
                                >
                                    <Link href={proCtaHref}>{proCtaLabel}</Link>
                                </Button>
                            </div>

                            <p className="mt-4 max-w-md text-sm text-muted-foreground">{proDescription}</p>

                            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                                {PRO_FEATURES.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                                        <Check {...ICON} className="mt-0.5 size-4 shrink-0 text-primary" weight="bold" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Free — quiet note, not a competing tower */}
                        <div className="rounded-2xl border border-border bg-secondary/40 p-6">
                            <p className="text-sm font-semibold text-foreground">Free, para siempre</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Para empezar a ordenar tus deudas sin pagar nada.
                            </p>
                            <ul className="mt-4 space-y-2">
                                {FREE_FEATURES.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground/80">
                                        <Check {...ICON} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href={freeCtaHref}
                                className="mt-5 inline-flex text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                            >
                                {freeCtaLabel} →
                            </Link>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:gap-6">
                        <p>Tarjeta (Visa/Mastercard en GTQ) vía Recurrente desde el checkout PRO.</p>
                        <p>
                            Sin tarjeta:{' '}
                            <Link href="/pago-manual" className="underline underline-offset-2 hover:text-foreground">
                                transferencia bancaria
                            </Link>
                            .
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
