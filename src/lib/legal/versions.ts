/**
 * Versions of legal documents currently active in production.
 * Bump the corresponding constant whenever the document changes materially
 * (a wording fix without semantic change does not require a bump).
 *
 * On bump, users will be required to re-accept the next time they visit
 * the app (mechanism is a follow-up; for now the bump only affects the
 * version recorded in user_consent_log for new signups).
 */
export const TOS_VERSION = '2026-05-16';
export const PRIVACY_VERSION = '2026-05-16';
export const FINANCIAL_DISCLAIMER_VERSION = '2026-05-16';

export type LegalDocumentType = 'tos' | 'privacy' | 'financial_disclaimer' | 'cookies';
