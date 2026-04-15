/**
 * Pagination types for server actions
 * PERF-006: Standardized pagination across all endpoints
 */

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasMore: boolean;
    };
}

// Default pagination constants
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 1000;

/**
 * Sanitizes and validates pagination parameters
 * Ensures page and limit are within acceptable bounds
 */
export function sanitizePaginationParams(
    params: PaginationParams = {}
): Required<Pick<PaginationParams, 'page' | 'limit'>> & Pick<PaginationParams, 'sortBy' | 'sortOrder'> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(
        Math.max(1, params.limit || DEFAULT_PAGE_SIZE),
        MAX_PAGE_SIZE
    );

    return {
        page,
        limit,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
    };
}

/**
 * Calculates offset for range queries
 */
export function calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
}

/**
 * Builds pagination metadata for responses
 */
export function buildPaginationMeta(
    total: number,
    page: number,
    limit: number
): PaginatedResponse<unknown>['pagination'] {
    const totalPages = Math.ceil(total / limit);

    return {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
    };
}
