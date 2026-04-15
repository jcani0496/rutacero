import Link from 'next/link';
import { Map } from 'lucide-react';

import { requireUserTenant } from '@/lib/tenant/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RouteProgressPath } from '@/components/features/route-progress-path';

export async function RouteProgressWrapper() {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return null;
    }

    if (!user) return null;

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('currency_base')
        .eq('user_id', user.id)
        .single();

    const currency = (profile as { currency_base: string } | null)?.currency_base || 'GTQ';

    const { data: debts } = await supabase
        .from('debts')
        .select('balance, min_payment')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

    const totalDebt = debts?.reduce((sum, debt) => sum + Number(debt.balance || 0), 0) || 0;
    const totalMinPayment = debts?.reduce((sum, debt) => sum + Number(debt.min_payment || 0), 0) || 0;

    const startDate = new Date();
    startDate.setDate(1);
    const startIso = startDate.toISOString().split('T')[0];

    const { data: payments } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .gte('payment_date', startIso);

    const monthlyPaid = payments?.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;

    if (totalDebt === 0) {
        return (
            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Map className="h-5 w-5 text-primary" />
                        RutaCero mensual
                    </CardTitle>
                    <CardDescription>
                        Inicia tu camino registrando una deuda y tu primer pago.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                    <Button variant="outline" asChild>
                        <Link href="/debts">Agregar deudas</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/payments">Registrar pago</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const monthlyTarget = totalMinPayment > 0 ? totalMinPayment : Math.max(totalDebt * 0.05, 500);
    const progress = monthlyTarget > 0 ? Math.min(monthlyPaid / monthlyTarget, 1) : 0;
    const remaining = Math.max(monthlyTarget - monthlyPaid, 0);
    const today = new Date();
    const isLateInMonth = today.getDate() >= 22;
    const mood = progress >= 0.8 ? 'positive' : progress < 0.4 && isLateInMonth ? 'warning' : 'steady';

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <Card className="relative overflow-hidden border-slate-800/60 bg-slate-900/85 text-white shadow-soft">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(16,185,129,0.25),transparent_55%),radial-gradient(circle_at_85%_0%,rgba(56,189,248,0.25),transparent_55%)]" />
            <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-2 text-white">
                    <Map className="h-5 w-5 text-emerald-400" />
                    RutaCero mensual
                </CardTitle>
                <CardDescription className="text-slate-300">
                    Cada pago te mueve hacia la libertad financiera.
                </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            Meta mensual sugerida
                        </p>
                        <p className="text-2xl font-bold text-white">
                            {formatCurrency(monthlyTarget)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Progreso</p>
                        <p className="text-2xl font-bold text-emerald-400">
                            {Math.round(progress * 100)}%
                        </p>
                    </div>
                </div>

                <RouteProgressPath progress={progress} mood={mood} />

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-300">
                    <span>{formatCurrency(monthlyPaid)} pagado este mes</span>
                    <span>
                        {remaining > 0
                            ? `Faltan ${formatCurrency(remaining)} para la meta`
                            : 'Meta mensual alcanzada'}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
