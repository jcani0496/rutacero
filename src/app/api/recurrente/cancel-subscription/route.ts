import { NextRequest, NextResponse } from 'next/server';
import { requireUserTenant } from '@/lib/tenant/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getRecurrenteClient } from '@/lib/recurrente/client';
import {
    applyRateLimit,
    getClientIdentifier,
    rateLimitExceededResponse,
} from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        // Apply rate limiting
        const identifier = getClientIdentifier(request);
        const { success } = await applyRateLimit(identifier, 'api');

        if (!success) {
            return rateLimitExceededResponse();
        }

        const { supabase, tenantId } = await requireUserTenant();

        // Get user's subscription
        const { data: subscription, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (subError || !subscription) {
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
                console.error('Error canceling in Recurrente:', recurrenteError);
                // Continue anyway - we'll update locally
            }
        }

        // Update local subscription.
        // Subscriptions UPDATE requires service_role per migration 024 RLS policy
        // ("Service role can write subscriptions"). Authorization is enforced by
        // requireUserTenant above + the tenant_id filter below — the tenantId comes
        // from the authenticated session, never from the request body.
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
            console.error('Error updating subscription:', updateError);
            return NextResponse.json(
                { error: 'Error al cancelar la suscripción' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Suscripción cancelada. Tu plan seguirá activo hasta el final del período.',
        });
    } catch (error) {
        console.error('Error in cancel-subscription:', error);
        return NextResponse.json(
            { error: 'Error al procesar la solicitud' },
            { status: 500 }
        );
    }
}
