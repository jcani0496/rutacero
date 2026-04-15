import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const channelMock = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        channel: vi.fn(() => channelMock),
        removeChannel: vi.fn(),
    }),
}));

import { NotificationBell } from './NotificationBell';

describe('NotificationBell', () => {
    it('adds an accessible label to the admin trigger when there are no unread notifications', () => {
        render(<NotificationBell adminId="admin-1" initialUnreadCount={0} />);

        expect(
            screen.getByRole('button', { name: 'Abrir notificaciones del panel de administracion' })
        ).toBeInTheDocument();
    });

    it('includes unread state in the admin trigger accessible name', () => {
        render(<NotificationBell adminId="admin-1" initialUnreadCount={2} />);

        expect(
            screen.getByRole('button', { name: 'Abrir notificaciones del panel de administracion: 2 sin leer' })
        ).toBeInTheDocument();
    });
});
