"use client";

import { useState, useMemo, useOptimistic } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { UpgradeLimitModal } from "@/components/features/upgrade-limit-modal";
import { createDebt, deleteDebt, type CreateDebtInput } from "@/lib/actions/debts";
import { exportDebtsCSV } from "@/lib/actions/export";
import { DEFAULT_PRO_VARIANT_CODE, getProVariant } from "@/lib/billing/plans";
import type { Debt } from "@/types";
import { DebtsToolbar } from "./components/debts-toolbar";
import { CreateDebtDialog } from "./components/create-debt-dialog";
import { DebtsTable } from "./components/debts-table";

const FREE_MAX_DEBTS = 5;

interface DebtsClientProps {
    initialDebts: Debt[];
    userCurrency: string;
    isPro?: boolean;
}

const formatCurrency = (amount: number, currency = "GTQ") => {
    return new Intl.NumberFormat("es-GT", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
    }).format(amount);
};

export function DebtsClient({ initialDebts, userCurrency, isPro = false }: DebtsClientProps) {
    const router = useRouter();
    // 1. Optimistic State
    const [debts, setOptimisticDebts] = useOptimistic(
        initialDebts,
        (state, action: { type: 'add' | 'delete'; payload: Debt | string }) => {
            if (action.type === 'add') {
                return [action.payload as Debt, ...state];
            } else if (action.type === 'delete') {
                return state.filter(d => d.id !== action.payload);
            }
            return state;
        }
    );

    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<string>("all");
    const [filterTag, setFilterTag] = useState<string>("all");
    const [sortBy, setSortBy] = useState<"balance" | "apr" | "due_date">("balance");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [debtLimitInfo, setDebtLimitInfo] = useState<{ current: number; max: number } | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Get unique tags from all debts
    const uniqueTags = useMemo(() => {
        const tags = new Set<string>();
        debts.forEach(debt => {
            if (debt.tags && Array.isArray(debt.tags)) {
                debt.tags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    }, [debts]);

    // Filter and sort debts
    const filteredDebts = debts
        .filter((debt) => {
            const matchesSearch = debt.creditor
                .toLowerCase()
                .includes(searchQuery.toLowerCase());
            const matchesType = filterType === "all" || debt.type === filterType;
            const matchesTag = filterTag === "all" || (debt.tags && debt.tags.includes(filterTag));
            return matchesSearch && matchesType && matchesTag;
        })
        .sort((a, b) => {
            const aValue = Number(a[sortBy]) || 0;
            const bValue = Number(b[sortBy]) || 0;
            const multiplier = sortOrder === "desc" ? -1 : 1;
            return (aValue - bValue) * multiplier;
        });

    const totalBalance = filteredDebts.reduce((sum, d) => sum + Number(d.balance), 0);
    const totalMinPayment = filteredDebts.reduce((sum, d) => sum + Number(d.min_payment), 0);
    const averageApr = filteredDebts.length > 0 
        ? (filteredDebts.reduce((sum, d) => sum + Number(d.apr), 0) / filteredDebts.length)
        : 0;
    const activeDebtCount = debts.filter((d) => d.status === "ACTIVE").length;
    /** Soft-cap: cannot add debt #6 (at 5). Nudge: at debt #5, before trying #6. */
    const softCapHit = !isPro && activeDebtCount >= FREE_MAX_DEBTS;
    const debtFiveNudge = !isPro && activeDebtCount === FREE_MAX_DEBTS;
    const annualPro = getProVariant(DEFAULT_PRO_VARIANT_CODE);

    const toggleSort = (column: typeof sortBy) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortBy(column);
            setSortOrder("desc");
        }
    };

    const handleCreateDebt = async (data: CreateDebtInput & { tags: string[] }) => {
        // Optimistic update
        const tempId = crypto.randomUUID();
        const optimisticDebt: Debt = {
            id: tempId,
            user_id: 'temp', // Not used in UI
            type: data.type,
            creditor: data.creditor,
            currency: data.currency || 'GTQ',
            balance: Number(data.balance),
            min_payment: Number(data.min_payment),
            apr: Number(data.apr ?? 0),
            due_date: Number(data.due_date),
            statement_date: data.cut_date || null,
            next_payment_date: new Date().toISOString(),
            category: data.category || null,
            installment_count: null,
            installments_left: null,
            fixed_payment: null,
            status: 'ACTIVE',
            notes: data.notes || null,
            tags: data.tags,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        setOptimisticDebts({ type: 'add', payload: optimisticDebt });

        try {
            const newDebt = await createDebt(data);
            return newDebt; // Return real debt to update parent (although useOptimistic handles display)
        } catch (error) {
            // Revert is handled by Next.js automatically when server action throws? 
            // Actually useOptimistic resets on revalidation. 
            // But if we want to manually handle errors, we might need more complex logic.
            // For now, let's rely on server action error bubbling up to component state if needed.
            throw error;
        }
    };

    const handleExportCSV = async () => {
        if (!isPro) {
            setShowUpgradeModal(true);
            return;
        }

        setIsExporting(true);
        try {
            const result = await exportDebtsCSV();
            if (result.success && result.data) {
                const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `deudas_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                URL.revokeObjectURL(link.href);
            } else if (result.requiresUpgrade) {
                setShowUpgradeModal(true);
            } else {
                console.error('Export error:', result.error);
                toast.error('No pudimos exportar tus deudas. Intentá de nuevo.');
            }
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('No pudimos exportar tus deudas. Revisá tu conexión e intentá de nuevo.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteDebt = async (id: string) => {
        setOptimisticDebts({ type: 'delete', payload: id });
        try {
            await deleteDebt(id);
        } catch (error) {
            console.error('Error deleting debt:', error);
            toast.error('No pudimos eliminar la deuda. Revisá tu conexión e intentá de nuevo.');
            // Roll back the optimistic removal by re-syncing with the server.
            router.refresh();
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Mis Deudas
                    </h1>
                    <p className="text-muted-foreground">
                        Administra y da seguimiento a todas tus deudas
                    </p>
                </div>
                <div className="flex gap-2">
                   {/* Export button hidden on mobile in Toolbar, shown here if needed or kept consistent */}
                   {/* We will let Toolbar handle export button visibility or keep it here if Toolbar is just filters */}
                   {/* Actually let's keep the Create Button here as part of Header Actions if we want consistent layout */}
                   
                   <CreateDebtDialog 
                        userCurrency={userCurrency}
                        isPro={isPro}
                        onDebtCreated={() => {}} // State updated via useOptimistic, server revalidates automatically
                        createAction={handleCreateDebt}
                        onUpgradeRequired={(info) => {
                            setDebtLimitInfo(info);
                            setShowUpgradeModal(true);
                        }}
                   />
                </div>
            </div>

            {debtFiveNudge && (
                <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                            Llegaste a la deuda #{FREE_MAX_DEBTS} — último cupo Free
                        </p>
                        <p className="text-sm text-muted-foreground">
                            La #{FREE_MAX_DEBTS + 1} pide PRO (Q{annualPro.priceQ}/año).
                            Generá tu plan ahora y mirá tu fecha libre de deudas.
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                            <Link href="/plan">Generar plan</Link>
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setDebtLimitInfo({ current: activeDebtCount, max: FREE_MAX_DEBTS });
                                setShowUpgradeModal(true);
                            }}
                        >
                            Activar PRO · Q{annualPro.priceQ}
                        </Button>
                    </div>
                </div>
            )}
            {softCapHit && !debtFiveNudge && (
                <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                            Llegaste al límite de {FREE_MAX_DEBTS} deudas en Free
                        </p>
                        <p className="text-sm text-muted-foreground">
                            La deuda #{FREE_MAX_DEBTS + 1} y las siguientes requieren PRO
                            (Q{annualPro.priceQ}/año).
                        </p>
                    </div>
                    <Button
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                            setDebtLimitInfo({ current: activeDebtCount, max: FREE_MAX_DEBTS });
                            setShowUpgradeModal(true);
                        }}
                    >
                        Activar PRO · Q{annualPro.priceQ}
                    </Button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground">
                            Deuda Total
                        </div>
                        <div className="mt-1 text-2xl font-bold">
                            {formatCurrency(totalBalance, userCurrency)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            {filteredDebts.length} deuda{filteredDebts.length !== 1 ? "s" : ""} activa{filteredDebts.length !== 1 ? "s" : ""}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground">
                            Pago Mínimo Total
                        </div>
                        <div className="mt-1 text-2xl font-bold">
                            {formatCurrency(totalMinPayment, userCurrency)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            Suma de todos los mínimos
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground">
                            APR Promedio
                        </div>
                        <div className="mt-1 text-2xl font-bold">
                            {averageApr.toFixed(1)}%
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            Tasa de interés promedio
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters and Search */}
            <DebtsToolbar 
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterType={filterType}
                onFilterTypeChange={setFilterType}
                filterTag={filterTag}
                onFilterTagChange={setFilterTag}
                uniqueTags={uniqueTags}
                onExport={handleExportCSV}
                isExporting={isExporting}
                hasDebts={debts.length > 0}
            />

            {/* Debts Table */}
            <Card>
                <DebtsTable 
                    debts={filteredDebts}
                    sortBy={sortBy}
                    onSortChange={toggleSort}
                    formatCurrency={formatCurrency}
                    onDeleteDebt={handleDeleteDebt}
                    hasFilters={searchQuery !== "" || filterType !== "all" || filterTag !== "all"}
                />
            </Card>

            {/* Upgrade Modal */}
            <UpgradeLimitModal
                open={showUpgradeModal}
                onClose={() => {
                    setShowUpgradeModal(false);
                    setDebtLimitInfo(null);
                }}
                featureType={debtLimitInfo ? 'debt' : 'export'}
                currentCount={debtLimitInfo?.current}
                maxAllowed={debtLimitInfo?.max}
            />
        </div>
    );
}
