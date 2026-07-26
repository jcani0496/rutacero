import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { accountDeletionRequests } from '@/db/schema';
import { logger } from '@/lib/logger';
import { requireUserTenant } from '@/lib/tenant/server';
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

    let pending: { id: string; executes_at: string; requested_at: string } | null = null;
    try {
        const [row] = await getDb()
            .select({
                id: accountDeletionRequests.id,
                executesAt: accountDeletionRequests.executesAt,
                requestedAt: accountDeletionRequests.requestedAt,
            })
            .from(accountDeletionRequests)
            .where(
                and(
                    eq(accountDeletionRequests.userId, user.id),
                    isNull(accountDeletionRequests.canceledAt),
                    isNull(accountDeletionRequests.executedAt)
                )
            )
            .limit(1);

        pending = row
            ? {
                id: row.id,
                executes_at: row.executesAt.toISOString(),
                requested_at: row.requestedAt.toISOString(),
            }
            : null;
    } catch (err) {
        // The page must still render the request form if the lookup fails —
        // an unreadable pending row must not lock the user out of the flow.
        logger.error({ err, userId: user.id }, '[delete-account] pending lookup failed');
    }

    return (
        <div className="mx-auto max-w-xl space-y-6 p-4 sm:p-6">
            <header className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                    Eliminar mi cuenta
                </h1>
                <p className="text-sm text-muted-foreground">
                    Esto eliminara tu cuenta, deudas, pagos, planes y todos tus datos
                    asociados. La eliminacion se ejecuta 7 dias despues de tu solicitud
                    — podés cancelar en cualquier momento durante ese periodo.
                </p>
            </header>
            <DeleteAccountClient pending={pending} />
        </div>
    );
}
