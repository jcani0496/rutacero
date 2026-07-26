import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getPlans, compareStrategies, getPlanItems } from '@/lib/actions/plans';
import { checkRecalculationNeeded } from '@/lib/actions/plan-recalculation';
import { getDebts } from '@/lib/actions/debts';
import { getIncomes, getExpenses } from '@/lib/actions/finances';
import { PlanClient } from './plan-client';
import { RouteProgressWrapper } from '@/components/dashboard/route-progress-wrapper';
import { FinancialDisclaimer } from '@/components/legal/financial-disclaimer';
import { resolveLaunchExperience } from '@/lib/launch/experience';
import { getActiveSubscriptionForTenant, requireUserTenant } from '@/lib/tenant/server';
import type { BudgetShortfallIssue } from '@/lib/plans/contracts';
import { getCurrentUserProfile } from '@/lib/actions/profile';

export const metadata = {
  title: 'Tu Plan | RutaCero',
  description: 'Plan personalizado para salir de deudas',
};

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const experience = resolveLaunchExperience({ searchParams: resolvedSearchParams });
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

  // Get user's existing plans
  const plans = await getPlans();
  const activePlan = plans.find(p => p.active);

  // Get debts for context
  const debtsResult = await getDebts();
  // getDebts without pagination returns array, with pagination returns PaginatedResponse
  const debts = Array.isArray(debtsResult) ? debtsResult : debtsResult.data;
  const hasDebts = debts.length > 0;

  const [incomes, expenses] = await Promise.all([getIncomes(), getExpenses()]);
  const monthlyIncome = incomes.reduce((sum, income) => sum + Number(income.amount), 0);
  const monthlyExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.budget_amount ?? expense.amount),
    0
  );

  // Get comparison if user has debts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let comparison: any = null;
  let comparisonIssue: BudgetShortfallIssue | null = null;
  if (hasDebts) {
    try {
      const comparisonResult = await compareStrategies();
      if (comparisonResult.ok) {
        comparison = comparisonResult.data;
      } else {
        comparisonIssue = comparisonResult.issue;
      }
    } catch {
      comparison = null;
    }
  }

  // Get plan items if there's an active plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let planItems: any = null;
  if (activePlan) {
    try {
      planItems = await getPlanItems(activePlan.id);
    } catch {
      // No plan items available
    }
  }

  // Check if plan needs recalculation
  const recalculationStatus = await checkRecalculationNeeded();

  const paymentStatusRaw = resolvedSearchParams.paymentStatus;
  const paymentStatusValue = Array.isArray(paymentStatusRaw)
    ? paymentStatusRaw[0]
    : paymentStatusRaw;
  const initialPaymentStatus =
    paymentStatusValue === 'covers' ||
    paymentStatusValue === 'ahead' ||
    paymentStatusValue === 'short'
      ? paymentStatusValue
      : null;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <Suspense fallback={<div className="h-40" />}>
        <RouteProgressWrapper />
      </Suspense>
      <FinancialDisclaimer />
      <PlanClient
        plans={plans}
        comparison={comparison}
        comparisonIssue={comparisonIssue}
        hasDebts={hasDebts}
        userCurrency={userCurrency}
        planItems={planItems}
        recalculationStatus={recalculationStatus}
        debts={debts}
        isPro={isPro}
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        upgradeTitle={experience.plan.upgradeTitle}
        upgradeDescription={experience.plan.upgradeDescription}
        upgradeCtaLabel={experience.plan.upgradeCtaLabel}
        upgradeCtaHref={experience.plan.upgradeCtaHref}
        upgradeBullets={experience.plan.upgradeBullets}
        upgradePricingHref={experience.plan.pricingHref}
        initialPaymentStatus={initialPaymentStatus}
      />
    </div>
  );
}
