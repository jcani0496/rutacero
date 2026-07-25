'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import {
    DEFAULT_PRO_VARIANT_CODE,
    PRO_VARIANTS,
    discountVsMonthly,
    monthlyEquivalent,
    type ProVariantCode,
} from '@/lib/billing/plans';
import { resolveVariantCode } from '@/lib/billing/resolve';
import { buildTrackedHref } from '@/lib/launch/experience';

type ManualVariantCode = Exclude<ProVariantCode, 'PRO_PASS_90D'>;

const TIER_DESCRIPTIONS: Record<ManualVariantCode, string> = {
    PRO_MONTHLY: 'Probálo un mes y decidí si te sirve.',
    PRO_QUARTERLY: 'Equilibrio entre compromiso y ahorro. Ideal si tu plan dura 3+ meses.',
    PRO_ANNUAL: 'Para quien quiere el plan completo y olvidarse de renovar.',
};

const VARIANT_LABEL: Record<ManualVariantCode, string> = {
    PRO_MONTHLY: 'Mensual',
    PRO_QUARTERLY: 'Trimestral',
    PRO_ANNUAL: 'Anual',
};

const PERIOD_LABELS: Record<ManualVariantCode, string> = {
    PRO_MONTHLY: '/mes',
    PRO_QUARTERLY: 'cada 3 meses',
    PRO_ANNUAL: '/año',
};

const TIERS = PRO_VARIANTS
    .filter((v): v is typeof v & { code: ManualVariantCode } => v.code !== 'PRO_PASS_90D')
    .map((v) => ({
        code: v.code,
        label: VARIANT_LABEL[v.code],
        priceLabel: `Q${v.priceQ}`,
        period: PERIOD_LABELS[v.code],
        description: TIER_DESCRIPTIONS[v.code],
        monthlyEqLabel: discountVsMonthly(v.code) > 0 ? `Q${monthlyEquivalent(v.code).toFixed(2)} por mes` : null,
        popular: v.code === DEFAULT_PRO_VARIANT_CODE,
    }));

