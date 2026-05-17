'use client';

import { useRef } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Landmark, MapPin, Shield, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollWordRotator } from '@/components/ui/scroll-word-rotator';

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
    headlineWords = ['Un plan', 'Sin tener que adivinar', 'Sabiendo cuánto te falta', 'Pagando lo menos en intereses'],
    subheadline = 'Ordená tus tarjetas, préstamos, cuotas y hasta lo que le debés al primo. Todo en quetzales. Nunca te pedimos las claves de tu banco.',
    primaryHref = '/signup',
    primaryLabel = 'Empezar gratis',
    secondaryHref = '/login',
    secondaryLabel = 'Ya tengo cuenta',
}: HeroSectionProps) {
    const heroRef = useRef<HTMLElement | null>(null);
    return (
        <MotionConfig reducedMotion="user">
        <section ref={heroRef} className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />

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
                        <MapPin className="w-4 h-4 text-primary" />
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
                        <ScrollWordRotator
                            words={headlineWords}
                            targetRef={heroRef}
                            className="text-primary"
                        />
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
                            <p className="text-sm font-semibold text-foreground">Hecho para Guatemala</p>
                            <p className="text-sm text-muted-foreground">
                                Precios, pagos y decisiones pensadas para usuarios en Guatemala.
                            </p>
                        </div>
                        <div className="rounded-2xl bg-muted/60 p-4">
                            <Shield className="mb-3 h-5 w-5 text-primary" />
                            <p className="text-sm font-semibold text-foreground">Sin banca conectada</p>
                            <p className="text-sm text-muted-foreground">
                                Tu plan se construye con la información que ingresas, no con tus claves bancarias.
                            </p>
                        </div>
                        <div className="rounded-2xl bg-muted/60 p-4">
                            <BadgeCheck className="mb-3 h-5 w-5 text-primary" />
                            <p className="text-sm font-semibold text-foreground">Cobro y acceso claros</p>
                            <p className="text-sm text-muted-foreground">
                                Empiezas gratis. Si más adelante necesitas más herramientas, puedes subir a PRO.
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
                            className="group bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
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
                            <Shield className="w-4 h-4 text-primary" />
                            <span>Encriptación en reposo y backups diarios. Nunca pedimos claves de tu banco.</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-primary" />
                            <span>Sin conexión bancaria obligatoria</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span>Plan gratuito y upgrade solo cuando lo necesites</span>
                        </div>
                    </motion.div>
                </div>
            </div>

        </section>
        </MotionConfig>
    );
}
