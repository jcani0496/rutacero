import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/actions/admin-auth';

const mocks = vi.hoisted(() => ({
    adminLogout: vi.fn(),
    push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    usePathname: () => '/admin/dashboard',
    useRouter: () => ({
        push: mocks.push,
    }),
}));

vi.mock('@/lib/actions/admin-auth', () => ({
    adminLogout: mocks.adminLogout,
}));

vi.mock('@/components/admin/NotificationBell', () => ({
    NotificationBell: ({ adminId }: { adminId: string }) => (
        <div data-testid="notification-bell">{adminId}</div>
    ),
}));

import { AdminSidebar } from './AdminSidebar';

const session: AdminSession = {
    adminId: 'admin-1',
    email: 'admin@rutacero.gt',
    role: 'ADMIN',
    displayName: 'Ruta Admin',
};

describe('AdminSidebar', () => {
    beforeEach(() => {
        mocks.adminLogout.mockReset();
        mocks.push.mockReset();
    });

    it('shows a mobile sheet with only the allowed navigation items', async () => {
        render(
            <AdminSidebar
                session={session}
                allowedNav={['/admin/dashboard', '/admin/support']}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /abrir navegación admin/i }));

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
        expect(within(dialog).getByRole('link', { name: /soporte/i })).toBeInTheDocument();
        expect(within(dialog).queryByRole('link', { name: /reportes/i })).not.toBeInTheDocument();
    });

    it('marks the current section and logs out through the admin action', async () => {
        render(<AdminSidebar session={session} />);

        expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page');

        fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));

        await waitFor(() => {
            expect(mocks.adminLogout).toHaveBeenCalledTimes(1);
        });
        expect(mocks.push).toHaveBeenCalledWith('/admin/login');
    });
});
