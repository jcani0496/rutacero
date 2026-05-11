'use server';

import { revalidatePath } from 'next/cache';
import { requireUserTenant } from '@/lib/tenant/server';
import { getReceiptSignedUrl } from '@/lib/storage/receipts';

interface UpdatePaymentReceiptInput {
    paymentId: string;
    receiptPath: string;
}

interface ActionResult {
    success: boolean;
    error?: string;
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

    try {
        const url = await getReceiptSignedUrl(supabase, payment.receipt_url);
        return { success: true, url };
    } catch {
        return { success: false, error: 'No se pudo generar la URL firmada' };
    }
}
