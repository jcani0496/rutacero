import { redirect } from 'next/navigation';
import { getMyTenants } from '@/lib/actions/tenants';
import { WorkspacesClient } from './workspaces-client';

export const metadata = {
  title: 'Workspaces | RutaCero',
  description: 'Selecciona o crea un workspace',
};

export default async function WorkspacesPage() {
  const { tenants, currentTenantId } = await getMyTenants();

  // If not authenticated, getMyTenants returns empty.
  if (!currentTenantId) {
    redirect('/login');
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <WorkspacesClient tenants={tenants} currentTenantId={currentTenantId} />
    </div>
  );
}

