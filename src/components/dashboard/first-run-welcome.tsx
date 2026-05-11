"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  PlayCircle,
  ListPlus,
  Calculator,
  Target,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FirstRunWelcomeProps {
  userName?: string | null;
}

const STEPS = [
  {
    icon: ListPlus,
    title: "Agrega tus deudas",
    description:
      "Registra tarjetas, préstamos o cuotas con su saldo, tasa y pago mínimo.",
  },
  {
    icon: Calculator,
    title: "Configura tu presupuesto",
    description:
      "Ingresa tus ingresos y gastos esenciales para conocer cuánto puedes destinar a pagos.",
  },
  {
    icon: Target,
    title: "Genera un plan",
    description:
      "Elige una estrategia (avalancha o bola de nieve) y obtén un calendario claro mes a mes.",
  },
  {
    icon: Sparkles,
    title: "Sigue tu progreso",
    description:
      "Marca pagos, recibe alertas y observa cómo se acerca tu fecha de libertad financiera.",
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
  const firstName = getGreetingName(userName);

  return (
    <section
      aria-labelledby="first-run-welcome-title"
      className="rounded-2xl border border-border bg-card p-8 shadow-soft sm:p-12"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="size-7 text-primary" aria-hidden="true" />
        </div>
        <h2
          id="first-run-welcome-title"
          className="text-2xl font-bold text-foreground sm:text-3xl"
        >
          {firstName
            ? `¡Hola, ${firstName}! Bienvenido a RutaCero`
            : "¡Bienvenido a RutaCero!"}
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Aún no tienes deudas registradas. Empieza agregando una para
          desbloquear tu plan personalizado, alertas inteligentes y predicciones
          de flujo de caja.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/debts" aria-label="Agrega tu primera deuda">
              <PlusCircle className="size-5" aria-hidden="true" />
              Agrega tu primera deuda
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
                <PlayCircle className="size-5" aria-hidden="true" />
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
                {STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          <span className="mr-2 text-muted-foreground">
                            {index + 1}.
                          </span>
                          {step.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <p className="mt-4 text-xs text-muted-foreground">
                Pronto añadiremos un recorrido en video para verlo paso a paso.
              </p>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}
