import { notFound, redirect } from 'next/navigation';
import { getPaymentForReceiptUpload, requireUserTenant } from '@/lib/tenant/server';
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

    let user, tenantId;
    try {
        ({ user, tenantId } = await requireUserTenant());
    } catch {
        redirect('/login');
    }

    const payment = await getPaymentForReceiptUpload(paymentId, tenantId, user.id);

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
                debtName={payment.debt.creditor ?? 'Pago'}
                amount={Number(payment.amount)}
                currency={payment.currency}
                paymentDate={payment.payment_date}
            />
        </div>
    );
}
