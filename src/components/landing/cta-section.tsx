'use client';

import { motion, MotionConfig } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';
import { Button } from '@/components/ui/button';
import { QuetzalMark } from '@/components/brand/quetzal-mark';

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
    headline = '¿Listo para decirle',
    accent = 'adiós a las deudas',
    description = 'Empieza gratis hoy. Sube a PRO solo si quieres probar diferentes planes de pago o ponerte metas.',
    primaryHref = '/signup',
    primaryLabel = 'Crear mi cuenta gratis',
    secondaryHref = '/pricing',
    secondaryLabel = 'Ver planes PRO',
}: CTASectionProps) {
    return (
        <MotionConfig reducedMotion="user">
            <section className="bg-[#111111] py-20 sm:py-28">
                <div className="mx-auto max-w-3xl px-6 text-center">
                    <motion.div
                        data-motion
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="mx-auto mb-8 inline-flex size-14 items-center justify-center rounded-full bg-[#0D9488]">
                            <QuetzalMark className="size-7 text-white" />
                        </div>

                        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            {headline} {accent}?
                        </h2>

                        <p className="mt-4 text-lg text-white/60">
                            {description}
                        </p>

                        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
                            <Button
                                size="lg"
                                className="group bg-white px-7 text-[#111111] hover:bg-white/90"
                                asChild
                            >
                                <Link href={primaryHref}>
                                    {primaryLabel}
                                    <ArrowRight {...ICON} className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
                                </Link>
                            </Button>
                            <Link
                                href={secondaryHref}
                                className="text-sm font-semibold text-[#5EEAD4] underline-offset-4 hover:underline"
                            >
                                {secondaryLabel}
                            </Link>
                        </div>

                        <p className="mt-8 text-sm text-white/40">
                            No te pedimos tarjeta. Si cancelas PRO, no te volvemos a cobrar.
                        </p>
                    </motion.div>
                </div>
            </section>
        </MotionConfig>
    );
}
