/**
 * Tests for pagination utilities
 * PERF-006: Verify pagination helper functions
 */

import { describe, it, expect } from 'vitest';
import {
    sanitizePaginationParams,
    calculateOffset,
    buildPaginationMeta,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
} from '@/types/pagination';

describe('Pagination Utilities', () => {
    describe('sanitizePaginationParams', () => {
        it('should use defaults when no params provided', () => {
            const result = sanitizePaginationParams({});

            expect(result.page).toBe(1);
            expect(result.limit).toBe(DEFAULT_PAGE_SIZE);
        });

        it('should sanitize negative page to 1', () => {
            const result = sanitizePaginationParams({ page: -5 });

            expect(result.page).toBe(1);
        });

        it('should sanitize zero page to 1', () => {
            const result = sanitizePaginationParams({ page: 0 });

            expect(result.page).toBe(1);
        });

        it('should cap limit at MAX_PAGE_SIZE', () => {
            const result = sanitizePaginationParams({ limit: 999999 });

            expect(result.limit).toBe(MAX_PAGE_SIZE);
        });

        it('should sanitize negative limit to 1', () => {
            const result = sanitizePaginationParams({ limit: -10 });

            expect(result.limit).toBe(1);
        });

        it('should preserve valid sort params', () => {
            const result = sanitizePaginationParams({
                sortBy: 'created_at',
                sortOrder: 'asc',
            });

            expect(result.sortBy).toBe('created_at');
            expect(result.sortOrder).toBe('asc');
        });

        it('should handle all params together', () => {
            const result = sanitizePaginationParams({
                page: 5,
                limit: 25,
                sortBy: 'name',
                sortOrder: 'desc',
            });

            expect(result.page).toBe(5);
            expect(result.limit).toBe(25);
            expect(result.sortBy).toBe('name');
            expect(result.sortOrder).toBe('desc');
        });
    });

    describe('calculateOffset', () => {
        it('should calculate offset for page 1', () => {
            const offset = calculateOffset(1, 50);
            expect(offset).toBe(0);
        });

        it('should calculate offset for page 2', () => {
            const offset = calculateOffset(2, 50);
            expect(offset).toBe(50);
        });

        it('should calculate offset for page 10', () => {
            const offset = calculateOffset(10, 25);
            expect(offset).toBe(225);
        });

        it('should handle custom page sizes', () => {
            const offset = calculateOffset(3, 100);
            expect(offset).toBe(200);
        });
    });

    describe('buildPaginationMeta', () => {
        it('should build correct metadata for first page', () => {
            const meta = buildPaginationMeta(100, 1, 50);

            expect(meta.total).toBe(100);
            expect(meta.page).toBe(1);
            expect(meta.limit).toBe(50);
            expect(meta.totalPages).toBe(2);
            expect(meta.hasMore).toBe(true);
        });

        it('should build correct metadata for last page', () => {
            const meta = buildPaginationMeta(100, 2, 50);

            expect(meta.page).toBe(2);
            expect(meta.totalPages).toBe(2);
            expect(meta.hasMore).toBe(false);
        });

        it('should handle exact page division', () => {
            const meta = buildPaginationMeta(150, 1, 50);

            expect(meta.totalPages).toBe(3);
            expect(meta.hasMore).toBe(true);
        });

        it('should handle partial last page', () => {
            const meta = buildPaginationMeta(125, 3, 50);

            expect(meta.totalPages).toBe(3);
            expect(meta.hasMore).toBe(false);
        });

        it('should handle zero results', () => {
            const meta = buildPaginationMeta(0, 1, 50);

            expect(meta.total).toBe(0);
            expect(meta.totalPages).toBe(0);
            expect(meta.hasMore).toBe(false);
        });

        it('should handle single page', () => {
            const meta = buildPaginationMeta(25, 1, 50);

            expect(meta.totalPages).toBe(1);
            expect(meta.hasMore).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very large page numbers', () => {
            const offset = calculateOffset(1000000, 50);
            expect(offset).toBe(49999950);
        });

        it('should handle 1-item pages', () => {
            const meta = buildPaginationMeta(100, 50, 1);

            expect(meta.totalPages).toBe(100);
            expect(meta.hasMore).toBe(true);
        });

        it('should handle fractional total pages correctly', () => {
            const meta = buildPaginationMeta(77, 1, 10);

            expect(meta.totalPages).toBe(8); // Ceiling of 7.7
        });
    });
});
