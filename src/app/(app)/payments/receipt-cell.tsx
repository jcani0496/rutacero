'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getReceiptUrlAction } from '@/lib/actions/payment-receipts';

interface ReceiptCellProps {
    paymentId: string;
    receiptPath: string | null;
}

export function ReceiptCell({ paymentId, receiptPath }: ReceiptCellProps) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!receiptPath) {
        return (
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                <Link
                    href={`/payments/${paymentId}/upload-receipt`}
                    aria-label="Subir comprobante"
                >
                    <Upload className="h-3.5 w-3.5" />
                    Subir
                </Link>
            </Button>
        );
    }

    const isPdf = receiptPath.toLowerCase().endsWith('.pdf');
    const Icon = isPdf ? FileText : ImageIcon;

    async function openReceipt() {
        setBusy(true);
        setError(null);
        try {
            const result = await getReceiptUrlAction(paymentId);
            if (!result.success) {
                setError(result.error);
                return;
            }
            window.open(result.url, '_blank', 'noopener,noreferrer');
        } catch {
            setError('No se pudo abrir el comprobante.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex flex-col gap-1">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                onClick={openReceipt}
                disabled={busy}
                aria-label="Ver comprobante"
            >
                {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Icon className="h-3.5 w-3.5" />
                )}
                Ver
            </Button>
            {error && (
                <span role="alert" className="text-[10px] text-destructive">
                    {error}
                </span>
            )}
        </div>
    );
}
