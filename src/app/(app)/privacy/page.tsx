import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
    title: 'Política de Privacidad | RutaCero',
    description: 'Información sobre cómo protegemos y tratamos tus datos personales',
};

export default function PrivacyPage() {
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                        <Shield className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Política de Privacidad</h1>
                        <p className="text-sm text-muted-foreground">Última actualización: 28 de diciembre de 2024</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none">
                <section>
                    <h2>1. Introducción</h2>
                    <p>
                        En RutaCero nos comprometemos a proteger la privacidad de nuestros usuarios. Esta Política
                        de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos su información
                        personal de conformidad con:
                    </p>
                    <ul>
                        <li>La Constitución Política de la República de Guatemala (Artículos 24 y 31)</li>
                        <li>La Ley para la Protección de Datos Personales (aprobada en noviembre de 2024)</li>
                        <li>La Ley de Acceso a la Información Pública (Decreto 57-2008)</li>
                        <li>Normativas internacionales de protección de datos</li>
                    </ul>
                </section>

                <section>
                    <h2>2. Responsable del Tratamiento</h2>
                    <p>
                        El responsable del tratamiento de sus datos personales es RutaCero, con domicilio en
                        Ciudad de Guatemala, Guatemala.
                    </p>
                    <p>
                        <strong>Delegado de Protección de Datos:</strong><br />
                        Correo electrónico: privacidad@rutacero.com
                    </p>
                </section>

                <section>
                    <h2>3. Datos que Recopilamos</h2>

                    <h3>3.1 Datos de Identificación</h3>
                    <ul>
                        <li>Nombre (opcional)</li>
                        <li>Dirección de correo electrónico</li>
                        <li>Preferencias de cuenta (moneda, día de corte)</li>
                    </ul>

                    <h3>3.2 Datos Financieros</h3>
                    <ul>
                        <li>Información de deudas (acreedor, monto, tasa de interés, fechas)</li>
                        <li>Registro de pagos realizados</li>
                        <li>Etiquetas y categorías personalizadas</li>
                    </ul>
                    <p>
                        <strong>IMPORTANTE:</strong> NO recopilamos ni almacenamos números de cuenta bancaria,
                        números de tarjeta de crédito completos, contraseñas de instituciones financieras ni
                        información de acceso a sus cuentas bancarias.
                    </p>

                    <h3>3.3 Datos de Uso</h3>
                    <ul>
                        <li>Información del dispositivo y navegador</li>
                        <li>Dirección IP</li>
                        <li>Páginas visitadas y acciones realizadas</li>
                        <li>Fecha y hora de acceso</li>
                    </ul>

                    <h3>3.4 Datos de Pago</h3>
                    <p>
                        Los pagos web se procesan a través de Recurrente y las compras Android dentro de la app
                        se procesan mediante Google Play. No almacenamos información de tarjetas de crédito en
                        nuestros servidores.
                    </p>
                </section>

                <section>
                    <h2>4. Base Legal y Finalidad del Tratamiento</h2>

                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                <th className="text-left">Finalidad</th>
                                <th className="text-left">Base Legal</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Prestación del servicio</td>
                                <td>Ejecución del contrato</td>
                            </tr>
                            <tr>
                                <td>Procesamiento de pagos</td>
                                <td>Ejecución del contrato</td>
                            </tr>
                            <tr>
                                <td>Comunicaciones sobre el servicio</td>
                                <td>Interés legítimo</td>
                            </tr>
                            <tr>
                                <td>Mejora de la plataforma</td>
                                <td>Interés legítimo</td>
                            </tr>
                            <tr>
                                <td>Cumplimiento legal</td>
                                <td>Obligación legal</td>
                            </tr>
                            <tr>
                                <td>Marketing (con consentimiento)</td>
                                <td>Consentimiento</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section>
                    <h2>5. Sus Derechos (ARCO-POL)</h2>
                    <p>
                        Conforme a la Ley para la Protección de Datos Personales de Guatemala, usted tiene
                        los siguientes derechos sobre sus datos personales:
                    </p>

                    <ul>
                        <li>
                            <strong>Acceso:</strong> Derecho a conocer qué datos personales tenemos sobre usted
                            y cómo los tratamos.
                        </li>
                        <li>
                            <strong>Rectificación:</strong> Derecho a solicitar la corrección de datos inexactos
                            o incompletos.
                        </li>
                        <li>
                            <strong>Cancelación:</strong> Derecho a solicitar la eliminación de sus datos cuando
                            ya no sean necesarios.
                        </li>
                        <li>
                            <strong>Oposición:</strong> Derecho a oponerse al tratamiento de sus datos en
                            determinadas circunstancias.
                        </li>
                        <li>
                            <strong>Portabilidad:</strong> Derecho a recibir sus datos en un formato estructurado
                            y de uso común.
                        </li>
                        <li>
                            <strong>Olvido:</strong> Derecho a solicitar la eliminación de sus datos de nuestros
                            sistemas y los de terceros.
                        </li>
                        <li>
                            <strong>Limitación:</strong> Derecho a solicitar la limitación del tratamiento en
                            casos específicos.
                        </li>
                    </ul>

                    <p>
                        Para ejercer cualquiera de estos derechos, envíe una solicitud a
                        <strong> privacidad@rutacero.com</strong> incluyendo:
                    </p>
                    <ul>
                        <li>Su nombre completo</li>
                        <li>Correo electrónico asociado a su cuenta</li>
                        <li>Descripción clara de su solicitud</li>
                        <li>Documento de identificación (para verificar su identidad)</li>
                    </ul>
                    <p>
                        Responderemos a su solicitud de forma gratuita en un plazo máximo de 15 días hábiles,
                        conforme a la ley.
                    </p>
                </section>

                <section>
                    <h2>6. Compartición de Datos</h2>
                    <p>
                        <strong>NO vendemos ni alquilamos sus datos personales a terceros.</strong>
                    </p>
                    <p>Compartimos datos únicamente con:</p>
                    <ul>
                        <li>
                            <strong>Proveedores de servicios:</strong> Recurrente (pagos), Supabase (infraestructura),
                            bajo acuerdos de confidencialidad y protección de datos.
                        </li>
                        <li>
                            <strong>Autoridades competentes:</strong> Cuando sea requerido por ley o por orden judicial
                            emitida por tribunal guatemalteco competente.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2>7. Seguridad de los Datos</h2>
                    <p>
                        Implementamos medidas técnicas y organizativas para proteger sus datos, incluyendo:
                    </p>
                    <ul>
                        <li>Cifrado de datos en tránsito (HTTPS/TLS)</li>
                        <li>Cifrado de datos en reposo</li>
                        <li>Autenticación segura</li>
                        <li>Acceso restringido basado en roles</li>
                        <li>Monitoreo y auditoría de accesos</li>
                        <li>Copias de seguridad regulares</li>
                    </ul>
                    <p>
                        En caso de una violación de seguridad que afecte sus datos, le notificaremos conforme
                        a los plazos y procedimientos establecidos por la ley guatemalteca.
                    </p>
                </section>

                <section>
                    <h2>8. Retención de Datos</h2>
                    <p>Conservamos sus datos durante:</p>
                    <ul>
                        <li>
                            <strong>Datos de cuenta:</strong> Mientras su cuenta esté activa, más 1 año adicional
                            para permitir reactivación.
                        </li>
                        <li>
                            <strong>Datos financieros:</strong> Mientras su cuenta esté activa o según lo requiera
                            la ley para fines contables (hasta 4 años según el Código de Comercio de Guatemala).
                        </li>
                        <li>
                            <strong>Datos de pago:</strong> Según los requisitos legales tributarios de Guatemala
                            (mínimo 4 años).
                        </li>
                    </ul>
                    <p>
                        Puede solicitar la eliminación de sus datos en cualquier momento, sujeto a nuestras
                        obligaciones legales de retención.
                    </p>
                </section>

                <section>
                    <h2>9. Transferencias Internacionales</h2>
                    <p>
                        Nuestros servidores y proveedores de servicios pueden estar ubicados fuera de Guatemala.
                        Cuando transferimos datos internacionalmente, nos aseguramos de que:
                    </p>
                    <ul>
                        <li>El país de destino ofrezca un nivel adecuado de protección</li>
                        <li>Existan cláusulas contractuales estándar de protección de datos</li>
                        <li>Se cumplan las garantías establecidas por la normativa guatemalteca</li>
                    </ul>
                </section>

                <section>
                    <h2>10. Cookies y Tecnologías Similares</h2>
                    <p>Utilizamos cookies esenciales para:</p>
                    <ul>
                        <li>Mantener su sesión activa</li>
                        <li>Recordar sus preferencias</li>
                        <li>Garantizar la seguridad de la plataforma</li>
                    </ul>
                    <p>
                        No utilizamos cookies de seguimiento publicitario de terceros. Puede configurar su
                        navegador para rechazar cookies, aunque esto puede afectar la funcionalidad de la
                        plataforma.
                    </p>
                </section>

                <section>
                    <h2>11. Menores de Edad</h2>
                    <p>
                        RutaCero está dirigido exclusivamente a personas mayores de 18 años. No recopilamos
                        intencionalmente datos de menores de edad. Si descubrimos que hemos recopilado datos
                        de un menor, los eliminaremos inmediatamente.
                    </p>
                </section>

                <section>
                    <h2>12. Cambios a Esta Política</h2>
                    <p>
                        Podemos actualizar esta política periódicamente. Los cambios materiales serán notificados
                        por correo electrónico con al menos 15 días de anticipación. El uso continuado de la
                        plataforma después de los cambios constituye aceptación de la política actualizada.
                    </p>
                </section>

                <section>
                    <h2>13. Contacto y Reclamaciones</h2>
                    <p>
                        Para cualquier pregunta, solicitud o reclamación relacionada con sus datos personales:
                    </p>
                    <ul>
                        <li><strong>Correo electrónico:</strong> privacidad@rutacero.com</li>
                        <li><strong>Dirección:</strong> Ciudad de Guatemala, Guatemala</li>
                    </ul>
                    <p>
                        Si considera que sus derechos no han sido debidamente atendidos, puede presentar una
                        reclamación ante la autoridad de protección de datos de Guatemala o los tribunales
                        competentes.
                    </p>
                </section>
            </div>

            {/* Footer */}
            <div className="border-t border-border pt-6">
                <p className="text-sm text-muted-foreground text-center">
                    Al utilizar RutaCero, usted confirma que ha leído y comprendido esta Política de Privacidad.
                </p>
                <div className="flex justify-center gap-4 mt-4">
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
