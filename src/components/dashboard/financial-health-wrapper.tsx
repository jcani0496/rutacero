import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { ICON } from "@/components/icons/phosphor";

import { getAppUser } from "@/lib/auth/session";
import { getDebts } from "@/lib/actions/debts";
import { getIncomes, getExpenses } from "@/lib/actions/finances";
import { calculateRiskScore } from "@/lib/engine/risk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function FinancialHealthWrapper() {
  const user = await getAppUser();

  if (!user) return null;

  const [debtsResult, incomes, expenses] = await Promise.all([
    getDebts(),
    getIncomes(),
    getExpenses(),
  ]);

  const debts = Array.isArray(debtsResult) ? debtsResult : debtsResult.data;
  const monthlyIncome = incomes.reduce((sum, income) => sum + Number(income.amount), 0);
  const monthlyExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.budget_amount ?? expense.amount),
    0
  );

  if (debts.length === 0 && monthlyIncome === 0 && monthlyExpenses === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Salud financiera</CardTitle>
          <CardDescription>
            Completa tus datos para calcular tu estado financiero general.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/finances">Agregar ingresos y gastos</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/debts">Agregar deudas</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const riskScore = calculateRiskScore({
    debts,
    monthlyIncome,
    monthlyExpenses,
  });

  const levelConfig = {
    HEALTHY: {
      label: "Saludable",
      tone: "text-success",
      ring: "bg-success/10",
      bar: "bg-success",
    },
    AT_RISK: {
      label: "En riesgo",
      tone: "text-warning",
      ring: "bg-warning/10",
      bar: "bg-warning",
    },
    CRITICAL: {
      label: "Crítico",
      tone: "text-destructive",
      ring: "bg-destructive/10",
      bar: "bg-destructive",
    },
  };

  const config = levelConfig[riskScore.level];
  const focusFactors = [...riskScore.factors].sort((a, b) => a.score - b.score).slice(0, 3);
  const primaryRecommendation = riskScore.recommendations[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salud financiera general</CardTitle>
        <CardDescription>
          Evaluación integral basada en ingresos, gastos y deudas activas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl", config.ring)}>
                <span className={cn("text-2xl font-bold", config.tone)}>{riskScore.score}</span>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Score</p>
                <p className={cn("text-lg font-semibold", config.tone)}>{config.label}</p>
                <p className="text-sm text-muted-foreground">
                  {riskScore.level === "HEALTHY"
                    ? "Mantené tu disciplina para acelerar tu libertad financiera."
                    : riskScore.level === "AT_RISK"
                      ? "Hay señales tempranas que podés ajustar este mes."
                      : "Necesitás un plan más agresivo para estabilizar tu flujo."}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", config.bar)}
                  style={{ width: `${riskScore.score}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-secondary p-4">
            <p className="text-sm font-semibold text-foreground">Factores clave</p>
            {focusFactors.map((factor) => (
              <div key={factor.name} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-foreground">{factor.name}</p>
                  <p className="text-xs text-muted-foreground">{factor.value}</p>
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    factor.impact === "POSITIVE"
                      ? "text-success"
                      : factor.impact === "NEGATIVE"
                        ? "text-destructive"
                        : "text-warning"
                  )}
                >
                  {factor.score}/100
                </span>
              </div>
            ))}
          </div>
        </div>

        {primaryRecommendation && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {primaryRecommendation.title}
              </p>
              <p className="text-xs text-muted-foreground">{primaryRecommendation.action}</p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/forecast">
                Ver detalles
                <ArrowUpRight {...ICON} className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
