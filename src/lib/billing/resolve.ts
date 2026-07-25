import {
    DEFAULT_PRO_VARIANT_CODE,
    PRO_VARIANTS,
    type ProVariantCode,
} from '@/lib/billing/plans';

const VALID_CODES: readonly ProVariantCode[] = PRO_VARIANTS.map((v) => v.code);

/**
 * Coerce arbitrary user input (typically a query-string value) into a valid
 * ProVariantCode. Falls back to PRO_ANNUAL for null/undefined/empty/unknown
 * values so the checkout page renders the commercial default.
 */
export function resolveVariantCode(input: unknown): ProVariantCode {
    if (typeof input !== 'string' || input.length === 0) {
        return DEFAULT_PRO_VARIANT_CODE;
    }
    return (VALID_CODES as readonly string[]).includes(input)
        ? (input as ProVariantCode)
        : DEFAULT_PRO_VARIANT_CODE;
}
