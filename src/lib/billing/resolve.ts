import { PRO_VARIANTS, type ProVariantCode } from '@/lib/billing/plans';

const VALID_CODES: readonly ProVariantCode[] = PRO_VARIANTS.map((v) => v.code);

/**
 * Coerce arbitrary user input (typically a query-string value) into a valid
 * ProVariantCode. Falls back to PRO_MONTHLY for null/undefined/empty/unknown
 * values so the checkout page renders a sensible default.
 */
export function resolveVariantCode(input: unknown): ProVariantCode {
    if (typeof input !== 'string' || input.length === 0) {
        return 'PRO_MONTHLY';
    }
    return (VALID_CODES as readonly string[]).includes(input)
        ? (input as ProVariantCode)
        : 'PRO_MONTHLY';
}
