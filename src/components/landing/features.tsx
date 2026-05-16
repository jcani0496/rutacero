'use client';

import { motion } from 'framer-motion';
import {
    CreditCard,
    Target,
    LineChart,
    Calculator,
    Download,
    Tag,
    Bell,
    Shield
} from 'lucide-react';

const features = [
    {
        icon: CreditCard,
        title: 'Todas tus deudas en un solo lugar',
        description: 'Tarjetas, préstamos, cuotas, deudas informales. Todo organizado y fácil de ver.',
        gradient: 'from-blue-500 to-cyan-500',
        span: 'col-span-1 md:col-span-2',
    },
    {
        icon: Target,
        title: 'Plan de pago personalizado',
        description: 'Te mostramos dos formas de pagar: empezar por la deuda más cara o por la más pequeña. Tú eliges la que mejor te funcione.',
        gradient: 'from-primary to-amber-500',
        span: 'col-span-1',
    },
    {
        icon: LineChart,
        title: 'Visualiza tu progreso',
        description: 'Gráficos que muestran cuánto has pagado y cuánto te falta.',
        gradient: 'from-green-500 to-emerald-500',
        span: 'col-span-1',
    },
    {
        icon: Calculator,
        title: 'Simulador What-If',
        description: '¿Qué pasa si pago Q500 extra al mes? Prueba diferentes montos y mira cómo cambia tu plan.',
        gradient: 'from-purple-500 to-pink-500',
        span: 'col-span-1 md:col-span-2',
        pro: true,
    },
    {
        icon: Download,
        title: 'Exporta a CSV',
        description: 'Descarga tus datos para tu contador o control personal.',
        gradient: 'from-amber-500 to-orange-500',
        span: 'col-span-1',
        pro: true,
    },
    {
        icon: Tag,
        title: 'Etiquetas personalizadas',
        description: 'Organiza tus deudas con tags como "Urgente", "Casa", "Auto".',
        gradient: 'from-rose-500 to-red-500',
        span: 'col-span-1',
        pro: true,
    },
    {
        icon: Bell,
        title: 'Recordatorios de pago',
        description: 'Recibe emails antes de cada fecha de pago según las fechas que tú registres.',
        gradient: 'from-indigo-500 to-violet-500',
        span: 'col-span-1',
    },
    {
        icon: Shield,
        title: 'Privacidad primero',
        description: 'No conectamos tus cuentas bancarias. Tu información solo la ves tú.',
        gradient: 'from-teal-500 to-cyan-500',
        span: 'col-span-1',
    },
];

export function FeaturesSection() {
    return (
        <section id="features" className="scroll-mt-20 py-24 bg-muted/30 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
                        Todo lo que necesitas para{' '}
                        <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                            salir de deudas
                        </span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Herramientas poderosas, diseño simple. Enfócate en lo que importa: pagar tus deudas.
                    </p>
                </motion.div>

                {/* Bento grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            whileHover={{
                                scale: 1.02,
                                rotateX: 2,
                                rotateY: 2,
                                transition: { duration: 0.2 }
                            }}
                            className={`${feature.span} group relative bg-card rounded-2xl border border-border p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden`}
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            {/* Gradient hover effect */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                            {/* PRO badge */}
                            {feature.pro && (
                                <div className="absolute top-4 right-4 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full">
                                    PRO
                                </div>
                            )}

                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                <feature.icon className="w-6 h-6 text-white" />
                            </div>

                            {/* Content */}
                            <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                                {feature.title}
                            </h3>
                            <p className="text-muted-foreground">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
