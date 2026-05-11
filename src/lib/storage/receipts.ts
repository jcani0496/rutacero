// Receipt upload helper. Validates type + size before upload and returns
// the bucket-relative storage path that should be persisted on
// payments.receipt_url. Signed URLs for display are produced on demand by
// getReceiptSignedUrl — they expire and must not be stored.

import { type SupabaseClient } from '@supabase/supabase-js';
import { type Database } from '@/types/supabase';

export const ALLOWED_RECEIPT_MIME = new Set<string>([
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'application/pdf',
]);

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

export const RECEIPT_BUCKET = 'payment-receipts';

export interface UploadReceiptParams {
    supabase: SupabaseClient<Database>;
    userId: string;
    tenantId: string;
    paymentId: string;
    file: Blob;
    contentType: string;
    extension: string;
}

export interface UploadReceiptResult {
    path: string;
}

export async function uploadReceipt(
    params: UploadReceiptParams
): Promise<UploadReceiptResult> {
    if (!ALLOWED_RECEIPT_MIME.has(params.contentType)) {
        throw new Error(`Tipo de archivo no permitido: ${params.contentType}`);
    }
    if (params.file.size === 0) {
        throw new Error('El archivo está vacío.');
    }
    if (params.file.size > MAX_RECEIPT_BYTES) {
        throw new Error('El archivo supera los 5 MB.');
    }

    // Strip any character that isn't alphanumeric to defeat path-traversal /
    // injection attempts like "JPG;DROP TABLE" or "../../etc/passwd". The
    // server only uses the extension for the object key — there is no shell
    // interpolation — but defense in depth is cheap.
    const safeExt = params.extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    // Reject if the extension is missing or sanitized to nothing. With
    // extensionFromFile() now returning '' on unknown MIMEs (instead of the
    // generic 'bin'), an unknown file type fails loudly here rather than
    // silently being stored as `<paymentId>.bin`.
    if (!safeExt) {
        throw new Error('La extensión del archivo es inválida.');
    }

    const path = `${params.userId}/${params.tenantId}/${params.paymentId}.${safeExt}`;

    const { error } = await params.supabase.storage
        .from(RECEIPT_BUCKET)
        .upload(path, params.file, {
            contentType: params.contentType,
            upsert: true,
        });

    if (error) {
        throw error;
    }

    return { path };
}

export async function getReceiptSignedUrl(
    supabase: SupabaseClient<Database>,
    path: string,
    expiresSeconds: number = 60 * 10
): Promise<string> {
    const { data, error } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(path, expiresSeconds);

    if (error || !data?.signedUrl) {
        throw error ?? new Error('No se pudo firmar la URL');
    }
    return data.signedUrl;
}

// Helper: derive a safe extension from a File object (mostly for the web
// fallback where contentType + filename are both available).
export function extensionFromFile(file: File): string {
    const fromName = file.name.split('.').pop() ?? '';
    if (fromName && fromName.length <= 5) return fromName;
    // Fallback: derive from MIME.
    const mime = file.type;
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/heic') return 'heic';
    if (mime === 'image/heif') return 'heif';
    if (mime === 'application/pdf') return 'pdf';
    // Unknown MIME — return empty so uploadReceipt() rejects rather than
    // storing the object under a generic `.bin` key.
    return '';
}
