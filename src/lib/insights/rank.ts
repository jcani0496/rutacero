/**
 * Ranks the union of generator outputs into the top N insights for display.
 *
 * Strategy:
 *  - Group by category.
 *  - Within a category, sort by severity (attention > positive > info), then
 *    by id (stable, deterministic).
 *  - Take ONE insight from each category in priority order
 *    (cost, composition, calendar, whatif).
 *  - If we still have room, take a second from each in the same order.
 *  - Always cap at `maxInsights` and never include duplicate ids.
 */

import type { Insight, InsightCategory } from './types';

const CATEGORY_PRIORITY: InsightCategory[] = ['cost', 'composition', 'calendar', 'whatif'];

const SEVERITY_WEIGHT: Record<Insight['severity'], number> = {
    attention: 3,
    positive: 2,
    info: 1,
};

export function rank(insights: Insight[], maxInsights: number): Insight[] {
    if (maxInsights <= 0) return [];

    // Dedupe by id while preserving first occurrence.
    const seenIds = new Set<string>();
    const deduped: Insight[] = [];
    for (const i of insights) {
        if (seenIds.has(i.id)) continue;
        seenIds.add(i.id);
        deduped.push(i);
    }

    // Bucket by category, sorted within each bucket.
    const buckets = new Map<InsightCategory, Insight[]>();
    for (const cat of CATEGORY_PRIORITY) buckets.set(cat, []);

    for (const insight of deduped) {
        const bucket = buckets.get(insight.category);
        if (bucket) bucket.push(insight);
    }

    for (const bucket of buckets.values()) {
        bucket.sort((a, b) => {
            const sevDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
            if (sevDiff !== 0) return sevDiff;
            return a.id.localeCompare(b.id);
        });
    }

    const out: Insight[] = [];
    // Round-robin across category priority. First pass guarantees diversity,
    // subsequent passes fill remaining slots.
    let passEmpty = false;
    while (out.length < maxInsights && !passEmpty) {
        passEmpty = true;
        for (const cat of CATEGORY_PRIORITY) {
            if (out.length >= maxInsights) break;
            const bucket = buckets.get(cat);
            if (!bucket || bucket.length === 0) continue;
            const next = bucket.shift()!;
            out.push(next);
            passEmpty = false;
        }
    }

    return out;
}
