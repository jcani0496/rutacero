import Link from "next/link";
import { HeartPulse, ArrowUpRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getDebts } from "@/lib/actions/debts";
import { getIncomes, getExpenses } from "@/lib/actions/finances";
import { calculateRiskScore } from "@/lib/engine/risk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function FinancialHealthWrapper() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            Salud financiera
          </CardTitle>
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
      tone: "text-emerald-400",
      ring: "bg-emerald-500/15",
      bar: "bg-emerald-500",
      glow: "from-emerald-500/25 via-emerald-500/10 to-transparent",
    },
    AT_RISK: {
      label: "En riesgo",
      tone: "text-amber-400",
      ring: "bg-amber-500/15",
      bar: "bg-amber-500",
      glow: "from-amber-500/25 via-amber-500/10 to-transparent",
    },
    CRITICAL: {
      label: "Crítico",
      tone: "text-red-400",
      ring: "bg-red-500/15",
      bar: "bg-red-500",
      glow: "from-red-500/25 via-red-500/10 to-transparent",
    },
  };

  const config = levelConfig[riskScore.level];
  const focusFactors = [...riskScore.factors].sort((a, b) => a.score - b.score).slice(0, 3);
  const primaryRecommendation = riskScore.recommendations[0];

  return (
    <Card className="relative overflow-hidden border-slate-800/60 bg-slate-900/70 text-white shadow-soft">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-80",
          `bg-gradient-to-r ${config.glow}`
        )}
      />
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center gap-2 text-white">
          <HeartPulse className="h-5 w-5 text-primary" />
          Salud financiera general
        </CardTitle>
        <CardDescription className="text-slate-300">
          Evaluación integral basada en ingresos, gastos y deudas activas.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl", config.ring)}>
                <span className="text-2xl font-bold">{riskScore.score}</span>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Score</p>
                <p className={cn("text-lg font-semibold", config.tone)}>{config.label}</p>
                <p className="text-sm text-slate-300">
                  {riskScore.level === "HEALTHY"
                    ? "Mantené tu disciplina para acelerar tu libertad financiera."
                    : riskScore.level === "AT_RISK"
                      ? "Hay señales tempranas que podés ajustar este mes."
                      : "Necesitás un plan más agresivo para estabilizar tu flujo."}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>0</span>
                <span>100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full transition-all", config.bar)}
                  style={{ width: `${riskScore.score}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold text-slate-200">Factores clave</p>
            {focusFactors.map((factor) => (
              <div key={factor.name} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-slate-200">{factor.name}</p>
                  <p className="text-xs text-slate-400">{factor.value}</p>
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    factor.impact === "POSITIVE"
                      ? "text-emerald-400"
                      : factor.impact === "NEGATIVE"
                        ? "text-red-400"
                        : "text-amber-400"
                  )}
                >
                  {factor.score}/100
                </span>
              </div>
            ))}
          </div>
        </div>

        {primaryRecommendation && (
          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-200">
                {primaryRecommendation.title}
              </p>
              <p className="text-xs text-slate-400">{primaryRecommendation.action}</p>
            </div>
            <Button size="sm" className="bg-white/10 text-white hover:bg-white/20" asChild>
              <Link href="/forecast">
                Ver detalles
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
