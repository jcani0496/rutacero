import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getDebts } from '@/lib/actions/debts';
import { getIncomes, getExpenses } from '@/lib/actions/finances';
import { getAlerts, getUpcomingPayments } from '@/lib/actions/alerts';
import { ForecastClient } from './forecast-client';
import { RouteProgressWrapper } from '@/components/dashboard/route-progress-wrapper';
import { FinancialDisclaimer } from '@/components/legal/financial-disclaimer';
import { getActiveSubscriptionForTenant, requireUserTenant } from '@/lib/tenant/server';
import { getCurrentUserProfile } from '@/lib/actions/profile';

export const metadata = {
  title: 'Predicciones | RutaCero',
  description: 'Proyecciones de flujo de caja y calendario de pagos',
};

export default async function ForecastPage() {
  let tenantId;
  try {
    ({ tenantId } = await requireUserTenant());
  } catch {
    redirect('/login');
  }

  const profile = await getCurrentUserProfile();
  const userCurrency = profile?.currency_base || 'GTQ';

  const subscription = await getActiveSubscriptionForTenant(tenantId);
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
      <FinancialDisclaimer text="Las proyecciones se calculan a partir de los datos que tú ingresaste y no incluyen cargos por mora, comisiones, cambios de tasa ni otros movimientos que pueda aplicar tu acreedor. Los montos reales pueden diferir." />
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
