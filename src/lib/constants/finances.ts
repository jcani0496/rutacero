// Finance constants - separated from server actions

// Expense categories
export const EXPENSE_CATEGORIES = [
    { value: 'HOUSING', label: 'Hogar' },
    { value: 'UTILITIES', label: 'Servicios' },
    { value: 'TRANSPORTATION', label: 'Transporte' },
    { value: 'FOOD', label: 'Alimentación' },
    { value: 'HEALTH', label: 'Salud' },
    { value: 'INSURANCE', label: 'Seguros' },
    { value: 'SUBSCRIPTIONS', label: 'Suscripciones' },
    { value: 'ENTERTAINMENT', label: 'Entretenimiento' },
    { value: 'PERSONAL_CARE', label: 'Cuidado Personal' },
    { value: 'EDUCATION', label: 'Educación' },
    { value: 'SAVINGS', label: 'Ahorro' },
    { value: 'OTHER', label: 'Otros' },
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['value'];

// Income types
export const INCOME_TYPES = [
    { value: 'FIXED', label: 'Fijo' },
    { value: 'VARIABLE', label: 'Variable' },
] as const;

export type IncomeType = typeof INCOME_TYPES[number]['value'];

// Expense types (Needs vs Wants)
export const EXPENSE_TYPES = [
    { value: 'NEED', label: 'Necesidad' },
    { value: 'WANT', label: 'Deseo' },
] as const;

export type ExpenseType = typeof EXPENSE_TYPES[number]['value'];

// Frequency options
export const FREQUENCY_OPTIONS = [
    { value: 'MONTHLY', label: 'Mensual' },
    { value: 'BIWEEKLY', label: 'Quincenal' },
] as const;

export type Frequency = typeof FREQUENCY_OPTIONS[number]['value'];
