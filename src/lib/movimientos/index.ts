/**
 * Client-safe barrel for the Movimientos module.
 *
 * Re-exports ONLY pure modules (types, formatters, buckets, aggregator
 * helpers). Anything that touches Supabase, the structured logger, or the
 * Upstash cache lives in `./server.ts` and must be imported from there
 * by server components / server actions.
 *
 * Why: importing this barrel from a `'use client'` component must NOT
 * pull `pino` into the browser bundle. Pino calls `pino.destination()`
 * which is a Node-only API; including it in the client crashes on
 * module evaluation ("eH.default.destination is not a function").
 */

export type {
    Granularity,
    MovimientosBucket,
    MovimientosResult,
    MovimientosTotals,
    MovementSource,
    RawMovement,
} from './types';

export {
    GRANULARITIES,
    DEFAULT_GRANULARITY,
    BUCKET_COUNT,
} from './types';

export {
    formatCurrency,
    periodLabel,
    granularityLabel,
} from './formatters';

export { nonEmptyBucketCount, missingSeries } from './aggregator';
