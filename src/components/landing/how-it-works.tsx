'use client';

import { motion } from 'framer-motion';
import { UserPlus, ListPlus, Rocket } from 'lucide-react';

const steps = [
    {
        number: 1,
        icon: UserPlus,
        title: 'Crea tu cuenta gratis',
        description: 'Regístrate en segundos. Sin tarjeta de crédito, sin compromisos.',
    },
    {
        number: 2,
        icon: ListPlus,
        title: 'Agrega tus deudas',
        description: 'Ingresa tus tarjetas, préstamos y otras deudas. La app calcula el plan por ti.',
    },
    {
        number: 3,
        icon: Rocket,
        title: 'Sigue tu plan',
        description: 'Recibe un plan personalizado y visualiza tu progreso hacia la libertad financiera.',
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
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
                        Comienza en{' '}
                        <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                            3 simples pasos
                        </span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        No necesitas ser experto en finanzas. Te guiamos en cada paso.
                    </p>
                </motion.div>

                {/* Steps */}
                <div className="max-w-4xl mx-auto relative">
                    {/* Connecting line */}
                    <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-amber-500 to-orange-500 hidden sm:block" />

                    {steps.map((step, index) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.6, delay: index * 0.2 }}
                            className={`relative flex items-center gap-8 mb-16 last:mb-0 ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                                }`}
                        >
                            {/* Number circle */}
                            <motion.div
                                className="absolute left-8 md:left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary/30 z-10"
                                whileHover={{ scale: 1.1 }}
                                transition={{ duration: 0.25 }}
                            >
                                {step.number}
                            </motion.div>

                            {/* Content card */}
                            <motion.div
                                className={`ml-24 md:ml-0 md:w-[calc(50%-4rem)] p-6 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 ${index % 2 === 0 ? 'md:mr-auto md:pr-8' : 'md:ml-auto md:pl-8'
                                    }`}
                                whileHover={{ y: -5 }}
                            >
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <step.icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-foreground">
                                        {step.title}
                                    </h3>
                                </div>
                                <p className="text-muted-foreground">
                                    {step.description}
                                </p>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
