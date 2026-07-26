"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  PlayCircle,
  Flask,
  CircleNotch,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { seedSampleData } from "@/lib/actions/sample-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ICON } from "@/components/icons/phosphor";

interface FirstRunWelcomeProps {
  userName?: string | null;
}

const STEPS = [
  {
    title: "Agregá tus deudas",
    description:
      "Registrá tarjetas, préstamos o cuotas con su saldo, tasa y pago mínimo.",
  },
  {
    title: "Configurá tu presupuesto",
    description:
      "Ingresá tus ingresos y gastos esenciales para conocer cuánto podés destinar a pagos.",
  },
  {
    title: "Generá un plan",
    description:
      "Elegí una estrategia (avalancha o bola de nieve) y obtené un calendario claro mes a mes.",
  },
  {
    title: "Seguí tu progreso",
    description:
      "Marcá pagos, recibí alertas y observá cómo se acerca tu fecha de libertad financiera.",
  },
];

function getGreetingName(rawName?: string | null): string {
  if (!rawName) return "";
  const trimmed = rawName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

export function FirstRunWelcome({ userName }: FirstRunWelcomeProps) {
  const [open, setOpen] = useState(false);
  const [isSeeding, startSeeding] = useTransition();
  const router = useRouter();
  const firstName = getGreetingName(userName);

  const handleSeedSample = () => {
    startSeeding(async () => {
      try {
        const result = await seedSampleData();
        if (result.success) {
          toast.success("Datos de ejemplo cargados", {
            description:
              "Son deudas e ingresos de muestra (no reales). Explorá el plan y eliminalos cuando quieras.",
          });
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        console.error("Error seeding sample data:", error);
        toast.error(
          "No pudimos cargar los datos de ejemplo. Revisá tu conexión e intentá de nuevo."
        );
      }
    });
  };

  return (
    <section
      aria-labelledby="first-run-welcome-title"
      className="rounded-2xl border border-border bg-card p-8 shadow-soft sm:p-12"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2
          id="first-run-welcome-title"
          className="text-2xl font-bold text-foreground sm:text-3xl"
        >
          {firstName
            ? `¡Hola, ${firstName}! Bienvenido a RutaCero`
            : "¡Bienvenido a RutaCero!"}
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Aún no tenés deudas registradas. Empezá con una deuda real y después
          generá tu plan — ahí ves tu ruta mes a mes.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/debts?new=1">
              <PlusCircle {...ICON} className="size-5" aria-hidden="true" />
              Agregar primera deuda
            </Link>
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                aria-label="Ver cómo funciona RutaCero"
              >
                <PlayCircle {...ICON} className="size-5" aria-hidden="true" />
                Ver cómo funciona
              </Button>
            </DialogTrigger>
            <DialogContent size="lg">
              <DialogHeader>
                <DialogTitle>Así funciona RutaCero</DialogTitle>
                <DialogDescription>
                  En cuatro pasos pasarás de no saber por dónde empezar a tener
                  un plan claro para salir de deudas.
                </DialogDescription>
              </DialogHeader>

              <ol className="mt-4 space-y-4">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-4 text-left">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <p className="mt-4 text-xs text-muted-foreground">
                Pronto añadiremos un recorrido en video para verlo paso a paso.
              </p>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-4 flex flex-col items-center gap-1.5">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleSeedSample}
            disabled={isSeeding}
          >
            {isSeeding ? (
              <CircleNotch {...ICON} className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Flask {...ICON} className="size-5" aria-hidden="true" />
            )}
            {isSeeding ? "Cargando ejemplo..." : "Ver con datos de ejemplo"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Datos de ejemplo claramente etiquetados — no son tus deudas reales.
            Podés eliminarlos cuando quieras y cargar las tuyas.
          </p>
        </div>
      </div>
    </section>
  );
}
