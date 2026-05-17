import Link from "next/link";
import { requireUserTenant } from "@/lib/tenant/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CreditCard, ArrowRight } from "lucide-react";
import type { Debt, UserProfile } from "@/types";

export async function DebtsListWrapper() {
  let supabase, user, tenantId;
  try {
    ({ supabase, user, tenantId } = await requireUserTenant());
  } catch {
    return null;
  }

  if (!user) return null;

  const [debtsResult, profileResult] = await Promise.all([
    supabase
      .from("debts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .order("balance", { ascending: false })
      .limit(5),
    supabase
      .from("user_profiles")
      .select("currency_base")
      .eq("user_id", user.id)
      .single()
  ]);

  const debts = debtsResult.data as Debt[] | null;
  const profile = profileResult.data as Pick<UserProfile, "currency_base"> | null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency: profile?.currency_base || "GTQ",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDebtTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CREDIT_CARD: "Tarjeta",
      LOAN: "Préstamo",
      INSTALLMENT: "Cuotas",
      INFORMAL: "Informal",
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Mis Deudas</CardTitle>
          <CardDescription>Ordenadas por saldo mayor</CardDescription>
        </div>
        <Button asChild size="sm">
          <Link href="/debts">
            <Plus className="mr-1 size-4" />
            Nueva
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {!debts || debts.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <CreditCard className="size-6 text-muted-foreground" />
            </div>
            <p className="mb-4 text-muted-foreground">
              Aún no tenés deudas registradas
            </p>
            <Button asChild variant="outline">
              <Link href="/debts">
                <Plus className="mr-2 size-4" />
                Agregar primera deuda
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {debts.map((debt) => (
              <Link
                key={debt.id}
                href={`/debts/${debt.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/20 hover:bg-accent hover:shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <CreditCard className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {debt.creditor}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getDebtTypeLabel(debt.type)}
                      </Badge>
                      {debt.apr && (
                        <span className="text-xs text-muted-foreground">
                          {debt.apr}% APR
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">
                    {formatCurrency(Number(debt.balance))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mín: {formatCurrency(Number(debt.min_payment))}
                  </p>
                </div>
              </Link>
            ))}
            {debts.length >= 5 && (
              <Link
                href="/debts"
                className="flex items-center justify-center gap-2 p-3 text-sm text-primary transition-colors hover:text-primary/80"
              >
                Ver todas
                <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
