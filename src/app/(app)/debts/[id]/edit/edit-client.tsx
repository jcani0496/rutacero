'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { TagInput } from '@/components/features/tag-input';
import { UpgradeLimitModal } from '@/components/features/upgrade-limit-modal';
import { toast } from '@/components/ui/toast';
import { updateDebt } from '@/lib/actions/debts';
import { DEBT_CATEGORY_OPTIONS } from '@/lib/constants/debts';
import {
    AprPresetHelper,
    ZeroAprWarning,
    shouldWarnZeroApr,
} from '../../components/apr-field-help';
import type { Debt } from '@/types';

interface EditDebtClientProps {
    debt: Debt;
    isPro: boolean;
}

const debtTypeLabels: Record<string, string> = {
    CREDIT_CARD: 'Tarjeta de Crédito',
    LOAN: 'Préstamo',
    INSTALLMENT: 'Cuotas',
    INFORMAL: 'Deuda Informal',
};

export function EditDebtClient({ debt, isPro }: EditDebtClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Form state
    const [creditor, setCreditor] = useState(debt.creditor);
    const [type, setType] = useState(debt.type);
    const [balance, setBalance] = useState(debt.balance);
    const [minPayment, setMinPayment] = useState(debt.min_payment);
    const [apr, setApr] = useState(debt.apr || 0);
    const [dueDate, setDueDate] = useState(debt.due_date || 0);
    const [paymentDay, setPaymentDay] = useState<number | undefined>(
        typeof debt.payment_day === 'number' ? debt.payment_day : undefined
    );
    const [interestModel, setInterestModel] = useState<
        'MONTHLY_SIMPLE' | 'DAILY_SIMPLE' | 'DAILY_AVG_BALANCE'
    >(
        (debt.interest_model as 'MONTHLY_SIMPLE' | 'DAILY_SIMPLE' | 'DAILY_AVG_BALANCE')
        || (debt.type === 'CREDIT_CARD' ? 'DAILY_SIMPLE' : 'MONTHLY_SIMPLE')
    );
    const [monthlyFees, setMonthlyFees] = useState<number>(Number(debt.monthly_fees || 0));
    const [cutDate, setCutDate] = useState(debt.statement_date || 0);
    const [currency, setCurrency] = useState(debt.currency);
    const [category, setCategory] = useState(debt.category || 'OTHER');
    const [tags, setTags] = useState<string[]>(debt.tags || []);
    const [notes, setNotes] = useState(debt.notes || '');
    const [goalExtraPayment, setGoalExtraPayment] = useState<number | undefined>(
        debt.goal_extra_payment && debt.goal_extra_payment > 0 ? debt.goal_extra_payment : undefined
    );
    const [goalTargetDate, setGoalTargetDate] = useState<string>(
        debt.goal_target_date || ''
    );

    const [aprWarningShown, setAprWarningShown] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Non-blocking zero-APR warning: pause the first submit to show it;
        // a second submit goes through.
        if (shouldWarnZeroApr(type, apr) && !aprWarningShown) {
            setAprWarningShown(true);
            return;
        }

        startTransition(async () => {
            try {
                await updateDebt({
                    id: debt.id,
                    creditor,
                    type,
                    balance,
                    min_payment: minPayment,
                    apr,
                    due_date: dueDate,
                    payment_day: paymentDay,
                    interest_model: interestModel,
                    monthly_fees: monthlyFees,
                    cut_date: cutDate || undefined,
                    currency,
                    category,
                    tags,
                    notes: notes || undefined,
                    goal_extra_payment: isPro ? goalExtraPayment : undefined,
                    goal_target_date: isPro ? (goalTargetDate || undefined) : undefined,
                });
                router.push('/debts');
                router.refresh();
            } catch (error) {
                console.error('Error updating debt:', error);
                toast.error('No pudimos actualizar la deuda. Revisá tu conexión e intentá de nuevo.');
            }
        });
    };

    return (
        <>
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/debts" aria-label="Volver a deudas">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Editar Deuda</h1>
                    <p className="text-muted-foreground">{debt.creditor}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Detalles de la Deuda</CardTitle>
                    <CardDescription>
                        Actualiza la información de tu deuda
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="creditor">Acreedor</Label>
                            <Input
                                id="creditor"
                                value={creditor}
                                onChange={(e) => setCreditor(e.target.value)}
                                placeholder="Ej: Banco Industrial"
                                required
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>Tipo de Deuda</Label>
                                <Select value={type} onValueChange={(v) => setType(v as Debt['type'])}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(debtTypeLabels).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label>Moneda</Label>
                                <Select value={currency} onValueChange={(v) => setCurrency(v as 'GTQ' | 'USD')}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="GTQ">Quetzales (GTQ)</SelectItem>
                                        <SelectItem value="USD">Dólares (USD)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Detalle de Deuda</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue />
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
                            <CurrencyInput
                                label="Saldo Actual"
                                value={balance}
                                onChange={(v) => setBalance(v || 0)}
                                currency={currency}
                            />
                            <CurrencyInput
                                label="Pago Mínimo"
                                value={minPayment}
                                onChange={(v) => setMinPayment(v || 0)}
                                currency={currency}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="apr">Tasa de Interés Anual (APR)</Label>
                            <Input
                                id="apr"
                                type="number"
                                value={apr || ''}
                                onChange={(e) => setApr(Number(e.target.value) || 0)}
                                placeholder="0"
                            />
                            <AprPresetHelper
                                debtType={type}
                                onSelect={(value) => setApr(value)}
                            />
                            <ZeroAprWarning
                                show={aprWarningShown && shouldWarnZeroApr(type, apr)}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="dueDate">Día de Pago</Label>
                                <Input
                                    id="dueDate"
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={dueDate || ''}
                                    onChange={(e) => {
                                        const v = Number(e.target.value) || 0;
                                        setDueDate(v);
                                        if (!paymentDay) setPaymentDay(v || undefined);
                                    }}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cutDate">Día de Corte (opcional)</Label>
                                <Input
                                    id="cutDate"
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={cutDate || ''}
                                    onChange={(e) => setCutDate(Number(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Configuración avanzada</p>
                                    <p className="text-xs text-muted-foreground">
                                        Ajusta el modelo de interés y fees para mejorar la precisión.
                                    </p>
                                </div>
                                <Badge variant="secondary">Precisión</Badge>
                            </div>

                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Modelo de interés</Label>
                                    <Select value={interestModel} onValueChange={(v) => setInterestModel(v as typeof interestModel)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DAILY_SIMPLE">Diario (tarjetas)</SelectItem>
                                            <SelectItem value="DAILY_AVG_BALANCE">Diario (saldo promedio)</SelectItem>
                                            <SelectItem value="MONTHLY_SIMPLE">Mensual simple</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="paymentDay">Día típico de pago (opcional)</Label>
                                    <Input
                                        id="paymentDay"
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={paymentDay || ''}
                                        onChange={(e) => setPaymentDay(Number(e.target.value) || undefined)}
                                        placeholder={dueDate ? `Ej: ${dueDate}` : 'Ej: 15'}
                                    />
                                </div>

                                <CurrencyInput
                                    label="Fees mensuales (opcional)"
                                    value={monthlyFees}
                                    onChange={(v) => setMonthlyFees(v || 0)}
                                    currency={currency}
                                    hint="Ej: seguro, membresía prorrateada"
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Metas de deuda</p>
                                    <p className="text-xs text-muted-foreground">
                                        Define un pago extra o una fecha objetivo para esta deuda.
                                    </p>
                                </div>
                                <Badge variant="secondary">PRO</Badge>
                            </div>
                            {isPro ? (
                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                    <CurrencyInput
                                        label="Pago extra mensual"
                                        value={goalExtraPayment}
                                        onChange={(v) => setGoalExtraPayment(v)}
                                        currency={currency}
                                        hint="Opcional"
                                    />
                                    <Input
                                        label="Fecha objetivo"
                                        type="date"
                                        value={goalTargetDate}
                                        onChange={(e) => setGoalTargetDate(e.target.value)}
                                    />
                                </div>
                            ) : (
                                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        Disponible en el plan PRO.
                                    </p>
                                    <Button size="sm" variant="outline" asChild>
                                        <Link href="/pricing">Ver Planes PRO</Link>
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Tags */}
                        <div className="grid gap-2">
                            <Label>Etiquetas</Label>
                            <TagInput
                                tags={tags}
                                onChange={setTags}
                                isPro={isPro}
                                onProRequired={() => setShowUpgradeModal(true)}
                            />
                        </div>

                        {/* Notes */}
                        <div className="grid gap-2">
                            <Label htmlFor="notes">Notas (opcional)</Label>
                            <Input
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notas adicionales..."
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" asChild>
                                <Link href="/debts">Cancelar</Link>
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Guardar Cambios
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <UpgradeLimitModal
                open={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                featureType="tags"
            />
        </>
    );
}
