'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const footerLinks = {
    producto: [
        { label: 'Funciones', href: '#features' },
        { label: 'Precios', href: '/pricing' },
        { label: 'FAQ', href: '#faq' },
    ],
    cuenta: [
        { label: 'Iniciar Sesión', href: '/login' },
        { label: 'Registrarse', href: '/signup' },
    ],
    soporte: [
        { label: 'Contacto', href: 'mailto:soporte@rutacero.com' },
        { label: 'Centro de ayuda', href: '/help' },
    ],
    empresa: [
        { label: 'Acerca de RutaCero', href: '/about' },
        { label: 'Política de Privacidad', href: '/privacy' },
        { label: 'Términos de Servicio', href: '/terms' },
    ],
};

export function Footer() {
    return (
        <footer className="bg-muted/50 border-t border-border">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 mb-12">
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-3 lg:col-span-1">
                        <Link href="/" className="inline-block">
                            <motion.span
                                className="text-2xl font-bold bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent"
                                whileHover={{ scale: 1.05 }}
                            >
                                RutaCero
                            </motion.span>
                        </Link>
                        <p className="text-sm text-muted-foreground mt-3">
                            Tu camino hacia la libertad financiera comienza aquí.
                        </p>
                    </div>

                    {/* Product links */}
                    <div>
                        <h4 className="font-semibold text-foreground mb-4">Producto</h4>
                        <ul className="space-y-3">
                            {footerLinks.producto.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Account links */}
                    <div>
                        <h4 className="font-semibold text-foreground mb-4">Cuenta</h4>
                        <ul className="space-y-3">
                            {footerLinks.cuenta.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support links */}
                    <div>
                        <h4 className="font-semibold text-foreground mb-4">Soporte</h4>
                        <ul className="space-y-3">
                            {footerLinks.soporte.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company links */}
                    <div>
                        <h4 className="font-semibold text-foreground mb-4">Empresa</h4>
                        <ul className="space-y-3">
                            {footerLinks.empresa.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom */}
                <div className="pt-8 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} RutaCero. Hecho con ❤️ en Guatemala.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        RutaCero no proporciona asesoría financiera. Consulta con un profesional.
                    </p>
                </div>
            </div>
        </footer>
    );
}
