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

import { UserNotificationBell } from './user-notification-bell';

describe('UserNotificationBell', () => {
    it('adds an accessible label to the trigger when there are no unread notifications', () => {
        render(<UserNotificationBell userId="user-1" initialUnreadCount={0} />);

        expect(screen.getByRole('button', { name: 'Abrir notificaciones' })).toBeInTheDocument();
    });

    it('includes unread state in the trigger accessible name', () => {
        render(<UserNotificationBell userId="user-1" initialUnreadCount={3} />);

        expect(screen.getByRole('button', { name: 'Abrir notificaciones: 3 sin leer' })).toBeInTheDocument();
    });
});