export default function ManualTransferClient() {
    const searchParams = useSearchParams();
    const preferredVariant = useMemo(() => {
        const resolved = resolveVariantCode(searchParams.get('variant'));
        return resolved === 'PRO_PASS_90D' ? DEFAULT_PRO_VARIANT_CODE : resolved;
    }, [searchParams]);

    const [pending, setPending] = useState<ManualVariantCode | null>(null);
    const [reference, setReference] = useState<{ code: string; variantLabel: string } | null>(null);
    const checkoutHref = buildTrackedHref('/checkout', searchParams, { ctaContext: 'pago_manual' });
    const checkoutWithVariant = `${checkoutHref}${checkoutHref.includes('?') ? '&' : '?'}variant=${preferredVariant}`;

    const submit = async (code: ManualVariantCode) => {
        setPending(code);
        try {
            const res = await fetch('/api/billing/manual-transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variantCode: code }),
            });
            const json = (await res.json()) as { ok?: boolean; referenceCode?: string; error?: string };
            if (!res.ok) {
                if (json.error === 'SERVICE_UNAVAILABLE') {
                    toast.error('Servicio temporalmente no disponible. Intentá más tarde.');
                } else if (json.error === 'EMAIL_SEND_FAILED') {
                    toast.error('No pudimos enviar el correo con las instrucciones. Intentá más tarde.');
                } else if (res.status === 401) {
                    toast.error('Necesitás iniciar sesión.');
                } else if (res.status === 429) {
                    toast.error('Demasiados intentos. Esperá un momento.');
                } else if (json.error === 'NO_EMAIL_ON_FILE') {
                    toast.error('Tu cuenta no tiene correo registrado. Actualizá tu perfil.');
                } else if (json.error === 'INVALID_VARIANT') {
                    toast.error('Variante no válida.');
                } else {
                    toast.error('Error al iniciar el pago manual.');
                }
                return;
            }
            if (json.ok && json.referenceCode) {
                setReference({ code: json.referenceCode, variantLabel: VARIANT_LABEL[code] });
                toast.success('Te enviamos las instrucciones por correo.');
            }
        } catch {
            toast.error('Error de red. Intentá más tarde.');
        } finally {
            setPending(null);
        }
    };

    if (reference) {
        return (
            <Card className="border-primary/40 bg-primary/5">
                <CardHeader>
                    <CardTitle>Te enviamos las instrucciones a tu correo</CardTitle>
                    <CardDescription>Variante elegida: {reference.variantLabel}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm">
                        Incluye este código en tu transferencia para que activemos tu PRO más rápido:
                    </p>
                    <p className="rounded-md bg-background border border-primary/30 px-3 py-2 font-mono text-base select-all">
                        {reference.code}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Activamos tu plan en menos de 24 horas hábiles tras recibir el comprobante.
                    </p>
                    <Button variant="outline" onClick={() => setReference(null)}>
                        Solicitar otra variante
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const orderedTiers = [...TIERS].sort((a, b) => {
        if (a.code === preferredVariant) return -1;
        if (b.code === preferredVariant) return 1;
        if (a.popular) return -1;
        if (b.popular) return 1;
        return 0;
    });

    return (
        <div className="space-y-6" aria-busy={pending !== null}>
            <ol className="grid gap-3 sm:grid-cols-3 text-sm">
                <li className="rounded-xl border border-border bg-card/70 p-4">
                    <p className="font-semibold text-foreground">1. Elegí la variante</p>
                    <p className="text-muted-foreground mt-1">Misma PRO que con tarjeta; recomendamos anual.</p>
                </li>
                <li className="rounded-xl border border-border bg-card/70 p-4">
                    <p className="font-semibold text-foreground">2. Transferí en GTQ</p>
                    <p className="text-muted-foreground mt-1">Te mandamos cuentas y código de referencia por correo.</p>
                </li>
                <li className="rounded-xl border border-border bg-card/70 p-4">
                    <p className="font-semibold text-foreground">3. Activamos PRO</p>
                    <p className="text-muted-foreground mt-1">En menos de 24 h hábiles tras el comprobante.</p>
                </li>
            </ol>

            <div className="grid gap-4 md:grid-cols-3">
                {orderedTiers.map((t) => {
                    const highlighted = t.code === preferredVariant || t.popular;
                    return (
                        <Card
                            key={t.code}
                            className={`relative flex flex-col ${
                                highlighted ? 'border-primary shadow-md shadow-primary/10' : ''
                            }`}
                        >
                            {t.popular && (
                                <div className="absolute top-0 right-0">
                                    <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground">
                                        Recomendado
                                    </Badge>
                                </div>
                            )}
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {highlighted && <Landmark className="h-4 w-4 text-primary" />}
                                    {t.label}
                                </CardTitle>
                                <CardDescription>{t.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col gap-4">
                                <div>
                                    <span className="text-3xl font-bold">{t.priceLabel}</span>
                                    <span className="text-muted-foreground"> {t.period}</span>
                                    {t.monthlyEqLabel && (
                                        <p className="text-sm text-muted-foreground">{t.monthlyEqLabel}</p>
                                    )}
                                </div>
                                <div className="flex-1" />
                                <Button
                                    onClick={() => submit(t.code)}
                                    disabled={pending !== null}
                                    aria-busy={pending === t.code}
                                    variant={highlighted ? 'default' : 'outline'}
                                >
                                    {pending === t.code ? (
                                        'Enviando...'
                                    ) : (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            Pagar por transferencia
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <p className="text-center text-sm text-muted-foreground">
                ¿Preferís tarjeta o Google Pay?{' '}
                <Link href={checkoutWithVariant} className="underline underline-offset-2 font-medium text-foreground">
                    Ir al checkout con Recurrente
                </Link>
                <span className="mx-2 text-border">·</span>
                <Link
                    href={buildTrackedHref('/pricing', searchParams, { ctaContext: 'pago_manual' })}
                    className="underline underline-offset-2"
                >
                    <ArrowLeft className="inline h-3 w-3 mr-1" />
                    Ver planes
                </Link>
            </p>
        </div>
    );
}
