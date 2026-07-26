'use client';

import { useState, useTransition } from 'react';
import { Database, CircleNotch, CheckCircle, WarningCircle, Trash } from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { seedTestData, clearTestData } from '@/lib/actions/seed-data';

interface SeedDataClientProps {
    users: Array<{ id: string; email: string }>;
}

export function SeedDataClient({ users }: SeedDataClientProps) {
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [isPending, startTransition] = useTransition();
    const [result, setResult] = useState<{
        success: boolean;
        message: string;
        data?: Record<string, number>;
    } | null>(null);

    const handleSeed = () => {
        if (!selectedUser) return;

        startTransition(async () => {
            try {
                const data = await seedTestData(selectedUser);
                setResult({
                    success: true,
                    message: 'Datos de prueba inyectados correctamente',
                    data: data.data,
                });
            } catch (error) {
                setResult({
                    success: false,
                    message: error instanceof Error ? error.message : 'Error desconocido',
                });
            }
        });
    };

    const handleClear = () => {
        if (!selectedUser) return;

        startTransition(async () => {
            try {
                await clearTestData(selectedUser);
                setResult({
                    success: true,
                    message: 'Datos eliminados correctamente',
                });
            } catch (error) {
                setResult({
                    success: false,
                    message: error instanceof Error ? error.message : 'Error desconocido',
                });
            }
        });
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Inyectar Datos de Prueba
                    </CardTitle>
                    <CardDescription>
                        Crea deudas, ingresos y gastos de prueba realistas para un usuario
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Seleccionar Usuario</label>
                        <Select value={selectedUser} onValueChange={setSelectedUser}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un usuario..." />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
                        <p className="font-medium">Datos que se crearán:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li>6 deudas (tarjetas, préstamos, cuotas, informal)</li>
                            <li>3 eventos de ingreso (salario quincenal + freelance)</li>
                            <li>8 gastos esenciales (alquiler, servicios, etc.)</li>
                            <li>4 metas de presupuesto variable</li>
                            <li>Suscripción PRO activada</li>
                        </ul>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            onClick={handleSeed}
                            disabled={!selectedUser || isPending}
                            className="flex-1"
                        >
                            {isPending ? (
                                <>
                                    <CircleNotch {...ICON} className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <Database className="mr-2 h-4 w-4" />
                                    Inyectar Datos
                                </>
                            )}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleClear}
                            disabled={!selectedUser || isPending}
                        >
                            <Trash {...ICON} className="mr-2 h-4 w-4" />
                            Limpiar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {result && (
                <Alert variant={result.success ? 'default' : 'destructive'}>
                    {result.success ? (
                        <CheckCircle {...ICON} className="h-4 w-4" />
                    ) : (
                        <WarningCircle {...ICON} className="h-4 w-4" />
                    )}
                    <AlertTitle>{result.success ? 'Éxito' : 'Error'}</AlertTitle>
                    <AlertDescription>{result.message}</AlertDescription>
                    {result.data && (
                        <ul className="mt-2 list-disc list-inside text-sm opacity-90">
                            {Object.entries(result.data).map(([key, value]) => (
                                <li key={key}>{key}: {value}</li>
                            ))}
                        </ul>
                    )}
                </Alert>
            )}
        </div>
    );
}
