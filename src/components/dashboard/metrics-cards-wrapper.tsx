import { requireUserTenant } from "@/lib/tenant/server";
import { StatCard } from "@/components/ui/card";
import { CreditCard, Banknote, Target, AlertTriangle } from "lucide-react";
import type { Debt, Plan, UserProfile } from "@/types";
import { getAlerts } from "@/lib/actions/alerts";

export async function MetricsCardsWrapper() {
  let supabase, user, tenantId;
  try {
    ({ supabase, user, tenantId } = await requireUserTenant());
  } catch {
    return null;
  }

  // Parallel data fetching for metrics
  const [debtsResult, activePlanResult, alerts, profileResult] = await Promise.all([
    supabase
      .from("debts")
      .select("balance, min_payment")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("status", "ACTIVE"),
    supabase
      .from("plans")
      .select("strategy, eta_debt_free")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("active", true)
      .single(),
    getAlerts(),
    supabase
      .from("user_profiles")
      .select("currency_base")
      .eq("user_id", user.id)
      .single()
  ]);

  const debts = debtsResult.data as Pick<Debt, "balance" | "min_payment">[] | null;
  const activePlan = activePlanResult.data as Pick<Plan, "strategy" | "eta_debt_free"> | null;
  const profile = profileResult.data as Pick<UserProfile, "currency_base"> | null;

  // Calculate totals
  const totalDebt = debts?.reduce((sum, debt) => sum + Number(debt.balance), 0) || 0;
  const totalMinPayment = debts?.reduce((sum, debt) => sum + Number(debt.min_payment), 0) || 0;
  const debtCount = debts?.length || 0;

  // Format currency helper
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
