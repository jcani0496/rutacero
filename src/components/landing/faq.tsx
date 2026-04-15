'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

const faqs = [
    {
        question: '¿RutaCero es realmente gratis?',
        answer: 'Sí, el plan gratuito es 100% gratis para siempre. Puedes usar hasta 5 deudas, ver tu plan de pago y acceder al dashboard sin pagar nada. Solo cobramos si decides actualizar a PRO para desbloquear más funciones.',
    },
    {
        question: '¿Mis datos están seguros?',
        answer: 'Protegemos el acceso y la sesion con controles de seguridad, no te pedimos credenciales bancarias y la informacion financiera que ingresas permanece separada por workspace.',
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
        answer: 'No. RutaCero no se conecta a tus bancos. Tu ingresas manualmente la informacion de tus deudas, lo que te da control y reduce riesgo operativo.',
    },
    {
        question: '¿Qué es el Simulador What-If?',
        answer: 'Es una herramienta PRO que te permite simular escenarios de pago. Por ejemplo, puedes ver cuántos meses te ahorras si pagas Q500 extra al mes, o qué deuda conviene pagar primero.',
    },
];

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className="py-24 relative overflow-hidden">
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
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
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
