'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { ReactNode } from 'react';

const TOP_FAQS: Array<{ question: string; answer: ReactNode }> = [
    {
        question: '¿RutaCero es un asesor financiero o me garantiza salir de deudas?',
        answer:
            'No. RutaCero es una herramienta de organización y planificación: cargas tus deudas y generas un plan de pagos. No es asesoría financiera ni promete un ahorro exacto o una fecha de libertad garantizada. Los resultados dependen de tus pagos reales y de los datos que ingreses.',
    },
    {
        question: '¿RutaCero es realmente gratis?',
        answer: 'Sí. El plan Free aguanta hasta 5 deudas y no caduca. Si llegas al límite, te avisamos y decides si pasas a PRO o te quedas ahí.',
    },
    {
        question: '¿Necesito conectar mis cuentas bancarias?',
        answer: 'No. RutaCero no se conecta a tus bancos. Ingresas la información a mano, así mantienes el control y no compartes credenciales bancarias.',
    },
    {
        question: '¿Qué métodos de pago aceptan para PRO?',
        answer: 'En web: tarjeta Visa/Mastercard vía Recurrente en GTQ, o transferencia bancaria (misma PRO, sin tarjeta). En Android el pase se compra en Google Play.',
    },
    {
        question: '¿Mis datos están seguros?',
        answer: 'Protegemos el acceso y la sesión con controles de seguridad, no pedimos credenciales bancarias y la información financiera que ingresas permanece separada por workspace.',
    },
];

export function FAQSection() {
    return (
        <section id="faq" className="scroll-mt-24 border-b border-border py-20 sm:py-28">
            <div className="mx-auto max-w-6xl px-6">
                <motion.div
                    data-motion
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                        <div className="max-w-xl">
                            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Preguntas frecuentes
                            </h2>
                            <p className="mt-3 text-lg text-muted-foreground">
                                Respuestas directas primero. RutaCero es una herramienta de planificación, no asesoría ni promesa de resultado.
                            </p>
                        </div>
                        <Link
                            href="/help"
                            className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                        >
                            Ver todas en el Centro de ayuda →
                        </Link>
                    </div>

                    <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
                        {TOP_FAQS.map((faq) => (
                            <div key={faq.question} className="border-t border-border pt-5">
                                <dt className="text-base font-semibold text-foreground">{faq.question}</dt>
                                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
                            </div>
                        ))}
                    </dl>
                </motion.div>
            </div>
        </section>
    );
}
