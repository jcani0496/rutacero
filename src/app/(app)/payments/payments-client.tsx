'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
    Plus,
    Trash2,
    Calendar,
    CreditCard,
    TrendingUp,
    DollarSign,
    Clock,
    Banknote,
    Download,
    Loader2,
    Crown,
    History,
    Map,
    Sparkles,
    Flag,
    Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UpgradeLimitModal } from '@/components/features/upgrade-limit-modal';
import { toast } from '@/components/ui/toast';
import {
    createPayment,
    deletePayment,
    type PaymentWithDebt,
} from '@/lib/actions/payments';
import { exportPaymentsCSV } from '@/lib/actions/export';
import type { Debt } from '@/types';
import { ReceiptCell } from './receipt-cell';

interface PaymentStats {
    totalThisMonth: number;
    totalYTD: number;
    lastPaymentDate: string | null;
    lastPaymentAmount: number;
    paymentCount: number;
}

interface PaymentsClientProps {
    initialPayments: PaymentWithDebt[];
    stats: PaymentStats;
    debts: Pick<Debt, 'id' | 'creditor' | 'balance' | 'currency' | 'type' | 'min_payment'>[];
    userCurrency: string;
    isPro?: boolean;
    hiddenPaymentsCount?: number;
}

const PAYMENT_METHODS = [
    { value: 'TRANSFER', label: 'Transferencia' },
    { value: 'CASH', label: 'Efectivo' },
    { value: 'CARD', label: 'Tarjeta' },
    { value: 'CHECK', label: 'Cheque' },
    { value: 'OTHER', label: 'Otro' },
];

const CELEBRATION_PARTICLES = [
    { key: 'p1', left: '10%', top: '18%', size: 'h-2 w-2', color: 'bg-emerald-300', shadow: 'shadow-[0_0_12px_rgba(52,211,153,0.6)]', animation: 'animate-float-slow', delay: '0ms' },
    { key: 'p2', left: '24%', top: '72%', size: 'h-2.5 w-2.5', color: 'bg-sky-300', shadow: 'shadow-[0_0_14px_rgba(125,211,252,0.5)]', animation: 'animate-float-medium', delay: '200ms' },
    { key: 'p3', left: '42%', top: '30%', size: 'h-1.5 w-1.5', color: 'bg-amber-300', shadow: 'shadow-[0_0_10px_rgba(252,211,77,0.5)]', animation: 'animate-float-fast', delay: '400ms' },
    { key: 'p4', left: '58%', top: '20%', size: 'h-2 w-2', color: 'bg-emerald-200', shadow: 'shadow-[0_0_12px_rgba(167,243,208,0.5)]', animation: 'animate-float-medium', delay: '100ms' },
    { key: 'p5', left: '70%', top: '66%', size: 'h-2.5 w-2.5', color: 'bg-sky-200', shadow: 'shadow-[0_0_14px_rgba(186,230,253,0.5)]', animation: 'animate-float-slow', delay: '300ms' },
    { key: 'p6', left: '84%', top: '32%', size: 'h-1.5 w-1.5', color: 'bg-amber-200', shadow: 'shadow-[0_0_10px_rgba(253,230,138,0.5)]', animation: 'animate-float-fast', delay: '250ms' },
    { key: 'p7', left: '18%', top: '48%', size: 'h-3 w-3', color: 'bg-emerald-300', shadow: 'shadow-[0_0_18px_rgba(52,211,153,0.5)]', animation: 'animate-spark', delay: '150ms' },
    { key: 'p8', left: '76%', top: '42%', size: 'h-3.5 w-3.5', color: 'bg-emerald-300', shadow: 'shadow-[0_0_20px_rgba(52,211,153,0.45)]', animation: 'animate-spark', delay: '350ms' },
    { key: 'p9', left: '8%', top: '36%', size: 'h-4 w-4', color: 'bg-sky-300/90', shadow: 'shadow-[0_0_22px_rgba(125,211,252,0.6)]', animation: 'animate-float-medium', delay: '180ms' },
    { key: 'p10', left: '88%', top: '18%', size: 'h-4 w-4', color: 'bg-emerald-200/90', shadow: 'shadow-[0_0_22px_rgba(167,243,208,0.6)]', animation: 'animate-float-slow', delay: '420ms' },
];

