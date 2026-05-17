import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";
import { getUserSubscription } from "@/lib/actions/dashboard-analytics";
import { getAlertSummaryFor } from "@/lib/alerts/summary";
import { requireUserTenant } from "@/lib/tenant/server";
import { logger } from "@/lib/logger";
import { getDisplayName } from "@/lib/auth/display-name";
import {
  buildDashboardSubtitle,
  extractFirstName,
  formatPlanUpdatedDate,
  isFirstSession,
} from "./header-helpers";

import { RevealOnMount } from "@/components/motion/reveal-on-mount";
import { MetricsCardsWrapper } from "@/components/dashboard/metrics-cards-wrapper";
import { AlertsWrapper } from "@/components/dashboard/alerts-wrapper";
import { InsightsSectionWrapper } from "@/components/dashboard/insights-section-wrapper";
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

interface DashboardHeroProps {
  subtitle: string;
  tagline: string;
  isPro: boolean;
  children?: React.ReactNode;
}

function DashboardHero({ subtitle, tagline, isPro, children }: DashboardHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-emerald-50/60 via-card to-sky-50/40 p-6 shadow-subtle">
      <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.10),transparent_55%)]" />
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl text-balance">
            Dashboard
          </h1>
          <p className="text-muted-foreground">{subtitle}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground/80">
            {tagline}
          </p>
        </div>
        {isPro && (
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
            <Crown className="mr-1 h-3 w-3" />
            PRO
          </Badge>
        )}
      </div>
      {children ? <div className="relative z-10">{children}</div> : null}
    </div>
  );
}

export default async function DashboardPage() {
  let supabase;
  let user;
  let tenantId;
  try {
    ({ supabase, user, tenantId } = await requireUserTenant());
  } catch {
    return null;
  }

  // We only fetch subscription here to show/hide the PRO badge in the header
  const { isPro } = await getUserSubscription();

  let debtsCount = 0;
  const { count, error: countError } = await supabase
    .from("debts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (countError) {
    logger.error(
      { err: countError, tenantId },
      "[dashboard] debts count query failed",
    );
    // Fail open to the full dashboard so users with debts don't see empty state
    debtsCount = 1;
  } else {
    debtsCount = count ?? 0;
  }

  const displayName = getDisplayName(user);

  const firstName = extractFirstName(displayName);
  const firstSession = isFirstSession(user.created_at);
  const subtitle = buildDashboardSubtitle({
    firstName,
    isFirstSession: firstSession,
  });

  if (debtsCount === 0) {
    return (
      <div className="space-y-6">
        <RevealOnMount>
          <DashboardHero
            subtitle="Comienza tu camino hacia cero deudas."
            tagline="RutaCero · Primer paso"
            isPro={isPro}
          />
        </RevealOnMount>

        <RevealOnMount delay={0.05}>
          <FirstRunWelcome userName={displayName} />
        </RevealOnMount>
      </div>
    );
  }

  // Pull real data backing the hero pills. Failures degrade gracefully:
  // a missing pill is always preferable to a ghost pill.
  const [activePlanResult, alertSummary, profileResult] = await Promise.all([
    supabase
      .from("plans")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .maybeSingle(),
    getAlertSummaryFor({ supabase, tenantId, userId: user.id }).catch((err) => {
      logger.error({ err, tenantId }, "[dashboard] getAlertSummaryFor failed");
      return { criticalCount: 0, warningCount: 0, infoCount: 0, topAlert: null };
    }),
    supabase
      .from("user_profiles")
      .select("timezone")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (activePlanResult.error) {
    logger.error(
      { err: activePlanResult.error, tenantId },
      "[dashboard] active plan lookup failed",
    );
  }

  if (profileResult.error) {
    logger.error(
      { err: profileResult.error, tenantId },
      "[dashboard] user_profiles timezone lookup failed",
    );
  }

  const userTimeZone = profileResult.data?.timezone || "America/Guatemala";

  const planUpdatedLabel = formatPlanUpdatedDate(
    activePlanResult.data?.created_at ?? null,
    userTimeZone,
  );
  const pendingAlertsCount = alertSummary.criticalCount + alertSummary.warningCount;
  const hasHeroPills = Boolean(planUpdatedLabel) || pendingAlertsCount > 0;

  return (
    <div className="space-y-6">
      <RevealOnMount>
        <DashboardHero
          subtitle={subtitle}
          tagline="RutaCero · Resumen diario"
          isPro={isPro}
        >
          {hasHeroPills ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {planUpdatedLabel ? (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-700 dark:text-emerald-300">
                  Plan generado el {planUpdatedLabel}
                </span>
              ) : null}
              {pendingAlertsCount > 0 ? (
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  Tienes {pendingAlertsCount} alerta
                  {pendingAlertsCount === 1 ? "" : "s"} pendiente
                  {pendingAlertsCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          ) : null}
        </DashboardHero>
      </RevealOnMount>

      {/* KPI Cards */}
      <RevealOnMount delay={0.05}>
        <Suspense fallback={<MetricsSkeleton />}>
          <MetricsCardsWrapper />
        </Suspense>
      </RevealOnMount>

      <RevealOnMount delay={0.1}>
        <Suspense fallback={<div className="h-40" />}>
          <RouteProgressWrapper />
        </Suspense>
      </RevealOnMount>

      <RevealOnMount delay={0.15}>
        <Suspense fallback={<div className="h-40" />}>
          <FinancialHealthWrapper />
        </Suspense>
      </RevealOnMount>

      {/* Alerts Banner */}
      <RevealOnMount delay={0.2}>
        <Suspense fallback={<AlertsSkeleton />}>
          <AlertsWrapper />
        </Suspense>
      </RevealOnMount>

      {/* Análisis automático — deterministic insights from user's debt data */}
      <RevealOnMount delay={0.25}>
        <Suspense fallback={<div className="h-40" />}>
          <InsightsSectionWrapper />
        </Suspense>
      </RevealOnMount>

      {/* Budget Overview */}
      <RevealOnMount delay={0.3}>
        <Suspense fallback={<div className="h-24" />}>
          <BudgetOverviewWrapper />
        </Suspense>
      </RevealOnMount>

      <RevealOnMount delay={0.35}>
        <Suspense fallback={<div className="h-24" />}>
          <DebtGoalsSummaryWrapper />
        </Suspense>
      </RevealOnMount>

      {/* Main content grid */}
      <RevealOnMount delay={0.4}>
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
      </RevealOnMount>

      {/* PRO Analytics Section */}
      <RevealOnMount delay={0.45}>
        <Suspense fallback={<AnalyticsSkeleton />}>
          <ProAnalyticsWrapper />
        </Suspense>
      </RevealOnMount>
    </div>
  );
}
