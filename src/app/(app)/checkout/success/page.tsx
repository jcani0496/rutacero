import Link from 'next/link';
import { CheckCircle2, Crown, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
    title: 'Pago Exitoso | RutaCero',
    description: 'Tu acceso a RutaCero PRO está activo',
};

export default async function CheckoutSuccessPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolvedSearchParams = await searchParams;
    const provider = typeof resolvedSearchParams.provider === 'string'
        ? resolvedSearchParams.provider
        : null;
    const isGooglePlay = provider === 'google_play';

    return (
        <div className="flex flex-col gap-8 p-4 sm:p-6 max-w-2xl mx-auto min-h-[60vh] justify-center">
            {/* Success icon */}
            <div className="text-center space-y-4">
                <div className="flex justify-center">
                    <div className="relative">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600">
                            <CheckCircle2 className="h-12 w-12 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                            <Crown className="h-4 w-4 text-white" />
                        </div>
                    </div>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    ¡Bienvenido a PRO! 🎉
                </h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                    {isGooglePlay
                        ? 'Tu pase PRO está activo. Ahora tenés acceso a todas las funciones premium de RutaCero.'
                        : 'Tu suscripción está activa. Ahora tenés acceso a todas las funciones premium de RutaCero.'}
                </p>
            </div>

            {/* Benefits card */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">
                                Nuevas funciones desbloqueadas
                            </h3>
                            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                <li>✓ Deudas ilimitadas</li>
                                <li>✓ Simulador What-If habilitado</li>
                                <li>✓ Exportar escenarios What-If</li>
                                <li>✓ Exportación CSV disponible</li>
                                <li>✓ Historial completo visible</li>
                                <li>✓ Tags personalizados</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg">
                    <Link href="/dashboard">
                        Ir al Dashboard
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                    <Link href="/plan">
                        Probar What-If
                    </Link>
                </Button>
            </div>

            {/* Receipt note */}
            <p className="text-xs text-muted-foreground text-center">
                {isGooglePlay
                    ? 'Google Play registrará el detalle de tu compra y tu acceso quedará vinculado a tu cuenta.'
                    : 'Recibirás un correo de confirmación con los detalles de tu suscripción.'}
            </p>
        </div>
    );
}
