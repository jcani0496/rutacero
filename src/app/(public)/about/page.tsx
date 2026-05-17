import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
    title: 'Acerca de RutaCero | RutaCero',
    description:
        'Quiénes somos: una herramienta hecha en Guatemala para ordenar deudas con claridad.',
};

export default function AboutPage() {
    return (
        <div className="flex flex-col gap-8 p-4 sm:p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/" aria-label="Volver al inicio">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Info className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            Acerca de RutaCero
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Hecho en Guatemala para ordenar deudas con claridad
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none">
                <section>
                    <h2>Qué es RutaCero</h2>
                    <p>
                        RutaCero es una herramienta hecha en Guatemala para ayudar a personas y
                        familias a ordenar sus deudas y tomar mejores decisiones con su dinero, sin
                        pedir banca en línea y con un lenguaje claro y honesto.
                    </p>
                </section>

                <section>
                    <h2>Qué hacemos</h2>
                    <p>
                        Centralizamos tarjetas, préstamos, cuotas y deudas informales en quetzales.
                        Te mostramos cuánto pagas de interés, cuánto puedes ahorrar y cuál es la
                        siguiente acción concreta cada quincena.
                    </p>
                    <p>
                        No somos asesores financieros y no somos una entidad regulada por la
                        Superintendencia de Bancos de Guatemala. Somos una herramienta de
                        planificación: tú decides qué hacer con la información.
                    </p>
                </section>

                <section>
                    <h2>Quién está detrás</h2>
                    <p>
                        Equipo guatemalteco. Si tienes preguntas, comentarios o sugerencias, escribe
                        a{' '}
                        <Link
                            href="mailto:soporte@rutacero.com"
                            className="underline underline-offset-2"
                        >
                            soporte@rutacero.com
                        </Link>
                        .
                    </p>
                </section>

                <section>
                    <h2>Contacto</h2>
                    <ul>
                        <li>
                            <strong>Correo:</strong>{' '}
                            <Link
                                href="mailto:soporte@rutacero.com"
                                className="underline underline-offset-2"
                            >
                                soporte@rutacero.com
                            </Link>
                        </li>
                        <li>
                            <strong>Ubicación:</strong> Ciudad de Guatemala
                        </li>
                    </ul>
                </section>
            </div>

            {/* Footer action */}
            <div className="flex justify-center pt-4">
                <Button variant="outline" asChild>
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al inicio
                    </Link>
                </Button>
            </div>
        </div>
    );
}
