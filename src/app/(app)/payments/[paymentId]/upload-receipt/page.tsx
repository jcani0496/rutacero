import { notFound, redirect } from 'next/navigation';
import { requireUserTenant } from '@/lib/tenant/server';
import { UploadReceiptClient } from './upload-receipt-client';

interface PageProps {
    params: Promise<{ paymentId: string }>;
}

export const metadata = {
    title: 'Subir comprobante | RutaCero',
    description: 'Subí una foto o PDF del comprobante de tu pago.',
};

export default async function UploadReceiptPage({ params }: PageProps) {
    const { paymentId } = await params;

    let supabase, user, tenantId;
    try {
        ({ supabase, user, tenantId } = await requireUserTenant());
    } catch {
        redirect('/login');
    }

    const { data: payment } = await supabase
        .from('payments')
        .select('id, receipt_url, amount, currency, payment_date, debt:debts!inner(creditor)')
        .eq('id', paymentId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!payment) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-xl mx-auto">
            <UploadReceiptClient
                paymentId={payment.id}
                currentReceiptPath={payment.receipt_url ?? null}
                userId={user.id}
                tenantId={tenantId}
                debtName={
                    Array.isArray(payment.debt)
                        ? (payment.debt[0]?.creditor ?? 'Pago')
                        : ((payment.debt as { creditor?: string } | null)?.creditor ?? 'Pago')
                }
                amount={Number(payment.amount)}
                currency={payment.currency}
                paymentDate={payment.payment_date}
            />
        </div>
    );
}
