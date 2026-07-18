"use client";

import Link from "next/link";
import {
  CreditCard,
  ArrowUpDown,
  Trash2,
  Edit,
  Eye,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useTransition } from "react";
import type { Debt } from "@/types";
import { DEBT_CATEGORY_OPTIONS } from "@/lib/constants/debts";

interface DebtsTableProps {
  debts: Debt[];
  sortBy: "balance" | "apr" | "due_date";
  onSortChange: (column: "balance" | "apr" | "due_date") => void;
  formatCurrency: (amount: number, currency?: string) => string;
  onDeleteDebt: (id: string) => Promise<void>;
  onCreateClick?: () => void; // Optional trigger for create dialog if empty
  hasFilters: boolean; // To show different empty state message
}

const debtTypeLabels: Record<string, string> = {
  CREDIT_CARD: "Tarjeta de Crédito",
  LOAN: "Préstamo",
  INSTALLMENT: "Cuotas",
  INFORMAL: "Deuda Informal",
};

const debtCategoryLabels = DEBT_CATEGORY_OPTIONS.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {}
);

export function DebtsTable({
  debts,
  sortBy,
  onSortChange,
  formatCurrency,
  onDeleteDebt,
  onCreateClick,
  hasFilters,
}: DebtsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!deleteId) return;
    startTransition(async () => {
      await onDeleteDebt(deleteId);
      setDeleteId(null);
    });
  };

  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-2 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <CreditCard className="size-6" />
      </div>
      <p className="font-medium text-foreground">No se encontraron deudas</p>
      <p className="text-sm text-muted-foreground">
        {hasFilters
          ? "Intentá ajustar los filtros de búsqueda"
          : "Agregá tu primera deuda para comenzar"}
      </p>
      {!hasFilters && onCreateClick && (
        <div className="mt-2">
          <Button onClick={onCreateClick}>
            <Plus className="mr-2 size-4" />
            Agregar Deuda
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {debts.length === 0 ? (
          <Card>
            <CardContent className="py-12">{emptyState}</CardContent>
          </Card>
        ) : (
          debts.map((debt) => (
            <Card key={debt.id}>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <CreditCard className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{debt.creditor}</p>
                      <p className="text-xs text-muted-foreground">
                        {debtTypeLabels[debt.type]}
                        {" · "}
                        {debt.category
                          ? debtCategoryLabels[debt.category] || debt.category
                          : "General"}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold">
                      {formatCurrency(Number(debt.balance), debt.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">Saldo</p>
                  </div>
                </div>

                {debt.tags && debt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {debt.tags.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {debt.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{debt.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="space-y-1">
                    <dt className="text-xs text-muted-foreground">APR</dt>
                    <dd>
                      <Badge
                        variant={
                          Number(debt.apr) >= 40
                            ? "risk-high"
                            : Number(debt.apr) >= 20
                            ? "risk-medium"
                            : "risk-low"
                        }
                      >
                        {debt.apr}%
                      </Badge>
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs text-muted-foreground">Pago Mín.</dt>
                    <dd className="font-medium">
                      {formatCurrency(Number(debt.min_payment), debt.currency)}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs text-muted-foreground">Día Pago</dt>
                    <dd className="font-medium">Día {debt.due_date}</dd>
                  </div>
                </dl>

                <div className="flex items-center gap-2">
                  <Button variant="outline" className="h-11 flex-1" asChild>
                    <Link href={`/debts/${debt.id}`}>
                      <Eye className="mr-2 size-4" />
                      Ver
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-11 flex-1" asChild>
                    <Link href={`/debts/${debt.id}/edit`}>
                      <Edit className="mr-2 size-4" />
                      Editar
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(debt.id)}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Eliminar</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Acreedor</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>
              <button
                onClick={() => onSortChange("balance")}
                className={`flex items-center gap-1 hover:text-foreground ${sortBy === "balance" ? "text-foreground" : ""}`}
              >
                Saldo
                <ArrowUpDown className="size-3" />
              </button>
            </TableHead>
            <TableHead>Pago Mín.</TableHead>
            <TableHead>
              <button
                onClick={() => onSortChange("apr")}
                className={`flex items-center gap-1 hover:text-foreground ${sortBy === "apr" ? "text-foreground" : ""}`}
              >
                APR
                <ArrowUpDown className="size-3" />
              </button>
            </TableHead>
            <TableHead>
              <button
                onClick={() => onSortChange("due_date")}
                className={`flex items-center gap-1 hover:text-foreground ${sortBy === "due_date" ? "text-foreground" : ""}`}
              >
                Día Pago
                <ArrowUpDown className="size-3" />
              </button>
            </TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {debts.length === 0 ? (
              <TableEmpty
                icon={<CreditCard className="size-6" />}
                title="No se encontraron deudas"
                description={
                  hasFilters
                    ? "Intentá ajustar los filtros de búsqueda"
                    : "Agregá tu primera deuda para comenzar"
                }
                action={
                  !hasFilters && onCreateClick ? (
                    <Button onClick={onCreateClick}>
                      <Plus className="mr-2 size-4" />
                      Agregar Deuda
                    </Button>
                  ) : undefined
                }
              />
            ) : (
            debts.map((debt) => (
              <TableRow key={debt.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                      <CreditCard className="size-5 text-primary" />
                    </div>
                    <span className="font-medium">{debt.creditor}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge variant="outline">{debtTypeLabels[debt.type]}</Badge>
                    <p className="text-xs text-muted-foreground">
                      {debt.category ? debtCategoryLabels[debt.category] || debt.category : "General"}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {debt.tags && debt.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-32">
                      {debt.tags.slice(0, 2).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {debt.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{debt.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="font-semibold">
                  {formatCurrency(Number(debt.balance), debt.currency)}
                </TableCell>
                <TableCell>
                  {formatCurrency(Number(debt.min_payment), debt.currency)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      Number(debt.apr) >= 40
                        ? "risk-high"
                        : Number(debt.apr) >= 20
                        ? "risk-medium"
                        : "risk-low"
                    }
                  >
                    {debt.apr}%
                  </Badge>
                </TableCell>
                <TableCell>Día {debt.due_date}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" asChild>
                      <Link href={`/debts/${debt.id}`}>
                        <Eye className="size-4" />
                        <span className="sr-only">Ver detalles</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon-sm" asChild>
                      <Link href={`/debts/${debt.id}/edit`}>
                        <Edit className="size-4" />
                        <span className="sr-only">Editar</span>
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(debt.id)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Eliminar</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta deuda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La deuda será eliminada
              permanentemente de tu cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
