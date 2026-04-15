'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Landmark, Shield, Sparkles, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Typewriter } from '@/components/ui/typewriter';

interface HeroSectionProps {
    badge?: string;
    headlinePrefix?: string;
    headlineWords?: string[];
    subheadline?: string;
    primaryHref?: string;
    primaryLabel?: string;
    secondaryHref?: string;
    secondaryLabel?: string;
}

export function HeroSection({
    badge = 'Ruta clara para deudas en Guatemala',
    headlinePrefix = 'Sal de deudas',
    headlineWords = ['mas rapido', 'sin estres', 'con un plan', 'para siempre'],
    subheadline = 'RutaCero te ayuda a ordenar tarjetas, prestamos, cuotas e incluso deudas informales en quetzales, con estrategias explicables y sin pedir banca en linea.',
    primaryHref = '/signup',
    primaryLabel = 'Empezar Gratis',
    secondaryHref = '/login',
    secondaryLabel = 'Ya tengo cuenta',
}: HeroSectionProps) {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />

            {/* Animated mesh gradient */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary/10 to-amber-500/10 rounded-full blur-3xl animate-spin-slow" />
            </div>

            {/* Floating shapes */}
            <motion.div
                className="absolute top-20 left-10 w-20 h-20 bg-primary/20 rounded-2xl"
                animate={{
                    y: [0, -20, 0],
                    rotate: [0, 5, 0],
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />
            <motion.div
                className="absolute bottom-32 right-20 w-16 h-16 bg-amber-500/20 rounded-full"
                animate={{
                    y: [0, 20, 0],
                    x: [0, 10, 0],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />
            <motion.div
                className="absolute top-40 right-32 w-12 h-12 border-2 border-primary/30 rounded-lg"
                animate={{
                    rotate: [0, 180, 360],
                    scale: [1, 1.1, 1],
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: 'linear',
                }}
            />

            {/* Content */}
            <div className="relative z-10 container mx-auto px-4 py-20">
                <div className="max-w-4xl mx-auto text-center">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
                    >
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">
                            {badge}
                        </span>
                    </motion.div>

                    {/* Main headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6"
                    >
                        {headlinePrefix}{' '}
                        <br className="hidden sm:block" />
                        <span className="bg-gradient-to-r from-primary via-amber-500 to-orange-500 bg-clip-text text-transparent">
                            <Typewriter
                                words={headlineWords}
                                typingSpeed={80}
                                deletingSpeed={40}
                                pauseDuration={2500}
                            />
                        </span>
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
                    >
                        {subheadline}
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.25 }}
                        className="mx-auto mb-10 grid max-w-3xl gap-3 rounded-3xl border border-border/60 bg-background/80 p-4 text-left shadow-sm backdrop-blur sm:grid-cols-3"
                    >
                        <div className="rounded-2xl bg-muted/60 p-4">
                            <Landmark className="mb-3 h-5 w-5 text-primary" />
                            <p className="text-sm font-semibold text-foreground">Hecho para GTQ</p>
                            <p className="text-sm text-muted-foreground">
                                Precios, pagos y decisiones pensadas para usuarios en Guatemala.
                            </p>
                        </div>
                        <div className="rounded-2xl bg-muted/60 p-4">
                            <Shield className="mb-3 h-5 w-5 text-emerald-500" />
                            <p className="text-sm font-semibold text-foreground">Sin banca conectada</p>
                            <p className="text-sm text-muted-foreground">
                                Tu plan se construye con la informacion que ingresas, no con tus claves bancarias.
                            </p>
                        </div>
                        <div className="rounded-2xl bg-muted/60 p-4">
                            <BadgeCheck className="mb-3 h-5 w-5 text-amber-500" />
                            <p className="text-sm font-semibold text-foreground">Cobro y acceso claros</p>
                            <p className="text-sm text-muted-foreground">
                                Empiezas gratis y pasas a PRO solo si necesitas mas contexto y seguimiento.
                            </p>
                        </div>
                    </motion.div>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
                    >
                        <Button
                            size="lg"
                            className="group bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 text-white px-8 py-6 text-lg shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
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
                            className="px-8 py-6 text-lg border-2 hover:bg-muted"
                            asChild
                        >
                            <Link href={secondaryHref}>
                                {secondaryLabel}
                            </Link>
                        </Button>
                    </motion.div>

                    {/* Trust badges */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                        className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground"
                    >
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-500" />
                            <span>Sesiones protegidas y datos separados por workspace</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-primary" />
                            <span>Sin conexion bancaria obligatoria</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span>Plan gratuito y upgrade solo cuando lo necesites</span>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Scroll indicator */}
            <motion.div
                className="absolute bottom-8 left-1/2 -translate-x-1/2"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            >
                <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
                    <motion.div
                        className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full"
                        animate={{ y: [0, 12, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                </div>
            </motion.div>
        </section>
    );
}
