import { redirect } from 'next/navigation';
import { SettingsClient } from './settings-client';
import { getSubscriptionForTenant, requireUserTenant } from '@/lib/tenant/server';
import { getCurrentUserProfile } from '@/lib/actions/profile';

export const metadata = {
    title: 'Configuración | RutaCero',
    description: 'Configurá tu perfil y preferencias',
};

export default async function SettingsPage() {
    let user, tenantId;
    try {
        ({ user, tenantId } = await requireUserTenant());
    } catch {
        redirect('/login');
    }

    const profile = await getCurrentUserProfile();
    const subscription = await getSubscriptionForTenant(tenantId);
    const subscriptionForClient = subscription?.id
        ? {
              id: subscription.id,
              plan_code: subscription.plan_code,
              status: subscription.status,
              provider: subscription.provider,
              renew_at: subscription.renew_at,
              external_id: subscription.external_id,
          }
        : null;

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <SettingsClient
                user={user}
                profile={profile}
                subscription={subscriptionForClient}
            />
        </div>
    );
}
