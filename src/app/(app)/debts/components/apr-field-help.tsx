"use client";

import { useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Typical APR presets for Guatemala, grouped by debt type.
const APR_PRESETS: Record<string, { label: string; value: number }[]> = {
  CREDIT_CARD: [
    { label: "Tarjeta de crédito típica (40%)", value: 40 },
    { label: "Tarjeta tienda/retail (45%)", value: 45 },
  ],
  LOAN: [
    { label: "Préstamo bancario (18%)", value: 18 },
    { label: "Préstamo personal (24%)", value: 24 },
  ],
  INSTALLMENT: [
    { label: "Préstamo bancario (18%)", value: 18 },
    { label: "Préstamo personal (24%)", value: 24 },
  ],
  INFORMAL: [{ label: "Prestamista informal (~60%)", value: 60 }],
};

/**
 * True when the debt type normally charges interest but the APR is 0 or
 * empty — the plan would look unrealistically interest-free.
 */
export function shouldWarnZeroApr(type: string, apr: number | undefined) {
  return (type === "CREDIT_CARD" || type === "LOAN") && (!apr || apr <= 0);
}

interface AprPresetHelperProps {
  debtType: string;
  onSelect: (value: number) => void;
}

/**
 * "No sé mi tasa" affordance: a small link that reveals typical APR
 * presets for the selected debt type. Selecting one fills the APR field
 * (still editable afterwards).
 */
export function AprPresetHelper({ debtType, onSelect }: AprPresetHelperProps) {
  const [open, setOpen] = useState(false);
  const presets = APR_PRESETS[debtType] ?? [];

  if (presets.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <HelpCircle className="size-3.5" />
        No sé mi tasa
      </button>
      {open && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal py-1.5 text-xs"
              onClick={() => {
                onSelect(preset.value);
                setOpen(false);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Non-blocking inline warning shown when a CREDIT_CARD or LOAN debt is
 * about to be saved with 0% APR. The user can still submit.
 */
export function ZeroAprWarning({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p>
        Con 0% de interés tu plan puede verse mejor de lo real. ¿Seguro que
        esta deuda no cobra interés?
      </p>
    </div>
  );
}
