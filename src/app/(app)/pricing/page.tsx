import Link from 'next/link';
import {
    Check,
    Crown,
    Zap,
    TrendingUp,
    Download,
    Calculator,
    History,
    ArrowRight,
    BadgeCheck,
    Landmark,
    ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropoffCapture } from '@/components/funnel/dropoff-capture';
import { FunnelEventTracker } from '@/components/funnel/funnel-event-tracker';
import { resolveLaunchExperience } from '@/lib/launch/experience';
import { getActiveSubscriptionForTenant, requireUserTenant } from '@/lib/tenant/server';
import {
    DEFAULT_PRO_VARIANT_CODE,
    PRO_VARIANTS,
    discountVsMonthly,
    monthlyEquivalent,
    type ProVariantCode,
} from '@/lib/billing/plans';

export const metadata = {
    title: 'Planes | RutaCero',
    description: 'Compará el plan gratuito y PRO de RutaCero para ordenar tus deudas con mayor claridad',
};

interface FreeFeature {
    text: string;
    included: boolean;
}

const FREE_PLAN: {
    name: string;
    code: 'FREE';
    price: number;
    description: string;
    features: FreeFeature[];
} = {
    name: 'Free',
    code: 'FREE',
    price: 0,
    description: 'Para empezar a ordenar tus deudas y entender tu situación actual',
    features: [
        { text: 'Hasta 5 deudas', included: true },
        { text: 'Dashboard básico', included: true },
        { text: 'Análisis de salud financiera', included: true },
        { text: 'Plan de pagos único', included: true },
        { text: '3 meses de historial', included: true },
        { text: 'Predicciones básicas', included: true },
        { text: 'Presupuestos por categoría', included: true },
        { text: 'Registro de gasto real', included: true },
        { text: 'Detalle de deuda por categoría', included: true },
        { text: 'Metas por deuda', included: false },
        { text: 'Exportar datos', included: false },
        { text: 'Exportar escenarios What-If', included: false },
        { text: 'Simulador What-If', included: false },
        { text: 'Analíticas avanzadas', included: false },
        { text: 'Tags personalizados', included: false },
        { text: 'Alertas de presupuesto', included: false },
        { text: 'Soporte por tickets', included: true },
    ],
};

interface ProTier {
    code: ProVariantCode;
    name: string;
    priceLabel: string;
    period: string;
    monthlyEqLabel: string | null;
    discountPct: number;
    popular: boolean;
    description: string;
}

const PERIOD_LABELS: Record<ProVariantCode, string> = {
    PRO_MONTHLY: '/mes',
    PRO_QUARTERLY: 'cada 3 meses',
    PRO_ANNUAL: '/año',
    PRO_PASS_90D: 'por 90 días',
};

const TIER_DESCRIPTIONS: Record<ProVariantCode, string> = {
    PRO_MONTHLY: 'Probálo un mes y decidí si te sirve.',
    PRO_QUARTERLY: 'Equilibrio entre compromiso y ahorro. Ideal si tu plan dura 3+ meses.',
    PRO_ANNUAL: 'Para quien quiere el plan completo y olvidarse de renovar.',
    PRO_PASS_90D: 'Pase de 90 días disponible solo en Android.',
};

const PRO_TIERS: ProTier[] = PRO_VARIANTS
    .filter((v) => v.code !== 'PRO_PASS_90D')
    .map((v) => ({
        code: v.code,
        name: v.label,
        priceLabel: `Q${v.priceQ}`,
        period: PERIOD_LABELS[v.code],
        monthlyEqLabel: discountVsMonthly(v.code) > 0
            ? `Q${monthlyEquivalent(v.code).toFixed(2)} por mes`
            : null,
        discountPct: Math.round(discountVsMonthly(v.code) * 100),
        popular: v.code === 'PRO_ANNUAL',
        description: TIER_DESCRIPTIONS[v.code],
    }));

const PASS_90D = PRO_VARIANTS.find((v) => v.code === 'PRO_PASS_90D')!;

