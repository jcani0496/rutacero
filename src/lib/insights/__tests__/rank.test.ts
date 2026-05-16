import { describe, expect, it } from 'vitest';
import { rank } from '../rank';
import type { Insight } from '../types';

function ins(
    id: string,
    category: Insight['category'],
    severity: Insight['severity'] = 'info',
): Insight {
    return {
        id,
        category,
        severity,
        title: id,
        body: id,
        computedAt: '2026-05-15T12:00:00.000Z',
    };
}

describe('insights/rank', () => {
    it('returns an empty list when maxInsights <= 0', () => {
        expect(rank([ins('a', 'cost')], 0)).toEqual([]);
    });

    it('returns at most maxInsights', () => {
        const all = [
            ins('a', 'cost'),
            ins('b', 'composition'),
            ins('c', 'calendar'),
            ins('d', 'whatif'),
            ins('e', 'cost', 'attention'),
        ];
        expect(rank(all, 3)).toHaveLength(3);
    });

    it('prefers category diversity on the first pass', () => {
        // Three cost insights and one composition: rank(maxInsights=2) should
        // still pick one of each category first.
        const all = [
            ins('cost-1', 'cost'),
            ins('cost-2', 'cost'),
            ins('cost-3', 'cost'),
            ins('comp-1', 'composition'),
        ];
        const result = rank(all, 2);
        const categories = result.map((r) => r.category);
        expect(new Set(categories)).toEqual(new Set(['cost', 'composition']));
    });

    it('within a category, attention > positive > info', () => {
        const all = [
            ins('cost-info', 'cost', 'info'),
            ins('cost-positive', 'cost', 'positive'),
            ins('cost-attention', 'cost', 'attention'),
        ];
        const result = rank(all, 1);
        expect(result[0].id).toBe('cost-attention');
    });

    it('respects category priority order: cost > composition > calendar > whatif', () => {
        const all = [
            ins('w', 'whatif'),
            ins('c', 'calendar'),
            ins('p', 'composition'),
            ins('o', 'cost'),
        ];
        const result = rank(all, 4);
        expect(result.map((r) => r.id)).toEqual(['o', 'p', 'c', 'w']);
    });

    it('never returns duplicate ids', () => {
        const all = [ins('a', 'cost'), ins('a', 'cost'), ins('b', 'composition')];
        const result = rank(all, 5);
        const ids = result.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('handles empty input', () => {
        expect(rank([], 3)).toEqual([]);
    });

    it('keeps stable ordering by id when severity ties', () => {
        const all = [
            ins('cost-b', 'cost', 'info'),
            ins('cost-a', 'cost', 'info'),
        ];
        const result = rank(all, 2);
        expect(result.map((r) => r.id)).toEqual(['cost-a', 'cost-b']);
    });
});
