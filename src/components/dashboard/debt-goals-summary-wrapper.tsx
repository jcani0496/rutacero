import Link from 'next/link';
import { Sparkles, ArrowRight, CalendarClock } from 'lucide-react';
import { getUserPlan } from '@/lib/utils/feature-access';
import { getDebts } from '@/lib/actions/debts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export async function DebtGoalsSummaryWrapper() {
  const { isPro } = await getUserPlan();

  let debts;
  try {
    const debtsResult = await getDebts('ACTIVE');
    debts = Array.isArray(debtsResult) ? debtsResult : debtsResult.data;
  } catch {
    return null;
  }

  const goals = debts.filter(
    (debt) => Number(debt.goal_extra_payment || 0) > 0 || debt.goal_target_date,
  );

  if (goals.length === 0) return null;

  const currency = goals[0]?.currency || 'GTQ';
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const totalExtra = goals.reduce((sum, d) => sum + Number(d.goal_extra_payment || 0), 0);
  const upcomingTarget = goals
    .filter((goal) => goal.goal_target_date)
    .map((goal) => new Date(goal.goal_target_date as string))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  if (!isPro) {
    return (
      <Card className="border-dashed border-primary/40 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Metas de deuda
              <Badge className="bg-amber-500/15 text-amber-600">PRO</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Tenés {goals.length} meta{goals.length !== 1 ? 's' : ''} registrada{goals.length !== 1 ? 's' : ''}.
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Actualiza para editar metas y ajustar el plan automáticamente.
          </p>
          <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
            <Link href="/pricing">
              Ver Planes PRO
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" />
            Metas de deuda
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Extra mensual total {formatCurrency(totalExtra)}.
          </p>
        </div>
        <Badge variant="secondary">{goals.length} metas</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4" />
          {upcomingTarget
            ? `Próxima meta: ${upcomingTarget.toLocaleDateString('es-GT', { month: 'short', year: 'numeric' })}`
            : 'Sin fecha objetivo definida'}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/debts">Gestionar metas</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
