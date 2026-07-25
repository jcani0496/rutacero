import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/actions/admin-notifications', () => ({
    getUnreadNotifications: vi.fn().mockResolvedValue({ notifications: [], unreadCount: 0 }),
    markNotificationAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
}));

import {
    ADMIN_NOTIFICATION_POLL_MS,
    NotificationBell,
    getNotificationTriggerLabel,
} from './NotificationBell';

describe('NotificationBell', () => {
    it('adds an accessible label to the admin trigger when there are no unread notifications', () => {
        render(<NotificationBell initialUnreadCount={0} />);

        expect(
            screen.getByRole('button', { name: 'Abrir notificaciones del panel de administracion' })
        ).toBeInTheDocument();
    });

    it('includes unread state in the admin trigger accessible name', () => {
        render(<NotificationBell initialUnreadCount={2} />);

        expect(
            screen.getByRole('button', { name: 'Abrir notificaciones del panel de administracion: 2 sin leer' })
        ).toBeInTheDocument();
    });

    it('formats trigger labels for empty, counted, and capped unread', () => {
        expect(getNotificationTriggerLabel(0)).toBe(
            'Abrir notificaciones del panel de administracion'
        );
        expect(getNotificationTriggerLabel(2)).toBe(
            'Abrir notificaciones del panel de administracion: 2 sin leer'
        );
        expect(getNotificationTriggerLabel(15)).toBe(
            'Abrir notificaciones del panel de administracion: 9 o mas sin leer'
        );
    });

    it('uses a 30–60s poll interval', () => {
        expect(ADMIN_NOTIFICATION_POLL_MS).toBeGreaterThanOrEqual(30_000);
        expect(ADMIN_NOTIFICATION_POLL_MS).toBeLessThanOrEqual(60_000);
    });
});
