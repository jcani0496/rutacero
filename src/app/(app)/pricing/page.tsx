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

export const metadata = {
    title: 'Planes | RutaCero',
    description: 'Compara el plan gratuito y PRO de RutaCero para ordenar tus deudas con mayor claridad',
};

const PLANS = [
    {
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
        popular: false,
    },
    {
        name: 'Pro',
        code: 'PRO',
        price: 49,
        description: 'Para quienes necesitan mas contexto, escenarios y seguimiento',
        features: [
            { text: 'Deudas ilimitadas', included: true },
            { text: 'Dashboard PRO con gráficos', included: true },
            { text: 'Análisis de salud financiera', included: true },
            { text: 'Múltiples planes de pago', included: true },
            { text: 'Historial completo', included: true },
            { text: 'Predicciones avanzadas', included: true },
            { text: 'Exportar a CSV', included: true },
            { text: 'Exportar escenarios What-If', included: true },
            { text: 'Simulador What-If', included: true },
            { text: 'Analíticas avanzadas', included: true },
            { text: 'Tags personalizados', included: true },
            { text: 'Alertas y resumen avanzado de presupuesto', included: true },
            { text: 'Metas por deuda y ajuste automático del plan', included: true },
            { text: 'Detalle de deuda por categoría', included: true },
            { text: 'Soporte prioritario por tickets', included: true },
        ],
        cta: 'Elegir Pro',
        popular: true,
    },
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

    return (
        <div className="flex flex-col gap-12 p-4 sm:p-6 max-w-6xl mx-auto">
            <FunnelEventTracker
                eventName="pricing_viewed"
                ctaContext="pricing"
                landingVariant={experience.landingVariant || undefined}
                offerVariant={experience.offerVariant || undefined}
            />
            {/* Hero */}
            <div className="text-center space-y-4 pt-8">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                    <Crown className="mr-1 h-3 w-3" />
                    {experience.pricing.badge}
                </Badge>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
                    {experience.pricing.titleLead}
                    <span className="text-primary"> {experience.pricing.titleAccent}</span>
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    {experience.pricing.description}
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

            {/* Plans */}
            <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto w-full">
                {PLANS.map((plan) => {
                    const isCurrentPlan = plan.code === currentPlan;

                    return (
                        <Card
                            key={plan.code}
                            className={`relative overflow-hidden ${plan.popular
                                    ? 'border-primary shadow-lg shadow-primary/10'
                                    : 'border-border'
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 right-0">
                                    <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground">
                                        Más Popular
                                    </Badge>
                                </div>
                            )}

                            <CardHeader className="pb-0">
                                <CardTitle className="flex items-center gap-2 text-2xl">
                                    {plan.popular && <Crown className="h-5 w-5 text-amber-500" />}
                                    {plan.name}
                                </CardTitle>
                                <CardDescription>
                                    {plan.code === 'PRO'
                                        ? experience.pricing.proPlanDescription
                                        : plan.description}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-6 pt-6">
                                {/* Price */}
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold">
                                        Q{plan.price}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {plan.code === 'PRO' ? '/mes o pase Android de 30 días' : ''}
                                    </span>
                                </div>

                                {/* Features */}
                                <ul className="space-y-3">
                                    {plan.features.map((feature, i) => (
                                        <li
                                            key={i}
                                            className={`flex items-center gap-3 text-sm ${feature.included
                                                    ? 'text-foreground'
                                                    : 'text-muted-foreground'
                                                }`}
                                        >
                                            <Check
                                                className={`h-4 w-4 shrink-0 ${feature.included
                                                        ? 'text-primary'
                                                        : 'text-muted-foreground/30'
                                                    }`}
                                            />
                                            {feature.text}
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                {isCurrentPlan ? (
                                    <Button
                                        className="w-full"
                                        variant="outline"
                                        disabled
                                    >
                                        <Check className="mr-2 h-4 w-4" />
                                        Plan Actual
                                    </Button>
                                ) : plan.code === 'FREE' ? (
                                    <Button
                                        className="w-full"
                                        variant="outline"
                                        asChild
                                    >
                                        <Link href="/dashboard">
                                            Ir al Dashboard
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                                        asChild
                                    >
                                        <Link href={experience.pricing.checkoutHref}>
                                            <Zap className="mr-2 h-4 w-4" />
                                            {plan.cta}
                                        </Link>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
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
