import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Crown } from "@phosphor-icons/react/dist/ssr";
import { ICON } from "@/components/icons/phosphor";
import { getUserSubscription } from "@/lib/actions/dashboard-analytics";
import { getAlertSummaryFor } from "@/lib/alerts/summary";
import { getDebts } from "@/lib/actions/debts";
import { getActivePlan } from "@/lib/actions/plans";
import { getCurrentUserProfile } from "@/lib/actions/profile";
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
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { SAMPLE_DATA_PREFIX } from "@/lib/constants/sample-data";

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
  headline?: string;
  outcomeEta?: string | null;
  outcomeTotal?: string | null;
  setupMode?: boolean;
  children?: React.ReactNode;
}

function DashboardHero({
  subtitle,
  tagline,
  isPro,
  headline = "Dashboard",
  outcomeEta,
  outcomeTotal,
  setupMode = false,
  children,
}: DashboardHeroProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl text-balance">
            {headline}
          </h1>
          <p className="text-muted-foreground">{subtitle}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground/80">
            {tagline}
          </p>
          {outcomeEta || outcomeTotal ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {outcomeEta ? (
                <div className="rounded-xl border border-primary/20 bg-accent px-4 py-3">
                  <p className="text-xs text-muted-foreground">Libre de deudas</p>
                  <p className="text-xl font-bold text-[var(--rc-teal-text)]">
                    {outcomeEta}
                  </p>
                </div>
              ) : null}
              {outcomeTotal ? (
                <div className="rounded-xl border border-border bg-secondary px-4 py-3">
                  <p className="text-xs text-muted-foreground">Deuda total</p>
                  <p className="text-xl font-bold text-foreground">{outcomeTotal}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          {setupMode ? (
            <div className="mt-4">
              <Button size="sm" asChild>
                <Link href="/plan">
                  Generar plan
                  <ArrowRight {...ICON} className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
        {isPro && (
          <Badge className="border border-border bg-secondary text-foreground">
            <Crown {...ICON} className="mr-1 h-3 w-3 text-primary" />
            PRO
          </Badge>
        )}
      </div>
      {children ? <div>{children}</div> : null}
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
  let totalDebtBalance = 0;
  let hasSampleData = false;
  try {
    const debtsResult = await getDebts("ACTIVE");
    const debts = Array.isArray(debtsResult) ? debtsResult : debtsResult.data;
    debtsCount = debts.length;
    totalDebtBalance = debts.reduce((sum, d) => sum + Number(d.balance), 0);
    hasSampleData = debts.some((debt) =>
      (debt.notes || "").startsWith(SAMPLE_DATA_PREFIX),
    );
  } catch (countError) {
    logger.error(
      { err: countError, tenantId },
      "[dashboard] debts count query failed",
    );
    // Fail open to the full dashboard so users with debts don't see empty state
    debtsCount = 1;
  }

  const displayName = getDisplayName(user);

  const firstName = extractFirstName(displayName);
  const firstSession = isFirstSession((user as { created_at?: string }).created_at);
  const subtitle = buildDashboardSubtitle({
    firstName,
    isFirstSession: firstSession,
  });

  if (debtsCount === 0) {
    return (
      <div className="space-y-6">
        <RevealOnMount>
          <DashboardHero
            subtitle="Empezá tu camino hacia cero deudas."
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
  const [activePlan, alertSummary, profile] = await Promise.all([
    getActivePlan().catch((err) => {
      logger.error({ err, tenantId }, "[dashboard] active plan lookup failed");
      return null;
    }),
    getAlertSummaryFor({ supabase, tenantId, userId: user.id }).catch((err) => {
      logger.error({ err, tenantId }, "[dashboard] getAlertSummaryFor failed");
      return { criticalCount: 0, warningCount: 0, infoCount: 0, topAlert: null };
    }),
    getCurrentUserProfile().catch((err) => {
      logger.error({ err, tenantId }, "[dashboard] user_profiles timezone lookup failed");
      return null;
    }),
  ]);

  const userTimeZone = profile?.timezone || "America/Guatemala";

  const planUpdatedLabel = formatPlanUpdatedDate(
    activePlan?.created_at ?? null,
    userTimeZone,
  );
  const pendingAlertsCount = alertSummary.criticalCount + alertSummary.warningCount;
  const hasHeroPills = Boolean(planUpdatedLabel) || pendingAlertsCount > 0;

  const currency = profile?.currency_base || "GTQ";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const outcomeEta = activePlan?.eta_debt_free
    ? new Date(activePlan.eta_debt_free).toLocaleDateString("es-GT", {
        month: "short",
        year: "numeric",
      })
    : null;
  const outcomeTotal = formatCurrency(totalDebtBalance);
  const setupMode = !activePlan;

  return (
    <div className="space-y-6">
      <RevealOnMount>
        <DashboardHero
          headline={setupMode ? "Armá tu ruta a cero" : "Tu ruta a cero"}
          subtitle={
            setupMode
              ? "Tenés deudas registradas. El siguiente paso es generar tu plan."
              : subtitle
          }
          tagline={setupMode ? "RutaCero · Setup" : "RutaCero · Resumen diario"}
          isPro={isPro}
          outcomeEta={outcomeEta}
          outcomeTotal={outcomeTotal}
          setupMode={setupMode}
        >
          {hasHeroPills ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {planUpdatedLabel ? (
                <span className="rounded-full bg-accent px-3 py-1 text-[var(--rc-teal-text)]">
                  Plan generado el {planUpdatedLabel}
                </span>
              ) : null}
              {pendingAlertsCount > 0 ? (
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  Tenés {pendingAlertsCount} alerta
                  {pendingAlertsCount === 1 ? "" : "s"} pendiente
                  {pendingAlertsCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          ) : null}
        </DashboardHero>
      </RevealOnMount>

      {hasSampleData && (
        <RevealOnMount delay={0.03}>
          <SampleDataBanner />
        </RevealOnMount>
      )}

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
