import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    generateStandardReport: vi.fn(),
    getTableColumns: vi.fn(),
    generateCustomReport: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('@/lib/actions/admin-reports', () => ({
    generateStandardReport: mocks.generateStandardReport,
    getTableColumns: mocks.getTableColumns,
    generateCustomReport: mocks.generateCustomReport,
}));

vi.mock('@/components/ui/toast', () => ({
    toast: {
        error: mocks.toastError,
        success: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        loading: vi.fn(),
        promise: vi.fn(),
        dismiss: vi.fn(),
    },
}));

vi.mock('@/components/ui/tabs', () => ({
    Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
    TabsContent: ({ children, className }: { children: ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
    ),
}));

vi.mock('@/components/ui/select', async () => {
    const React = await import('react');
    const SelectContext = React.createContext<((value: string) => void) | null>(null);

    return {
        Select: ({
            children,
            onValueChange,
        }: {
            children: ReactNode;
            onValueChange?: (value: string) => void;
        }) => <SelectContext.Provider value={onValueChange ?? null}>{children}</SelectContext.Provider>,
        SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
        SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        SelectItem: ({
            children,
            value,
        }: {
            children: ReactNode;
            value: string;
        }) => {
            const onValueChange = React.useContext(SelectContext);
            return (
                <button type="button" onClick={() => onValueChange?.(value)}>
                    {children}
                </button>
            );
        },
    };
});

import { ReportsClient } from './reports-client';

describe('ReportsClient', () => {
    beforeEach(() => {
        mocks.generateStandardReport.mockReset();
        mocks.getTableColumns.mockReset();
        mocks.generateCustomReport.mockReset();
        mocks.toastError.mockReset();
    });

    it('shows inline feedback when a standard report download fails', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.generateStandardReport.mockRejectedValue(new Error('Permiso denegado'));

        render(
            <ReportsClient
                standardReports={[
                    {
                        id: 'users',
                        name: 'Reporte de Usuarios',
                        description: 'Usuarios registrados',
                        icon: 'Users',
                    },
                ]}
                tables={[]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /descargar csv/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/permiso denegado/i);
        expect(mocks.toastError).toHaveBeenCalledWith('Error al generar el reporte', {
            description: 'Permiso denegado',
        });

        consoleErrorSpy.mockRestore();
    });

    it('clears stale preview data and surfaces the latest preview error', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mocks.getTableColumns.mockResolvedValue([
            { name: 'user_id', type: 'uuid', label: 'User ID' },
            { name: 'created_at', type: 'timestamp', label: 'Fecha Creación' },
        ]);
        mocks.generateCustomReport
            .mockResolvedValueOnce({
                headers: ['User ID', 'Fecha Creación'],
                rows: [['usr_123', '2026-04-09']],
            })
            .mockRejectedValueOnce(new Error('Consulta bloqueada por seguridad'));

        render(
            <ReportsClient
                standardReports={[]}
                tables={[
                    {
                        name: 'debts',
                        label: 'Deudas',
                        description: 'Deudas registradas',
                    },
                ]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /deudas/i }));

        await screen.findByText('User ID');

        fireEvent.click(screen.getByRole('button', { name: /vista previa/i }));
        expect(await screen.findByText('usr_123')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /vista previa/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/consulta bloqueada por seguridad/i);
        });

        expect(screen.queryByText('usr_123')).not.toBeInTheDocument();
        expect(mocks.toastError).toHaveBeenCalledWith('Error al generar la vista previa', {
            description: 'Consulta bloqueada por seguridad',
        });

        consoleErrorSpy.mockRestore();
    });
});
