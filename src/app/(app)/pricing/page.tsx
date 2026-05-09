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
import { requireUserTenant } from '@/lib/tenant/server';
import { PRO_VARIANTS, monthlyEquivalent, type ProVariantCode } from '@/lib/billing/plans';

export const metadata = {
    title: 'Planes | RutaCero',
    description: 'Compara el plan gratuito y PRO de RutaCero para ordenar tus deudas con mayor claridad',
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
    cta: string;
} = {
    name: 'Free',
    code: 'FREE',
    price: 0,
    description: 'Para empezar a ordenar tus deudas y entender tu situacion actual',
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
    cta: 'Plan Actual',
};

interface ProTier {
    code: ProVariantCode;
    name: string;
    priceLabel: string;
    period: string;
    monthlyEqLabel: string;
    discountPct: number;
    popular: boolean;
    description: string;
}

const PRO_TIERS: ProTier[] = PRO_VARIANTS
    .filter((v) => v.code !== 'PRO_PASS_90D')
    .map((v) => ({
        code: v.code,
        name: v.label,
        priceLabel: `Q${v.priceQ}`,
        period:
            v.code === 'PRO_MONTHLY' ? '/mes' :
                v.code === 'PRO_QUARTERLY' ? 'cada 3 meses' :
                    '/año',
        monthlyEqLabel: `Q${monthlyEquivalent(v.code).toFixed(2)} por mes`,
        discountPct: Math.round(v.discountVsMonthly * 100),
        popular: v.code === 'PRO_QUARTERLY',
        description:
            v.code === 'PRO_ANNUAL' ? 'Para quien quiere el plan completo y olvidarse de renovar.' :
                v.code === 'PRO_QUARTERLY' ? 'Equilibrio entre compromiso y ahorro. Ideal si tu plan dura 3+ meses.' :
                    'Pruébalo un mes y decide si te sirve.',
    }));

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
        title: 'Mas contexto para decidir',
        description: 'Compara escenarios y entiende mejor el impacto de pagar mas o cambiar de estrategia.',
    },
    {
        icon: Download,
        title: 'Exporta tus datos',
        description: 'Descarga reportes CSV para compartir con tu contador o para tu control personal.',
    },
    {
        icon: Calculator,
        title: 'Simulador What-If',
        description: 'Explora escenarios de pago extra antes de comprometerte con un nuevo plan.',
    },
    {
        icon: History,
        title: 'Historial completo',
        description: 'Visualiza todo tu progreso desde el primer día sin límites de tiempo.',
    },
];

function buildVariantHref(baseHref: string, code: ProVariantCode): string {
    const separator = baseHref.includes('?') ? '&' : '?';
    return `${baseHref}${separator}variant=${code}`;
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
        const { supabase, tenantId } = await requireUserTenant();
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('plan_code')
            .eq('tenant_id', tenantId)
            .eq('status', 'ACTIVE')
            .single();
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
                    Decide cada quincena qué pagar primero, con números claros.
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    PRO te muestra cuánto vas a ahorrar exactamente, te avisa antes de cada pago y ajusta tu plan
                    cuando cambia tu ingreso. Cancelas cuando quieras y mantienes acceso hasta que termine el período pagado.
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
                            No pedimos banca en linea y el acceso queda protegido por sesion.
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/70">
                    <CardContent className="pt-6">
                        <BadgeCheck className="mb-3 h-5 w-5 text-amber-500" />
                        <p className="font-semibold text-foreground">Cobro claro</p>
                        <p className="text-sm text-muted-foreground">
                            En web cobramos por Recurrente; en Android el pase PRO se compra dentro de Google Play.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Android-only note */}
            <p className="text-center text-sm text-muted-foreground -mb-4">
                El Pase de 90 días por Q99 está disponible solo en la app Android (Google Play).
            </p>

            {/* Plans: 3 PRO + 1 FREE */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 w-full">
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
                                    {tier.popular && <Crown className="h-5 w-5 text-amber-500" />}
                                    {tier.name}
                                </CardTitle>
                                <CardDescription>{tier.description}</CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4 pt-6 flex flex-col flex-1">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-3xl font-bold">{tier.priceLabel}</span>
                                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">{tier.monthlyEqLabel}</p>
                                {tier.discountPct > 0 && (
                                    <Badge variant="secondary" className="w-fit bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        Ahorras {tier.discountPct}% vs mensual
                                    </Badge>
                                )}

                                <div className="flex-1" />

                                {isPro ? (
                                    <Button className="w-full" variant="outline" disabled>
                                        <Check className="mr-2 h-4 w-4" />
                                        Plan Actual
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
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

                <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <h3 className="font-semibold text-foreground">¿Puedo cancelar cuando quiera?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            En web sí: puedes cancelar tu suscripción y mantener acceso hasta el final del período pagado. En Android no hay auto-renovación: el pase vence solo.
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
                            En web aceptamos tarjetas por Recurrente en GTQ. En Android el cobro se procesa dentro de Google Play.
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
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    >
                        <Link href={experience.pricing.checkoutHref}>
                            <Crown className="mr-2 h-4 w-4" />
                            {experience.pricing.finalCtaLabel}
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
