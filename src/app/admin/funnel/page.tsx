import { getFunnelLast30Days } from '@/lib/actions/admin-funnel';

export const dynamic = 'force-dynamic';

export default async function AdminFunnelPage() {
    const funnel = await getFunnelLast30Days();
    const fmt = (n: number) => `${(n * 100).toFixed(1)}%`;
    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Funnel últimos 30 días</h1>
                <p className="text-sm text-muted-foreground">Eventos agregados desde marketing_funnel_events.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Pricing visto" value={funnel.pricing_viewed} />
                <Stat label="Checkout iniciado" value={funnel.checkout_started} />
                <Stat label="Pago exitoso" value={funnel.payment_succeeded} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Pricing → Checkout" value={fmt(funnel.conversion_pricing_to_checkout)} />
                <Stat label="Checkout → Pago" value={fmt(funnel.conversion_checkout_to_payment)} />
                <Stat label="Pricing → Pago" value={fmt(funnel.conversion_pricing_to_payment)} />
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
        </div>
    );
}
