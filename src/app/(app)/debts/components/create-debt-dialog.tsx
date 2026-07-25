"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "@/components/ui/toast";
import { TagInput } from "@/components/features/tag-input";
import { Badge } from "@/components/ui/badge";
import { DEBT_CATEGORY_OPTIONS } from "@/lib/constants/debts";
import {
  AprPresetHelper,
  ZeroAprWarning,
  shouldWarnZeroApr,
} from "./apr-field-help";
import type { CreateDebtInput } from "@/lib/actions/debts";
import type { Debt } from "@/types";
import { cn } from "@/lib/utils";

interface CreateDebtDialogProps {
  userCurrency: string;
  isPro?: boolean;
  onDebtCreated: (debt: Debt) => void;
  createAction: (data: CreateDebtInput & { tags: string[] }) => Promise<Debt>;
  onUpgradeRequired: (info: { current: number; max: number }) => void;
}

function emptyForm(userCurrency: string): CreateDebtInput {
  return {
    creditor: "",
    type: "CREDIT_CARD",
    balance: 0,
    min_payment: 0,
    apr: 0,
    due_date: 0,
    payment_day: undefined,
    interest_model: "DAILY_SIMPLE",
    monthly_fees: 0,
    currency: userCurrency as "GTQ" | "USD",
    category: "OTHER",
    goal_extra_payment: undefined,
    goal_target_date: undefined,
  };
}

