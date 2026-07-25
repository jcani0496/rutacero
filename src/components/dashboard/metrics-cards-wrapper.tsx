import { StatCard } from "@/components/ui/card";
import { CreditCard, Banknote, Target, AlertTriangle } from "lucide-react";
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency: profile?.currency_base || "GTQ",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
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
        title="Plan Activo"
        value={activePlan?.strategy || "Sin plan"}
        subtitle={
          activePlan?.eta_debt_free
            ? `Libre de deudas: ${new Date(activePlan.eta_debt_free).toLocaleDateString("es-GT", { month: "short", year: "numeric" })}`
            : "Genera tu primer plan"
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
  );
}
