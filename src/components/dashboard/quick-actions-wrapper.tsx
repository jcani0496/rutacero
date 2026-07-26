import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getDebtStats } from "@/lib/actions/debts";
import { getActivePlan } from "@/lib/actions/plans";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ICON } from "@/components/icons/phosphor";

export async function QuickActionsWrapper() {
  let activePlan;
  let debtCount = 0;
  try {
    const [plan, stats] = await Promise.all([getActivePlan(), getDebtStats()]);
    activePlan = plan;
    debtCount = stats.debtCount;
  } catch {
    return null;
  }

  const actions = [
    ...(!activePlan && debtCount > 0
      ? [{
          href: "/plan",
          title: "Genera tu primer plan",
          description: "Te ayudaremos a salir de deudas más rápido",
          highlight: true,
        }]
      : []),
    {
      href: "/debts",
      title: "Agregar deuda",
      description: "Tarjeta, préstamo o cuotas",
      highlight: false,
    },
    {
      href: "/finances",
      title: "Configurar ingresos",
      description: "Ingresos y gastos esenciales",
      highlight: false,
    },
    {
      href: "/forecast",
      title: "Ver predicciones",
      description: "Flujo de caja quincenal",
      highlight: false,
    },
    ...(activePlan
      ? [{
          href: "/plan",
          title: "Ver calendario de pagos",
          description: `Plan ${activePlan.strategy.toLowerCase()}`,
          highlight: false,
        }]
      : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones Rápidas</CardTitle>
        <CardDescription>Lo que podés hacer ahora</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => (
          <Link
            key={`${action.href}-${action.title}`}
            href={action.href}
            className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-all hover:shadow-soft ${
              action.highlight
                ? "border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10"
                : "border-border hover:border-primary/20 hover:bg-accent"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{action.title}</p>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </div>
            <ArrowRight
              {...ICON}
              className={`size-5 shrink-0 ${action.highlight ? "text-primary" : "text-muted-foreground"}`}
            />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
