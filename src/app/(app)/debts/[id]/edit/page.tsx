import { redirect } from 'next/navigation';
import { getAppUser } from '@/lib/auth/session';
import { getDebtById } from '@/lib/actions/debts';
import { getUserPlan } from '@/lib/utils/feature-access';
import { EditDebtClient } from './edit-client';

interface PageProps {
    params: Promise<{ id: string }>;
}

export const metadata = {
    title: 'Editar Deuda | RutaCero',
    description: 'Edita los detalles de tu deuda',
};

export default async function EditDebtPage({ params }: PageProps) {
    const { id } = await params;

    const user = await getAppUser();

    if (!user) {
        redirect('/login');
    }

    let debt;
    try {
        debt = await getDebtById(id);
    } catch {
        redirect('/debts');
    }

    const plan = await getUserPlan();
    const isPro = plan.planCode !== 'FREE';

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl mx-auto">
            <EditDebtClient debt={debt} isPro={isPro} />
        </div>
    );
}
