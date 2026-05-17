import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { getAlerts } from "@/lib/actions/alerts";

export async function AlertsWrapper() {
  const alerts = await getAlerts();

  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <>
      <Alert variant="warning" showIcon className="mb-6">
        <AlertTitle>
          Tenés {alerts.length} alerta{alerts.length !== 1 ? "s" : ""} activa{alerts.length !== 1 ? "s" : ""}
        </AlertTitle>
        <AlertDescription>
          {alerts[0].message}
          {alerts.length > 1 && <span className="ml-1">y {alerts.length - 1} más.</span>}
        </AlertDescription>
      </Alert>

      <Card className="border-warning/20 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="size-5" />
            Alertas Activas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-xl bg-muted/50 p-4"
              >
                <div
                  className={`mt-1 size-2 shrink-0 rounded-full ${
                    alert.severity === "CRITICAL"
                      ? "bg-destructive"
                      : alert.severity === "WARNING"
                      ? "bg-warning"
                      : "bg-primary"
                  }`}
                />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{alert.title}</p>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                </div>
                <Badge
                  variant={
                    alert.severity === "CRITICAL"
                      ? "risk-high"
                      : alert.severity === "WARNING"
                      ? "risk-medium"
                      : "risk-low"
                  }
                >
                  {alert.severity === "CRITICAL"
                    ? "Urgente"
                    : alert.severity === "WARNING"
                    ? "Atención"
                    : "Info"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
