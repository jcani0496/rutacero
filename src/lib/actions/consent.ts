'use server';

import { headers } from 'next/headers';
import { getDb } from '@/db/client';
import { userConsentLog } from '@/db/schema';
import { getAppUser } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import {
    TOS_VERSION,
    PRIVACY_VERSION,
    FINANCIAL_DISCLAIMER_VERSION,
    type LegalDocumentType,
} from '@/lib/legal/versions';

/**
 * Internal insert helper. NOT exported — under `'use server'` every export
 * becomes a public server action, and this one writes with the service-role
 * client (bypasses RLS). Audit 2026-07 (P0): the previous exported version
 * accepted a caller-supplied userId, letting any visitor forge consent rows
 * for any user without authentication.
 */
async function insertConsentRow(
    userId: string,
    documentType: LegalDocumentType,
    version: string,
): Promise<void> {
    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? hdrs.get('x-real-ip')
        ?? null;
    const ua = hdrs.get('user-agent') ?? null;

    try {
        await getDb().insert(userConsentLog).values({
            userId,
            documentType,
            version,
            ipAddress: ip,
            userAgent: ua,
        });
    } catch (err) {
        logger.error(
            { err, userId, documentType },
            '[consent] insert failed',
        );
        // Do NOT throw — we don't want signup to fail because consent logging
        // failed. But this is critical to monitor in Sentry.
    }
}

/**
 * Records the bundle accepted at signup (ToS + Privacy + Disclaimer).
 *
 * The user id comes EXCLUSIVELY from the authenticated session — never from
 * the caller. Without a valid session this is a no-op (logged): consent
 * evidence written on behalf of someone else is worthless as evidence.
 */
export async function recordSignupConsent(): Promise<void> {
    const user = await getAppUser();

    if (!user) {
        logger.warn(
            { err: 'no session' },
            '[consent] recordSignupConsent called without an authenticated session — ignored',
        );
        return;
    }

    await Promise.allSettled([
        insertConsentRow(user.id, 'tos', TOS_VERSION),
        insertConsentRow(user.id, 'privacy', PRIVACY_VERSION),
        insertConsentRow(user.id, 'financial_disclaimer', FINANCIAL_DISCLAIMER_VERSION),
    ]);
}
