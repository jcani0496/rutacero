/**
 * Locale-aware formatters for insights copy. All output is Spanish (es-GT)
 * and uses GTQ currency by default to match the rest of the RutaCero UI.
 */

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

/**
 * Formats a monetary amount in Guatemalan style: `Q1,234.56`.
 * Falls back to GTQ when the currency code is missing/unknown.
 *
 * Node's ICU emits `Q ` (non-breaking space) between the symbol and
 * digits — we strip that to match common RutaCero copy ("Q200.00").
 */
export function formatCurrency(amount: number, currency = 'GTQ'): string {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    let formatted: string;
    try {
        formatted = getCurrencyFormatter(currency).format(safeAmount);
    } catch {
        formatted = getCurrencyFormatter('GTQ').format(safeAmount);
    }
    return formatted.replace(/ /g, '').replace(/ /g, '');
}

/**
 * Percentage with up to 1 decimal: `24%`, `12.5%`.
 */
export function formatPercent(value: number): string {
    if (!Number.isFinite(value)) return '0%';
    const rounded = Math.round(value * 10) / 10;
    if (Number.isInteger(rounded)) {
        return `${rounded}%`;
    }
    return `${rounded.toFixed(1).replace('.', '.')}%`;
}

/**
 * Human-friendly Spanish duration. Examples:
 *   1   -> "1 mes"
 *   3   -> "3 meses"
 *   12  -> "1 año"
 *   16  -> "1 año y 4 meses"
 *   24  -> "2 años"
 */
export function formatMonths(months: number): string {
    if (!Number.isFinite(months) || months <= 0) return '0 meses';
    const total = Math.round(months);
    if (total < 12) {
        return total === 1 ? '1 mes' : `${total} meses`;
    }
    const years = Math.floor(total / 12);
    const rem = total % 12;
    const yearsLabel = years === 1 ? '1 año' : `${years} años`;
    if (rem === 0) return yearsLabel;
    const monthsLabel = rem === 1 ? '1 mes' : `${rem} meses`;
    return `${yearsLabel} y ${monthsLabel}`;
}

/**
 * Long Spanish date in es-GT format: `15 de mayo de 2026`.
 * Accepts an ISO date string or a Date.
 */
export function formatLongDate(input: string | Date, timeZone = 'America/Guatemala'): string {
    const date = typeof input === 'string' ? new Date(input) : input;
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('es-GT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone,
    }).format(date);
}
