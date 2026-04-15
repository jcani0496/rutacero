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

  return (
    <>
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
                    ? "Intenta ajustar los filtros de búsqueda"
                    : "Agrega tu primera deuda para comenzar"
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