export function CreateDebtDialog({
  userCurrency,
  isPro,
  onDebtCreated,
  createAction,
  onUpgradeRequired,
}: CreateDebtDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<CreateDebtInput>(() =>
    emptyForm(userCurrency)
  );
  const [formTags, setFormTags] = useState<string[]>([]);
  const [aprWarningShown, setAprWarningShown] = useState(false);

  // Activation: onboarding / first-run link with ?new=1 opens the dialog.
  // Defer setState so we don't sync-update inside the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      router.replace("/debts", { scroll: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  const resetForm = () => {
    setFormData(emptyForm(userCurrency));
    setFormTags([]);
    setAprWarningShown(false);
    setAdvancedOpen(false);
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    // Non-blocking zero-APR warning: pause the first submit to show it;
    // a second submit goes through.
    if (shouldWarnZeroApr(formData.type, formData.apr) && !aprWarningShown) {
      setAprWarningShown(true);
      return;
    }
    startTransition(async () => {
      try {
        const newDebt = await createAction({ ...formData, tags: formTags });
        onDebtCreated(newDebt);
        setOpen(false);
        resetForm();
        toast.success("Deuda guardada", {
          description: "Siguiente paso: generá tu plan de pagos.",
          action: {
            label: "Generar plan",
            onClick: () => router.push("/plan"),
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage.startsWith("DEBT_LIMIT:")) {
          const [, current, max] = errorMessage.split(":");
          onUpgradeRequired({ current: Number(current), max: Number(max) });
          setOpen(false);
        } else {
          console.error("Error creating debt:", error);
          toast.error(
            "No pudimos guardar la deuda. Revisá tu conexión e intentá de nuevo."
          );
        }
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setAprWarningShown(false);
          setAdvancedOpen(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Nueva Deuda
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Nueva Deuda</DialogTitle>
          <DialogDescription>
            Solo lo esencial para empezar. Lo avanzado queda opcional abajo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateDebt} className="grid gap-4 py-4">
          <Input
            id="debt-creditor"
            label="Acreedor / Institución"
            placeholder="Ej: BAC Credomatic"
            value={formData.creditor}
            onChange={(e) =>
              setFormData({ ...formData, creditor: e.target.value })
            }
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="debt-type">Tipo de Deuda</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    type: value as CreateDebtInput["type"],
                    interest_model:
                      value === "CREDIT_CARD" ? "DAILY_SIMPLE" : "MONTHLY_SIMPLE",
                  })
                }
              >
                <SelectTrigger id="debt-type">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT_CARD">Tarjeta de Crédito</SelectItem>
                  <SelectItem value="LOAN">Préstamo</SelectItem>
                  <SelectItem value="INSTALLMENT">Cuotas</SelectItem>
                  <SelectItem value="INFORMAL">Deuda Informal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-currency">Moneda</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) =>
                  setFormData({ ...formData, currency: value as "GTQ" | "USD" })
                }
              >
                <SelectTrigger id="debt-currency">
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GTQ">Quetzales (GTQ)</SelectItem>
                  <SelectItem value="USD">Dólares (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencyInput
              id="debt-balance"
              label="Saldo Actual"
              placeholder="0.00"
              currency={(formData.currency || userCurrency) as "GTQ" | "USD"}
              value={formData.balance}
              onChange={(value) =>
                setFormData({ ...formData, balance: value || 0 })
              }
            />
            <CurrencyInput
              id="debt-min-payment"
              label="Pago Mínimo"
              placeholder="0.00"
              currency={(formData.currency || userCurrency) as "GTQ" | "USD"}
              value={formData.min_payment}
              onChange={(value) =>
                setFormData({ ...formData, min_payment: value || 0 })
              }
            />
          </div>
          <div className="space-y-2">
            <Input
              id="debt-apr"
              label="Tasa de Interés Anual (APR)"
              type="number"
              placeholder="0"
              hint="Dejalo en 0 si no aplica"
              value={formData.apr || ""}
              onChange={(e) =>
                setFormData({ ...formData, apr: Number(e.target.value) || 0 })
              }
            />
            <AprPresetHelper
              debtType={formData.type}
              onSelect={(value) => setFormData({ ...formData, apr: value })}
            />
            <ZeroAprWarning
              show={
                aprWarningShown &&
                shouldWarnZeroApr(formData.type, formData.apr)
              }
            />
          </div>
          <Input
            id="debt-due-date"
            label="Día de Pago"
            type="number"
            placeholder="Ej: 15"
            min={1}
            max={31}
            value={formData.due_date || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                due_date: Number(e.target.value) || 0,
                payment_day:
                  formData.payment_day ?? (Number(e.target.value) || 0),
              })
            }
            required
          />

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Opciones avanzadas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Categoría, corte, modelo de interés, metas y etiquetas
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    advancedOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="debt-category">Detalle de Deuda</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger id="debt-category">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEBT_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="debt-cut-date"
                  label="Día de Corte (opcional)"
                  type="number"
                  placeholder="Ej: 1"
                  min={1}
                  max={31}
                  value={formData.cut_date || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cut_date: Number(e.target.value) || undefined,
                    })
                  }
                />
                <Input
                  id="debt-payment-day"
                  label="Día típico de pago (opcional)"
                  type="number"
                  placeholder="Ej: 15"
                  min={1}
                  max={31}
                  value={formData.payment_day || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payment_day: Number(e.target.value) || undefined,
                    })
                  }
                  hint="Si pagás antes o después del vencimiento, esto afecta el interés."
                />
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Precisión del cálculo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Mejora fechas e intereses si tenés el dato.
                    </p>
                  </div>
                  <Badge variant="secondary">Opcional</Badge>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="debt-interest-model">Modelo de interés</Label>
                    <Select
                      value={formData.interest_model || "MONTHLY_SIMPLE"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          interest_model:
                            value as CreateDebtInput["interest_model"],
                        })
                      }
                    >
                      <SelectTrigger id="debt-interest-model">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY_SIMPLE">
                          Diario (tarjetas, más realista)
                        </SelectItem>
                        <SelectItem value="DAILY_AVG_BALANCE">
                          Diario (saldo promedio)
                        </SelectItem>
                        <SelectItem value="MONTHLY_SIMPLE">
                          Mensual simple (aproximado)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Para tarjetas, usá Diario. Para préstamos simples, Mensual.
                    </p>
                  </div>
                  <CurrencyInput
                    id="debt-monthly-fees"
                    label="Fees mensuales (opcional)"
                    placeholder="0.00"
                    currency={
                      (formData.currency || userCurrency) as "GTQ" | "USD"
                    }
                    value={formData.monthly_fees}
                    onChange={(value) =>
                      setFormData({ ...formData, monthly_fees: value || 0 })
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Metas de deuda
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Definí un pago extra mensual o una fecha objetivo.
                    </p>
                  </div>
                  <Badge variant="secondary">PRO</Badge>
                </div>
                {isPro ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <CurrencyInput
                      id="debt-goal-extra-payment"
                      label="Pago extra mensual"
                      placeholder="0.00"
                      currency={
                        (formData.currency || userCurrency) as "GTQ" | "USD"
                      }
                      value={formData.goal_extra_payment}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          goal_extra_payment: value,
                        })
                      }
                      hint="Opcional"
                    />
                    <Input
                      id="debt-goal-target-date"
                      label="Fecha objetivo"
                      type="date"
                      value={formData.goal_target_date || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          goal_target_date: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Disponible para usuarios PRO.
                    </p>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/pricing">Ver Planes PRO</Link>
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Etiquetas</Label>
                <TagInput
                  tags={formTags}
                  onChange={setFormTags}
                  isPro={isPro}
                  onProRequired={() => {
                    setOpen(false);
                    onUpgradeRequired({ current: 0, max: 0 });
                  }}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Agregar Deuda"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
