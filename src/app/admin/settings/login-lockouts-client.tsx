'use client';

import { useState, useTransition } from 'react';
import { Loader2, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { unlockLoginLockout, runSecurityMaintenanceNow, type LoginLockoutEntry } from '@/lib/actions/admin-security';

interface LoginLockoutsClientProps {
  initialLockouts: LoginLockoutEntry[];
}

function formatDate(value: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('es-GT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LoginLockoutsClient({ initialLockouts }: LoginLockoutsClientProps) {
  const [lockouts, setLockouts] = useState(initialLockouts);
  const [isUnlocking, startUnlock] = useTransition();
  const [isMaintaining, startMaintenance] = useTransition();

  const handleUnlock = (channel: 'user' | 'admin', principal: string) => {
    startUnlock(async () => {
      const result = await unlockLoginLockout({ channel, principal });
      if (!result.success) {
        toast.error(result.error || 'No se pudo desbloquear.');
        return;
      }
      setLockouts((current) =>
        current.filter((item) => !(item.channel === channel && item.principal === principal.toLowerCase()))
      );
      toast.success('Cuenta desbloqueada.');
    });
  };

  const handleMaintenance = () => {
    startMaintenance(async () => {
      const result = await runSecurityMaintenanceNow();
      if (!result.success) {
        toast.error(result.error || 'No se pudo ejecutar mantenimiento.');
        return;
      }
      toast.success(
        `Mantenimiento ejecutado. Lockouts eliminados: ${result.deleted?.lockouts || 0}, webhooks eliminados: ${result.deleted?.webhookEvents || 0}`
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Bloqueos de Login
          </h3>
          <p className="text-xs text-muted-foreground">
            Gestiona cuentas bloqueadas por intentos fallidos y ejecuta limpieza de seguridad.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleMaintenance} disabled={isMaintaining}>
          {isMaintaining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Mantenimiento
        </Button>
      </div>

      {lockouts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No hay bloqueos activos o recientes.
        </div>
      ) : (
        <div className="space-y-3">
          {lockouts.map((item) => (
            <div key={`${item.channel}:${item.principal}`} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.channel === 'admin' ? 'destructive' : 'secondary'}>
                      {item.channel === 'admin' ? 'Admin' : 'Usuario'}
                    </Badge>
                    <span className="font-medium">{item.principal}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fallos: {item.failed_attempts} · Nivel: {item.lock_level} · Bloqueado hasta: {formatDate(item.locked_until)}
                  </p>
                  <p className="text-xs text-muted-foreground">Actualizado: {formatDate(item.updated_at)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUnlock(item.channel, item.principal)}
                  disabled={isUnlocking}
                >
                  {isUnlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Desbloquear
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
