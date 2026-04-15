import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { recordMarketingEvent, MARKETING_EVENT_NAMES } from '@/lib/funnel/events';
import { createClient } from '@/lib/supabase/server';
import { requireUserTenant } from '@/lib/tenant/server';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logApiError, logApiRequest } from '@/lib/logger';

const marketingEventSchema = z.object({
    eventName: z.enum(MARKETING_EVENT_NAMES),
    email: z.string().trim().email().max(160).optional(),
    path: z.string().trim().max(240).optional(),
    ctaContext: z.string().trim().max(120).optional(),
    landingVariant: z.string().trim().max(120).optional(),
    offerVariant: z.string().trim().max(120).optional(),
    planStrategy: z.string().trim().max(40).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const identifier = getClientIdentifier(request);

    try {
        const { success } = await applyRateLimit(identifier, 'api');

        if (!success) {
            return rateLimitExceededResponse();
        }

        const rawBody = await request.json();
        const parsed = marketingEventSchema.safeParse(rawBody);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Solicitud invalida' }, { status: 400 });
        }

        let userId: string | null = null;
        let tenantId: string | null = null;

        try {
            const tenantContext = await requireUserTenant();
            userId = tenantContext.user.id;
            tenantId = tenantContext.tenantId;
        } catch {
            try {
                const supabase = await createClient();
                const { data } = await supabase.auth.getUser();
                userId = data.user?.id || null;
            } catch {
                userId = null;
            }
        }

        await recordMarketingEvent({
            eventName: parsed.data.eventName,
            tenantId,
            userId,
            email: parsed.data.email || null,
            path: parsed.data.path || null,
            planStrategy: parsed.data.planStrategy || null,
            metadata: parsed.data.metadata || {},
            overrides: {
                ctaContext: parsed.data.ctaContext || null,
                landingVariant: parsed.data.landingVariant || null,
                offerVariant: parsed.data.offerVariant || null,
                path: parsed.data.path || null,
            },
        });

        logApiRequest({
            method: 'POST',
            path: '/api/funnel/event',
            userId: userId || undefined,
            ip: identifier,
            statusCode: 200,
            duration: Date.now() - startTime,
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        logApiError({
            method: 'POST',
            path: '/api/funnel/event',
            error,
            statusCode: 500,
        });

        return NextResponse.json(
            { error: 'No pudimos registrar el evento' },
            { status: 500 }
        );
    }
}
