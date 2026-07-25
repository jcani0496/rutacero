'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { uploadReceipt } from '@/lib/storage/receipts';
import {
    updatePaymentReceipt,
    uploadReceiptFileAction,
} from '@/lib/actions/payment-receipts';
import { useReceiptPicker } from './use-receipt-picker';
import { ReceiptPreview } from './receipt-preview';

const useRailwayStorage =
    (process.env.NEXT_PUBLIC_STORAGE_PROVIDER || '').toLowerCase() ===
    'railway';

interface UploadReceiptClientProps {
    paymentId: string;
    currentReceiptPath: string | null;
    userId: string;
    tenantId: string;
    debtName: string;
    amount: number;
    currency: string;
    paymentDate: string;
}

export function UploadReceiptClient(props: UploadReceiptClientProps) {
    const router = useRouter();
    const picker = useReceiptPicker();
    const [busy, setBusy] = useState(false);

    async function handleUpload(): Promise<void> {
        if (!picker.picked) return;
        setBusy(true);
        picker.setError(null);
        try {
            // Railway Buckets credentials are server-only — upload via action.
            // Supabase Storage keeps the existing client direct-upload path (CI).
            if (useRailwayStorage) {
                const formData = new FormData();
                formData.set('paymentId', props.paymentId);
                formData.set('contentType', picker.picked.contentType);
                formData.set('extension', picker.picked.extension);
                formData.set(
                    'file',
                    picker.picked.blob,
                    `receipt.${picker.picked.extension}`
                );
                const result = await uploadReceiptFileAction(formData);
                if (!result.success) {
                    picker.setError(
                        result.error ?? 'Error guardando el comprobante.'
                    );
                    return;
                }
            } else {
                const supabase = createClient();
                const { path } = await uploadReceipt({
                    supabase,
                    userId: props.userId,
                    tenantId: props.tenantId,
                    paymentId: props.paymentId,
                    file: picker.picked.blob,
                    contentType: picker.picked.contentType,
                    extension: picker.picked.extension,
                });
                const result = await updatePaymentReceipt({
                    paymentId: props.paymentId,
                    receiptPath: path,
                });
                if (!result.success) {
                    picker.setError(
                        result.error ?? 'Error guardando el comprobante.'
                    );
                    return;
                }
            }
            // The server action calls revalidatePath('/payments'), which
            // invalidates the cached server component on the next navigation;
            // router.push then re-fetches it. An additional router.refresh()
            // would just trigger a redundant round trip.
            router.push('/payments');
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Error al subir el comprobante.';
            picker.setError(message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Subir comprobante</CardTitle>
                <p className="text-sm text-muted-foreground">
                    {props.debtName} —{' '}
                    {new Intl.NumberFormat('es-GT', {
                        style: 'currency',
                        currency: props.currency || 'GTQ',
                    }).format(props.amount)}
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {props.currentReceiptPath && (
                    <p className="text-xs text-muted-foreground">
                        Ya existe un comprobante. Al subir uno nuevo reemplazará el anterior.
                    </p>
                )}

                {picker.error && (
                    <div
                        role="alert"
                        className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                    >
                        {picker.error}
                    </div>
                )}

                {!picker.picked && (
                    <div className="flex flex-col gap-2">
                        {picker.native ? (
                            <Button
                                type="button"
                                onClick={picker.handleNativeCapture}
                                className="gap-2"
                            >
                                <Camera className="h-4 w-4" />
                                Tomar foto
                            </Button>
                        ) : (
                            <>
                                <input
                                    ref={picker.fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
                                    // No `capture` attribute on purpose: iOS
                                    // Safari treats `capture` as a hard
                                    // requirement and blocks the gallery /
                                    // Files picker. Without it Android Chrome
                                    // still offers the camera as one option
                                    // alongside the gallery.
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) picker.handleWebFile(f);
                                    }}
                                />
                                <Button
                                    type="button"
                                    onClick={() => picker.fileInputRef.current?.click()}
                                    className="gap-2"
                                >
                                    <Camera className="h-4 w-4" />
                                    Seleccionar o tomar foto
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Acepta JPG, PNG, HEIC o PDF. Máximo 5 MB.
                                </p>
                            </>
                        )}
                    </div>
                )}

                {picker.picked && (
                    <ReceiptPreview
                        picked={picker.picked}
                        busy={busy}
                        onUpload={handleUpload}
                        onChange={() => picker.setPicked(null)}
                    />
                )}

                <Link
                    href="/payments"
                    className="text-sm text-muted-foreground underline"
                >
                    Volver a pagos
                </Link>
            </CardContent>
        </Card>
    );
}
