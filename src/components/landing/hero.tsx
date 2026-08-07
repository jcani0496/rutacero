'use client';

import { motion, MotionConfig } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ICON } from '@/components/icons/phosphor';
import { PlanMock } from '@/components/landing/plan-mock';

interface HeroSectionProps {
    kicker?: string;
    headline?: string;
    subheadline?: string;
    primaryHref?: string;
    primaryLabel?: string;
    secondaryHref?: string;
    secondaryLabel?: string;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function HeroSection({
    kicker = 'Hoja de ruta en quetzales',
    headline = 'Organiza lo que debes. Ve exactamente lo que te falta.',
    subheadline = 'Tarjetas, cuotas, préstamos y hasta lo que le debes al primo — todo en un solo plan, en quetzales. No conectamos tu banco.',
    primaryHref = '/signup',
    primaryLabel = 'Empieza gratis',
    secondaryHref = '/login',
    secondaryLabel = 'Ya tengo cuenta',
}: HeroSectionProps) {
    return (
        <MotionConfig reducedMotion="user">
            <section className="relative overflow-hidden border-b border-border">
                <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:py-28">
                    <motion.div
                        data-motion
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: EASE_OUT }}
                    >
                        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--rc-teal-text)]">
                            {kicker}
                        </p>

                        <h1 className="mt-4 max-w-xl text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
                            {headline}
                        </h1>

                        <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                            {subheadline}
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Button
                                size="lg"
                                className="group bg-[#111111] px-7 text-white hover:bg-[#2A2A2A]"
                                asChild
                            >
                                <Link href={primaryHref}>
                                    {primaryLabel}
                                    <ArrowRight {...ICON} className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
                                </Link>
                            </Button>
                            <Link
                                href={secondaryHref}
                                className="text-sm font-semibold text-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
                            >
                                {secondaryLabel}
                            </Link>
                        </div>

                        <p className="mt-6 text-sm text-muted-foreground">
                            Gratis para siempre en el plan Free. Sin tarjeta para empezar.
                        </p>
                    </motion.div>

                    <motion.div
                        data-motion
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.55, delay: 0.1, ease: EASE_OUT }}
                        className="flex justify-center lg:justify-end"
                    >
                        <PlanMock />
                    </motion.div>
                </div>
            </section>
        </MotionConfig>
    );
}