const CELEBRATION_CONFETTI = [
    { key: 'c1', left: '12%', color: 'bg-emerald-300', size: 'h-3 w-1.5', delay: '0ms', duration: '2200ms' },
    { key: 'c2', left: '22%', color: 'bg-sky-300', size: 'h-2.5 w-1.5', delay: '300ms', duration: '2600ms' },
    { key: 'c3', left: '34%', color: 'bg-amber-300', size: 'h-3.5 w-1.5', delay: '600ms', duration: '2400ms' },
    { key: 'c4', left: '48%', color: 'bg-emerald-200', size: 'h-3 w-1', delay: '200ms', duration: '2800ms' },
    { key: 'c5', left: '56%', color: 'bg-sky-200', size: 'h-2.5 w-1', delay: '500ms', duration: '2500ms' },
    { key: 'c6', left: '66%', color: 'bg-amber-200', size: 'h-3 w-1.5', delay: '120ms', duration: '2300ms' },
    { key: 'c7', left: '74%', color: 'bg-emerald-300', size: 'h-3.5 w-1.5', delay: '420ms', duration: '2700ms' },
    { key: 'c8', left: '82%', color: 'bg-sky-300', size: 'h-3 w-1', delay: '720ms', duration: '2400ms' },
    { key: 'c9', left: '90%', color: 'bg-amber-300', size: 'h-2.5 w-1.5', delay: '900ms', duration: '2600ms' },
    { key: 'c10', left: '16%', color: 'bg-emerald-200', size: 'h-2.5 w-1', delay: '840ms', duration: '2800ms' },
    { key: 'c11', left: '40%', color: 'bg-sky-200', size: 'h-3 w-1.5', delay: '360ms', duration: '2300ms' },
    { key: 'c12', left: '60%', color: 'bg-amber-200', size: 'h-3.5 w-1.5', delay: '180ms', duration: '2500ms' },
];

