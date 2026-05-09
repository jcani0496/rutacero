'use server';

import { z } from 'zod';
import { requirePermission } from '@/lib/actions/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { getProVariant, type ProVariantCode } from '@/lib/billing/plans';
import { recordMarketingEventWithAdmin } from '@/lib/funnel/events';
import { createMarketingContext } from '@/lib/funnel/attribution';
import { logPaymentEvent } from '@/lib/logger';

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

type ManualBillingInterval = 'monthly' | 'quarterly' | 'yearly';

function billingIntervalForVariant(code: ProVariantCode): ManualBillingInterval {
    switch (code) {
        case 'PRO_MONTHLY':
            return 'monthly';
        case 'PRO_QUARTERLY':
            return 'quarterly';
        case 'PRO_ANNUAL':
            return 'yearly';
        case 'PRO_PASS_90D':
            // Defensive — Input enum already excludes this, so this branch is unreachable.
            throw new Error('PRO_PASS_90D no es válido para activaciones manuales (Android-only).');
    }
}

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
        throw grantError;
    }

    // 2. Activate the subscription. `renew_at = expires_at` for manual grants — no auto-renew.
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
                payment_method: 'manual_transfer',
                renew_at: expiresAtIso,
            },
            { onConflict: 'tenant_id' }
        );

    if (subError) {
        throw subError;
    }

    // 3. Marketing funnel — manual grants are valid activations and feed conversion metrics.
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

    // 4. Structured payment log — `subscription_created` is the closest event in the
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
