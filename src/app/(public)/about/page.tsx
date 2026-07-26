import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
    title: 'Acerca de RutaCero | RutaCero',
    description:
        'Quiénes somos: una herramienta hecha en Guatemala para ordenar deudas con claridad.',
};

export default function AboutPage() {
    return (
        <div className="flex flex-col gap-8 p-4 sm:p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/" aria-label="Volver al inicio">
                        <ArrowLeft weight="regular" className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        Acerca de RutaCero
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Hecho en Guatemala para ordenar deudas con claridad
                    </p>
                </div>
            </div>

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

            <div className="flex justify-center pt-4">
                <Button variant="outline" asChild>
                    <Link href="/">
                        <ArrowLeft weight="regular" className="mr-2 h-4 w-4" />
                        Volver al inicio
                    </Link>
                </Button>
            </div>
        </div>
    );
}
