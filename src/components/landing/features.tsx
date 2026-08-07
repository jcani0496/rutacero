'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

function DebtListVisual() {
    const rows = [
        { name: 'BI', kind: 'Tarjeta de crédito' },
        { name: 'Banrural', kind: 'Préstamo personal' },
        { name: 'Cemaco', kind: 'Cuota 6 de 12' },
        { name: 'El primo', kind: 'Sin interés, sin fecha' },
    ];
    return (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-1.5">
            {rows.map((row, i) => (
                <div
                    key={row.name}
                    className={`flex items-center justify-between px-4 py-3 ${i !== rows.length - 1 ? 'border-b border-border' : ''}`}
                >
                    <span className="text-sm font-semibold text-foreground">{row.name}</span>
                    <span className="text-xs text-muted-foreground">{row.kind}</span>
                </div>
            ))}
        </div>
    );
}

function StrategyVisual() {
    return (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-primary bg-accent px-3 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rc-teal-text)]">Bola de nieve</p>
                    <p className="mt-1 text-xs text-muted-foreground">La deuda más chica primero</p>
                </div>
                <div className="rounded-xl border border-border px-3 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Avalancha</p>
                    <p className="mt-1 text-xs text-muted-foreground">La de más interés primero</p>
                </div>
            </div>
            <p className="mt-4 font-money text-sm text-muted-foreground">
                Ahorro estimado con avalancha: <span className="font-semibold text-foreground">Q1,240 en intereses</span>
            </p>
        </div>
    );
}

function ProgressVisual() {
    const bars = [28, 44, 61, 79];
    return (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
            <div className="flex items-end gap-3 h-28">
                {bars.map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-full w-full items-end">
                            <div
                                className="w-full rounded-md bg-primary/80"
                                style={{ height: `${h}%` }}
                            />
                        </div>
                        <span className="text-[11px] text-muted-foreground">Mes {i + 1}</span>
                    </div>
                ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Deuda restante, mes a mes.</p>
        </div>
    );
}

type Block = {
    index: string;
    title: string;
    description: string;
    detail: string;
    visual: ReactNode;
};

const BLOCKS: Block[] = [
    {
        index: '01',
        title: 'Todas tus deudas, en un solo lugar',
        description:
            'Tarjetas de BI o Banrural, cuotas de Cemaco o La Curacao, lo que le debes al primo o a la cooperativa. Todo en quetzales, todo en una lista.',
        detail: 'No pedimos credenciales bancarias. Cargas la información a mano y mantienes el control.',
        visual: <DebtListVisual />,
    },
    {
        index: '02',
        title: 'Un plan de pago que puedes comparar',
        description:
            'Te mostramos dos formas de pagar: empezar por la deuda más pequeña o por la más cara. Comparas el impacto y eliges la que te funcione.',
        detail: 'PRO agrega un simulador what-if: qué pasa si metes el bono 14 a la tarjeta este mes.',
        visual: <StrategyVisual />,
    },
    {
        index: '03',
        title: 'Progreso que se puede ver',
        description:
            'Un gráfico simple de cuánto has pagado y cuánto te falta, mes a mes. Nada de métricas que no vas a volver a mirar.',
        detail: 'Exporta tus datos a CSV cuando quieras — para tu contador o control personal.',
        visual: <ProgressVisual />,
    },
];

export function FeaturesSection() {
    return (
        <section id="features" className="scroll-mt-24 border-b border-border py-20 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <div className="max-w-xl">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                        Un plan de deudas, no un dashboard con luces
                    </h2>
                    <p className="mt-3 text-lg text-muted-foreground">
                        Tres cosas resuelven la mayoría de casos. Lo demás vive en la app cuando lo necesites.
                    </p>
                </div>

                <div className="mt-16 flex flex-col gap-16 sm:mt-20 sm:gap-24">
                    {BLOCKS.map((block, i) => (
                        <motion.div
                            key={block.index}
                            data-motion
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-80px' }}
                            transition={{ duration: 0.5, ease: EASE_OUT }}
                            className={`grid items-center gap-8 sm:grid-cols-2 sm:gap-12 ${i % 2 === 1 ? 'sm:[&>*:first-child]:order-2' : ''}`}
                        >
                            <div>
                                <span className="font-money text-sm font-semibold text-[var(--rc-teal-text)]">{block.index}</span>
                                <h3 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                                    {block.title}
                                </h3>
                                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                                    {block.description}
                                </p>
                                <p className="mt-4 text-sm text-foreground/70">
                                    {block.detail}
                                </p>
                            </div>
                            <div className="flex justify-center sm:justify-end">
                                {block.visual}
                            </div>
                        </motion.div>
                    ))}
                </div>

                <p className="mt-16 max-w-3xl text-xs text-muted-foreground">
                    Las marcas mencionadas en los ejemplos pertenecen a sus respectivos titulares. RutaCero no está afiliada, asociada ni endosada por ninguna de las entidades nombradas.
                </p>
            </div>
        </section>
    );
}
