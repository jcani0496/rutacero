'use client';

import { motion } from 'framer-motion';

const steps = [
    {
        number: '01',
        title: 'Crea tu cuenta gratis',
        description: 'Registro en segundos. Sin tarjeta de crédito, sin compromisos.',
    },
    {
        number: '02',
        title: 'Agrega tus deudas',
        description: 'Ingresa tus tarjetas, préstamos y cuotas. La app calcula el plan por ti.',
    },
    {
        number: '03',
        title: 'Sigue tu plan',
        description: 'Visualiza tu progreso mes a mes y sabe exactamente cuánto te falta.',
    },
];

export function HowItWorksSection() {
    return (
        <section id="how-it-works" className="scroll-mt-20 py-24 relative overflow-hidden">
            <div className="container mx-auto px-4">
                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground tracking-tight mb-4">
                        Cómo funciona
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        No necesitas ser experto en finanzas. Te guiamos en cada paso.
                    </p>
                </motion.div>

                {/* Horizontal 3-step strip */}
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.4, delay: index * 0.06 }}
                            className="text-left"
                        >
                            <p className="text-sm text-muted-foreground mb-3 font-medium tracking-wide">
                                {step.number}
                            </p>
                            <h3 className="text-xl font-semibold text-foreground mb-2">
                                {step.title}
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
