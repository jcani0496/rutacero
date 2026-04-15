import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getDebts } from '@/lib/actions/debts';
import { getIncomes, getExpenses } from '@/lib/actions/finances';
import { getAlerts, getUpcomingPayments } from '@/lib/actions/alerts';
import { ForecastClient } from './forecast-client';
import { RouteProgressWrapper } from '@/components/dashboard/route-progress-wrapper';
import { requireUserTenant } from '@/lib/tenant/server';

export const metadata = {
  title: 'Predicciones | RutaCero',
  description: 'Proyecciones de flujo de caja y calendario de pagos',
};

export default async function ForecastPage() {
  let supabase, user, tenantId;
  try {
    ({ supabase, user, tenantId } = await requireUserTenant());
  } catch {
    redirect('/login');
  }

  // Get user profile for currency
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('currency_base')
    .eq('user_id', user.id)
    .single();

  const profile = profileData as { currency_base: string } | null;
  const userCurrency = profile?.currency_base || 'GTQ';

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_code, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'ACTIVE')
    .single();

  const planCode = subscription?.plan_code || 'FREE';
  const isPro = planCode === 'PRO' || planCode === 'BUSINESS';

  // Fetch data in parallel
  const [debtsResult, incomes, expenses, alerts, upcomingPayments] = await Promise.all([
    getDebts(),
    getIncomes(),
    getExpenses(),
    getAlerts(),
    getUpcomingPayments(),
  ]);

  // getDebts without pagination returns array, with pagination returns PaginatedResponse
  const debts = Array.isArray(debtsResult) ? debtsResult : debtsResult.data;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <Suspense fallback={<div className="h-40" />}>
        <RouteProgressWrapper />
      </Suspense>
      <ForecastClient
        debts={debts}
        incomes={incomes}
        expenses={expenses}
        alerts={alerts}
        upcomingPayments={upcomingPayments}
        userCurrency={userCurrency}
        isPro={isPro}
      />
    </div>
  );
}
