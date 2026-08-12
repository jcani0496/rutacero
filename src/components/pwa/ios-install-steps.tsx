import { DeviceMobile, Export, Plus } from "@phosphor-icons/react";
import { ICON } from "@/components/icons/phosphor";

const STEPS = [
  {
    icon: Export,
    title: "Tocá Compartir",
    body: "El recuadro con la flecha hacia arriba, abajo en Safari.",
  },
  {
    icon: Plus,
    title: "Elegí Añadir a pantalla de inicio",
    body: "Puede estar un poco más abajo en la lista.",
  },
  {
    icon: DeviceMobile,
    title: "Confirmá Añadir",
    body: "RutaCero queda como app en tu pantalla de inicio.",
  },
] as const;

export function IosInstallSteps() {
  return (
    <ol className="space-y-3">
      {STEPS.map((step, index) => {
        const StepIcon = step.icon;
        return (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[var(--rc-teal-text)]"
            >
              <StepIcon {...ICON} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                {index + 1}. {step.title}
              </p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
