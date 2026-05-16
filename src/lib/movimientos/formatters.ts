/**
 * Spanish (es-GT) formatters for the Movimientos view.
 *
 * Pure functions — no React, no DB. Locale-aware. Currency follows the same
 * "strip non-breaking space after Q" rule the insights formatters use.
 */

import type { Granularity } from './types';

const MONTH_SHORT = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

const MONTH_LONG = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
    const key = currency.toUpperCase();
    const cached = CURRENCY_FORMATTERS.get(key);
    if (cached) return cached;
    const formatter = new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: key,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    CURRENCY_FORMATTERS.set(key, formatter);
    return formatter;
}

/** Format a monetary amount: `Q1,234.56`. Falls back to GTQ on bad codes. */
export function formatCurrency(amount: number, currency = 'GTQ'): string {
    const safe = Number.isFinite(amount) ? amount : 0;
    let formatted: string;
    try {
        formatted = getCurrencyFormatter(currency).format(safe);
    } catch {
        formatted = getCurrencyFormatter('GTQ').format(safe);
    }
    // Strip whitespace between the currency symbol and digits. Node's ICU
    // emits a non-breaking space (U+00A0) and sometimes a narrow no-break
    // space (U+202F); we strip both.
    return formatted.replace(/[\s  ]/g, '');
}

/** Short X-axis label for a bucket starting at `start`. */
export function formatBucketLabel(start: Date, granularity: Granularity): string {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth();
    const d = start.getUTCDate();
    switch (granularity) {
        case 'diario':
            return `${String(d).padStart(2, '0')} ${MONTH_SHORT[m]}`;
        case 'semanal': {
            // Use day-month so the user instantly sees what week they look at.
            return `${String(d).padStart(2, '0')} ${MONTH_SHORT[m]}`;
        }
        case 'quincenal': {
            const q = d <= 15 ? 1 : 2;
            return `${MONTH_SHORT[m]} Q${q}`;
        }
        case 'mensual':
            return MONTH_SHORT[m];
        case 'trimestral': {
            const q = Math.floor(m / 3) + 1;
            return `T${q} ${y}`;
        }
        case 'semestral': {
            const h = m < 6 ? 1 : 2;
            return `S${h} ${y}`;
        }
        case 'anual':
            return String(y);
    }
}

/** Long tooltip label for a bucket starting at `start`. */
export function formatBucketLongLabel(start: Date, granularity: Granularity): string {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth();
    const d = start.getUTCDate();
    switch (granularity) {
        case 'diario':
            return `${d} de ${MONTH_LONG[m]} de ${y}`;
        case 'semanal':
            return `Semana del ${d} de ${MONTH_LONG[m]} de ${y}`;
        case 'quincenal': {
            const q = d <= 15 ? 1 : 2;
            return `${q === 1 ? '1ra' : '2da'} quincena de ${MONTH_LONG[m]} de ${y}`;
        }
        case 'mensual':
            return `${MONTH_LONG[m]} de ${y}`.replace(/^./, (c) => c.toUpperCase());
        case 'trimestral': {
            const q = Math.floor(m / 3) + 1;
            return `${q}.º trimestre de ${y}`;
        }
        case 'semestral': {
            const h = m < 6 ? 1 : 2;
            return `${h === 1 ? 'Primer' : 'Segundo'} semestre de ${y}`;
        }
        case 'anual':
            return `Año ${y}`;
    }
}

/**
 * Spanish copy for the KPI titles and the chart subtitle. Matches the spec's
 * "Ingreso del año / Ingreso del trimestre / Ingreso de los últimos 90 días"
 * shape.
 */
export function periodLabel(granularity: Granularity): string {
    switch (granularity) {
        case 'diario':
            return 'los últimos 90 días';
        case 'semanal':
            return 'las últimas 26 semanas';
        case 'quincenal':
            return 'las últimas 12 quincenas';
        case 'mensual':
            return 'los últimos 12 meses';
        case 'trimestral':
            return 'los últimos 8 trimestres';
        case 'semestral':
            return 'los últimos 6 semestres';
        case 'anual':
            return 'los últimos 5 años';
    }
}

/** Short Spanish label for the granularity selector. */
export function granularityLabel(granularity: Granularity): string {
    switch (granularity) {
        case 'diario':
            return 'Diario';
        case 'semanal':
            return 'Semanal';
        case 'quincenal':
            return 'Quincenal';
        case 'mensual':
            return 'Mensual';
        case 'trimestral':
            return 'Trimestral';
        case 'semestral':
            return 'Semestral';
        case 'anual':
            return 'Anual';
    }
}
