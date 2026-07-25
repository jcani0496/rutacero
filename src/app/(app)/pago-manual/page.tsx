import { Suspense } from 'react';
import ManualTransferClient from './manual-transfer-client';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Pago por transferencia | RutaCero',
    description: 'Activá tu plan PRO con una transferencia bancaria en quetzales — misma PRO que con tarjeta',
};

export default function PagoManualPage() {
    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">
            <header className="space-y-2">
                <p className="text-sm font-medium text-primary">Camino #1 sin tarjeta</p>
                <h1 className="text-2xl sm:text-3xl font-bold">Pago por transferencia bancaria</h1>
                <p className="text-muted-foreground">
                    Misma PRO que con Recurrente: depositá o transferí en quetzales si no tenés tarjeta, si el
                    cobro con tarjeta falló, o si preferís prepago. Te enviamos las instrucciones y un código
                    de referencia por correo.
                </p>
            </header>
            <h2 className="sr-only">Elegí una variante</h2>
            <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando opciones…</p>}>
                <ManualTransferClient />
            </Suspense>
        </div>
    );
}
