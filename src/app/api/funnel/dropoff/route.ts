import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getDb, schema } from '@/db/client';
import { getAppUser } from '@/lib/auth/session';
import { isDrizzleEnabled } from '@/lib/data/provider';
import { createMarketingContext } from '@/lib/funnel/attribution';
import { readAttributionStateFromCookies } from '@/lib/funnel/attribution-server';
import { recordMarketingEvent } from '@/lib/funnel/events';
import { DROPOFF_SURFACES } from '@/lib/funnel/dropoff';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logApiError, logApiRequest } from '@/lib/logger';
import { requireUserTenant } from '@/lib/tenant/server';

const dropoffSchema = z.object({
    surface: z.enum(DROPOFF_SURFACES),
    reason: z.string().trim().min(1).max(120),
    detail: z.string().trim().max(500).optional(),
    email: z.string().trim().email().max(160).optional(),
    path: z.string().trim().max(240).optional(),
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
        const parsed = dropoffSchema.safeParse(rawBody);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Solicitud invalida' },
                { status: 400 }
            );
        }

        let userId: string | null = null;
        let tenantId: string | null = null;
        try {
            const tenantContext = await requireUserTenant();
            userId = tenantContext.user.id;
            tenantId = tenantContext.tenantId;
        } catch {
            try {
                const user = await getAppUser();
                userId = user?.id || null;
            } catch {
                userId = null;
            }
        }

        if (!isDrizzleEnabled()) {
            // Legacy Supabase PostgREST path removed with F6 cutover.
            return NextResponse.json({ ok: false }, { status: 202 });
        }

        const attributionState = await readAttributionStateFromCookies();
        const marketingContext = createMarketingContext(attributionState, {
            ctaContext: parsed.data.surface,
            path: parsed.data.path || null,
        });

        const metadata = {
            attribution_id: marketingContext.attributionId,
            source: marketingContext.source,
            medium: marketingContext.medium,
            campaign_id: marketingContext.campaignId,
            creative_id: marketingContext.creativeId,
            partner_slug: marketingContext.partnerSlug,
            landing_variant: marketingContext.landingVariant,
            offer_variant: marketingContext.offerVariant,
            cta_context: marketingContext.ctaContext,
            referrer: request.headers.get('referer'),
            user_agent: request.headers.get('user-agent'),
            tenant_id: tenantId,
        };

        const db = getDb();
        await db.insert(schema.marketingDropoffEvents).values({
            surface: parsed.data.surface,
            reason: parsed.data.reason,
            detail: parsed.data.detail || null,
            email: parsed.data.email || null,
            path: parsed.data.path || null,
            userId: userId,
            metadata,
        });

        await recordMarketingEvent({
            eventName: 'dropoff_reported',
            tenantId,
            userId,
            email: parsed.data.email || null,
            path: parsed.data.path || null,
            metadata: {
                reason: parsed.data.reason,
                detail: parsed.data.detail || null,
                surface: parsed.data.surface,
            },
            marketingContext,
        });

        logApiRequest({
            method: 'POST',
            path: '/api/funnel/dropoff',
            userId: userId || undefined,
            ip: identifier,
            statusCode: 200,
            duration: Date.now() - startTime,
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        logApiError({
            method: 'POST',
            path: '/api/funnel/dropoff',
            error,
            statusCode: 500,
        });

        return NextResponse.json(
            { error: 'No pudimos guardar tu comentario' },
            { status: 500 }
        );
    }
}
