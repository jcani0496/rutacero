import { notFound } from 'next/navigation';
import { getUserTicketWithMessages } from '@/lib/actions/support';
import { TicketClient } from './ticket-client';

export const metadata = {
    title: 'Detalle de Ticket | RutaCero',
};

export default async function TicketPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    if (!id || id === 'undefined') {
        notFound();
    }

    const data = await getUserTicketWithMessages(id);

    if (!data) {
        notFound();
    }

    return <TicketClient ticket={data.ticket} messages={data.messages} />;
}
