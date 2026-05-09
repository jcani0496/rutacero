'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Rocket, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SPARKLES = Array.from({ length: 6 }, (_, i) => {
    // Deterministic "random-looking" values to avoid SSR/client hydration mismatch.
    const top = 20 + ((i * 37) % 60); // 20-79
    const left = 10 + ((i * 53) % 80); // 10-89
    const duration = 2 + (((i * 29) % 200) / 100); // 2.00-3.99
    const delay = (((i * 17) % 200) / 100); // 0.00-1.99

    return { top, left, duration, delay };
});

interface CTASectionProps {
    headline?: string;
    accent?: string;
    description?: string;
    primaryHref?: string;
    primaryLabel?: string;
    secondaryHref?: string;
    secondaryLabel?: string;
}

export function CTASection({
    headline = 'Listo para decirle',
    accent = 'adios a las deudas',
    description = 'Comienza gratis hoy y activa PRO solo cuando necesites mas contexto, escenarios y seguimiento.',
    primaryHref = '/signup',
    primaryLabel = 'Crear mi cuenta gratis',
    secondaryHref = '/pricing',
    secondaryLabel = 'Ver planes PRO',
}: CTASectionProps) {
    return (
        <section className="py-24 relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-amber-500/20 to-orange-500/20" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(0,0,0,0)_0%,rgba(0,0,0,0.3)_100%)]" />

            {/* Animated shapes */}
            <motion.div
                className="absolute top-10 left-10 w-32 h-32 border border-white/10 rounded-full"
                animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
                className="absolute bottom-10 right-10 w-24 h-24 bg-white/5 rounded-2xl"
                animate={{
                    y: [0, -30, 0],
                    rotate: [0, 45, 0],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute top-1/2 right-1/4 w-16 h-16 bg-amber-500/20 rounded-full blur-xl"
                animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 0.8, 0.5],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Floating sparkles */}
            {SPARKLES.map((s, i) => (
                <motion.div
                    key={i}
                    className="absolute"
                    style={{
                        top: `${s.top}%`,
                        left: `${s.left}%`,
                    }}
                    animate={{
                        y: [0, -20, 0],
                        opacity: [0.3, 1, 0.3],
                    }}
                    transition={{
                        duration: s.duration,
                        repeat: Infinity,
                        delay: s.delay,
                    }}
                >
                    <Sparkles className="w-4 h-4 text-amber-400/50" />
                </motion.div>
            ))}

            <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-4xl mx-auto text-center">
                    {/* Icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ type: 'spring', duration: 0.8 }}
                        className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-amber-500 mb-8 shadow-2xl shadow-primary/30"
                    >
                        <Rocket className="w-10 h-10 text-white" />
                    </motion.div>

                    {/* Headline */}
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6"
                    >
                        {headline}{' '}
                        <span className="bg-gradient-to-r from-primary via-amber-500 to-orange-500 bg-clip-text text-transparent">
                            {accent}
                        </span>
                        ?
                    </motion.h2>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
                    >
                        {description}
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center"
                    >
                        <Button
                            size="lg"
                            className="group bg-white text-primary hover:bg-white/90 px-8 py-6 text-lg shadow-xl hover:shadow-2xl transition-all duration-300"
                            asChild
                        >
                            <Link href={primaryHref}>
                                {primaryLabel}
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="border-2 border-white/30 text-foreground hover:bg-white/10 px-8 py-6 text-lg backdrop-blur-sm"
                            asChild
                        >
                            <Link href={secondaryHref}>
                                {secondaryLabel}
                            </Link>
                        </Button>
                    </motion.div>

                    {/* Trust text */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="mt-8 text-sm text-muted-foreground"
                    >
                        Sin tarjeta de crédito • Sin conexión bancaria • Cancela cuando quieras
                    </motion.p>
                </div>
            </div>
        </section>
    );
}
