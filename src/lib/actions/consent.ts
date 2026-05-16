'use server';

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import {
    TOS_VERSION,
    PRIVACY_VERSION,
    FINANCIAL_DISCLAIMER_VERSION,
    type LegalDocumentType,
} from '@/lib/legal/versions';

interface RecordConsentParams {
    userId: string;
    documentType: LegalDocumentType;
    version: string;
}

export async function recordUserConsent(params: RecordConsentParams) {
    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? hdrs.get('x-real-ip')
        ?? null;
    const ua = hdrs.get('user-agent') ?? null;

    const admin = createAdminClient();
    const { error } = await admin
        .from('user_consent_log')
        .insert({
            user_id: params.userId,
            document_type: params.documentType,
            version: params.version,
            ip_address: ip,
            user_agent: ua,
        });
    if (error) {
        logger.error(
            { err: error, userId: params.userId, documentType: params.documentType },
            '[consent] insert failed',
        );
        // Do NOT throw — we don't want signup to fail because consent logging
        // failed. But this is critical to monitor in Sentry.
    }
}

/**
 * Helper to record the bundle accepted at signup (ToS + Privacy + Disclaimer)
 * in a single call. Inserts three rows.
 */
export async function recordSignupConsent(userId: string) {
    await Promise.allSettled([
        recordUserConsent({ userId, documentType: 'tos', version: TOS_VERSION }),
        recordUserConsent({ userId, documentType: 'privacy', version: PRIVACY_VERSION }),
        recordUserConsent({
            userId,
            documentType: 'financial_disclaimer',
            version: FINANCIAL_DISCLAIMER_VERSION,
        }),
    ]);
}
