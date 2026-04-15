import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
    title: 'Términos de Servicio | RutaCero',
    description: 'Términos y condiciones de uso de la plataforma RutaCero',
};

export default function TermsPage() {
    return (
        <div className="flex flex-col gap-8 p-4 sm:p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Scale className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Términos de Servicio</h1>
                        <p className="text-sm text-muted-foreground">Última actualización: 28 de diciembre de 2024</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none">
                <section>
                    <h2>1. Aceptación de los Términos</h2>
                    <p>
                        Al acceder y utilizar RutaCero (&quot;la Plataforma&quot;), usted acepta estar legalmente vinculado
                        por estos Términos de Servicio. Si no está de acuerdo con alguna parte de estos términos,
                        no debe utilizar la Plataforma.
                    </p>
                    <p>
                        Estos términos se rigen por las leyes de la República de Guatemala, incluyendo pero no
                        limitándose a la Constitución Política de la República, el Código Civil, el Código de
                        Comercio, la Ley de Protección al Consumidor y Usuario (Decreto 6-2003), y la Ley para
                        la Protección de Datos Personales (aprobada en noviembre de 2024).
                    </p>
                </section>

                <section>
                    <h2>2. Descripción del Servicio</h2>
                    <p>
                        RutaCero es una plataforma de gestión financiera personal que permite a los usuarios:
                    </p>
                    <ul>
                        <li>Registrar y dar seguimiento a sus deudas</li>
                        <li>Generar planes de pago personalizados</li>
                        <li>Visualizar proyecciones financieras</li>
                        <li>Acceder a herramientas de análisis y simulación (funciones PRO)</li>
                    </ul>
                    <p>
                        <strong>La Plataforma NO proporciona asesoría financiera, legal o fiscal profesional.</strong>
                        Las herramientas y cálculos son únicamente informativos y educativos. Para decisiones
                        financieras importantes, consulte con un profesional debidamente colegiado en Guatemala.
                    </p>
                </section>

                <section>
                    <h2>3. Requisitos de Elegibilidad</h2>
                    <p>Para utilizar RutaCero, usted debe:</p>
                    <ul>
                        <li>Ser mayor de edad (18 años) según la legislación guatemalteca</li>
                        <li>Tener capacidad legal para celebrar contratos</li>
                        <li>Proporcionar información veraz y actualizada</li>
                        <li>No utilizar la Plataforma para fines ilegales</li>
                    </ul>
                </section>

                <section>
                    <h2>4. Registro y Cuenta de Usuario</h2>
                    <p>
                        Usted es responsable de mantener la confidencialidad de sus credenciales de acceso y de
                        todas las actividades que ocurran bajo su cuenta. Debe notificarnos inmediatamente de
                        cualquier uso no autorizado de su cuenta.
                    </p>
                    <p>
                        Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos o
                        que se utilicen de manera fraudulenta.
                    </p>
                </section>

                <section>
                    <h2>5. Planes y Pagos</h2>
                    <h3>5.1 Plan Gratuito</h3>
                    <p>
                        El plan gratuito incluye funcionalidades básicas con las siguientes limitaciones:
                    </p>
                    <ul>
                        <li>Máximo 5 deudas registradas</li>
                        <li>Historial de pagos limitado a 3 meses</li>
                        <li>Sin acceso a exportación, simulador o etiquetas personalizadas</li>
                    </ul>

                    <h3>5.2 Plan PRO</h3>
                    <p>
                        El plan PRO incluye todas las funcionalidades premium. En web, el cobro se procesa como
                        suscripción mensual a través de Recurrente. En la app Android distribuida por Google Play,
                        PRO se vende como un pase de duración limitada sin auto-renovación.
                    </p>
                    <ul>
                        <li>La suscripción web se renueva automáticamente cada mes</li>
                        <li>El pase Android vence al finalizar el período comprado y requiere una nueva compra manual</li>
                        <li>La suscripción web puede cancelarse desde la configuración de su cuenta</li>
                        <li>No se realizan reembolsos por períodos parciales</li>
                    </ul>

                    <h3>5.3 Facturación</h3>
                    <p>
                        Todos los precios se muestran en Quetzales guatemaltecos (GTQ). Los cargos incluyen el
                        Impuesto al Valor Agregado (IVA) según las leyes fiscales de Guatemala.
                    </p>
                </section>

                <section>
                    <h2>6. Propiedad Intelectual</h2>
                    <p>
                        Todos los derechos de propiedad intelectual sobre la Plataforma, incluyendo pero no
                        limitándose a software, diseño, logos, textos y gráficos, son propiedad exclusiva de
                        RutaCero o de sus licenciantes.
                    </p>
                    <p>
                        Usted conserva todos los derechos sobre los datos que ingresa a la Plataforma. Al
                        utilizar el servicio, nos otorga una licencia limitada para procesar dichos datos
                        únicamente con el fin de proporcionar el servicio.
                    </p>
                </section>

                <section>
                    <h2>7. Limitación de Responsabilidad</h2>
                    <p>
                        <strong>En la máxima medida permitida por la ley guatemalteca:</strong>
                    </p>
                        <ul>
                            <li>
                            La Plataforma se proporciona &quot;tal cual&quot; sin garantías de ningún tipo, expresas o
                            implícitas
                            </li>
                        <li>
                            No garantizamos la exactitud, completitud o utilidad de los cálculos y proyecciones
                        </li>
                        <li>
                            No somos responsables por decisiones financieras tomadas basándose en la información
                            de la Plataforma
                        </li>
                        <li>
                            Nuestra responsabilidad máxima se limita al monto pagado por usted en los últimos
                            12 meses
                        </li>
                        <li>
                            No somos responsables por daños indirectos, incidentales, especiales o consecuentes
                        </li>
                    </ul>
                </section>

                <section>
                    <h2>8. Indemnización</h2>
                    <p>
                        Usted acepta indemnizar y mantener indemne a RutaCero, sus directores, empleados y
                        agentes, de cualquier reclamación, daño, pérdida o gasto (incluyendo honorarios legales)
                        que surja de:
                    </p>
                    <ul>
                        <li>Su uso de la Plataforma</li>
                        <li>Su violación de estos términos</li>
                        <li>Su violación de derechos de terceros</li>
                    </ul>
                </section>

                <section>
                    <h2>9. Modificaciones</h2>
                    <p>
                        Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios
                        entrarán en vigor al publicarse en la Plataforma. El uso continuado después de la
                        publicación constituye aceptación de los términos modificados.
                    </p>
                    <p>
                        Para cambios materiales, notificaremos a los usuarios registrados por correo electrónico
                        con al menos 15 días de anticipación.
                    </p>
                </section>

                <section>
                    <h2>10. Terminación</h2>
                    <p>
                        Podemos suspender o terminar su acceso a la Plataforma en cualquier momento, con o sin
                        causa, con o sin previo aviso. Usted puede cancelar su cuenta en cualquier momento
                        desde la configuración.
                    </p>
                    <p>
                        Tras la terminación, sus datos serán tratados conforme a nuestra Política de Privacidad.
                    </p>
                </section>

                <section>
                    <h2>11. Ley Aplicable y Jurisdicción</h2>
                    <p>
                        Estos términos se rigen por las leyes de la República de Guatemala. Cualquier disputa
                        que surja en relación con estos términos será sometida a la jurisdicción exclusiva de
                        los tribunales competentes de la Ciudad de Guatemala, Guatemala.
                    </p>
                    <p>
                        Las partes acuerdan agotar los medios alternativos de resolución de conflictos antes
                        de acudir a la vía judicial, incluyendo la mediación y el arbitraje conforme a la
                        normativa guatemalteca vigente.
                    </p>
                </section>

                <section>
                    <h2>12. Disposiciones Generales</h2>
                    <ul>
                        <li>
                            <strong>Divisibilidad:</strong> Si alguna disposición de estos términos se considera
                            inválida, las demás disposiciones permanecerán en pleno vigor y efecto.
                        </li>
                        <li>
                            <strong>Renuncia:</strong> La falta de ejercicio de cualquier derecho no constituye
                            renuncia al mismo.
                        </li>
                        <li>
                            <strong>Acuerdo Completo:</strong> Estos términos, junto con la Política de Privacidad,
                            constituyen el acuerdo completo entre las partes.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2>13. Contacto</h2>
                    <p>
                        Para preguntas sobre estos términos, contáctenos en:
                    </p>
                    <ul>
                        <li>Correo electrónico: legal@rutacero.com</li>
                        <li>Dirección: Ciudad de Guatemala, Guatemala</li>
                    </ul>
                </section>
            </div>

            {/* Footer */}
            <div className="border-t border-border pt-6">
                <p className="text-sm text-muted-foreground text-center">
                    Al utilizar RutaCero, usted confirma que ha leído, entendido y aceptado estos Términos de Servicio.
                </p>
                <div className="flex justify-center gap-4 mt-4">
                    <Button variant="outline" asChild>
                        <Link href="/privacy">Ver Política de Privacidad</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/">Volver al Inicio</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
