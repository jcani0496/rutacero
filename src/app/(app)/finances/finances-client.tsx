'use client';

import { useState, useTransition } from 'react';
import {
    Plus,
    Wallet,
    TrendingUp,
    TrendingDown,
    Receipt,
    Trash2,
    Edit2,
    DollarSign,
    PiggyBank,
    ShoppingCart,
    Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Progress } from '@/components/ui/progress';
import { EXPENSE_CATEGORIES, FREQUENCY_OPTIONS } from '@/lib/constants/finances';
import {
    createIncome,
    deleteIncome,
    createExpense,
    deleteExpense,
	createBudgetTarget,
	updateBudgetTarget,
	deleteBudgetTarget,
	type Income,
	type Expense,
	type BudgetTarget,
} from '@/lib/actions/finances';

interface FinancesClientProps {
    initialIncomes: Income[];
    initialExpenses: Expense[];
    initialBudgetTargets: BudgetTarget[];
    userCurrency: string;
}

export function FinancesClient({
    initialIncomes,
    initialExpenses,
    initialBudgetTargets,
    userCurrency
}: FinancesClientProps) {
    const [incomes, setIncomes] = useState<Income[]>(initialIncomes);
    const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
    const [budgetTargets, setBudgetTargets] = useState<BudgetTarget[]>(initialBudgetTargets);
    const [isPending, startTransition] = useTransition();
    const [incomeDrawerOpen, setIncomeDrawerOpen] = useState(false);
    const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
    const [budgetDrawerOpen, setBudgetDrawerOpen] = useState(false);
    const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

    // Form states for income
    const [incomeForm, setIncomeForm] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        type: 'FIXED' as 'FIXED' | 'VARIABLE',
        source: '',
        notes: '',
    });

    // Form states for expense
    const [expenseForm, setExpenseForm] = useState({
        name: '',
        amount: '',
        frequency: 'MONTHLY' as 'MONTHLY' | 'BIWEEKLY',
        expense_type: 'NEED' as 'NEED' | 'WANT',
        category: 'OTHER',
        next_date: new Date().toISOString().split('T')[0],
    });

    const [budgetForm, setBudgetForm] = useState({
        category: '',
        amount: '',
        actual_amount: '',
        period: 'MONTHLY' as 'MONTHLY' | 'BIWEEKLY',
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: userCurrency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Handle income submission
    const handleAddIncome = () => {
        if (!incomeForm.amount || parseFloat(incomeForm.amount) <= 0) return;

        startTransition(async () => {
            try {
                const newIncome = await createIncome({
                    amount: parseFloat(incomeForm.amount),
                    date: incomeForm.date,
                    type: incomeForm.type,
                    source: incomeForm.source || 'Salario',
                    notes: incomeForm.notes || undefined,
                    currency: userCurrency as 'GTQ' | 'USD',
                });
                setIncomes(prev => [newIncome, ...prev]);
                setIncomeForm({
                    amount: '',
                    date: new Date().toISOString().split('T')[0],
                    type: 'FIXED',
                    source: '',
                    notes: '',
                });
                setIncomeDrawerOpen(false);
            } catch (error) {
                console.error('Error adding income:', error);
            }
        });
    };

    // Handle income deletion
    const handleDeleteIncome = (id: string) => {
        startTransition(async () => {
            try {
                await deleteIncome(id);
                setIncomes(prev => prev.filter(i => i.id !== id));
            } catch (error) {
                console.error('Error deleting income:', error);
            }
        });
    };

    // Handle expense submission
    const handleAddExpense = () => {
        if (!expenseForm.name || !expenseForm.amount || parseFloat(expenseForm.amount) <= 0) return;

        startTransition(async () => {
            try {
                const newExpense = await createExpense({
                    name: expenseForm.name,
                    amount: parseFloat(expenseForm.amount),
                    frequency: expenseForm.frequency,
                    expense_type: expenseForm.expense_type,
                    category: expenseForm.category,
                    next_date: expenseForm.next_date,
                    currency: userCurrency as 'GTQ' | 'USD',
                });
                setExpenses(prev => [...prev, newExpense]);
                setExpenseForm({
                    name: '',
                    amount: '',
                    frequency: 'MONTHLY',
                    expense_type: 'NEED',
                    category: 'OTHER',
                    next_date: new Date().toISOString().split('T')[0],
                });
                setExpenseDrawerOpen(false);
            } catch (error) {
                console.error('Error adding expense:', error);
            }
        });
    };

    // Handle expense deletion
    const handleDeleteExpense = (id: string) => {
        startTransition(async () => {
            try {
                await deleteExpense(id);
                setExpenses(prev => prev.filter(e => e.id !== id));
            } catch (error) {
                console.error('Error deleting expense:', error);
            }
        });
    };

    // Calculate live totals
    const liveIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const liveBudgeted = expenses.reduce((sum, e) => sum + Number(e.budget_amount || e.amount), 0);
    const liveNeeds = expenses.filter(e => e.expense_type === 'NEED').reduce((sum, e) => sum + Number(e.budget_amount || e.amount), 0);
    const liveWants = expenses.filter(e => e.expense_type === 'WANT').reduce((sum, e) => sum + Number(e.budget_amount || e.amount), 0);
    const liveAvailable = liveIncome - liveBudgeted;
    const liveVariableBudget = budgetTargets.reduce((sum, b) => sum + Number(b.amount), 0);
    const liveVariableActual = budgetTargets.reduce((sum, b) => sum + Number(b.actual_amount || 0), 0);

    const resetBudgetForm = () => {
        setBudgetForm({
            category: '',
            amount: '',
            actual_amount: '',
            period: 'MONTHLY',
        });
        setEditingBudgetId(null);
    };

    const handleBudgetDialogChange = (open: boolean) => {
        setBudgetDrawerOpen(open);
        if (!open) {
            resetBudgetForm();
        }
    };

    const handleAddOrUpdateBudget = () => {
        if (!budgetForm.category || !budgetForm.amount || parseFloat(budgetForm.amount) <= 0) return;

        startTransition(async () => {
            try {
                const parsedActual = budgetForm.actual_amount.trim() === '' ? undefined : parseFloat(budgetForm.actual_amount);
                const actualAmount = Number.isNaN(parsedActual) ? undefined : parsedActual;
                if (editingBudgetId) {
                    const updated = await updateBudgetTarget({
                        id: editingBudgetId,
                        category: budgetForm.category,
                        amount: parseFloat(budgetForm.amount),
                        actual_amount: actualAmount,
                        period: budgetForm.period,
                        currency: userCurrency as 'GTQ' | 'USD',
                    });
                    setBudgetTargets(prev => prev.map(b => (b.id === updated.id ? updated : b)));
                } else {
                    const created = await createBudgetTarget({
                        category: budgetForm.category,
                        amount: parseFloat(budgetForm.amount),
                        actual_amount: actualAmount,
                        period: budgetForm.period,
                        currency: userCurrency as 'GTQ' | 'USD',
                    });
                    setBudgetTargets(prev => [created, ...prev]);
                }

                setBudgetDrawerOpen(false);
                resetBudgetForm();
            } catch (error) {
                console.error('Error saving budget target:', error);
            }
        });
    };

    const handleEditBudget = (budget: BudgetTarget) => {
        setEditingBudgetId(budget.id);
        setBudgetForm({
            category: budget.category,
            amount: budget.amount.toString(),
            actual_amount: (budget.actual_amount || 0).toString(),
            period: budget.period,
        });
        setBudgetDrawerOpen(true);
    };

    const handleDeleteBudget = (id: string) => {
        startTransition(async () => {
            try {
                await deleteBudgetTarget(id);
                setBudgetTargets(prev => prev.filter(b => b.id !== id));
            } catch (error) {
                console.error('Error deleting budget target:', error);
            }
        });
    };

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Finanzas
                    </h1>
                    <p className="text-muted-foreground">
                        Gestiona tus ingresos y gastos mensuales
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Ingresos
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">
                            {formatCurrency(liveIncome)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {incomes.length} fuente{incomes.length !== 1 ? 's' : ''}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Necesidades
                        </CardTitle>
                        <Receipt className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">
                            {formatCurrency(liveNeeds)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {expenses.filter(e => e.expense_type === 'NEED').length} gasto{expenses.filter(e => e.expense_type === 'NEED').length !== 1 ? 's' : ''} fijos
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Deseos
                        </CardTitle>
                        <ShoppingCart className="h-4 w-4 text-pink-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-pink-500">
                            {formatCurrency(liveWants)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {expenses.filter(e => e.expense_type === 'WANT').length} gasto{expenses.filter(e => e.expense_type === 'WANT').length !== 1 ? 's' : ''} variables
                        </p>
                    </CardContent>
                </Card>

                <Card className={`bg-gradient-to-br ${liveAvailable >= 0 ? 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20' : 'from-red-500/10 to-red-600/5 border-red-500/20'}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Disponible para Deudas
                        </CardTitle>
                        <PiggyBank className={`h-4 w-4 ${liveAvailable >= 0 ? 'text-cyan-500' : 'text-red-500'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${liveAvailable >= 0 ? 'text-cyan-500' : 'text-red-500'}`}>
                            {formatCurrency(liveAvailable)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {liveAvailable >= 0 ? 'Para pagos extra' : 'Déficit mensual'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs for Income/Expenses */}
            <Tabs defaultValue="income" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-xl">
                    <TabsTrigger value="income" className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Ingresos
                    </TabsTrigger>
                    <TabsTrigger value="expenses" className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        Gastos
                    </TabsTrigger>
                    <TabsTrigger value="budgets" className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Presupuestos
                    </TabsTrigger>
                </TabsList>

                {/* Income Tab */}
                <TabsContent value="income" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Ingresos Mensuales</CardTitle>
                            <Dialog open={incomeDrawerOpen} onOpenChange={setIncomeDrawerOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="gap-2">
                                        <Plus className="h-4 w-4" />
                                        Nuevo Ingreso
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>Agregar Ingreso</DialogTitle>
                                        <DialogDescription>
                                            Registra una nueva fuente de ingresos
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="income-source">Fuente</Label>
                                            <Input
                                                id="income-source"
                                                placeholder="Ej: Salario, Freelance"
                                                value={incomeForm.source}
                                                onChange={(e) => setIncomeForm(prev => ({ ...prev, source: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="income-amount">Monto</Label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="income-amount"
                                                    type="number"
                                                    placeholder="0.00"
                                                    className="pl-9"
                                                    value={incomeForm.amount}
                                                    onChange={(e) => setIncomeForm(prev => ({ ...prev, amount: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="income-type">Tipo</Label>
                                                <Select
                                                    value={incomeForm.type}
                                                    onValueChange={(value: 'FIXED' | 'VARIABLE') => setIncomeForm(prev => ({ ...prev, type: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="FIXED">Fijo</SelectItem>
                                                        <SelectItem value="VARIABLE">Variable</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="income-date">Fecha</Label>
                                                <Input
                                                    id="income-date"
                                                    type="date"
                                                    value={incomeForm.date}
                                                    onChange={(e) => setIncomeForm(prev => ({ ...prev, date: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setIncomeDrawerOpen(false)}>
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleAddIncome}
                                            disabled={isPending || !incomeForm.amount}
                                        >
                                            {isPending ? 'Agregando...' : 'Agregar Ingreso'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            {incomes.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No hay ingresos registrados</p>
                                    <p className="text-sm">Agrega tu primer ingreso para comenzar</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fuente</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                            <TableHead className="w-[80px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {incomes.map((income) => (
                                            <TableRow key={income.id}>
                                                <TableCell className="font-medium">
                                                    {income.source || 'Ingreso'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={income.type === 'FIXED' ? 'default' : 'secondary'}>
                                                        {income.type === 'FIXED' ? 'Fijo' : 'Variable'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(income.date).toLocaleDateString('es-GT')}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-emerald-500">
                                                    {formatCurrency(Number(income.amount))}
                                                </TableCell>
                                                <TableCell>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Eliminar ingreso?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Esta acción no se puede deshacer.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteIncome(income.id)}>
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
                </TabsContent>

                {/* Expenses Tab */}
                <TabsContent value="expenses" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Gastos Fijos y Variables</CardTitle>
                            <Dialog open={expenseDrawerOpen} onOpenChange={setExpenseDrawerOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="gap-2">
                                        <Plus className="h-4 w-4" />
                                        Nuevo Gasto
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>Agregar Gasto</DialogTitle>
                                        <DialogDescription>
                                            Registra un gasto recurrente
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="expense-name">Nombre</Label>
                                            <Input
                                                id="expense-name"
                                                placeholder="Ej: Renta, Netflix"
                                                value={expenseForm.name}
                                                onChange={(e) => setExpenseForm(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="expense-amount">Monto Mensual</Label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="expense-amount"
                                                    type="number"
                                                    placeholder="0.00"
                                                    className="pl-9"
                                                    value={expenseForm.amount}
                                                    onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="expense-type">Tipo</Label>
                                                <Select
                                                    value={expenseForm.expense_type}
                                                    onValueChange={(value: 'NEED' | 'WANT') => setExpenseForm(prev => ({ ...prev, expense_type: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="NEED">Necesidad</SelectItem>
                                                        <SelectItem value="WANT">Deseo</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="expense-category">Categoría</Label>
                                                <Select
                                                    value={expenseForm.category}
                                                    onValueChange={(value) => setExpenseForm(prev => ({ ...prev, category: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {EXPENSE_CATEGORIES.map((cat) => (
                                                            <SelectItem key={cat.value} value={cat.value}>
                                                                {cat.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="expense-frequency">Frecuencia</Label>
                                            <Select
                                                value={expenseForm.frequency}
                                                onValueChange={(value: 'MONTHLY' | 'BIWEEKLY') => setExpenseForm(prev => ({ ...prev, frequency: value }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MONTHLY">Mensual</SelectItem>
                                                    <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setExpenseDrawerOpen(false)}>
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleAddExpense}
                                            disabled={isPending || !expenseForm.name || !expenseForm.amount}
                                        >
                                            {isPending ? 'Agregando...' : 'Agregar Gasto'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            {expenses.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No hay gastos registrados</p>
                                    <p className="text-sm">Agrega tus gastos fijos para un mejor control</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Categoría</TableHead>
                                            <TableHead>Frecuencia</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                            <TableHead className="w-[80px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {expenses.map((expense) => (
                                            <TableRow key={expense.id}>
                                                <TableCell className="font-medium">
                                                    {expense.name}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={expense.expense_type === 'NEED' ? 'default' : 'secondary'}>
                                                        {expense.expense_type === 'NEED' ? 'Necesidad' : 'Deseo'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || expense.category}
                                                </TableCell>
                                                <TableCell>
                                                    {expense.frequency === 'MONTHLY' ? 'Mensual' : 'Quincenal'}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-red-400">
                                                    {formatCurrency(Number(expense.budget_amount || expense.amount))}
                                                </TableCell>
                                                <TableCell>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Esta acción no se puede deshacer.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteExpense(expense.id)}>
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
                </TabsContent>

                {/* Budgets Tab */}
                <TabsContent value="budgets" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <CardTitle>Presupuesto Variable</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Define limites por categoria para controlar gastos variables.
                                </p>
                            </div>
                            <Dialog open={budgetDrawerOpen} onOpenChange={handleBudgetDialogChange}>
                                <DialogTrigger asChild>
                                    <Button
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => resetBudgetForm()}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Nuevo Presupuesto
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>
                                            {editingBudgetId ? 'Editar Presupuesto' : 'Agregar Presupuesto'}
                                        </DialogTitle>
                                        <DialogDescription>
                                            Establece un objetivo mensual por categoria.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="budget-category">Categoria</Label>
                                            <Input
                                                id="budget-category"
                                                list="budget-category-options"
                                                placeholder="Ej: Alimentacion"
                                                value={budgetForm.category}
                                                onChange={(e) => setBudgetForm(prev => ({ ...prev, category: e.target.value }))}
                                            />
                                            <datalist id="budget-category-options">
                                                {EXPENSE_CATEGORIES.map((cat) => (
                                                    <option key={cat.value} value={cat.label} />
                                                ))}
                                            </datalist>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="budget-amount">Monto</Label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="budget-amount"
                                                    type="number"
                                                    placeholder="0.00"
                                                    className="pl-9"
                                                    value={budgetForm.amount}
                                                    onChange={(e) => setBudgetForm(prev => ({ ...prev, amount: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="budget-actual">Gasto real (opcional)</Label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="budget-actual"
                                                    type="number"
                                                    placeholder="0.00"
                                                    className="pl-9"
                                                    value={budgetForm.actual_amount}
                                                    onChange={(e) => setBudgetForm(prev => ({ ...prev, actual_amount: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="budget-period">Periodo</Label>
                                            <Select
                                                value={budgetForm.period}
                                                onValueChange={(value: 'MONTHLY' | 'BIWEEKLY') => setBudgetForm(prev => ({ ...prev, period: value }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {FREQUENCY_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleBudgetDialogChange(false)}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleAddOrUpdateBudget}
                                            disabled={isPending || !budgetForm.category || !budgetForm.amount}
                                        >
                                            {isPending
                                                ? 'Guardando...'
                                                : editingBudgetId
                                                    ? 'Actualizar'
                                                    : 'Agregar Presupuesto'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            {budgetTargets.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No hay presupuestos definidos</p>
                                    <p className="text-sm">Crea tu primer objetivo de gasto variable</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-3 pb-4 sm:grid-cols-3">
                                        <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                Presupuesto total
                                            </p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {formatCurrency(liveVariableBudget)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                Gasto registrado
                                            </p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {formatCurrency(liveVariableActual)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                Saldo disponible
                                            </p>
                                            <p className={`text-lg font-semibold ${liveVariableBudget - liveVariableActual >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {formatCurrency(liveVariableBudget - liveVariableActual)}
                                            </p>
                                            <Badge variant="secondary" className="mt-2">
                                                {budgetTargets.length} categoria{budgetTargets.length !== 1 ? 's' : ''}
                                            </Badge>
                                        </div>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Categoria</TableHead>
                                                <TableHead>Periodo</TableHead>
                                                <TableHead className="text-right">Objetivo</TableHead>
                                                <TableHead className="text-right">Gasto real</TableHead>
                                                <TableHead>Uso</TableHead>
                                                <TableHead className="w-[90px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {budgetTargets.map((budget) => (
                                                <TableRow key={budget.id}>
                                                    <TableCell className="font-medium">
                                                        {budget.category}
                                                    </TableCell>
                                                    <TableCell>
                                                        {budget.period === 'MONTHLY' ? 'Mensual' : 'Quincenal'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-cyan-500">
                                                        {formatCurrency(Number(budget.amount))}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-foreground">
                                                        {formatCurrency(Number(budget.actual_amount || 0))}
                                                    </TableCell>
                                                    <TableCell>
                                                        {(() => {
                                                            const target = Number(budget.amount) || 0;
                                                            const actual = Number(budget.actual_amount || 0);
                                                            const percent = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
                                                            const isOver = actual > target;
                                                            const isNear = !isOver && percent >= 85;
                                                            const progressClass = isOver
                                                                ? "[&_[data-slot=progress-indicator]]:bg-red-500"
                                                                : isNear
                                                                    ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                                                                    : "[&_[data-slot=progress-indicator]]:bg-emerald-500";

                                                            return (
                                                                <div className="min-w-[140px] space-y-2">
                                                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                                        <span>{percent}%</span>
                                                                        <span className={isOver ? 'text-red-500' : isNear ? 'text-amber-500' : 'text-emerald-500'}>
                                                                            {isOver ? 'Excedido' : isNear ? 'Cerca del límite' : 'En control'}
                                                                        </span>
                                                                    </div>
                                                                    <Progress
                                                                        value={percent}
                                                                        className={`bg-muted ${progressClass}`}
                                                                    />
                                                                </div>
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => handleEditBudget(budget)}
                                                            >
                                                                <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Esta accion no se puede deshacer.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteBudget(budget.id)}>
                                                                            Eliminar
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
