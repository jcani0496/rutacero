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
import { requireUserTenant } from '@/lib/tenant/server';
import type { BudgetShortfallIssue } from '@/lib/plans/contracts';

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

  // Get subscription status
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_code, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'ACTIVE')
    .single();

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
  let comparison = null;
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
  let planItems = null;
  if (activePlan) {
    try {
      planItems = await getPlanItems(activePlan.id);
    } catch {
      // No plan items available
    }
  }

  // Check if plan needs recalculation
  const recalculationStatus = await checkRecalculationNeeded();

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
      />
    </div>
  );
}
