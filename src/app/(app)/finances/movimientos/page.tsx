import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMovimientosAggregates, normalizeGranularity } from '@/lib/actions/movimientos';
import { MovimientosClient } from './movimientos-client';

export const metadata = {
    title: 'Movimientos | RutaCero',
    description: 'Visualiza cómo se distribuyen tus ingresos y gastos en distintos periodos.',
};

// Server components read URL state directly via the `searchParams` prop.
interface PageProps {
    searchParams: Promise<{ granularity?: string }>;
}

export default async function MovimientosPage({ searchParams }: PageProps) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }

    const params = await searchParams;
    const granularity = await normalizeGranularity(params.granularity);

    const result = await getMovimientosAggregates({ granularity });

    return <MovimientosClient initialResult={result} />;
}
