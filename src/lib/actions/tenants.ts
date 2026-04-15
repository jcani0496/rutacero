'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { ensureCurrentTenantForUser } from '@/lib/tenant/server';

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export async function getMyTenants(): Promise<{
  tenants: TenantSummary[];
  currentTenantId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { tenants: [], currentTenantId: null };

  // Ensure bootstrap exists, so at least the personal tenant is present.
  const ensuredTenantId = await ensureCurrentTenantForUser(user.id);

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('current_tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const currentTenantId = (profile?.current_tenant_id as string | null) || ensuredTenantId;

  const { data: memberships, error } = await supabase
    .from('tenant_memberships')
    .select('tenant_id, role, tenant:tenants(id, slug, name)')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error loading memberships:', error);
    return { tenants: [], currentTenantId };
  }

  const tenants = (memberships || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => ({
      id: m.tenant?.id as string,
      slug: m.tenant?.slug as string,
      name: m.tenant?.name as string,
      role: m.role as TenantSummary['role'],
    }))
    .filter((t) => Boolean(t.id));

  return { tenants, currentTenantId };
}

export async function switchTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado' };

  // Verify membership first.
  const { data: membership } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return { success: false, error: 'No eres miembro de este workspace' };
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ current_tenant_id: tenantId })
    .eq('user_id', user.id);

  if (error) {
    console.error('Error switching tenant:', error);
    return { success: false, error: 'No se pudo cambiar el workspace' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/workspaces');

  return { success: true };
}

export async function createWorkspace(name: string): Promise<{ success: boolean; tenantId?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autenticado' };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Nombre requerido' };

  const slugBase = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  const slug = `${slugBase || 'workspace'}-${user.id.slice(0, 8)}`;

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      slug,
      name: trimmed,
      created_by_user_id: user.id,
    })
    .select('id')
    .single();

  if (tenantError || !tenant?.id) {
    console.error('Error creating tenant:', tenantError);
    return { success: false, error: 'No se pudo crear el workspace' };
  }

  const tenantId = tenant.id as string;

  // Bootstrap membership (OWNER).
  const { error: memberError } = await supabase
    .from('tenant_memberships')
    .insert({ tenant_id: tenantId, user_id: user.id, role: 'OWNER' });

  if (memberError) {
    console.error('Error creating membership:', memberError);
    return { success: false, error: 'No se pudo agregar membresía' };
  }

  // Switch to new workspace.
  await supabase.from('user_profiles').update({ current_tenant_id: tenantId }).eq('user_id', user.id);

  // Ensure subscription row exists (FREE by default). Billing updates still come from the webhook.
  const admin = createAdminClient();
  await admin.from('subscriptions').upsert(
    {
      tenant_id: tenantId,
      user_id: user.id,
      purchaser_user_id: user.id,
      plan_code: 'FREE',
      status: 'ACTIVE',
      provider: 'internal',
    },
    { onConflict: 'tenant_id' }
  );

  revalidatePath('/workspaces');

  return { success: true, tenantId };
}
