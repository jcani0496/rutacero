'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropoffCapture } from '@/components/funnel/dropoff-capture';
import { buildTrackedHref } from '@/lib/launch/experience';
import {
    DEFAULT_PRO_VARIANT_CODE,
    WEB_PRO_VARIANT_CODES,
    discountVsMonthly,
    getProVariant,
    monthlyEquivalent,
    type ProVariantCode,
} from '@/lib/billing/plans';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface UpgradeLimitModalProps {
    open: boolean;
    onClose: () => void;
    featureType: 'debt' | 'export' | 'history' | 'whatif' | 'tags' | 'goals';
    currentCount?: number;
    maxAllowed?: number;
}

const FEATURE_MESSAGES = {
    debt: {
        title: 'Límite de deudas en Free',
        description:
            'Ya alcanzaste las 5 deudas del plan gratuito. La sexta y las que sigan requieren PRO.',
        benefit:
            'Con PRO agregás deudas ilimitadas y seguís el plan con más contexto, sin tocar el techo de Free.',
    },
    export: {
        title: 'Exportación PRO',
        description: 'La exportación de datos es una función exclusiva de usuarios PRO.',
        benefit: 'Exportá tus deudas, pagos y reportes a CSV para compartir con tu contador o para tu control personal.',
    },
    history: {
        title: 'Historial Completo PRO',
        description: 'El acceso al historial completo es exclusivo de usuarios PRO.',
        benefit: 'Visualizá todo tu historial de pagos sin límite de tiempo para un mejor seguimiento de tu progreso.',
    },
    whatif: {
        title: 'Simulador What-If PRO',
        description: 'El simulador de escenarios es exclusivo de usuarios PRO.',
        benefit: 'Simulá diferentes montos de pago y mirá cómo afectan tu tiempo libre de deuda.',
    },
    tags: {
        title: 'Etiquetas Personalizadas PRO',
        description: 'Las etiquetas personalizadas son exclusivas de usuarios PRO.',
        benefit: 'Organizá y categorizá tus deudas con etiquetas personalizadas para un mejor control.',
    },
    goals: {
        title: 'Metas de Deuda PRO',
        description: 'Las metas por deuda son exclusivas de usuarios PRO.',
        benefit: 'Definí pagos extra o fechas objetivo y ajustá tu plan automáticamente.',
    },
};

const TRUST_CHIPS = [
    'Cobro en GTQ',
    'Sin banca conectada',
    'Cancelás cuando quieras',
] as const;

function variantPeriodLabel(code: ProVariantCode): string {
    switch (code) {
        case 'PRO_MONTHLY':
            return '/mes';
        case 'PRO_QUARTERLY':
            return ' / 3 meses';
        case 'PRO_ANNUAL':
            return '/año';
        default:
            return '';
    }
}

export function UpgradeLimitModal({
    open,
    onClose,
    featureType,
    currentCount,
    maxAllowed,
}: UpgradeLimitModalProps) {
    const message = FEATURE_MESSAGES[featureType];
    const searchParams = useSearchParams();
    const [selectedVariant, setSelectedVariant] = useState<ProVariantCode>(DEFAULT_PRO_VARIANT_CODE);

    useEffect(() => {
        if (open) {
            setSelectedVariant(DEFAULT_PRO_VARIANT_CODE);
        }
    }, [open]);

    const variant = getProVariant(selectedVariant);
    const monthlyEq = monthlyEquivalent(selectedVariant);
    const discountPct = Math.round(discountVsMonthly(selectedVariant) * 100);

    const webVariants = useMemo(
        () => WEB_PRO_VARIANT_CODES.map((code) => getProVariant(code)),
        []
    );

    const checkoutHref = buildTrackedHref('/checkout', searchParams, {
        ctaContext: 'paywall',
    });
    const checkoutWithVariant = `${checkoutHref}${checkoutHref.includes('?') ? '&' : '?'}variant=${selectedVariant}`;
    const pricingHref = buildTrackedHref('/pricing', searchParams, {
        ctaContext: 'paywall',
    });

    const softCapDescription =
        featureType === 'debt' &&
        currentCount !== undefined &&
        maxAllowed !== undefined &&
        Number.isFinite(maxAllowed)
            ? `Tenés ${currentCount} de ${maxAllowed} deudas en Free. Para agregar la #${maxAllowed + 1} necesitás PRO.`
            : message.description;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                            <Sparkles className="h-6 w-6 text-primary" />
                        </div>
                        <DialogTitle className="text-xl">{message.title}</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {featureType === 'debt' && currentCount !== undefined && maxAllowed !== undefined && (
                        <div className="flex items-center justify-center gap-4 rounded-xl bg-muted p-4">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-foreground">{currentCount}</p>
                                <p className="text-xs text-muted-foreground">Actuales</p>
                            </div>
                            <div className="text-2xl text-muted-foreground">/</div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-foreground">
                                    {Number.isFinite(maxAllowed) ? maxAllowed : '∞'}
                                </p>
                                <p className="text-xs text-muted-foreground">Máximo Free</p>
                            </div>
                        </div>
                    )}

                    <DialogDescription className="text-center text-base">
                        {softCapDescription}
                    </DialogDescription>

                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">RutaCero PRO</p>
                                <p className="text-2xl font-bold text-foreground">
                                    Q{variant.priceQ}
                                    <span className="text-base font-normal text-muted-foreground">
                                        {variantPeriodLabel(selectedVariant)}
                                    </span>
                                </p>
                                {selectedVariant !== 'PRO_MONTHLY' && (
                                    <p className="text-xs text-muted-foreground">
                                        Equivale a Q{monthlyEq.toFixed(2)}/mes
                                        {discountPct > 0 ? ` · ahorrás ${discountPct}%` : ''}
                                    </p>
                                )}
                            </div>
                            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-1" />
                        </div>
                        <p className="text-sm text-foreground">{message.benefit}</p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Elegí tu plan</p>
                        <div className="grid gap-2">
                            {webVariants.map((option) => {
                                const selected = option.code === selectedVariant;
                                const optionDiscount = Math.round(discountVsMonthly(option.code) * 100);
                                return (
                                    <button
                                        key={option.code}
                                        type="button"
                                        onClick={() => setSelectedVariant(option.code)}
                                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                            selected
                                                ? 'border-primary bg-primary/10'
                                                : 'border-border bg-background hover:border-primary/40'
                                        }`}
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">
                                                {option.label}
                                                {option.code === DEFAULT_PRO_VARIANT_CODE && (
                                                    <span className="ml-2 text-xs font-medium text-primary">
                                                        Recomendado
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {option.headline}
                                                {optionDiscount > 0 ? ` · −${optionDiscount}%` : ''}
                                            </p>
                                        </div>
                                        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2">
                        {TRUST_CHIPS.map((chip) => (
                            <span
                                key={chip}
                                className="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
                            >
                                {chip}
                            </span>
                        ))}
                    </div>

                    <DropoffCapture
                        surface="paywall"
                        className="border-border/60 bg-background/80 p-3"
                    />
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
                        Ahora no
                    </Button>
                    <Button variant="outline" asChild className="w-full sm:w-auto">
                        <Link href={pricingHref}>Ver planes</Link>
                    </Button>
                    <Button asChild className="w-full sm:w-auto">
                        <Link href={checkoutWithVariant}>
                            Activar PRO · Q{variant.priceQ}
                        </Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