const PRO_FEATURES: string[] = [
    'Deudas ilimitadas',
    'Dashboard PRO con gráficos',
    'Análisis de salud financiera',
    'Múltiples planes de pago',
    'Historial completo',
    'Predicciones avanzadas',
    'Exportar a CSV',
    'Exportar escenarios What-If',
    'Simulador What-If',
    'Analíticas avanzadas',
    'Tags personalizados',
    'Alertas y resumen avanzado de presupuesto',
    'Metas por deuda y ajuste automático del plan',
    'Detalle de deuda por categoría',
    'Soporte prioritario por tickets',
];

const BENEFITS = [
    {
        icon: TrendingUp,
        title: 'Más contexto para decidir',
        description: 'Compará escenarios y entendé mejor el impacto de pagar más o cambiar de estrategia.',
    },
    {
        icon: Download,
        title: 'Exportá tus datos',
        description: 'Descargá reportes CSV para compartir con tu contador o para tu control personal.',
    },
    {
        icon: Calculator,
        title: 'Simulador What-If',
        description: 'Explorá escenarios de pago extra antes de comprometerte con un nuevo plan.',
    },
    {
        icon: History,
        title: 'Historial completo',
        description: 'Visualizá todo tu progreso desde el primer día sin límites de tiempo.',
    },
];

function buildVariantHref(baseHref: string, code: ProVariantCode): string {
    const [pathAndQuery, fragment] = baseHref.split('#');
    const separator = pathAndQuery.includes('?') ? '&' : '?';
    const withVariant = `${pathAndQuery}${separator}variant=${code}`;
    return fragment ? `${withVariant}#${fragment}` : withVariant;
}

