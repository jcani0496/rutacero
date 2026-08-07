'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Capacitor } from '@capacitor/core';
import {
    ArrowLeft,
    SealCheck,
    Bank,
    Check,
    CircleNotch,
    Crown,
    Lightning,
    Shield,
    ShieldCheck,
    WarningCircle
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropoffCapture } from '@/components/funnel/dropoff-capture';
import { getGooglePlayPublicConfig } from '@/lib/billing/google-play-config';
import { GooglePlayBilling, type GooglePlayProductDetails } from '@/lib/billing/google-play-plugin';
import { getProVariant, monthlyEquivalent } from '@/lib/billing/plans';
import { resolveVariantCode } from '@/lib/billing/resolve';
import { buildTrackedHref } from '@/lib/launch/experience';
import { openRecurrenteCheckout } from '@/lib/recurrente/open-checkout';

const PRO_FEATURES = [
    'Deudas ilimitadas',
    'Dashboard PRO con gráficos',
    'Simulador What-If',
    'Exportar escenarios What-If',
    'Exportar a CSV',
    'Historial completo',
    'Tags personalizados',
    'Soporte prioritario',
];

export default function CheckoutPage() {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isNativePlatform, setIsNativePlatform] = useState(false);
    const [isAndroidNative, setIsAndroidNative] = useState(false);
    const [androidProduct, setAndroidProduct] = useState<GooglePlayProductDetails | null>(null);

    const canceled = searchParams.get('canceled') === 'true';
    const ctaContext = searchParams.get('cta_context') || 'checkout';
    const variantCode = resolveVariantCode(searchParams.get('variant'));
    const variant = getProVariant(variantCode);
    const monthlyEquivalentQ = monthlyEquivalent(variantCode);
    const pricingHref = buildTrackedHref('/pricing', searchParams);
    const transferHref = (() => {
        const base = buildTrackedHref('/pago-manual', searchParams, { ctaContext: 'checkout_transfer' });
        return `${base}${base.includes('?') ? '&' : '?'}variant=${variantCode}`;
    })();
    const googlePlayConfig = getGooglePlayPublicConfig();

    useEffect(() => {
        if (canceled) {
            setError('El pago fue cancelado. Podés intentar de nuevo cuando quieras.');
        }
    }, [canceled]);

    useEffect(() => {
        const nativePlatform = Capacitor.isNativePlatform();
        const androidPlatform = nativePlatform && Capacitor.getPlatform() === 'android';

        setIsNativePlatform(nativePlatform);
        setIsAndroidNative(androidPlatform);

        if (!androidPlatform) {
            return;
        }

        let cancelled = false;

        void (async () => {
            try {
                await GooglePlayBilling.isAvailable();
                const response = await GooglePlayBilling.getProductDetails({
                    productIds: [googlePlayConfig.productId],
                });

                if (!cancelled) {
                    setAndroidProduct(
                        response.products.find((product) => product.productId === googlePlayConfig.productId) || null
                    );
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'No se pudo cargar Google Play Billing');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [googlePlayConfig.productId]);

    const handleAndroidCheckout = async () => {
        const prepareResponse = await fetch('/api/billing/google-play/prepare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ctaContext,
            }),
        });
        const prepareData = await prepareResponse.json();

        if (!prepareResponse.ok) {
            throw new Error(prepareData.error || 'No se pudo preparar la compra en Google Play');
        }

        const purchaseResponse = await GooglePlayBilling.purchaseProduct({
            productId: prepareData.productId,
            obfuscatedAccountId: prepareData.obfuscatedAccountId,
        });

        if (purchaseResponse.purchase.purchaseState === 'PENDING') {
            throw new Error('Google Play marcó la compra como pendiente. Completa la validación en Play Store e inténtalo de nuevo.');
        }

        const verifyResponse = await fetch('/api/billing/google-play/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId: purchaseResponse.purchase.productId,
                purchaseToken: purchaseResponse.purchase.purchaseToken,
                orderId: purchaseResponse.purchase.orderId,
            }),
        });
        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok) {
            throw new Error(verifyData.error || 'No se pudo validar la compra en Google Play');
        }

        window.location.assign('/checkout/success?provider=google_play');
    };

    const handleCheckout = async () => {
        setIsLoading(true);
        setError(null);

        try {
            if (isAndroidNative) {
                await handleAndroidCheckout();
                return;
            }

            const response = await fetch('/api/recurrente/create-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ctaContext,
                    variantCode,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al procesar');
            }

            const openMode = await openRecurrenteCheckout(data.checkoutUrl);

            if (openMode === 'external_browser') {
                setIsLoading(false);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al procesar el pago');
            setIsLoading(false);
        }
    };

    const variantPriceLabel = `Q${variant.priceQ}`;
    const variantTotalLabel = `Q${variant.priceQ.toFixed(2)}`;
    const variantPeriodLabel =
        variantCode === 'PRO_MONTHLY'
            ? '/mes'
            : variantCode === 'PRO_QUARTERLY'
            ? ' / 3 meses'
            : variantCode === 'PRO_ANNUAL'
            ? ' / año'
            : '';
    const priceLabel = isAndroidNative
        ? (androidProduct?.formattedPrice || 'Q49')
        : variantPriceLabel;
    const totalLabel = isAndroidNative
        ? (androidProduct?.formattedPrice || 'Q49.00')
        : variantTotalLabel;
    const orderDescription = isAndroidNative
        ? `Pase Android de ${googlePlayConfig.passDurationDays} días`
        : variant.label;

    return (
        <div className="flex flex-col gap-8 p-4 sm:p-6 max-w-4xl mx-auto">
            {/* Back button */}
            <div>
                <Button variant="ghost" size="sm" asChild>
                    <Link href={pricingHref}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver a planes
                    </Link>
                </Button>
            </div>

            {/* Header */}
            <div className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-strong">
                        <Crown className="h-8 w-8 text-primary-strong-foreground" />
                    </div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {isAndroidNative ? 'Activar Pase RutaCero PRO' : 'Suscribirse a RutaCero PRO'}
                </h1>
                <p className="text-muted-foreground">
                    {isAndroidNative
                        ? `Compra segura dentro de Google Play sin auto-renovación y acceso por ${googlePlayConfig.passDurationDays} días`
                        : 'Trabajá tu plan con más contexto, cobro en GTQ y cancelación flexible'}
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                    <Bank className="mb-3 h-5 w-5 text-primary" />
                    <p className="font-semibold text-foreground">Cobro local</p>
                    <p className="text-sm text-muted-foreground">
                        {isAndroidNative
                            ? 'El cargo se procesa dentro de Google Play y queda asociado a tu cuenta.'
                            : 'El cargo se procesa en quetzales con Recurrente.'}
                    </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                    <ShieldCheck className="mb-3 h-5 w-5 text-success" />
                    <p className="font-semibold text-foreground">Más control, no más riesgo</p>
                    <p className="text-sm text-muted-foreground">No pedimos banca en línea para construir tu plan.</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                    <SealCheck className="mb-3 h-5 w-5 text-primary" />
                    <p className="font-semibold text-foreground">Upgrade claro</p>
                    <p className="text-sm text-muted-foreground">
                        {isAndroidNative
                            ? 'Activás PRO cuando lo necesitás y volvés a comprar cuando el pase expire.'
                            : 'Activás PRO cuando lo necesitás y cancelás cuando quieras.'}
                    </p>
                </div>
            </div>

            {/* Error alert */}
            {error && (
                <Alert variant="destructive">
                    <WarningCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {!isAndroidNative && (canceled || error) && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                    <div className="space-y-1">
                        <p className="font-semibold text-foreground flex items-center gap-2">
                            <Bank className="h-4 w-4 text-primary" />
                            ¿Falló o cancelaste con tarjeta?
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Podés activar la misma PRO por transferencia bancaria en GTQ — sin tarjeta.
                        </p>
                    </div>
                    <Button asChild className="shrink-0">
                        <Link href={transferHref}>Pagar por transferencia</Link>
                    </Button>
                </div>
            )}

            {/* Main content */}
            <div className="grid gap-8 md:grid-cols-2">
                {/* Features */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lightning className="h-5 w-5 text-primary" />
                            Qué incluye PRO
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {PRO_FEATURES.map((feature, i) => (
                                <li key={i} className="flex items-center gap-3">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20">
                                        <Check className="h-3 w-3 text-green-500" />
                                    </div>
                                    <span className="text-sm">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Payment card */}
                <Card className="border-primary/50">
                    <CardHeader>
                        <CardTitle>Resumen del pedido</CardTitle>
                        <CardDescription>{orderDescription}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Price */}
                        <div className="flex flex-col gap-1 border-b border-border pb-4">
                            <div className="flex items-baseline justify-between">
                                <span className="text-muted-foreground">{isAndroidNative ? 'RutaCero PRO' : variant.label}</span>
                                <div className="text-right">
                                    <span className="text-3xl font-bold">{priceLabel}</span>
                                    {!isAndroidNative && (
                                        <span className="text-muted-foreground">{variantPeriodLabel}</span>
                                    )}
                                </div>
                            </div>
                            {!isAndroidNative && variantCode !== 'PRO_MONTHLY' && (
                                <p className="text-right text-xs text-muted-foreground">
                                    Equivale a Q{monthlyEquivalentQ.toFixed(2)} / mes
                                </p>
                            )}
                        </div>

                        {/* Total */}
                        <div className="flex items-baseline justify-between font-semibold">
                            <span>Total hoy</span>
                            <span className="text-2xl">{totalLabel}</span>
                        </div>

                        {/* CTA */}
                        <Button
                            className="w-full gradient-primary"
                            size="lg"
                            onClick={handleCheckout}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <CircleNotch {...ICON} className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <Crown className="mr-2 h-4 w-4" />
                                    {isAndroidNative ? 'Comprar Pase PRO' : 'Pagar con tarjeta'}
                                </>
                            )}
                        </Button>

                        {!isAndroidNative && (
                            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
                                <div className="flex items-start gap-2">
                                    <Bank className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">
                                            Transferencia bancaria
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Sin tarjeta o si preferís prepago. Misma variante ({variant.label}).
                                        </p>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full" asChild>
                                    <Link href={transferHref}>Continuar con transferencia</Link>
                                </Button>
                            </div>
                        )}

                        {/* Security note */}
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <Shield className="h-4 w-4" />
                            <span>
                                {isAndroidNative
                                    ? 'Compra segura procesada dentro de Google Play'
                                    : isNativePlatform
                                    ? 'Te abrimos el checkout en el navegador del sistema para pagar con tarjeta o Google Pay. Volvé a la app cuando termines.'
                                    : 'Tarjeta vía Recurrente en GTQ · transferencia como alternativa'}
                            </span>
                        </div>

                        {/* Terms */}
                        <p className="text-xs text-muted-foreground text-center">
                            Al suscribirte, aceptas nuestros{' '}
                            <Link href="/terms" className="underline hover:text-foreground">
                                términos de servicio
                            </Link>{' '}
                            y{' '}
                            <Link href="/privacy" className="underline hover:text-foreground">
                                política de privacidad
                            </Link>
                            . {isAndroidNative
                                ? 'No hay auto-renovación; cuando expire el pase podrás comprar otro desde Android.'
                                : 'Podés cancelar en cualquier momento.'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-border/60 bg-card p-6">
                    <h2 className="text-xl font-semibold text-foreground">Preguntas antes de pagar</h2>
                    <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                        <div>
                            <p className="font-medium text-foreground">Qué desbloqueás con PRO justo después de pagar</p>
                            <p>Simulador What-If, metas por deuda, exportaciones y seguimiento mas profundo del plan.</p>
                        </div>
                        <div>
                            <p className="font-medium text-foreground">Como cuidamos la confianza</p>
                            <p>
                                {isAndroidNative
                                    ? 'No pedimos credenciales bancarias y la compra se valida server-side después de Google Play.'
                                    : 'No pedimos credenciales bancarias y el cobro se hace con Recurrente.'}
                            </p>
                        </div>
                        <div>
                            <p className="font-medium text-foreground">Puedo cancelar despues</p>
                            <p>
                                {isAndroidNative
                                    ? 'No hay cancelación porque no existe auto-renovación. El pase se vence solo al final del período comprado.'
                                    : 'Si. Podés cancelar cuando quieras y mantenés acceso hasta el final del periodo pagado.'}
                            </p>
                        </div>
                    </div>
                </div>

                <DropoffCapture
                    surface="checkout"
                    defaultOpen={canceled}
                    title={canceled ? 'Vimos que cancelaste el cobro' : undefined}
                />
            </div>
        </div>
    );
}
