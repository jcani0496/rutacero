import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
    { label: 'Cómo funciona', href: '#como-funciona' },
    { label: 'Funciones', href: '#features' },
    { label: 'Precios', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
] as const;

interface LandingNavProps {
    primaryHref?: string;
    primaryLabel?: string;
    secondaryHref?: string;
    secondaryLabel?: string;
}

/**
 * Desktop-only top nav. Mobile keeps the scroll-triggered
 * StickyMobileNav instead of duplicating chrome on small screens.
 */
export function LandingNav({
    primaryHref = '/signup',
    primaryLabel = 'Empieza gratis',
    secondaryHref = '/login',
    secondaryLabel = 'Ya tengo cuenta',
}: LandingNavProps) {
    return (
        <header className="sticky top-0 z-30 hidden border-b border-border/70 bg-background/85 backdrop-blur-md md:block">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
                <Link href="/" className="flex items-center" aria-label="RutaCero, inicio">
                    <BrandLogo height={24} variant="light" priority />
                </Link>

                <nav aria-label="Navegación principal" className="flex items-center gap-7 text-sm font-medium text-foreground/65">
                    {NAV_LINKS.map((link) => (
                        <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                            {link.label}
                        </a>
                    ))}
                </nav>

                <div className="flex items-center gap-4">
                    <Link
                        href={secondaryHref}
                        className="text-sm font-medium text-foreground/65 transition-colors hover:text-foreground"
                    >
                        {secondaryLabel}
                    </Link>
                    <Button
                        asChild
                        size="sm"
                        className="bg-[#111111] text-white hover:bg-[#2A2A2A]"
                    >
                        <Link href={primaryHref}>{primaryLabel}</Link>
                    </Button>
                </div>
            </div>
        </header>
    );
}
