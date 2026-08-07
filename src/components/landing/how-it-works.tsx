'use client';

import { motion } from 'framer-motion';

const steps = [
    {
        number: '01',
        title: 'Crea tu cuenta gratis',
        description: 'Registro en segundos. Sin tarjeta, sin compromiso.',
    },
    {
        number: '02',
        title: 'Agrega tus deudas',
        description: 'Ingresa tus tarjetas, préstamos y cuotas. La app calcula el plan por ti.',
    },
    {
        number: '03',
        title: 'Sigue tu plan',
        description: 'Ve tu progreso mes a mes y sabe exactamente cuánto te falta.',
    },
];

export function HowItWorksSection() {
    return (
        <section id="como-funciona" className="scroll-mt-24 border-b border-border py-20 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <motion.div
                    data-motion
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.5 }}
                    className="grid gap-10 sm:grid-cols-3 sm:gap-8"
                >
                    <div className="sm:col-span-3 max-w-xl">
                        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                            Cómo funciona
                        </h2>
                        <p className="mt-3 text-lg text-muted-foreground">
                            No necesitas ser experto en finanzas. Tres pasos y ya tienes tu ruta.
                        </p>
                    </div>

                    {steps.map((step) => (
                        <div key={step.number} className="border-t border-border pt-6">
                            <p className="font-money text-sm font-semibold text-[var(--rc-teal-text)]">{step.number}</p>
                            <h3 className="mt-2 text-xl font-bold text-foreground">
                                {step.title}
                            </h3>
                            <p className="mt-2 leading-relaxed text-muted-foreground">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
