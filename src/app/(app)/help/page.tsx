import { getUserTickets } from '@/lib/actions/support';
import { HelpClient } from './help-client';

export const metadata = {
    title: 'Soporte | RutaCero',
};

export default async function HelpPage() {
    const tickets = await getUserTickets();

    return <HelpClient tickets={tickets} />;
}
