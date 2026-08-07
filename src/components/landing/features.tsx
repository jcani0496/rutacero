'use client';

import { motion } from 'framer-motion';

type FeatureCard = {
    title: string;
    description: string;
    span: string;
    pro?: boolean;
    comingSoon?: boolean;
    /** Typographic lead instead of decorative icon */
    lead?: string;
};

const features: FeatureCard[] = [
    {
        lead: '01',
        title: 'Todas tus deudas en un solo lugar',
        description: 'Tarjetas de BI o Banrural, cuotas de Cemaco o La Curacao, lo que debes al primo o la cooperativa.',
        span: 'col-span-1 md:col-span-2',
    },
    {
        lead: '02',
        title: 'Plan de pago personalizado',
        description: 'Te mostramos dos formas de pagar: empezar por la deuda más cara o por la más pequeña. Elige la que mejor te funcione.',
        span: 'col-span-1',
    },
    {
        lead: 'A tu favor',
        title: 'Visualiza tu progreso',
        description: 'Gráficos claros que muestran cuánto has pagado y cuánto te falta.',
        span: 'col-span-1',
    },
    {
        lead: 'PRO',
        title: 'Simulador What-If',
        description: '¿Y si metes todo el bono 14 a la tarjeta? Te dice cuánto ahorras en intereses.',
        span: 'col-span-1 md:col-span-2',
        pro: true,
    },
    {
        lead: 'CSV',
        title: 'Exporta a CSV',
        description: 'Descarga tus datos para tu contador o control personal.',
        span: 'col-span-1',
        pro: true,
        comingSoon: true,
    },
    {
        lead: 'Tags',
        title: 'Etiquetas personalizadas',
        description: 'Organiza tus deudas con tags como "Urgente", "Casa", "Auto".',
        span: 'col-span-1',
        pro: true,
    },
    {
        lead: 'Email',
        title: 'Recordatorios de pago',
        description: 'Recibe emails antes de cada fecha de pago según las fechas que tú registres.',
        span: 'col-span-1',
        comingSoon: true,
    },
    {
        lead: '0',
        title: 'Conexiones a tu banco',
        description: 'No pedimos credenciales bancarias. Tu información solo la ves tú.',
        span: 'col-span-1',
    },
];

export function FeaturesSection() {
    return (
        <section id="features" className="scroll-mt-20 py-24 bg-muted/30 relative overflow-hidden">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="container mx-auto px-4 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground tracking-tight mb-4">
                        Todo lo que necesitas para salir de deudas
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Solo lo que necesitas para salir de esto. Nada más.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.5, delay: Math.min(index, 5) * 0.06 }}
                            whileHover={{
                                y: -4,
                                transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
                            }}
                            className={`${feature.span} group relative bg-card rounded-2xl border border-border p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-colors duration-300 overflow-hidden`}
                        >
                            <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                                {feature.pro && (
                                    <div className="px-2 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full">
                                        PRO
                                    </div>
                                )}
                                {feature.comingSoon && (
                                    <div className="px-2 py-1 bg-slate-500 text-white text-xs font-semibold rounded-full">
                                        Próximamente
                                    </div>
                                )}
                            </div>

                            {feature.lead ? (
                                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-primary">
                                    {feature.lead}
                                </p>
                            ) : null}

                            <h3 className="text-xl font-semibold text-foreground mb-2">
                                {feature.title}
                            </h3>
                            <p className="text-muted-foreground">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                <p className="text-xs text-muted-foreground mt-8 text-center max-w-3xl mx-auto px-4">
                    Las marcas mencionadas en los ejemplos pertenecen a sus respectivos titulares. RutaCero no está afiliada, asociada ni endosada por ninguna de las entidades nombradas.
                </p>
            </div>
        </section>
    );
}
