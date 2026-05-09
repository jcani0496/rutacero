'use client';

import { useState, useTransition } from 'react';
import { adminGrantManualSubscription } from '@/lib/actions/admin-billing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

type ManualVariantCode = 'PRO_MONTHLY' | 'PRO_QUARTERLY' | 'PRO_ANNUAL';

const VARIANT_OPTIONS: Array<{ value: ManualVariantCode; label: string }> = [
    { value: 'PRO_MONTHLY', label: 'Mensual (Q49 / 30 días)' },
    { value: 'PRO_QUARTERLY', label: 'Trimestral (Q119 / 90 días)' },
    { value: 'PRO_ANNUAL', label: 'Anual (Q399 / 365 días)' },
];

export default function GrantFormClient({ initialTenantId }: { initialTenantId: string }) {
    const [tenantId, setTenantId] = useState(initialTenantId);
    const [variantCode, setVariantCode] = useState<ManualVariantCode>('PRO_QUARTERLY');
    const [bankReference, setBankReference] = useState('');
    const [notes, setNotes] = useState('');
    const [isPending, startTransition] = useTransition();

    const submit = () =>
        startTransition(async () => {
            try {
                const r = await adminGrantManualSubscription({
                    tenantId,
                    variantCode,
                    bankReference,
                    notes: notes.trim() ? notes.trim() : null,
                });
                toast.success(
                    `PRO activo hasta ${new Date(r.expiresAt).toLocaleDateString('es-GT')}`
                );
                setBankReference('');
                setNotes('');
            } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error');
            }
        });

    const disabled = isPending || !tenantId.trim() || bankReference.trim().length < 3;

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="tenantId">Tenant ID</Label>
                <Input
                    id="tenantId"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="UUID del workspace"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="variant">Variante</Label>
                <Select
                    value={variantCode}
                    onValueChange={(v) => setVariantCode(v as ManualVariantCode)}
                >
                    <SelectTrigger id="variant">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {VARIANT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {o.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="bankRef">Referencia bancaria</Label>
                <Input
                    id="bankRef"
                    value={bankReference}
                    onChange={(e) => setBankReference(e.target.value)}
                    placeholder="Ej. BI-12345"
                    maxLength={120}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detalle del comprobante / cliente"
                    maxLength={2000}
                />
            </div>

            <Button disabled={disabled} onClick={submit}>
                {isPending ? 'Activando...' : 'Activar PRO manual'}
            </Button>
        </div>
    );
}
