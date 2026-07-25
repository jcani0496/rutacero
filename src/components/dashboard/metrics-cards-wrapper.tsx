import Link from "next/link";
import { StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Banknote, Target, AlertTriangle, ArrowRight } from "lucide-react";
import { getAlerts } from "@/lib/actions/alerts";
import { getDebtStats } from "@/lib/actions/debts";
import { getActivePlan } from "@/lib/actions/plans";
import { getCurrentUserProfile } from "@/lib/actions/profile";

export async function MetricsCardsWrapper() {
  let debtsStats;
  let activePlan;
  let alerts;
  let profile;
  try {
    [debtsStats, activePlan, alerts, profile] = await Promise.all([
      getDebtStats(),
      getActivePlan(),
      getAlerts(),
      getCurrentUserProfile(),
    ]);
  } catch {
    return null;
  }

  const totalDebt = debtsStats.totalBalance;
  const totalMinPayment = debtsStats.totalMinPayment;
  const debtCount = debtsStats.debtCount;
  const currency = profile?.currency_base || "GTQ";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const etaLabel = activePlan?.eta_debt_free
    ? new Date(activePlan.eta_debt_free).toLocaleDateString("es-GT", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-4">
      {!activePlan && debtCount > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Modo setup</p>
            <p className="text-sm text-muted-foreground">
              Ya tenés {formatCurrency(totalDebt)} en deudas. Generá tu plan para ver
              tu fecha libre de deudas.
            </p>
          </div>
          <Button size="sm" asChild className="shrink-0">
            <Link href="/plan">
              Generar plan
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Deuda Total"
          value={formatCurrency(totalDebt)}
          subtitle={`${debtCount} deuda${debtCount !== 1 ? "s" : ""} activa${debtCount !== 1 ? "s" : ""}`}
          icon={<CreditCard className="size-5" />}
        />

        <StatCard
          title="Pago Mínimo Mensual"
          value={formatCurrency(totalMinPayment)}
          subtitle="Suma de todos los mínimos"
          icon={<Banknote className="size-5" />}
        />

        <StatCard
          title={etaLabel ? "Libre de deudas" : "Plan Activo"}
          value={etaLabel || "Sin plan"}
          subtitle={
            etaLabel
              ? `Estrategia ${activePlan?.strategy || ""} · ${formatCurrency(totalDebt)}`
              : "Generá tu primer plan"
          }
          icon={<Target className="size-5" />}
        />

        <StatCard
          title="Alertas"
          value={alerts?.length || 0}
          subtitle="Pendientes de revisar"
          icon={<AlertTriangle className="size-5" />}
          className={alerts && alerts.length > 0 ? "border-warning/20" : ""}
        />
      </div>
    </div>
  );
}
