'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ALLOWED_RECEIPT_MIME,
    MAX_RECEIPT_BYTES,
    extensionFromFile,
} from '@/lib/storage/receipts';
import { base64ToBlob } from '@/lib/storage/base64-to-blob';

export interface PickedReceipt {
    blob: Blob;
    contentType: string;
    extension: string;
    previewUrl: string;
    name: string;
    sizeBytes: number;
}

// Capacitor surface lives on window at runtime when running inside the
// native shell. Guarded access avoids pulling the plugin into the web
// bundle's hot path.
interface CapacitorGlobal {
    isNativePlatform?: () => boolean;
}

function isNativePlatform(): boolean {
    if (typeof window === 'undefined') return false;
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
}

export interface UseReceiptPicker {
    picked: PickedReceipt | null;
    setPicked: (p: PickedReceipt | null) => void;
    error: string | null;
    setError: (msg: string | null) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    native: boolean;
    handleNativeCapture: () => Promise<void>;
    handleWebFile: (file: File) => void;
}

export function useReceiptPicker(): UseReceiptPicker {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [picked, setPicked] = useState<PickedReceipt | null>(null);
    const [error, setError] = useState<string | null>(null);
    const native = useMemo(() => isNativePlatform(), []);

    useEffect(() => {
        return () => {
            if (picked?.previewUrl) URL.revokeObjectURL(picked.previewUrl);
        };
    }, [picked]);

    async function handleNativeCapture(): Promise<void> {
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
            // Use the browser's native data-URL fetch path instead of a
            // synchronous atob + charCodeAt loop. For a 5MB photo this avoids
            // ~6.7M iterations on the main thread that visibly stutter the UI
            // on low-end Android devices.
            const blob = await base64ToBlob(photo.base64String, mime);
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

    function handleWebFile(file: File): void {
        setError(null);
        if (!ALLOWED_RECEIPT_MIME.has(file.type)) {
            setError('Formato no permitido. Usá JPG, PNG, HEIC o PDF.');
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

    return {
        picked,
        setPicked,
        error,
        setError,
        fileInputRef,
        native,
        handleNativeCapture,
        handleWebFile,
    };
}

