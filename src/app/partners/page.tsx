import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Envelope } from '@phosphor-icons/react/dist/ssr';

import { Button } from '@/components/ui/button';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
    title: 'Partners | RutaCero',
    description:
        'Cooperativas, coaches y organizaciones en Guatemala: explorá un piloto de RutaCero con atribución y acceso claro para tu comunidad.',
};

const PARTNER_MAIL =
    'mailto:hola@rutacero.gt?subject=Inter%C3%A9s%20partner%20RutaCero&body=Hola%2C%20quiero%20explorar%20un%20piloto%20partner%20con%20RutaCero.%0A%0AOrganizaci%C3%B3n%3A%0ACiudad%3A%0ATipo%20(cooperativa%20%2F%20coach%20%2F%20otro)%3A%0ATama%C3%B1o%20estimado%20de%20comunidad%3A%0A';

const PILOT_ITEMS = [
    {
        title: 'Landing con atribución',
        description:
            'Una ruta `/partners/tu-slug` para medir signup → plan → paid sin inventar cupones públicos.',
    },
    {
        title: 'Acceso y seats',
        description:
            'Grant admin, cupón anual o seats prepago — se define al cerrar el piloto, no como oferta genérica en la web.',
    },
] as const;

export default function PartnersIndexPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <main className="flex-1">
                <section className="relative overflow-hidden border-b border-border">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.12),_transparent_55%)]"
                    />
                    <div className="container relative mx-auto px-4 py-16 sm:py-24 max-w-3xl">
                        <p className="text-sm font-medium text-primary mb-3">Partners · Guatemala</p>
                        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
                            RutaCero para tu comunidad
                        </h1>
                        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
                            Si sos cooperativa, coach, ONG o programa de educación financiera y querés
                            ofrecer un camino claro a deudas en quetzales, escribinos. No hay catálogo
                            público de alianzas cerradas: cada piloto se arma con atribución y reglas
                            claras.
                        </p>
                        <div className="mt-8 flex flex-col sm:flex-row gap-3">
                            <Button asChild size="lg">
                                <a href={PARTNER_MAIL}>
                                    <Envelope weight="regular" className="mr-2 h-4 w-4" />
                                    Escribir a hola@rutacero.gt
                                </a>
                            </Button>
                            <Button asChild variant="outline" size="lg">
                                <Link href="/signup">
                                    Probar la app gratis
                                    <ArrowRight weight="regular" className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="container mx-auto px-4 py-14 max-w-3xl space-y-8">
                    <h2 className="text-xl font-semibold text-foreground">Qué exploramos en un piloto</h2>
                    <ul className="grid gap-4 sm:grid-cols-2">
                        {PILOT_ITEMS.map((item) => (
                            <li key={item.title} className="rounded-2xl border border-border bg-card/60 p-5">
                                <p className="font-medium text-foreground">{item.title}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {item.description}
                                </p>
                            </li>
                        ))}
                    </ul>

                    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Lead, no catálogo</p>
                        <p>
                            Esta página es el canal de contacto. Si ya tenés un slug de piloto activo,
                            usá la URL que te compartimos (`/partners/…`). Para interesarte:{' '}
                            <a className="underline underline-offset-2 text-foreground" href={PARTNER_MAIL}>
                                hola@rutacero.gt
                            </a>
                            .
                        </p>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