export default async function PricingPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolvedSearchParams = await searchParams;
    const experience = resolveLaunchExperience({ searchParams: resolvedSearchParams });

    // Check if user is already PRO in the current tenant
    let currentPlan = 'FREE';
    try {
        const { tenantId } = await requireUserTenant();
        const subscription = await getActiveSubscriptionForTenant(tenantId);
        currentPlan = subscription?.plan_code || 'FREE';
    } catch {
        // Not authenticated: show pricing with FREE default
    }

    const isPro = currentPlan === 'PRO' || currentPlan === 'BUSINESS';
    const isFreeCurrent = currentPlan === 'FREE';

    return (
        <div className="flex flex-col gap-12 p-4 sm:p-6 max-w-7xl mx-auto">
            <FunnelEventTracker
                eventName="pricing_viewed"
                ctaContext="pricing"
                landingVariant={experience.landingVariant || undefined}
                offerVariant={experience.offerVariant || undefined}
            />
            {/* Hero - result-led */}
            <div className="text-center space-y-4 pt-8">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                    <Crown className="mr-1 h-3 w-3" />
                    RutaCero PRO
                </Badge>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
                    Decidí cada quincena qué pagar primero, con números claros.
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    PRO te muestra cuánto vas a ahorrar exactamente, te avisa antes de cada pago y ajusta tu plan
                    cuando cambia tu ingreso. Cancelás cuando quieras y mantenés acceso hasta que termine el período pagado.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-border/60 bg-card/70">
                    <CardContent className="pt-6">
                        <Landmark className="mb-3 h-5 w-5 text-primary" />
                        <p className="font-semibold text-foreground">Hecho para Guatemala</p>
                        <p className="text-sm text-muted-foreground">
                            Precios en quetzales y una narrativa pensada para deudas locales.
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/70">
                    <CardContent className="pt-6">
                        <ShieldCheck className="mb-3 h-5 w-5 text-emerald-500" />
                        <p className="font-semibold text-foreground">Privacidad primero</p>
                        <p className="text-sm text-muted-foreground">
                            No pedimos banca en línea y el acceso queda protegido por sesión.
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/70">
                    <CardContent className="pt-6">
                        <BadgeCheck className="mb-3 h-5 w-5 text-primary" />
                        <p className="font-semibold text-foreground">Cobro claro</p>
                        <p className="text-sm text-muted-foreground">
                            En web: tarjeta (Recurrente) o transferencia bancaria. En Android: pase dentro de Google Play.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Plans: 3 PRO + 1 FREE */}
            <div className="space-y-6 w-full">
                <h2 className="sr-only">Elegí tu variante PRO</h2>
                {/* Android-only note */}
                <p className="text-center text-sm text-muted-foreground -mb-2">
                    El Pase de 90 días por Q{PASS_90D.priceQ} está disponible solo en la app Android (Google Play).
                </p>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 w-full max-w-7xl mx-auto">
                    {PRO_TIERS.map((tier) => {
                        const href = buildVariantHref(experience.pricing.checkoutHref, tier.code);

                        return (
                            <Card
                                key={tier.code}
                                className={`relative overflow-hidden flex flex-col ${tier.popular
                                    ? 'border-primary shadow-lg shadow-primary/10'
                                    : 'border-border'
                                    }`}
                            >
                                {tier.popular && (
                                    <div className="absolute top-0 right-0">
                                        <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground">
                                            Más popular
                                        </Badge>
                                    </div>
                                )}

                                <CardHeader className="pb-0">
                                    <CardTitle className="flex items-center gap-2 text-xl">
                                        {tier.popular && <Crown className="h-5 w-5 text-primary" />}
                                        {tier.name}
                                    </CardTitle>
                                    <CardDescription>{tier.description}</CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-4 pt-6 flex flex-col flex-1">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="text-3xl font-bold">{tier.priceLabel}</span>
                                        <span className="text-sm text-muted-foreground">{tier.period}</span>
                                    </div>
                                    {tier.monthlyEqLabel && (
                                        <p className="text-sm text-muted-foreground">{tier.monthlyEqLabel}</p>
                                    )}
                                    {tier.discountPct > 0 && (
                                        <Badge variant="secondary" className="w-fit bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                            Ahorrás {tier.discountPct}% vs mensual
                                        </Badge>
                                    )}

                                    <div className="flex-1" />

                                    {isPro ? (
                                        <div className="space-y-1">
                                            <Button className="w-full" variant="outline" disabled>
                                                <Check className="mr-2 h-4 w-4" />
                                                Plan Actual
                                            </Button>
                                            <p className="text-xs text-center text-muted-foreground">
                                                Ya tenés acceso PRO activo
                                            </p>
                                        </div>
                                    ) : (
                                        <Button
                                            className="w-full gradient-primary"
                                            asChild
                                        >
                                            <Link href={href}>
                                                <Zap className="mr-2 h-4 w-4" />
                                                Elegir {tier.name}
                                            </Link>
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}

                    {/* FREE card */}
                    <Card className="relative overflow-hidden flex flex-col border-border">
                        <CardHeader className="pb-0">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                {FREE_PLAN.name}
                            </CardTitle>
                            <CardDescription>{FREE_PLAN.description}</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4 pt-6 flex flex-col flex-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold">Q{FREE_PLAN.price}</span>
                            </div>

                            <ul className="space-y-2">
                                {FREE_PLAN.features.map((feature, i) => (
                                    <li
                                        key={i}
                                        className={`flex items-center gap-2 text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground'
                                            }`}
                                    >
                                        <Check
                                            className={`h-4 w-4 shrink-0 ${feature.included ? 'text-primary' : 'text-muted-foreground/30'
                                                }`}
                                        />
                                        {feature.text}
                                    </li>
                                ))}
                            </ul>

                            <div className="flex-1" />

                            {isFreeCurrent ? (
                                <Button className="w-full" variant="outline" disabled>
                                    <Check className="mr-2 h-4 w-4" />
                                    Plan Actual
                                </Button>
                            ) : (
                                <Button className="w-full" variant="outline" asChild>
                                    <Link href="/dashboard">
                                        Ir al Dashboard
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {!isPro && (
                <div className="max-w-4xl mx-auto w-full space-y-3">
                    <div className="text-center space-y-1">
                        <h2 className="text-xl font-semibold text-foreground">Cómo querés pagar PRO</h2>
                        <p className="text-sm text-muted-foreground">
                            Dos caminos equivalentes en web: tarjeta o transferencia. Misma PRO, mismos precios.
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-primary" />
                                <p className="font-semibold text-foreground">Tarjeta · Recurrente</p>
                            </div>
                            <p className="text-sm text-muted-foreground flex-1">
                                Visa/Mastercard en GTQ. Activación inmediata. Ideal si tenés tarjeta a mano.
                            </p>
                            <Button asChild>
                                <Link href={buildVariantHref(experience.pricing.checkoutHref, DEFAULT_PRO_VARIANT_CODE)}>
                                    Ir al checkout
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Landmark className="h-5 w-5 text-primary" />
                                <p className="font-semibold text-foreground">Transferencia bancaria</p>
                            </div>
                            <p className="text-sm text-muted-foreground flex-1">
                                Sin tarjeta, prepago, o si el cobro con tarjeta falló. Te mandamos cuentas y código
                                por correo; activamos en menos de 24 h hábiles.
                            </p>
                            <Button variant="outline" asChild>
                                <Link href={`/pago-manual?variant=${DEFAULT_PRO_VARIANT_CODE}`}>
                                    Pagar por transferencia
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Single shared PRO features list */}
            <div className="space-y-6 max-w-4xl mx-auto w-full">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground">
                        Todas las variantes PRO incluyen
                    </h2>
                    <p className="text-muted-foreground mt-2">
                        Las funciones son las mismas; solo cambia la duración y el precio.
                    </p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-border bg-card/50 p-6">
                    {PRO_FEATURES.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                            {feature}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Benefits */}
            <div className="space-y-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground">
                        ¿Por qué elegir PRO?
                    </h2>
                    <p className="text-muted-foreground mt-2">
                        Beneficios para tomar decisiones con mayor contexto y seguimiento
                    </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {BENEFITS.map((benefit, i) => (
                        <Card key={i} className="border-border/50 bg-card/50">
                            <CardContent className="pt-6">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-4">
                                    <benefit.icon className="h-5 w-5 text-primary" />
                                </div>
                                <h3 className="font-semibold text-foreground mb-2">
                                    {benefit.title}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {benefit.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {!isPro && (
                <DropoffCapture surface="pricing" className="max-w-2xl mx-auto w-full" />
            )}

            {/* FAQ */}
            <div className="space-y-6 max-w-2xl mx-auto w-full">
                <h2 className="text-2xl font-bold text-foreground text-center">
                    Preguntas Frecuentes
                </h2>
                <p className="text-sm text-muted-foreground text-center max-w-xl mx-auto">
                    RutaCero es una herramienta de planificación: no asesoría financiera ni promesa de ahorro o libertad garantizada.
                    Preferí self-serve (esta página y el{' '}
                    <Link href="/help" className="underline underline-offset-2 text-foreground">
                        Centro de ayuda
                    </Link>
                    ); no hay coaching 1:1 incluido.
                </p>

                <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <h3 className="font-semibold text-foreground">¿Puedo cancelar cuando quiera?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            En web sí: podés cancelar tu suscripción y mantener acceso hasta el final del período pagado. En Android no hay auto-renovación: el pase vence solo.
                        </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <h3 className="font-semibold text-foreground">¿Mis datos están seguros?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Protegemos acceso y sesiones, y no pedimos tus credenciales bancarias. Tus datos se mantienen separados por workspace.
                        </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <h3 className="font-semibold text-foreground">¿Qué métodos de pago aceptan?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            En web: tarjeta (Recurrente, GTQ) o{' '}
                            <Link href="/pago-manual" className="underline underline-offset-2 text-foreground">
                                transferencia bancaria
                            </Link>
                            . En Android el cobro va por Google Play.
                        </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                        <h3 className="font-semibold text-foreground">¿PRO incluye soporte personalizado?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            No. PRO desbloquea funciones de la herramienta. El soporte es self-serve (FAQ + tickets para fallos de producto o facturación), no acompañamiento emocional ni asesoría 1:1.
                        </p>
                    </div>
                </div>
            </div>

            {/* Final CTA */}
            {!isPro && (
                <div className="text-center py-8 rounded-2xl border border-primary/20 bg-primary/5">
                    <h2 className="text-xl font-bold text-foreground mb-2">
                        {experience.pricing.finalTitle}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                        {experience.pricing.finalDescription}
                    </p>
                    <Button
                        asChild
                        className="gradient-primary"
                    >
                        <Link href={buildVariantHref(experience.pricing.checkoutHref, DEFAULT_PRO_VARIANT_CODE)}>
                            <Crown className="mr-2 h-4 w-4" />
                            {experience.pricing.finalCtaLabel}
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
