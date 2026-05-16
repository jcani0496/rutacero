'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Plus } from 'lucide-react';

const faqs: Array<{ question: string; answer: ReactNode }> = [
    {
        question: '¿RutaCero es realmente gratis?',
        answer: 'Sí, el plan gratuito es 100% gratis para siempre. Puedes usar hasta 5 deudas, ver tu plan de pago y acceder al dashboard sin pagar nada. Solo cobramos si decides actualizar a PRO para desbloquear más funciones.',
    },
    {
        question: '¿Mis datos están seguros?',
        answer: 'Protegemos el acceso y la sesión con controles de seguridad, no te pedimos credenciales bancarias y la información financiera que ingresas permanece separada por workspace.',
    },
    {
        question: '¿Qué métodos de pago aceptan para PRO?',
        answer: 'Aceptamos tarjetas de crédito y débito Visa y Mastercard a través de Recurrente. Los cobros se procesan en Quetzales (GTQ).',
    },
    {
        question: '¿Puedo cancelar PRO en cualquier momento?',
        answer: 'Sí, puedes cancelar tu suscripción PRO cuando quieras desde la configuración de tu cuenta. Mantendrás acceso a PRO hasta el final de tu período de facturación.',
    },
    {
        question: '¿Necesito conectar mis cuentas bancarias?',
        answer: 'No. RutaCero no se conecta a tus bancos. Tú ingresas la información a mano. Así mantienes el control y no compartes datos sensibles de tu banco.',
    },
    {
        question: '¿Qué es el Simulador What-If?',
        answer: 'Es una herramienta PRO que te permite simular escenarios de pago. Por ejemplo, puedes ver cuántos meses te ahorras si pagas Q500 extra al mes, o ver qué pasa si pagas primero la deuda más cara vs. la más pequeña.',
    },
    {
        question: '¿Quién está detrás de RutaCero?',
        answer: (
            <>
                RutaCero es una herramienta hecha en Guatemala por un equipo local. Si quieres saber más o escribirnos directamente, visita la página{' '}
                <Link href="/about" className="underline underline-offset-2 font-medium hover:text-foreground">
                    Acerca de RutaCero
                </Link>{' '}
                o escríbenos a soporte@rutacero.com.
            </>
        ),
    },
    {
        question: '¿RutaCero reporta o consulta mi historial de buró?',
        answer: 'No. RutaCero no consulta ni reporta nada al buró de crédito. Solo usamos la información que tú nos compartes dentro de la app para construir tu plan de pagos.',
    },
    {
        question: '¿Cómo elimino mi cuenta y mis datos?',
        answer: 'Puedes eliminar tu cuenta desde Configuración → Eliminar mi cuenta. La eliminación es definitiva y elimina deudas, pagos, planes y todos tus datos asociados. Hay un periodo de gracia de 7 días en el que puedes cancelar la solicitud.',
    },
    {
        question: 'Si pago PRO y el servicio cierra, ¿qué pasa con mis datos?',
        answer: 'Tienes derecho a descargar tus datos en cualquier momento (deudas y pagos) en formato CSV desde Configuración → Mis datos, sin costo. Si por cualquier razón cerráramos el servicio, te avisaríamos con al menos 30 días de anticipación y te entregaríamos un export completo de tus datos.',
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
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
                        Preguntas{' '}
                        <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                            frecuentes
                        </span>
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        ¿Tienes dudas? Aquí respondemos las más comunes.
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
                            transition={{ delay: index * 0.1 }}
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
                                    <Plus className="w-5 h-5 text-primary" />
                                </motion.div>
                            </button>

                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        id={`faq-panel-${index}`}
                                        role="region"
                                        aria-labelledby={`faq-button-${index}`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="px-6 pb-6 text-muted-foreground">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
