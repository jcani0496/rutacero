import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function buildNotReadyResponse(
    reason: 'missing_env' | 'db_unreachable' | 'unexpected_error',
    options?: {
        missing?: string[];
        details?: string;
    }
) {
    const responseBody: {
        status: 'not_ready';
        reason: 'missing_env' | 'db_unreachable' | 'unexpected_error';
        missing?: string[];
        details?: string;
    } = {
        status: 'not_ready',
        reason,
    };

    if (process.env.NODE_ENV !== 'production') {
        if (options?.missing) {
            responseBody.missing = options.missing;
        }

        if (options?.details) {
            responseBody.details = options.details;
        }
    }

    return NextResponse.json(responseBody, {
        status: 503,
        headers: NO_STORE_HEADERS,
    });
}

export async function GET() {
    const requiredEnv = [
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'ADMIN_JWT_SECRET',
    ];

    const missingEnv = requiredEnv.filter((key) => !process.env[key]);
    if (missingEnv.length > 0) {
        return buildNotReadyResponse('missing_env', { missing: missingEnv });
    }

    try {
        const supabase = createAdminClient();
        const { error } = await supabase
            .from('tenants')
            .select('id')
            .limit(1);

        if (error) {
            return buildNotReadyResponse('db_unreachable', {
                details: error.message,
            });
        }

        return NextResponse.json(
            {
                status: 'ready',
                timestamp: new Date().toISOString(),
            },
            { headers: NO_STORE_HEADERS }
        );
    } catch (error) {
        return buildNotReadyResponse('unexpected_error', {
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
