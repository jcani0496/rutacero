import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserTenant } from '@/lib/tenant/server';
import { getProVariant } from '@/lib/billing/plans';
import { recordMarketingEvent } from '@/lib/funnel/events';
import {
    sendTransferInstructionsEmail,
    BankAccountConfigError,
} from '@/lib/resend/transfer';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const Body = z.object({
    variantCode: z.enum(['PRO_MONTHLY', 'PRO_QUARTERLY', 'PRO_ANNUAL']),
});

export async function POST(req: NextRequest) {
    const id = getClientIdentifier(req);
    const { success } = await applyRateLimit(id, 'checkout');
    if (!success) return rateLimitExceededResponse();

    let session: Awaited<ReturnType<typeof requireUserTenant>>;
    try {
        session = await requireUserTenant();
    } catch {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const { user, tenantId } = session;

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: 'INVALID_VARIANT' }, { status: 400 });
    }

    const variant = getProVariant(parsed.data.variantCode);

    if (!user.email) {
        return NextResponse.json({ error: 'NO_EMAIL_ON_FILE' }, { status: 400 });
    }

    const tenantPart = tenantId.replace(/-/g, '').slice(0, 8).toUpperCase();
    const tsPart = Date.now().toString(36).toUpperCase();
    const randPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    const referenceCode = `RC-${tenantPart}-${tsPart}-${randPart}`;

    try {
        await sendTransferInstructionsEmail({
            to: user.email,
            variant,
            referenceCode,
        });
    } catch (e) {
        if (e instanceof BankAccountConfigError) {
            logger.error(
                { err: e.message },
                'manual-transfer: server misconfiguration (no bank accounts)'
            );
            return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 });
        }
        logger.error(
            { err: e instanceof Error ? e.message : String(e) },
            'manual-transfer email failed'
        );
        return NextResponse.json({ error: 'EMAIL_SEND_FAILED' }, { status: 502 });
    }

    try {
        await recordMarketingEvent({
            eventName: 'checkout_started',
            tenantId,
            userId: user.id,
            metadata: { method: 'manual_transfer', variantCode: variant.code, referenceCode },
        });
    } catch (e) {
        logger.warn(
            { err: e instanceof Error ? e.message : String(e) },
            'manual-transfer marketing event failed'
        );
    }

    return NextResponse.json({ ok: true, referenceCode });
}
