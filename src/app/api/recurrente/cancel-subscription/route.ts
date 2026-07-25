import { NextRequest, NextResponse } from 'next/server';
import { requireUserTenant } from '@/lib/tenant/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getRecurrenteClient } from '@/lib/recurrente/client';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { isDrizzleEnabled } from '@/lib/data/provider';
import {
    drizzleFindSubscriptionByTenantId,
    drizzleUpdateSubscriptionByTenant,
} from '@/lib/billing/drizzle';

export async function POST(request: NextRequest) {
    // Apply rate limiting first (so anonymous spam still hits the limiter),
    // matching the canonical sequence in /api/billing/manual-transfer/route.ts.
    const identifier = getClientIdentifier(request);
    const { success } = await applyRateLimit(identifier, 'api');

    if (!success) {
        return rateLimitExceededResponse();
    }

    let session: Awaited<ReturnType<typeof requireUserTenant>>;
    try {
        session = await requireUserTenant();
    } catch {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const { supabase, tenantId } = session;

    try {
        // Get user's subscription
        let subscription: {
            plan_code: string;
            status: string;
            external_id: string | null;
        } | null = null;

        if (isDrizzleEnabled()) {
            subscription = await drizzleFindSubscriptionByTenantId(tenantId);
        } else {
            const { data, error: subError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('tenant_id', tenantId)
                .single();

            if (subError || !data) {
                return NextResponse.json(
                    { error: 'No se encontró suscripción' },
                    { status: 404 }
                );
            }
            subscription = data;
        }

        if (!subscription) {
            return NextResponse.json(
                { error: 'No se encontró suscripción' },
                { status: 404 }
            );
        }

        // If already FREE or CANCELED, nothing to do
        if (subscription.plan_code === 'FREE' || subscription.status === 'CANCELED') {
            return NextResponse.json(
                { error: 'No hay suscripción activa para cancelar' },
                { status: 400 }
            );
        }

        // Try to cancel in Recurrente if external_id exists
        if (subscription.external_id) {
            try {
                const recurrente = getRecurrenteClient();
                await recurrente.cancelSubscription(subscription.external_id);
            } catch (recurrenteError) {
                logger.error(
                    {
                        err:
                            recurrenteError instanceof Error
                                ? recurrenteError.message
                                : String(recurrenteError),
                        externalId: subscription.external_id,
                        tenantId,
                    },
                    'cancel-subscription: Recurrente cancel failed, proceeding with local update'
                );
                // Continue anyway - we'll update locally
            }
        }

        // Update local subscription.
        // Subscriptions UPDATE requires service_role per migration 024 RLS policy
        // ("Service role can write subscriptions"). Authorization is enforced by
        // requireUserTenant above + the tenant_id filter below — the tenantId comes
        // from the authenticated session, never from the request body.
        if (isDrizzleEnabled()) {
            await drizzleUpdateSubscriptionByTenant(tenantId, {
                status: 'CANCELED',
                cancelAt: new Date().toISOString(),
            });
        } else {
            const admin = createAdminClient();
            const { error: updateError } = await admin
                .from('subscriptions')
                .update({
                    status: 'CANCELED',
                    cancel_at: new Date().toISOString(),
                    // Keep plan_code as PRO until renew_at passes (grace period)
                })
                .eq('tenant_id', tenantId);

            if (updateError) {
                logger.error(
                    { err: updateError.message, tenantId },
                    'cancel-subscription: admin UPDATE failed'
                );
                return NextResponse.json(
                    { error: 'Error al cancelar la suscripción' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Suscripción cancelada. Tu plan seguirá activo hasta el final del período.',
        });
    } catch (error) {
        logger.error(
            {
                err: error instanceof Error ? error.message : String(error),
            },
            'cancel-subscription: unhandled error'
        );
        return NextResponse.json(
            { error: 'Error al procesar la solicitud' },
            { status: 500 }
        );
    }
}
