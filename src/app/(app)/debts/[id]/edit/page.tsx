import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Get debt details
    let debt;
    try {
        debt = await getDebtById(id);
    } catch {
        redirect('/debts');
    }

    // Get user plan for tags feature
    const plan = await getUserPlan();
    const isPro = plan.planCode !== 'FREE';

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl mx-auto">
            <EditDebtClient debt={debt} isPro={isPro} />
        </div>
    );
}
