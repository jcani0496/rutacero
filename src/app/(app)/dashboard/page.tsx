import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/actions/dashboard-analytics";
import { ensureCurrentTenantForUser } from "@/lib/tenant/server";

import { MetricsCardsWrapper } from "@/components/dashboard/metrics-cards-wrapper";
import { AlertsWrapper } from "@/components/dashboard/alerts-wrapper";
import { DebtsListWrapper } from "@/components/dashboard/debts-list-wrapper";
import { QuickActionsWrapper } from "@/components/dashboard/quick-actions-wrapper";
import { ProAnalyticsWrapper } from "@/components/dashboard/pro-analytics-wrapper";
import { BudgetOverviewWrapper } from "@/components/dashboard/budget-overview-wrapper";
import { DebtGoalsSummaryWrapper } from "@/components/dashboard/debt-goals-summary-wrapper";
import { FinancialHealthWrapper } from "@/components/dashboard/financial-health-wrapper";
import { RouteProgressWrapper } from "@/components/dashboard/route-progress-wrapper";
import { FirstRunWelcome } from "@/components/dashboard/first-run-welcome";

import {
  MetricsSkeleton,
  DebtsListSkeleton,
  QuickActionsSkeleton,
  AlertsSkeleton,
  AnalyticsSkeleton,
} from "@/components/dashboard/skeletons";

export const metadata = {
  title: "Dashboard | RutaCero",
  description: "Resumen de tus finanzas y progreso.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // We only fetch subscription here to show/hide the PRO badge in the header
  const { isPro } = await getUserSubscription();

  // Resolve tenant id (using same fallback pattern as requireUserTenant)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("current_tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let tenantId = (profile?.current_tenant_id as string | null | undefined) ?? null;
  if (!tenantId) {
    try {
      tenantId = await ensureCurrentTenantForUser(user.id);
    } catch {
      tenantId = null;
    }
  }

  let debtsCount = 0;
  if (tenantId) {
    const { count } = await supabase
      .from("debts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    debtsCount = count ?? 0;
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    null;

  if (debtsCount === 0) {
    return (
      <div className="space-y-6">
        {/* Welcome header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/80 p-6 text-white shadow-soft">
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.2),transparent_55%),radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.2),transparent_55%)]" />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
                Dashboard
              </h1>
              <p className="text-slate-300">
                Comienza tu camino hacia cero deudas.
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                RutaCero · Primer paso
              </p>
            </div>
            {isPro && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                <Crown className="mr-1 h-3 w-3" />
                PRO
              </Badge>
            )}
          </div>
        </div>

        <FirstRunWelcome userName={displayName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/80 p-6 text-white shadow-soft">
        <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.2),transparent_55%),radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.2),transparent_55%)]" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
              Dashboard
            </h1>
            <p className="text-slate-300">
              Bienvenido de vuelta. Aquí está el resumen de tus finanzas.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              RutaCero · Resumen diario
            </p>
          </div>
          {isPro && (
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
              <Crown className="mr-1 h-3 w-3" />
              PRO
            </Badge>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">
            Plan recomendado actualizado
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">
            Revisa tus alertas pendientes
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsCardsWrapper />
      </Suspense>

      <Suspense fallback={<div className="h-40" />}>
        <RouteProgressWrapper />
      </Suspense>

      <Suspense fallback={<div className="h-40" />}>
        <FinancialHealthWrapper />
      </Suspense>

      {/* Alerts Banner */}
      <Suspense fallback={<AlertsSkeleton />}>
        <AlertsWrapper />
      </Suspense>

      {/* Budget Overview */}
      <Suspense fallback={<div className="h-24" />}>
        <BudgetOverviewWrapper />
      </Suspense>

      <Suspense fallback={<div className="h-24" />}>
        <DebtGoalsSummaryWrapper />
      </Suspense>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Debts list */}
        <Suspense fallback={<DebtsListSkeleton />}>
          <DebtsListWrapper />
        </Suspense>

        {/* Quick actions */}
        <Suspense fallback={<QuickActionsSkeleton />}>
          <QuickActionsWrapper />
        </Suspense>
      </div>

      {/* PRO Analytics Section */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <ProAnalyticsWrapper />
      </Suspense>
    </div>
  );
}