export function PaymentsClient({
    initialPayments,
    stats,
    debts,
    userCurrency,
    isPro = false,
    hiddenPaymentsCount = 0
}: PaymentsClientProps) {
    const [payments, setPayments] = useState<PaymentWithDebt[]>(initialPayments);
    const [isPending, startTransition] = useTransition();
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [routePulseKey, setRoutePulseKey] = useState(0);
    const [celebration, setCelebration] = useState<{
        type: 'standard' | 'extra';
        amount: number;
        creditor?: string;
        isCurrentMonth: boolean;
    } | null>(null);
    const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
    const routePathRef = useRef<SVGPathElement | null>(null);
    const [routeLength, setRouteLength] = useState<number | null>(null);
    const [routePoints, setRoutePoints] = useState<{
        progress: { x: number; y: number } | null;
        checkpoints: Array<{ label: string; at: number; x: number; y: number }>;
    }>({
        progress: null,
        checkpoints: [],
    });

    // Form state
    const [form, setForm] = useState({
        debt_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        method: 'TRANSFER',
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: userCurrency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-GT', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Calculate live totals
    const liveTotalThisMonth = (() => {
        const now = new Date();
        return payments
            .filter(p => {
                const d = new Date(p.payment_date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            })
            .reduce((sum, p) => sum + Number(p.amount), 0);
    })();

    const totalMinPayment = debts.reduce((sum, debt) => sum + Number(debt.min_payment || 0), 0);
    const totalDebt = debts.reduce((sum, debt) => sum + Number(debt.balance || 0), 0);
    const monthlyTarget = totalMinPayment > 0 ? totalMinPayment : Math.max(totalDebt * 0.05, 500);
    const monthlyProgress = monthlyTarget > 0 ? Math.min((liveTotalThisMonth / monthlyTarget) * 100, 100) : 0;
    const remainingToTarget = Math.max(monthlyTarget - liveTotalThisMonth, 0);
    const normalizedProgress = Math.min(Math.max(monthlyProgress / 100, 0), 1);
    const progressLength = routeLength ? routeLength * normalizedProgress : 0;
    const today = new Date();
    const isLateInMonth = today.getDate() >= 22;
    const routeMood = monthlyProgress >= 80 ? 'positive' : monthlyProgress < 40 && isLateInMonth ? 'warning' : 'steady';

    const isCurrentMonthPayment = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    };

    useEffect(() => {
        setPortalRoot(document.body);
        return () => {
            if (celebrationTimerRef.current) {
                clearTimeout(celebrationTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!routePathRef.current) return;
        const length = routePathRef.current.getTotalLength();
        setRouteLength(length);

        const progressPoint = routePathRef.current.getPointAtLength(length * normalizedProgress);
        const checkpointDefs = [
            { label: 'Inicio', at: 0.08 },
            { label: 'Hito', at: 0.5 },
            { label: 'RutaCero', at: 0.92 },
        ];
        const checkpoints = checkpointDefs.map((checkpoint) => {
            const point = routePathRef.current?.getPointAtLength(length * checkpoint.at);
            return {
                ...checkpoint,
                x: point?.x ?? 0,
                y: point?.y ?? 0,
            };
        });

        setRoutePoints({
            progress: { x: progressPoint.x, y: progressPoint.y },
            checkpoints,
        });
    }, [normalizedProgress, routePulseKey]);

    const handleAddPayment = () => {
        if (!form.debt_id || !form.amount || parseFloat(form.amount) <= 0) return;

        startTransition(async () => {
            try {
                const paymentAmount = parseFloat(form.amount);
                const newPayment = await createPayment({
                    debt_id: form.debt_id,
                    amount: paymentAmount,
                    payment_date: form.payment_date,
                    method: form.method,
                    currency: userCurrency as 'GTQ' | 'USD',
                });

                // Add to list with debt info
                const selectedDebt = debts.find(d => d.id === form.debt_id);
                const paymentWithDebt: PaymentWithDebt = {
                    ...newPayment,
                    debt: selectedDebt ? {
                        creditor: selectedDebt.creditor,
                        type: selectedDebt.type,
                    } : undefined,
                };

                setPayments(prev => [paymentWithDebt, ...prev]);

                const countsThisMonth = isCurrentMonthPayment(form.payment_date);
                const nextTotalThisMonth = countsThisMonth ? liveTotalThisMonth + paymentAmount : liveTotalThisMonth;
                const nextProgress = monthlyTarget > 0
                    ? Math.min((nextTotalThisMonth / monthlyTarget) * 100, 100)
                    : 0;
                const minPayment = Number(selectedDebt?.min_payment || 0);
                const extraAmount = minPayment > 0 ? Math.max(paymentAmount - minPayment, 0) : 0;
                const celebrationType = extraAmount > 0 ? 'extra' : 'standard';

                toast.success('Pago registrado', {
                    description: `${formatCurrency(paymentAmount)} a ${selectedDebt?.creditor || 'tu deuda'} · Ruta ${Math.round(nextProgress)}%${extraAmount > 0 ? ` · Pago extra +${formatCurrency(extraAmount)}` : ''}`,
                });

                setCelebration({
                    type: celebrationType,
                    amount: paymentAmount,
                    creditor: selectedDebt?.creditor,
                    isCurrentMonth: countsThisMonth,
                });
                if (celebrationTimerRef.current) {
                    clearTimeout(celebrationTimerRef.current);
                }
                celebrationTimerRef.current = setTimeout(() => {
                    setCelebration(null);
                }, 2400);

                setRoutePulseKey(Date.now());
                setForm({
                    debt_id: '',
                    amount: '',
                    payment_date: new Date().toISOString().split('T')[0],
                    method: 'TRANSFER',
                });
                setIsPaymentOpen(false);
            } catch (error) {
                console.error('Error adding payment:', error);
                toast.error('No pudimos registrar el pago. Revisá tu conexión e intentá de nuevo.');
            }
        });
    };

    const handleDeletePayment = (id: string) => {
        startTransition(async () => {
            try {
                await deletePayment(id);
                setPayments(prev => prev.filter(p => p.id !== id));
            } catch (error) {
                console.error('Error deleting payment:', error);
                toast.error('No pudimos eliminar el pago. Revisá tu conexión e intentá de nuevo.');
            }
        });
    };

    const handleExportCSV = async () => {
        if (!isPro) {
            setShowUpgradeModal(true);
            return;
        }

        setIsExporting(true);
        try {
            const result = await exportPaymentsCSV();
            if (result.success && result.data) {
                const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `pagos_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                URL.revokeObjectURL(link.href);
            } else if (result.requiresUpgrade) {
                setShowUpgradeModal(true);
            } else {
                console.error('Export error:', result.error);
                toast.error('No pudimos exportar tus pagos. Intentá de nuevo.');
            }
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('No pudimos exportar tus pagos. Revisá tu conexión e intentá de nuevo.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            {celebration && portalRoot && createPortal(
                <div
                    className="pointer-events-none fixed inset-0 isolate"
                    style={{ backgroundColor: '#05070f', zIndex: 9999 }}
                >
                    <div className="absolute inset-0 bg-[#05070f]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.28),transparent_55%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.16),transparent_50%)]" />
                    <div className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl animate-pulse" />
                    <div
                        className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/20 opacity-70 animate-spin-slow"
                        style={{ animationDuration: '8s' }}
                    />
                    <div
                        className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/20 opacity-60 animate-spin-slow"
                        style={{ animationDuration: '12s', animationDirection: 'reverse' }}
                    />
                    <div className="absolute inset-0 opacity-100" aria-hidden="true">
                        {CELEBRATION_PARTICLES.map((particle) => (
                            <span
                                key={particle.key}
                                className={`absolute rounded-full ${particle.size} ${particle.color} ${particle.shadow} ${particle.animation}`}
                                style={{ left: particle.left, top: particle.top, animationDelay: particle.delay }}
                            />
                        ))}
                    </div>
                    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
                        {CELEBRATION_CONFETTI.map((piece) => (
                            <span
                                key={piece.key}
                                className={`absolute top-[-12%] rounded-full ${piece.color} ${piece.size} animate-confetti`}
                                style={{
                                    left: piece.left,
                                    animationDelay: piece.delay,
                                    animationDuration: piece.duration,
                                }}
                            />
                        ))}
                    </div>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(5,7,15,0.75)_55%,rgba(5,7,15,0.95)_100%)]" />
                    <div className="absolute left-1/2 top-1/2 w-[min(94%,600px)] -translate-x-1/2 -translate-y-1/2 animate-scale-in">
                        <div
                            className="relative overflow-hidden rounded-[36px] border border-emerald-400/40 bg-[#0b1220] px-10 py-10 text-white shadow-[0_24px_80px_rgba(5,7,15,0.9)]"
                            style={{ backgroundColor: '#0b1220' }}
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,197,94,0.35),transparent_70%)]" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_120%,rgba(56,189,248,0.25),transparent_70%)]" />
                            <div className="relative z-10 flex flex-col items-center gap-5 text-center">
                                <div className="relative flex h-24 w-24 items-center justify-center rounded-[28px] bg-emerald-400/20">
                                    <span className="absolute inset-0 rounded-[28px] bg-emerald-400/25 animate-ping" />
                                    <span className="absolute -inset-4 rounded-[32px] border border-emerald-300/30" />
                                    {celebration.type === 'extra' ? (
                                        <Zap className="h-9 w-9 text-emerald-200" />
                                    ) : (
                                        <Sparkles className="h-9 w-9 text-emerald-100" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">
                                        {celebration.type === 'extra' ? 'Pago extra' : 'Pago en ruta'}
                                    </p>
                                    <p className="mt-3 text-4xl font-semibold">
                                        {formatCurrency(celebration.amount)}
                                    </p>
                                    <p className="text-sm text-emerald-100/80">
                                        {celebration.creditor || 'RutaCero'}
                                    </p>
                                </div>
                                <div className="rounded-full border border-emerald-300/40 bg-emerald-300/15 px-5 py-2 text-xs text-emerald-100/80">
                                    {celebration.isCurrentMonth
                                        ? 'Tu camino avanza este mes.'
                                        : 'Pago registrado. Ajusta tu ruta cuando quieras.'}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-slate-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                                    RutaCero celebrando tu avance
                                </div>
                            </div>
                            <div className="absolute -right-8 -top-16 h-36 w-36 rounded-full bg-emerald-400/20 blur-2xl" />
                            <div className="absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl" />
                            <div className="absolute right-6 top-6 flex gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-300/80 animate-ping" />
                                <span className="h-2 w-2 rounded-full bg-sky-300/80 animate-ping [animation-delay:150ms]" />
                                <span className="h-2 w-2 rounded-full bg-amber-300/80 animate-ping [animation-delay:300ms]" />
                            </div>
                            <div className="absolute -bottom-16 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
                        </div>
                    </div>
                </div>,
                portalRoot
            )}

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Pagos
                    </h1>
                    <p className="text-muted-foreground">
                        Historial de pagos realizados a tus deudas
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleExportCSV}
                        disabled={isExporting || payments.length === 0}
                    >
                        {isExporting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        Exportar CSV
                    </Button>
                    <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" />
                                Registrar Pago
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Registrar Pago</DialogTitle>
                                <DialogDescription>
                                    Registrá un pago realizado a una deuda
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="debt">Deuda</Label>
                                    <Select
                                        value={form.debt_id}
                                        onValueChange={(value) => setForm(prev => ({ ...prev, debt_id: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona una deuda" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {debts.length === 0 ? (
                                                <SelectItem value="none" disabled>
                                                    No hay deudas activas
                                                </SelectItem>
                                            ) : (
                                                debts.map((debt) => (
                                                    <SelectItem key={debt.id} value={debt.id}>
                                                        {debt.creditor} - {formatCurrency(Number(debt.balance))}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="amount">Monto</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="amount"
                                            type="number"
                                            placeholder="0.00"
                                            className="pl-9"
                                            value={form.amount}
                                            onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="date">Fecha de Pago</Label>
                                        <Input
                                            id="date"
                                            type="date"
                                            value={form.payment_date}
                                            onChange={(e) => setForm(prev => ({ ...prev, payment_date: e.target.value }))}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="method">Método</Label>
                                        <Select
                                            value={form.method}
                                            onValueChange={(value) => setForm(prev => ({ ...prev, method: value }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PAYMENT_METHODS.map((method) => (
                                                    <SelectItem key={method.value} value={method.value}>
                                                        {method.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleAddPayment}
                                    disabled={isPending || !form.debt_id || !form.amount}
                                >
                                    {isPending ? 'Registrando...' : 'Registrar Pago'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pagado Este Mes
                        </CardTitle>
                        <Calendar className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">
                            {formatCurrency(liveTotalThisMonth)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {payments.filter(p => {
                                const d = new Date(p.payment_date);
                                const now = new Date();
                                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                            }).length} pago{payments.filter(p => {
                                const d = new Date(p.payment_date);
                                const now = new Date();
                                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                            }).length !== 1 ? 's' : ''}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Año
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-500">
                            {formatCurrency(stats.totalYTD)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.paymentCount} pago{stats.paymentCount !== 1 ? 's' : ''} total
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Último Pago
                        </CardTitle>
                        <Clock className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-500">
                            {stats.lastPaymentDate ? formatCurrency(stats.lastPaymentAmount) : '-'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.lastPaymentDate ? formatDate(stats.lastPaymentDate) : 'Sin pagos'}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Deudas Activas
                        </CardTitle>
                        <CreditCard className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">
                            {debts.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Pendientes de pago
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* RutaCero Path */}
            {debts.length > 0 && (
                <Card className="relative overflow-hidden border-slate-800/60 bg-slate-900/85 text-white shadow-soft">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(16,185,129,0.25),transparent_55%),radial-gradient(circle_at_85%_0%,rgba(56,189,248,0.25),transparent_55%)]" />
                    <CardHeader className="relative z-10">
                        <CardTitle className="flex items-center gap-2 text-white">
                            <Map className="h-5 w-5 text-emerald-400" />
                            RutaCero · Camino del mes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                    {totalMinPayment > 0 ? 'Meta mensual sugerida' : 'Meta mensual estimada'}
                                </p>
                                <p className="text-2xl font-bold text-white">
                                    {formatCurrency(monthlyTarget)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Progreso</p>
                                <p className="text-2xl font-bold text-emerald-400">
                                    {Math.round(monthlyProgress)}%
                                </p>
                            </div>
                        </div>

                        <div className="relative mt-2">
                            <div className="relative h-32 rounded-2xl border border-white/10 bg-white/5 p-3">
                                <svg viewBox="0 0 800 120" className="h-full w-full">
                                    <defs>
                                        <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor={routeMood === 'warning' ? '#f59e0b' : '#34d399'} />
                                            <stop offset="55%" stopColor={routeMood === 'warning' ? '#fbbf24' : '#38bdf8'} />
                                            <stop offset="100%" stopColor={routeMood === 'warning' ? '#f97316' : '#a855f7'} />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d="M24,95 C300,10 520,115 776,30"
                                        pathLength="100"
                                        stroke="rgba(148,163,184,0.4)"
                                        strokeWidth="7"
                                        fill="none"
                                    />
                                    <path
                                        key={`route-progress-${routePulseKey}`}
                                        ref={routePathRef}
                                        d="M24,95 C300,10 520,115 776,30"
                                        stroke="url(#routeGradient)"
                                        strokeWidth="7"
                                        strokeDasharray={`${progressLength} ${routeLength ?? 1}`}
                                        strokeDashoffset={0}
                                        strokeLinecap="round"
                                        fill="none"
                                        className="transition-all duration-700"
                                    />
                                    {routePoints.checkpoints.map((checkpoint) => {
                                        const isActive = monthlyProgress >= checkpoint.at * 100;
                                        return (
                                            <g key={checkpoint.label}>
                                                <circle
                                                    cx={checkpoint.x}
                                                    cy={checkpoint.y}
                                                    r="6"
                                                    fill={isActive ? 'rgba(52,211,153,0.9)' : 'rgba(148,163,184,0.3)'}
                                                    stroke={isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)'}
                                                    strokeWidth="1.5"
                                                />
                                                <text
                                                    x={checkpoint.x}
                                                    y={checkpoint.y + 20}
                                                    textAnchor="middle"
                                                    fill="rgba(148,163,184,0.9)"
                                                    fontSize="9"
                                                    letterSpacing="0.25em"
                                                    dominantBaseline="hanging"
                                                >
                                                    {checkpoint.label.toUpperCase()}
                                                </text>
                                            </g>
                                        );
                                    })}
                                    {routePoints.progress && (
                                        <g key={`route-marker-${routePulseKey}`}>
                                            <circle
                                                cx={routePoints.progress.x}
                                                cy={routePoints.progress.y}
                                                r="12"
                                                fill="rgba(16,185,129,0.18)"
                                                className="animate-ping"
                                                style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
                                            />
                                            <circle
                                                cx={routePoints.progress.x}
                                                cy={routePoints.progress.y}
                                                r="6"
                                                fill="rgba(16,185,129,0.9)"
                                                stroke="rgba(255,255,255,0.8)"
                                                strokeWidth="1.5"
                                            />
                                        </g>
                                    )}
                                </svg>
                                <div className="absolute right-4 top-3 flex items-center gap-2 text-xs text-slate-300">
                                    <Flag className="h-4 w-4 text-amber-300" />
                                    {routeMood === 'warning' ? 'Ritmo bajo' : routeMood === 'positive' ? 'Ruta fuerte' : 'Ritmo estable'}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-xs text-slate-300">
                            <span>{formatCurrency(liveTotalThisMonth)} pagado este mes</span>
                            <span>
                                {remainingToTarget > 0
                                    ? `Faltan ${formatCurrency(remainingToTarget)} para la meta`
                                    : 'Meta mensual alcanzada'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                            <Sparkles className="h-4 w-4 text-amber-300" />
                            <span>
                                {routeMood === 'warning'
                                    ? 'Estás fuera de ritmo. Un pago extra puede enderezar la ruta.'
                                    : 'Cada pago mueve tu ruta. Prueba un pago extra para acelerar.'}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Hidden History Banner */}
            {!isPro && hiddenPaymentsCount > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                            <History className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="font-medium text-foreground">
                                {hiddenPaymentsCount} pagos más en tu historial
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Actualiza a PRO para ver tu historial completo
                            </p>
                        </div>
                    </div>
                    <Button asChild size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                        <Link href="/pricing">
                            <Crown className="mr-2 h-4 w-4" />
                            Ver PRO
                        </Link>
                    </Button>
                </div>
            )}

            {/* Payments Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Historial de Pagos</CardTitle>
                </CardHeader>
                <CardContent>
                    {payments.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No hay pagos registrados</p>
                            <p className="text-sm">Registrá tu primer pago para comenzar</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Deuda</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead>Comprobante</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell>
                                            {formatDate(payment.payment_date)}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {payment.debt?.creditor || 'Deuda eliminada'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {PAYMENT_METHODS.find(m => m.value === payment.method)?.label || payment.method || 'N/A'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-emerald-500">
                                            {formatCurrency(Number(payment.amount))}
                                        </TableCell>
                                        <TableCell>
                                            <ReceiptCell
                                                paymentId={payment.id}
                                                receiptPath={payment.receipt_url}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        aria-label={`Eliminar pago de ${payment.debt?.creditor || 'deuda'}`}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            El saldo de la deuda será restaurado.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeletePayment(payment.id)}>
                                                            Eliminar
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Upgrade Modal */}
            <UpgradeLimitModal
                open={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                featureType="export"
            />
        </div>
    );
}
