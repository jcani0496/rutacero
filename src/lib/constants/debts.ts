export const DEBT_CATEGORY_OPTIONS = [
    { value: 'VEHICLE', label: 'Vehículo' },
    { value: 'HOUSING', label: 'Vivienda' },
    { value: 'HOME_IMPROVEMENT', label: 'Mejoras del hogar' },
    { value: 'EDUCATION', label: 'Educación' },
    { value: 'HEALTH', label: 'Salud' },
    { value: 'BUSINESS', label: 'Negocio' },
    { value: 'APPLIANCES', label: 'Electrodomésticos' },
    { value: 'TECH', label: 'Tecnología' },
    { value: 'TRAVEL', label: 'Viajes' },
    { value: 'TAXES', label: 'Impuestos' },
    { value: 'CONSUMPTION', label: 'Consumo' },
    { value: 'OTHER', label: 'Otro' },
] as const;

export type DebtCategory = typeof DEBT_CATEGORY_OPTIONS[number]['value'];
