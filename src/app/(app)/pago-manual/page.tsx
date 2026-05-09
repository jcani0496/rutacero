import ManualTransferClient from './manual-transfer-client';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Pago por transferencia | RutaCero',
    description: 'Activa tu plan PRO con una transferencia bancaria en quetzales',
};

export default function PagoManualPage() {
    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">
            <header className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold">Pago por transferencia bancaria</h1>
                <p className="text-muted-foreground">
                    Si no tienes tarjeta, puedes activar PRO depositando o transfiriendo el monto a una de
                    nuestras cuentas. Te enviamos las instrucciones por correo y un código de referencia.
                </p>
            </header>
            <ManualTransferClient />
        </div>
    );
}
