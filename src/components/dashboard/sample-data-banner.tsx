"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { clearSampleData } from "@/lib/actions/sample-data";

/**
 * Shown on the dashboard while the account contains sample rows created by
 * "Ver con datos de ejemplo". Offers a one-click way to remove them.
 */
export function SampleDataBanner() {
  const router = useRouter();
  const [isClearing, startClearing] = useTransition();

  const handleClear = () => {
    startClearing(async () => {
      try {
        const result = await clearSampleData();
        if (result.success) {
          toast.success("Datos de ejemplo eliminados", {
            description: "Tu cuenta quedó lista para tus deudas reales.",
          });
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        console.error("Error clearing sample data:", error);
        toast.error(
          "No pudimos eliminar los datos de ejemplo. Revisá tu conexión e intentá de nuevo."
        );
      }
    });
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <FlaskConical className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Estás viendo datos de ejemplo
          </p>
          <p className="text-sm text-muted-foreground">
            Explorá el plan y, cuando quieras, eliminalos para agregar tus
            deudas reales.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClear}
        disabled={isClearing}
      >
        {isClearing ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-4" aria-hidden="true" />
        )}
        {isClearing ? "Eliminando..." : "Eliminar datos de ejemplo"}
      </Button>
    </div>
  );
}
