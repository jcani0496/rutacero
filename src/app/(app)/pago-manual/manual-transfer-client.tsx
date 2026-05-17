'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { PRO_VARIANTS, monthlyEquivalent, type ProVariantCode } from '@/lib/billing/plans';

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
        monthlyEqLabel: v.discountVsMonthly > 0 ? `Q${monthlyEquivalent(v.code).toFixed(2)} por mes` : null,
    }));

export default function ManualTransferClient() {
    const [pending, setPending] = useState<ManualVariantCode | null>(null);
    const [reference, setReference] = useState<{ code: string; variantLabel: string } | null>(null);

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

    return (
        <div className="grid gap-4 md:grid-cols-3" aria-busy={pending !== null}>
            {TIERS.map((t) => (
                <Card key={t.code} className="flex flex-col">
                    <CardHeader>
                        <CardTitle>{t.label}</CardTitle>
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
                        >
                            {pending === t.code ? 'Enviando...' : 'Pagar por transferencia'}
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
