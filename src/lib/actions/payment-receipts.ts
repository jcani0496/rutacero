'use server';

import { revalidatePath } from 'next/cache';
import { requireUserTenant } from '@/lib/tenant/server';
import {
    getReceiptSignedUrl,
    uploadReceipt,
} from '@/lib/storage/receipts';

interface UpdatePaymentReceiptInput {
    paymentId: string;
    receiptPath: string;
}

interface ActionResult {
    success: boolean;
    error?: string;
    path?: string;
}

/**
 * Persist a receipt path on a payment after the client has uploaded the file
 * to Storage. Verifies tenant ownership before writing.
 */
export async function updatePaymentReceipt(
    input: UpdatePaymentReceiptInput
): Promise<ActionResult> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return { success: false, error: 'No autenticado' };
    }

    if (!input.paymentId || !input.receiptPath) {
        return { success: false, error: 'Datos inválidos' };
    }

    // Verify the payment belongs to this tenant + user. We check both so a
    // tenant-member could not overwrite another member's receipt path.
    const { data: payment, error: fetchError } = await supabase
        .from('payments')
        .select('id')
        .eq('id', input.paymentId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (fetchError) {
        return { success: false, error: 'Error verificando el pago' };
    }
    if (!payment) {
        return { success: false, error: 'Pago no encontrado' };
    }

    // Defense in depth: ensure the receipt path belongs to this user/tenant/
    // payment tuple. Without this guard, a tenant member could overwrite the
    // receipt_url column with a path pointing to a foreign user's storage
    // object — granting the foreign user's data a stable, signable handle.
    const expectedPrefix = `${user.id}/${tenantId}/${input.paymentId}.`;
    if (!input.receiptPath.startsWith(expectedPrefix)) {
        return { success: false, error: 'Ruta de comprobante inválida' };
    }

    const { error: updateError } = await supabase
        .from('payments')
        .update({
            receipt_url: input.receiptPath,
            receipt_uploaded_at: new Date().toISOString(),
        })
        .eq('id', input.paymentId)
        .eq('tenant_id', tenantId);

    if (updateError) {
        return { success: false, error: 'Error guardando el comprobante' };
    }

    revalidatePath('/payments');
    return { success: true };
}

/**
 * Server-side receipt upload for STORAGE_PROVIDER=railway (S3 credentials
 * must never reach the browser). Also usable for supabase when the client
 * prefers a single code path. Validates ownership, uploads the object, then
 * persists payments.receipt_url.
 */
export async function uploadReceiptFileAction(
    formData: FormData
): Promise<ActionResult> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return { success: false, error: 'No autenticado' };
    }

    const paymentId = String(formData.get('paymentId') ?? '');
    const contentType = String(formData.get('contentType') ?? '');
    const extension = String(formData.get('extension') ?? '');
    const file = formData.get('file');

    if (!paymentId || !contentType || !extension || !(file instanceof Blob)) {
        return { success: false, error: 'Datos inválidos' };
    }

    const { data: payment, error: fetchError } = await supabase
        .from('payments')
        .select('id')
        .eq('id', paymentId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (fetchError) {
        return { success: false, error: 'Error verificando el pago' };
    }
    if (!payment) {
        return { success: false, error: 'Pago no encontrado' };
    }

    let path: string;
    try {
        ({ path } = await uploadReceipt({
            supabase,
            userId: user.id,
            tenantId,
            paymentId,
            file,
            contentType,
            extension,
        }));
    } catch (err: unknown) {
        return {
            success: false,
            error:
                err instanceof Error
                    ? err.message
                    : 'Error al subir el comprobante.',
        };
    }

    return updatePaymentReceipt({ paymentId, receiptPath: path });
}

/**
 * Returns a short-lived signed URL for the receipt belonging to a payment.
 * Used by the payment history client to render thumbnails / open links on
 * demand without leaking signed URLs through the initial HTML.
 */
export async function getReceiptUrlAction(
    paymentId: string
): Promise<{ success: true; url: string } | { success: false; error: string }> {
    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        return { success: false, error: 'No autenticado' };
    }

    const { data: payment, error } = await supabase
        .from('payments')
        .select('receipt_url')
        .eq('id', paymentId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        return { success: false, error: 'Error consultando el pago' };
    }
    if (!payment?.receipt_url) {
        return { success: false, error: 'No hay comprobante para este pago' };
    }

    // Sanity-check the stored path before signing it. Payment ownership was
    // already verified above, but a stored receipt_url that does not start
    // with the authenticated user's id signals data corruption (or a bypass
    // of the write-side guard) — refuse to mint a signed URL for it.
    if (!payment.receipt_url.startsWith(`${user.id}/`)) {
        return { success: false, error: 'Ruta de comprobante inesperada' };
    }

    try {
        const url = await getReceiptSignedUrl(supabase, payment.receipt_url);
        return { success: true, url };
    } catch {
        return { success: false, error: 'No se pudo generar la URL firmada' };
    }
}
