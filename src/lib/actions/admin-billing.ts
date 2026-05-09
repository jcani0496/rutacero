'use server';

import { z } from 'zod';
import { requirePermission, logAdminAction } from '@/lib/actions/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { getProVariant } from '@/lib/billing/plans';
import { billingIntervalForVariant } from '@/lib/billing/billing-interval';
import { recordMarketingEventWithAdmin } from '@/lib/funnel/events';
import { createMarketingContext } from '@/lib/funnel/attribution';
import { logger, logPaymentEvent } from '@/lib/logger';

// Manual grants exclude PRO_PASS_90D (Android-only). Mirrors recurrente checkout
// validation so the admin path cannot accidentally activate a Google Play SKU.
const ManualVariantCode = z.enum(['PRO_MONTHLY', 'PRO_QUARTERLY', 'PRO_ANNUAL']);

const Input = z.object({
    tenantId: z.string().uuid(),
    variantCode: ManualVariantCode,
    bankReference: z.string().min(3).max(120),
    notes: z.string().max(2000).nullable(),
});

export type AdminGrantManualSubscriptionInput = z.input<typeof Input>;

/**
 * Server action: admin grants a PRO subscription manually after confirming a
 * bank-transfer/deposit. Inserts an audit row in `manual_payment_grants`, then
 * upserts the matching `subscriptions` row with `payment_method='manual_transfer'`.
 *
 * Permission: `subscriptions:update` (closest existing permission for billing
 * mutations — there is no dedicated `billing:write` in ROLE_PERMISSIONS).
 */
export async function adminGrantManualSubscription(raw: AdminGrantManualSubscriptionInput) {
    const session = await requirePermission('subscriptions:update');
    const data = Input.parse(raw);
    const variant = getProVariant(data.variantCode);

    const admin = createAdminClient();

    // Resolve the tenant owner for the subscription row (subscriptions.user_id is NOT NULL).
    const { data: tenantRow, error: tenantError } = await admin
        .from('tenants')
        .select('created_by_user_id')
        .eq('id', data.tenantId)
        .single();

    if (tenantError || !tenantRow?.created_by_user_id) {
        throw new Error('Tenant no encontrado o sin propietario asociado.');
    }

    const ownerUserId = tenantRow.created_by_user_id;
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + variant.durationDays * 24 * 60 * 60 * 1000);
    const expiresAtIso = expiresAt.toISOString();

    // 1. Audit row FIRST so a partial failure mid-write still leaves an investigation trail.
    const { error: grantError } = await admin
        .from('manual_payment_grants')
        .insert({
            tenant_id: data.tenantId,
            granted_by_admin_id: session.adminId,
            variant_code: variant.code,
            price_amount_q: variant.priceQ,
            duration_days: variant.durationDays,
            bank_reference: data.bankReference,
            expires_at: expiresAtIso,
            notes: data.notes,
        });

    if (grantError) {
        logger.error(
            { code: grantError.code, details: grantError.details },
            'manual_payment_grants insert failed'
        );
        throw new Error('Error al registrar la concesión manual. Intenta nuevamente.');
    }

    // 2. Activate the subscription. For manual grants, renew_at is reused as the expiry date (no auto-renewal).
    const { error: subError } = await admin
        .from('subscriptions')
        .upsert(
            {
                tenant_id: data.tenantId,
                user_id: ownerUserId,
                purchaser_user_id: ownerUserId,
                plan_code: 'PRO',
                status: 'ACTIVE',
                billing_interval: billingIntervalForVariant(variant.code),
                price_amount_q: variant.priceQ,
                provider: 'manual_transfer',
                payment_method: 'manual_transfer',
                start_at: nowIso,
                // For manual grants, renew_at is reused as the expiry date (no auto-renewal).
                renew_at: expiresAtIso,
            },
            { onConflict: 'tenant_id' }
        );

    if (subError) {
        logger.error(
            { code: subError.code, details: subError.details },
            'subscriptions upsert failed; attempting grant rollback'
        );
        // Best-effort compensation: delete the just-inserted grant row to avoid an orphan
        // audit entry. The tuple (tenant_id, granted_by_admin_id, expires_at) uniquely
        // identifies this insert because expires_at is millisecond-precise from Date.now().
        const { error: rollbackError } = await admin
            .from('manual_payment_grants')
            .delete()
            .eq('tenant_id', data.tenantId)
            .eq('granted_by_admin_id', session.adminId)
            .eq('expires_at', expiresAtIso);
        if (rollbackError) {
            logger.error(
                { code: rollbackError.code },
                'manual_payment_grants rollback also failed; orphan row exists'
            );
        }
        throw new Error('Error al activar la suscripción. Intenta nuevamente o contacta soporte.');
    }

    // 3. Audit log row in `audit_logs` for cross-admin observability (mirrors other admin actions).
    // Best-effort: failures inside logAdminAction are logged there and never thrown.
    await logAdminAction(
        session.adminId,
        'subscription.manual_grant',
        'subscriptions',
        data.tenantId,
        {
            variantCode: variant.code,
            priceQ: variant.priceQ,
            bankReference: data.bankReference,
            durationDays: variant.durationDays,
        }
    );

    // 4. Marketing funnel — manual grants are valid activations and feed conversion metrics.
    await recordMarketingEventWithAdmin(
        admin,
        {
            eventName: 'subscription_activated',
            tenantId: data.tenantId,
            userId: ownerUserId,
            metadata: {
                source: 'manual_transfer',
                variantCode: variant.code,
                bankReference: data.bankReference,
                grantedByAdminId: session.adminId,
            },
        },
        createMarketingContext(null, {})
    );

    // 5. Structured payment log — `subscription_created` is the closest event in the
    // restricted union accepted by logPaymentEvent.
    logPaymentEvent({
        event: 'subscription_created',
        userId: ownerUserId,
        amount: variant.priceQ,
        currency: 'GTQ',
        provider: 'manual_transfer',
        externalId: data.bankReference,
    });

    return { ok: true as const, expiresAt: expiresAtIso };
}
