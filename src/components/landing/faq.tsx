'use client';

import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Plus } from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';

const faqs: Array<{ question: string; answer: ReactNode }> = [
    {
        question: '¿RutaCero es un asesor financiero o me garantiza salir de deudas?',
        answer:
            'No. RutaCero es una herramienta de organización y planificación: cargas tus deudas y generas un plan de pagos. No somos asesoría financiera, no prometemos un ahorro exacto ni una fecha de libertad garantizada. Los resultados dependen de tus pagos reales y de los datos que ingreses.',
    },
    {
        question: '¿Cómo empiezo sin escribir a soporte?',
        answer: (
            <>
                Crea tu cuenta, agrega tu primera deuda y genera un plan desde la app. La mayoría de dudas se resuelven en este FAQ, en{' '}
                <Link href="/pricing" className="underline underline-offset-2 font-medium hover:text-foreground">
                    Precios
                </Link>{' '}
                y en el{' '}
                <Link href="/help" className="underline underline-offset-2 font-medium hover:text-foreground">
                    Centro de ayuda
                </Link>{' '}
                (guías y tickets solo para problemas de producto o facturación).
            </>
        ),
    },
    {
        question: '¿RutaCero es realmente gratis?',
        answer: 'Sí. El Free aguanta hasta 5 deudas y no caduca. Si llegas al límite, te avisamos y tú decides si pasas a PRO o sigues ahí.',
    },
    {
        question: '¿Mis datos están seguros?',
        answer: 'Protegemos el acceso y la sesión con controles de seguridad, no te pedimos credenciales bancarias y la información financiera que ingresas permanece separada por workspace.',
    },
    {
        question: '¿Qué métodos de pago aceptan para PRO?',
        answer: 'En web: tarjeta Visa/Mastercard vía Recurrente en GTQ, o transferencia bancaria (misma PRO, sin tarjeta). En Android el pase se compra en Google Play.',
    },
    {
        question: '¿Puedo cancelar PRO en cualquier momento?',
        answer: 'Sí. Cancelas desde Configuración de tu cuenta y mantienes acceso a PRO hasta el final del período ya facturado. En Android el pase de Google Play vence solo (sin auto-renovación).',
    },
    {
        question: '¿Necesito conectar mis cuentas bancarias?',
        answer: 'No. RutaCero no se conecta a tus bancos. Ingresas la información a mano; así mantienes el control y no compartes credenciales bancarias.',
    },
    {
        question: '¿Qué es el Simulador What-If?',
        answer: 'Es una herramienta que simula escenarios de pago (por ejemplo, pagar extra al mes o cambiar el orden de deudas). Son estimaciones según los datos que cargas; no son una promesa de resultado.',
    },
    {
        question: '¿Ofrecen acompañamiento emocional o coaching 1:1?',
        answer: (
            <>
                No. El soporte de RutaCero es self-serve: FAQ, la app y tickets solo para fallos técnicos, facturación o cuenta. No ofrecemos terapia, coaching emocional ni asesoría personalizada por chat. Si necesitas ayuda profesional con estrés o finanzas, busca un profesional certificado; nosotros te ayudamos a usar la herramienta.
            </>
        ),
    },
    {
        question: '¿Quién está detrás de RutaCero?',
        answer: (
            <>
                RutaCero es una herramienta hecha en Guatemala. Más contexto en{' '}
                <Link href="/about" className="underline underline-offset-2 font-medium hover:text-foreground">
                    Acerca de RutaCero
                </Link>
                . Para problemas de producto o facturación que no resuelva el FAQ, usa el Centro de ayuda o soporte@rutacero.com.
            </>
        ),
    },
    {
        question: '¿RutaCero reporta o consulta mi historial de buró?',
        answer: 'No. RutaCero no consulta ni reporta nada al buró de crédito. Solo usa la información que compartes dentro de la app para armar tu plan.',
    },
    {
        question: '¿Cómo elimino mi cuenta y mis datos?',
        answer: 'Desde Configuración → Eliminar mi cuenta. Es definitivo (deudas, pagos, planes y datos asociados). Hay 7 días de gracia para cancelar la solicitud.',
    },
    {
        question: 'Si pago PRO y el servicio cierra, ¿qué pasa con mis datos?',
        answer: 'Puedes descargar deudas y pagos en CSV desde Configuración → Mis datos, sin costo. Si cerráramos el servicio, avisamos con al menos 30 días y entregamos un export completo.',
    },
];

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section id="faq" className="scroll-mt-20 py-24 relative overflow-hidden">
            <div className="container mx-auto px-4">
                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground tracking-tight mb-4">
                        Preguntas frecuentes
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Respuestas self-serve primero. RutaCero es una herramienta de planificación — no asesoría ni promesa de resultado.
                    </p>
                </motion.div>

                {/* FAQ accordion */}
                <div className="max-w-3xl mx-auto space-y-4">
                    {faqs.map((faq, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: Math.min(index, 4) * 0.04 }}
                            className="border border-border rounded-xl overflow-hidden bg-card hover:border-primary/30 transition-colors"
                        >
                            <button
                                id={`faq-button-${index}`}
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                aria-expanded={openIndex === index}
                                aria-controls={`faq-panel-${index}`}
                                className="w-full flex items-center justify-between p-6 text-left"
                            >
                                <span className="text-lg font-medium text-foreground pr-4">
                                    {faq.question}
                                </span>
                                <motion.div
                                    animate={{ rotate: openIndex === index ? 45 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
                                >
                                    <Plus {...ICON} className="w-5 h-5 text-primary" />
                                </motion.div>
                            </button>

                            <motion.div
                                id={`faq-panel-${index}`}
                                role="region"
                                aria-labelledby={`faq-button-${index}`}
                                initial={false}
                                animate={{
                                    gridTemplateRows: openIndex === index ? '1fr' : '0fr',
                                    opacity: openIndex === index ? 1 : 0,
                                }}
                                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                                style={{ display: 'grid' }}
                            >
                                <div style={{ overflow: 'hidden' }}>
                                    <div className="px-6 pb-6 text-muted-foreground">
                                        {faq.answer}
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
