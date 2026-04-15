'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkspace, switchTenant, type TenantSummary } from '@/lib/actions/tenants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function WorkspacesClient(props: { tenants: TenantSummary[]; currentTenantId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...props.tenants].sort((a, b) => {
      if (a.id === props.currentTenantId) return -1;
      if (b.id === props.currentTenantId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [props.tenants, props.currentTenantId]);

  const onSwitch = (tenantId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await switchTenant(tenantId);
      if (!res.success) {
        setError(res.error || 'No se pudo cambiar el workspace');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    });
  };

  const onCreate = () => {
    setError(null);
    startTransition(async () => {
      const res = await createWorkspace(name);
      if (!res.success) {
        setError(res.error || 'No se pudo crear el workspace');
        return;
      }
      setName('');
      router.push('/dashboard');
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Workspaces</h1>
        <p className="text-sm text-muted-foreground">
          Selecciona el workspace en el que quieres trabajar. Tus datos son personales por workspace.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tus workspaces</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.map((t) => {
            const isCurrent = t.id === props.currentTenantId;
            return (
              <div key={t.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{t.name}</span>
                    {isCurrent && <Badge>Actual</Badge>}
                    <Badge variant="outline">{t.role}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{t.slug}</div>
                </div>
                <Button
                  variant={isCurrent ? 'secondary' : 'default'}
                  disabled={pending || isCurrent}
                  onClick={() => onSwitch(t.id)}
                >
                  {isCurrent ? 'Seleccionado' : 'Cambiar'}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Crear workspace</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Nombre del workspace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
          />
          <Button onClick={onCreate} disabled={pending || name.trim().length < 2}>
            Crear
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

