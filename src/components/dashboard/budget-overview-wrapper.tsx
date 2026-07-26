import Link from 'next/link';
import { Crown, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { ICON } from '@/components/icons/phosphor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getBudgetOverview } from '@/lib/actions/finances';
import { getUserSubscription } from '@/lib/actions/dashboard-analytics';

export async function BudgetOverviewWrapper() {
  const { isPro } = await getUserSubscription();

  if (!isPro) {
    return (
      <Card className="border-dashed border-primary/40 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Presupuesto Variable PRO
              <Badge className="bg-amber-500/15 text-amber-600">Nuevo</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Desbloqueá alertas y resumen avanzado de presupuestos.
            </p>
          </div>
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
            <Crown {...ICON} className="mr-1 h-3 w-3" />
            PRO
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Visualizá el uso por categoria y recibí alertas cuando excedas el límite.
          </p>
          <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
            <Link href="/pricing">
              Ver Planes PRO
              <ArrowRight {...ICON} className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const overview = await getBudgetOverview();

  if (!overview || overview.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Presupuesto Variable</CardTitle>
          <p className="text-sm text-muted-foreground">
            Aún no tenés presupuestos definidos.
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/finances">Crear presupuestos</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currency = overview.items[0]?.currency || 'GTQ';
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const topItems = [...overview.items].sort((a, b) => b.usagePercent - a.usagePercent).slice(0, 4);
  const remainingLabel = overview.remainingTotal >= 0 ? 'Disponible' : 'Excedido';

  return (
    <div className="space-y-4">
      {overview.overBudgetCount > 0 && (
        <Alert variant="warning" showIcon>
          <AlertTitle>Presupuesto excedido</AlertTitle>
          <AlertDescription>
            {overview.overBudgetCount} categoria{overview.overBudgetCount !== 1 ? 's' : ''} superaron el limite este periodo.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border/60">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Resumen de presupuesto</CardTitle>
            <p className="text-sm text-muted-foreground">
              Seguimiento del gasto variable del mes.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/finances">Ver detalles</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Presupuesto total</p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(overview.totalTarget)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Gasto real</p>
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(overview.totalActual)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{remainingLabel}</p>
              <p className={`text-lg font-semibold ${overview.remainingTotal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {formatCurrency(overview.remainingTotal)}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {topItems.map((item) => {
              const progressClass = item.status === 'OVER'
                ? '[&_[data-slot=progress-indicator]]:bg-red-500'
                : item.status === 'NEAR_LIMIT'
                  ? '[&_[data-slot=progress-indicator]]:bg-amber-500'
                  : '[&_[data-slot=progress-indicator]]:bg-emerald-500';

              return (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{item.category}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(item.actual)} / {formatCurrency(item.target)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, item.usagePercent)}
                    className={`bg-muted ${progressClass}`}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
