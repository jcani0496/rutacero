import { redirect } from 'next/navigation';
import { getAppUser } from '@/lib/auth/session';
import { getMovimientosAggregates, normalizeGranularity } from '@/lib/actions/movimientos';
import { MovimientosClient } from './movimientos-client';

export const metadata = {
    title: 'Movimientos | RutaCero',
    description: 'Visualizá cómo se distribuyen tus ingresos y gastos en distintos periodos.',
};

interface PageProps {
    searchParams: Promise<{ granularity?: string }>;
}

export default async function MovimientosPage({ searchParams }: PageProps) {
    const user = await getAppUser();
    if (!user) {
        redirect('/login');
    }

    const params = await searchParams;
    const granularity = await normalizeGranularity(params.granularity);

    const result = await getMovimientosAggregates({ granularity });

    return <MovimientosClient initialResult={result} />;
}
