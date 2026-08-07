import Link from 'next/link';

const footerLinks = {
    producto: [
        { label: 'Funciones', href: '#features' },
        { label: 'Precios', href: '/pricing' },
        { label: 'FAQ', href: '#faq' },
    ],
    cuenta: [
        { label: 'Iniciar sesión', href: '/login' },
        { label: 'Registrarse', href: '/signup' },
    ],
    soporte: [
        { label: 'Contacto', href: 'mailto:soporte@rutacero.com' },
        { label: 'Centro de ayuda', href: '/help' },
    ],
    empresa: [
        { label: 'Acerca de RutaCero', href: '/about' },
        { label: 'Partners', href: '/partners' },
        { label: 'Política de privacidad', href: '/privacy' },
        { label: 'Términos de servicio', href: '/terms' },
        { label: 'Política de cookies', href: '/cookies' },
    ],
};

export function Footer() {
    return (
        <footer className="border-t border-border bg-secondary/30">
            <div className="mx-auto max-w-6xl px-6 py-16">
                <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
                    <div className="col-span-2 sm:col-span-3 lg:col-span-1">
                        <Link href="/" className="text-lg font-bold tracking-tight text-foreground" aria-label="RutaCero, inicio">
                            RutaCero
                        </Link>
                        <p className="mt-3 text-sm text-muted-foreground">
                            Software guatemalteco para dejar de deber dinero.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-foreground">Producto</h4>
                        <ul className="mt-4 space-y-3">
                            {footerLinks.producto.map((link) => (
                                <li key={link.label}>
                                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-foreground">Cuenta</h4>
                        <ul className="mt-4 space-y-3">
                            {footerLinks.cuenta.map((link) => (
                                <li key={link.label}>
                                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-foreground">Soporte</h4>
                        <ul className="mt-4 space-y-3">
                            {footerLinks.soporte.map((link) => (
                                <li key={link.label}>
                                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-foreground">Empresa</h4>
                        <ul className="mt-4 space-y-3">
                            {footerLinks.empresa.map((link) => (
                                <li key={link.label}>
                                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div role="note" aria-label="Aviso legal" className="mt-12 border-t border-border pt-6">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        <strong className="text-foreground">Aviso legal:</strong> RutaCero es una herramienta de software de
                        planificación personal. No es una institución financiera ni está supervisada
                        por la Superintendencia de Bancos de Guatemala. No constituye asesoría
                        financiera, legal, contable ni fiscal.
                    </p>
                </div>

                <div className="mt-8 flex flex-col items-center gap-2 border-t border-border pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} RutaCero. Hecho en Guatemala.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {/* TODO(founder): replace with real values once SAT inscription is issued. */}
                        Operado desde Guatemala · NIT en trámite · Contacto:{' '}
                        <a className="underline hover:text-foreground" href="mailto:hola@rutacero.gt">hola@rutacero.gt</a>
                    </p>
                </div>
            </div>
        </footer>
    );
}
