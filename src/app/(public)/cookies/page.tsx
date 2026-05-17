import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
    title: 'Política de Cookies | RutaCero',
    description:
        'Información sobre el uso de cookies en RutaCero: cookies esenciales, sin seguimiento publicitario.',
};

export default function CookiesPage() {
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                        <Cookie className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Política de Cookies</h1>
                        <p className="text-sm text-muted-foreground">Última actualización: 16 de mayo de 2026</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none">
                <section>
                    <h2>1. Qué son las cookies</h2>
                    <p>
                        Las cookies son pequeños archivos de texto que un sitio web almacena en tu
                        navegador cuando lo visitas. Sirven para que el sitio recuerde información
                        sobre tu visita, como tu sesión iniciada o tus preferencias, y así puedas
                        usarlo de forma fluida sin tener que reintroducir esos datos en cada página.
                    </p>
                </section>

                <section>
                    <h2>2. Cookies que RutaCero usa</h2>
                    <p>
                        RutaCero usa únicamente cookies esenciales necesarias para el funcionamiento
                        de la plataforma. No usamos cookies analíticas ni publicitarias.
                    </p>

                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                <th className="text-left">Cookie</th>
                                <th className="text-left">Tipo</th>
                                <th className="text-left">Finalidad</th>
                                <th className="text-left">Duración</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>rutacero-auth</code></td>
                                <td>Esencial</td>
                                <td>Mantener tu sesión iniciada en la plataforma.</td>
                                <td>Sesión / 7 días</td>
                            </tr>
                            <tr>
                                <td><code>rutacero-cookie-consent</code></td>
                                <td>Esencial</td>
                                <td>Recordar tu preferencia respecto al aviso de cookies.</td>
                                <td>1 año</td>
                            </tr>
                            <tr>
                                <td><code>rutacero-attribution</code></td>
                                <td>Esencial</td>
                                <td>
                                    Conservar el contexto de la campaña o partner que te trajo a
                                    la plataforma para preservar la atribución del registro.
                                </td>
                                <td>30 días</td>
                            </tr>
                            <tr>
                                <td><code>admin_session</code></td>
                                <td>Esencial</td>
                                <td>
                                    Mantener la sesión del panel administrativo interno (solo
                                    para personal autorizado de RutaCero).
                                </td>
                                <td>Sesión</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section>
                    <h2>3. No usamos cookies de terceros con fines publicitarios</h2>
                    <p>
                        <strong>
                            RutaCero no utiliza cookies publicitarias, cookies de seguimiento de
                            terceros, píxeles de redes sociales ni herramientas de remarketing.
                        </strong>{' '}
                        No vendemos ni compartimos tu información de navegación con redes
                        publicitarias.
                    </p>
                    <p>
                        Las cookies que usamos son técnicamente necesarias para que la plataforma
                        funcione (mantener tu sesión, recordar tu preferencia sobre este mismo
                        aviso, conservar el contexto de tu registro). Si las deshabilitas, puede
                        que partes esenciales del servicio dejen de funcionar.
                    </p>
                </section>

                <section>
                    <h2>4. Cómo gestionar tus cookies</h2>
                    <p>
                        Puedes aceptar, rechazar o eliminar las cookies desde la configuración de
                        tu navegador. Ten en cuenta que deshabilitar las cookies esenciales puede
                        impedirte iniciar sesión o usar la plataforma con normalidad.
                    </p>
                    <p>Guías oficiales de los navegadores más comunes:</p>
                    <ul>
                        <li>
                            <a
                                href="https://support.google.com/chrome/answer/95647"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Google Chrome
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Mozilla Firefox
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://support.apple.com/es-es/guide/safari/sfri11471/mac"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Safari
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Microsoft Edge
                            </a>
                        </li>
                    </ul>
                </section>

                <section>
                    <h2>5. Cambios a esta política</h2>
                    <p>
                        Si modificamos las cookies que usamos o el alcance de esta política,
                        actualizaremos esta página y la fecha de &quot;Última actualización&quot; al
                        inicio del documento. Para cambios materiales notificaremos a los usuarios
                        registrados por correo electrónico.
                    </p>
                </section>

                <section>
                    <h2>6. Contacto</h2>
                    <p>
                        Si tienes preguntas sobre esta política de cookies, escríbenos a{' '}
                        <strong>privacidad@rutacero.com</strong>.
                    </p>
                </section>
            </div>

            {/* Footer */}
            <div className="border-t border-border pt-6">
                <p className="text-sm text-muted-foreground text-center">
                    Al continuar usando RutaCero, aceptas el uso de cookies esenciales descrito en
                    esta política.
                </p>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                    <Button variant="outline" asChild>
                        <Link href="/privacy">Ver Política de Privacidad</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/terms">Ver Términos de Servicio</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/">Volver al Inicio</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
