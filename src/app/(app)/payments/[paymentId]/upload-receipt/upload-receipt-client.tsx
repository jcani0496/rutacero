'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, FileText, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import {
    ALLOWED_RECEIPT_MIME,
    MAX_RECEIPT_BYTES,
    extensionFromFile,
    uploadReceipt,
} from '@/lib/storage/receipts';
import { updatePaymentReceipt } from '@/lib/actions/payment-receipts';

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

interface NativePicked {
    blob: Blob;
    contentType: string;
    extension: string;
    previewUrl: string;
    name: string;
    sizeBytes: number;
}

// Capacitor surface lives on window at runtime when running inside the
// native shell. Guarded access avoids pulling the plugin into the web bundle's
// hot path.
interface CapacitorGlobal {
    isNativePlatform?: () => boolean;
}

function isNativePlatform(): boolean {
    if (typeof window === 'undefined') return false;
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
}

export function UploadReceiptClient(props: UploadReceiptClientProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [picked, setPicked] = useState<NativePicked | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (picked?.previewUrl) URL.revokeObjectURL(picked.previewUrl);
        };
    }, [picked]);

    const native = useMemo(() => isNativePlatform(), []);

    async function handleNativeCapture() {
        setError(null);
        try {
            // Dynamic import keeps the plugin out of the web bundle.
            const { Camera, CameraResultType, CameraSource } = await import(
                '@capacitor/camera'
            );
            const photo = await Camera.getPhoto({
                source: CameraSource.Prompt,
                resultType: CameraResultType.Base64,
                quality: 80,
                allowEditing: false,
            });
            if (!photo.base64String) {
                setError('No se pudo obtener la foto.');
                return;
            }
            const mime =
                photo.format === 'png'
                    ? 'image/png'
                    : photo.format === 'heic'
                        ? 'image/heic'
                        : photo.format === 'heif'
                            ? 'image/heif'
                            : 'image/jpeg';
            const bytes = base64ToUint8Array(photo.base64String);
            // Slice the underlying buffer so the BlobPart type is a plain
            // ArrayBuffer rather than the slightly-stricter Uint8Array generic
            // that TS 5.7 complains about.
            const blob = new Blob(
                [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
                { type: mime }
            );
            const url = URL.createObjectURL(blob);
            setPicked({
                blob,
                contentType: mime,
                extension: photo.format ?? 'jpg',
                previewUrl: url,
                name: `comprobante.${photo.format ?? 'jpg'}`,
                sizeBytes: blob.size,
            });
        } catch (err: unknown) {
            // User cancellation throws — silent ignore.
            const message = err instanceof Error ? err.message : String(err);
            if (/cancel/i.test(message)) return;
            setError('No se pudo abrir la cámara.');
        }
    }

    function handleWebFile(file: File) {
        setError(null);
        if (!ALLOWED_RECEIPT_MIME.has(file.type)) {
            setError('Formato no permitido. Usa JPG, PNG, HEIC o PDF.');
            return;
        }
        if (file.size === 0) {
            setError('El archivo está vacío.');
            return;
        }
        if (file.size > MAX_RECEIPT_BYTES) {
            setError('El archivo supera los 5 MB.');
            return;
        }
        const url = URL.createObjectURL(file);
        setPicked({
            blob: file,
            contentType: file.type,
            extension: extensionFromFile(file),
            previewUrl: url,
            name: file.name,
            sizeBytes: file.size,
        });
    }

    async function handleUpload() {
        if (!picked) return;
        setBusy(true);
        setError(null);
        try {
            const supabase = createClient();
            const { path } = await uploadReceipt({
                supabase,
                userId: props.userId,
                tenantId: props.tenantId,
                paymentId: props.paymentId,
                file: picked.blob,
                contentType: picked.contentType,
                extension: picked.extension,
            });
            const result = await updatePaymentReceipt({
                paymentId: props.paymentId,
                receiptPath: path,
            });
            if (!result.success) {
                setError(result.error ?? 'Error guardando el comprobante.');
                return;
            }
            router.push('/payments');
            router.refresh();
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Error al subir el comprobante.';
            setError(message);
        } finally {
            setBusy(false);
        }
    }

    const isImage = picked?.contentType.startsWith('image/');
    const isPdf = picked?.contentType === 'application/pdf';

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

                {error && (
                    <div
                        role="alert"
                        className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                    >
                        {error}
                    </div>
                )}

                {!picked && (
                    <div className="flex flex-col gap-2">
                        {native ? (
                            <Button
                                type="button"
                                onClick={handleNativeCapture}
                                className="gap-2"
                            >
                                <Camera className="h-4 w-4" />
                                Tomar foto
                            </Button>
                        ) : (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleWebFile(f);
                                    }}
                                />
                                <Button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
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

                {picked && (
                    <div className="flex flex-col gap-3">
                        {isImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={picked.previewUrl}
                                alt="Vista previa del comprobante"
                                className="max-h-72 w-full rounded-md border object-contain"
                            />
                        )}
                        {isPdf && (
                            <div className="flex items-center gap-3 rounded-md border p-3 text-sm">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">{picked.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {(picked.sizeBytes / 1024).toFixed(0)} KB
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={handleUpload}
                                disabled={busy}
                                className="gap-2"
                            >
                                {busy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="h-4 w-4" />
                                )}
                                Subir comprobante
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setPicked(null)}
                                disabled={busy}
                            >
                                Cambiar
                            </Button>
                        </div>
                    </div>
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

function base64ToUint8Array(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
