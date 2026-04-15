import Link from "next/link";
import { requireUserTenant } from "@/lib/tenant/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Target, Plus, Wallet, TrendingUp, Calendar, ArrowRight } from "lucide-react";

export async function QuickActionsWrapper() {
  let supabase, user, tenantId;
  try {
    ({ supabase, user, tenantId } = await requireUserTenant());
  } catch {
    return null;
  }

  const [activePlanResult, debtsCountResult] = await Promise.all([
    supabase
      .from("plans")
      .select("strategy")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("active", true)
      .single(),
    supabase
      .from("debts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
  ]);

  const activePlan = activePlanResult.data;
  const debtCount = debtsCountResult.count || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones Rápidas</CardTitle>
        <CardDescription>Lo que puedes hacer ahora</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Generate plan CTA - highlighted if no active plan */}
        {!activePlan && debtCount > 0 && (
          <Link
            href="/plan"
            className="flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all hover:border-primary/40 hover:bg-primary/10 hover:shadow-soft"
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20">
              <Target className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                Genera tu primer plan
              </p>
              <p className="text-sm text-muted-foreground">
                Te ayudaremos a salir de deudas más rápido
              </p>
            </div>
            <ArrowRight className="size-5 text-primary" />
          </Link>
        )}

        <Link
          href="/debts"
          className="flex items-center gap-4 rounded-xl border border-border p-4 transition-all hover:border-primary/20 hover:bg-accent hover:shadow-soft"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Plus className="size-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Agregar deuda</p>
            <p className="text-sm text-muted-foreground">
              Tarjeta, préstamo o cuotas
            </p>
          </div>
          <ArrowRight className="size-5 text-muted-foreground" />
        </Link>

        <Link
          href="/finances"
          className="flex items-center gap-4 rounded-xl border border-border p-4 transition-all hover:border-primary/20 hover:bg-accent hover:shadow-soft"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Wallet className="size-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">
              Configurar ingresos
            </p>
            <p className="text-sm text-muted-foreground">
              Ingresos y gastos esenciales
            </p>
          </div>
          <ArrowRight className="size-5 text-muted-foreground" />
        </Link>

        <Link
          href="/forecast"
          className="flex items-center gap-4 rounded-xl border border-border p-4 transition-all hover:border-primary/20 hover:bg-accent hover:shadow-soft"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <TrendingUp className="size-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Ver predicciones</p>
            <p className="text-sm text-muted-foreground">
              Flujo de caja quincenal
            </p>
          </div>
          <ArrowRight className="size-5 text-muted-foreground" />
        </Link>

        {activePlan && (
          <Link
            href="/plan"
            className="flex items-center gap-4 rounded-xl border border-border p-4 transition-all hover:border-primary/20 hover:bg-accent hover:shadow-soft"
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Calendar className="size-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                Ver calendario de pagos
              </p>
              <p className="text-sm text-muted-foreground">
                Plan {activePlan.strategy.toLowerCase()}
              </p>
            </div>
            <ArrowRight className="size-5 text-muted-foreground" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
