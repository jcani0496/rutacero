import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/actions/user-notifications', () => ({
    getUnreadUserNotifications: vi.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
    markUserNotificationAsRead: vi.fn(),
    markAllUserNotificationsAsRead: vi.fn(),
}));

import {
    USER_NOTIFICATION_POLL_MS,
    UserNotificationBell,
    getNotificationTriggerLabel,
} from './user-notification-bell';

describe('UserNotificationBell', () => {
    it('adds an accessible label to the trigger when there are no unread notifications', () => {
        render(<UserNotificationBell initialUnreadCount={0} />);

        expect(screen.getByRole('button', { name: 'Abrir notificaciones' })).toBeInTheDocument();
    });

    it('includes unread state in the trigger accessible name', () => {
        render(<UserNotificationBell initialUnreadCount={3} />);

        expect(screen.getByRole('button', { name: 'Abrir notificaciones: 3 sin leer' })).toBeInTheDocument();
    });

    it('formats trigger labels for empty, counted, and capped unread', () => {
        expect(getNotificationTriggerLabel(0)).toBe('Abrir notificaciones');
        expect(getNotificationTriggerLabel(3)).toBe('Abrir notificaciones: 3 sin leer');
        expect(getNotificationTriggerLabel(12)).toBe('Abrir notificaciones: 9 o mas sin leer');
    });

    it('uses a 30–60s poll interval', () => {
        expect(USER_NOTIFICATION_POLL_MS).toBeGreaterThanOrEqual(30_000);
        expect(USER_NOTIFICATION_POLL_MS).toBeLessThanOrEqual(60_000);
    });
});
