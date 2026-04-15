import { redirect } from 'next/navigation';

export default async function AdminSupportPage() {
    redirect('/admin/support/tickets');
}
