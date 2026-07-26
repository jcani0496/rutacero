'use server';

import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { accountDeletionRequests } from '@/db/schema';
import { requireUserTenant } from '@/lib/tenant/server';
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

    const db = getDb();

    // Idempotent: if the user already has an active request, return it.
    const [existing] = await db
        .select({
            id: accountDeletionRequests.id,
            executesAt: accountDeletionRequests.executesAt,
        })
        .from(accountDeletionRequests)
        .where(
            and(
                eq(accountDeletionRequests.userId, user.id),
                isNull(accountDeletionRequests.canceledAt),
                isNull(accountDeletionRequests.executedAt)
            )
        )
        .limit(1);

    if (existing) {
        return { ok: true, executesAt: existing.executesAt.toISOString() };
    }

    const executesAt = new Date(
        Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    );

    try {
        await db.insert(accountDeletionRequests).values({
            userId: user.id,
            reason: data.reason ?? null,
            executesAt,
        });
    } catch (insertError) {
        logger.error(
            { err: insertError instanceof Error ? insertError.message : String(insertError) },
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
    const db = getDb();

    // Atomic UPDATE-with-RETURNING. If the cron has already claimed the row
    // (set executed_at), the WHERE filter excludes it and nothing is returned.
    // The user's "cancel" intent is too late in that case — same outcome as
    // there never having been an active request.
    let canceled: { id: string }[];
    try {
        canceled = await db
            .update(accountDeletionRequests)
            .set({ canceledAt: new Date() })
            .where(
                and(
                    eq(accountDeletionRequests.userId, user.id),
                    isNull(accountDeletionRequests.canceledAt),
                    isNull(accountDeletionRequests.executedAt)
                )
            )
            .returning({ id: accountDeletionRequests.id });
    } catch (cancelError) {
        logger.error(
            { err: cancelError instanceof Error ? cancelError.message : String(cancelError) },
            'cancelAccountDeletion: update failed'
        );
        return { ok: false, error: 'No se pudo cancelar la solicitud.' };
    }

    if (canceled.length === 0) {
        return { ok: false, error: 'No hay solicitud activa que cancelar.' };
    }

    logger.info({ userId: user.id }, 'account deletion canceled');
    return { ok: true };
}
