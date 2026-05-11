import { redirect } from 'next/navigation';
import { requireUserTenant } from '@/lib/tenant/server';
import { createAdminClient } from '@/lib/supabase/server';
import { DeleteAccountClient } from './delete-account-client';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Eliminar cuenta | RutaCero',
};

export default async function DeleteAccountPage() {
    let user;
    try {
        ({ user } = await requireUserTenant());
    } catch {
        redirect('/login');
    }

    const admin = createAdminClient();
    const { data: pending } = await admin
        .from('account_deletion_requests')
        .select('id, executes_at, requested_at')
        .eq('user_id', user.id)
        .is('canceled_at', null)
        .is('executed_at', null)
        .maybeSingle();

    return (
        <div className="mx-auto max-w-xl space-y-6 p-4 sm:p-6">
            <header className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                    Eliminar mi cuenta
                </h1>
                <p className="text-sm text-muted-foreground">
                    Esto eliminara tu cuenta, deudas, pagos, planes y todos tus datos
                    asociados. La eliminacion se ejecuta 7 dias despues de tu solicitud
                    — puedes cancelar en cualquier momento durante ese periodo.
                </p>
            </header>
            <DeleteAccountClient pending={pending} />
        </div>
    );
}
