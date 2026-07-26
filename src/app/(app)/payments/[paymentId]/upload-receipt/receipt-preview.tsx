'use client';

import {
    CircleNotch,
    FileText,
    Upload
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';

import { Button } from '@/components/ui/button';
import type { PickedReceipt } from './use-receipt-picker';

interface ReceiptPreviewProps {
    picked: PickedReceipt;
    busy: boolean;
    onUpload: () => void;
    onChange: () => void;
}

export function ReceiptPreview({ picked, busy, onUpload, onChange }: ReceiptPreviewProps) {
    const isImage = picked.contentType.startsWith('image/');
    const isPdf = picked.contentType === 'application/pdf';

    return (
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
                <Button type="button" onClick={onUpload} disabled={busy} className="gap-2">
                    {busy ? (
                        <CircleNotch {...ICON} className="h-4 w-4 animate-spin" />
                    ) : (
                        <Upload className="h-4 w-4" />
                    )}
                    Subir comprobante
                </Button>
                <Button type="button" variant="ghost" onClick={onChange} disabled={busy}>
                    Cambiar
                </Button>
            </div>
        </div>
    );
}
