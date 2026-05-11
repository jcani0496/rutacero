'use server';

import { z } from 'zod';
import { requireUserTenant } from '@/lib/tenant/server';
import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { sendAccountDeletionConfirmation } from '@/lib/emails/send-account-deletion-confirmation';

const RequestInput = z.object({
    reason: z.string().max(1000).nullable().optional(),
});

const GRACE_PERIOD_DAYS = 7;

export async function requestAccountDeletion(
    raw: z.infer<typeof RequestInput>
): Promise<{ ok: true; executesAt: string } | { ok: false; error: string }> {
    const { user } = await requireUserTenant();
    const data = RequestInput.parse(raw);

    const admin = createAdminClient();

    // Idempotent: if the user already has an active request, return it.
    const { data: existing } = await admin
        .from('account_deletion_requests')
        .select('id, executes_at')
        .eq('user_id', user.id)
        .is('canceled_at', null)
        .is('executed_at', null)
        .maybeSingle();

    if (existing) {
        return { ok: true, executesAt: existing.executes_at };
    }

    const executesAt = new Date(
        Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );

    const { error: insertError } = await admin
        .from('account_deletion_requests')
        .insert({
            user_id: user.id,
            reason: data.reason ?? null,
            executes_at: executesAt.toISOString(),
        });

    if (insertError) {
        logger.error(
            { err: insertError.message, code: insertError.code },
            'requestAccountDeletion: insert failed'
        );
        return { ok: false, error: 'No se pudo registrar la solicitud. Intenta mas tarde.' };
    }

    // Best-effort confirmation email — failure does not invalidate the request.
    if (user.email) {
        try {
            await sendAccountDeletionConfirmation({
                to: user.email,
                executesAt,
                gracePeriodDays: GRACE_PERIOD_DAYS,
            });
        } catch (e) {
            logger.warn(
                { err: e instanceof Error ? e.message : String(e) },
                'requestAccountDeletion: email failed (request still recorded)'
            );
        }
    }

    logger.info(
        { userId: user.id, executesAt: executesAt.toISOString() },
        'account deletion requested'
    );

    return { ok: true, executesAt: executesAt.toISOString() };
}

export async function cancelAccountDeletion(): Promise<
    { ok: true } | { ok: false; error: string }
> {
    const { user } = await requireUserTenant();
    const admin = createAdminClient();

    // Atomic UPDATE-with-RETURNING. If the cron has already claimed the row
    // (set executed_at), the WHERE filter excludes it and `canceled` is null.
    // The user's "cancel" intent is too late in that case — same outcome as
    // there never having been an active request.
    const { data: canceled, error: cancelError } = await admin
        .from('account_deletion_requests')
        .update({ canceled_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('canceled_at', null)
        .is('executed_at', null)
        .select('id')
        .maybeSingle();

    if (cancelError) {
        logger.error(
            { err: cancelError.message, code: cancelError.code },
            'cancelAccountDeletion: update failed'
        );
        return { ok: false, error: 'No se pudo cancelar la solicitud.' };
    }

    if (!canceled) {
        return { ok: false, error: 'No hay solicitud activa que cancelar.' };
    }

    logger.info({ userId: user.id }, 'account deletion canceled');
    return { ok: true };
}
