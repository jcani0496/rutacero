'use client';

import { motion, MotionConfig } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Landmark, MapPin, Shield, TrendingDown } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { TimedWordRotator } from '@/components/ui/timed-word-rotator';

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
    headlinePrefix = 'Salí de deudas',
    headlineWords = ['Un plan', 'Sin tener que adivinar', 'Sabiendo cuánto te falta', 'Pagando lo menos en intereses'],
    subheadline = 'Ordená tus tarjetas, préstamos, cuotas y hasta lo que le debés al primo. Todo en quetzales. Nunca te pedimos las claves de tu banco.',
    primaryHref = '/signup',
    primaryLabel = 'Empezar gratis',
    secondaryHref = '/login',
    secondaryLabel = 'Ya tengo cuenta',
}: HeroSectionProps) {
    return (
        <MotionConfig reducedMotion="user">
        <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden">
            {/* Atmospheric background */}
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.10),transparent_45%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.08),transparent_50%)]" />

            {/* Content */}
            <div className="relative z-10 container mx-auto px-4 py-16 sm:py-20">
                <div className="max-w-4xl mx-auto text-center">
                    {/* Brand — hero-level signal */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45 }}
                        className="mb-6 flex flex-col items-center gap-3"
                    >
                        <BrandLogo height={64} priority variant="auto" />
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs sm:text-sm font-medium text-primary">
                                {badge}
                            </span>
                        </div>
                    </motion.div>

                    {/* Main headline — supports brand, does not overpower it */}
                    <motion.h1
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.08 }}
                        className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-4 sm:mb-6"
                    >
                        {headlinePrefix}{' '}
                        <br className="hidden sm:block" />
                        <TimedWordRotator
                            words={headlineWords}
                            className="text-primary"
                        />
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.16 }}
                        className="text-base sm:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto"
                    >
                        {subheadline}
                    </motion.p>

                    {/* CTAs first — above the fold on mobile */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.22 }}
                        className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-3"
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

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.28 }}
                        className="text-xs sm:text-sm text-muted-foreground mb-8 sm:mb-10 max-w-xl mx-auto"
                    >
                        RutaCero es una herramienta de planificación. No promete ahorros exactos ni libertad financiera garantizada.
                    </motion.p>

                    {/* Trust strip — after CTA so primary action stays above-fold on small screens */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.32 }}
                        className="mx-auto mb-8 grid max-w-3xl gap-2 sm:gap-3 rounded-2xl sm:rounded-3xl border border-border/60 bg-background/80 p-3 sm:p-4 text-left shadow-sm backdrop-blur grid-cols-1 sm:grid-cols-3"
                    >
                        <div className="rounded-xl sm:rounded-2xl bg-muted/60 p-3 sm:p-4">
                            <Landmark className="mb-2 sm:mb-3 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            <p className="text-sm font-semibold text-foreground">Hecho para Guatemala</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Precios, pagos y decisiones pensadas para usuarios en Guatemala.
                            </p>
                        </div>
                        <div className="rounded-xl sm:rounded-2xl bg-muted/60 p-3 sm:p-4">
                            <Shield className="mb-2 sm:mb-3 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            <p className="text-sm font-semibold text-foreground">Sin banca conectada</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Tu plan se construye con la información que ingresás, no con tus claves bancarias.
                            </p>
                        </div>
                        <div className="rounded-xl sm:rounded-2xl bg-muted/60 p-3 sm:p-4">
                            <BadgeCheck className="mb-2 sm:mb-3 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            <p className="text-sm font-semibold text-foreground">Cobro y acceso claros</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Empezás gratis. Si más adelante necesitás más herramientas, podés subir a PRO.
                            </p>
                        </div>
                    </motion.div>

                    {/* Trust badges */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-muted-foreground"
                    >
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary shrink-0" />
                            <span>Encriptación en reposo y backups diarios. Nunca pedimos claves de tu banco.</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-primary shrink-0" />
                            <span>Sin conexión bancaria obligatoria</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span>Plan gratuito y upgrade solo cuando lo necesités</span>
                        </div>
                    </motion.div>
                </div>
            </div>

        </section>
        </MotionConfig>
    );
}
