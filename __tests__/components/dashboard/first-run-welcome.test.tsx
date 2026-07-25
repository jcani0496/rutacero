import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it, expect, vi } from 'vitest';

const { routerRefresh, seedSampleData } = vi.hoisted(() => ({
  routerRefresh: vi.fn(),
  seedSampleData: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn() }),
}));

vi.mock('@/lib/actions/sample-data', () => ({
  seedSampleData,
}));

import { FirstRunWelcome } from '@/components/dashboard/first-run-welcome';

describe('FirstRunWelcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('greets the user by their first name when provided', () => {
    render(<FirstRunWelcome userName="Maria Lopez" />);
    expect(
      screen.getByRole('heading', { level: 2, name: /hola, maria/i })
    ).toBeInTheDocument();
  });

  it('falls back to a generic greeting when no name is provided', () => {
    render(<FirstRunWelcome userName={null} />);
    expect(
      screen.getByRole('heading', { level: 2, name: /bienvenido a rutacero/i })
    ).toBeInTheDocument();
  });

  it('renders the primary CTA pointing to /debts with create dialog open', () => {
    render(<FirstRunWelcome userName="Ana" />);
    const cta = screen.getByRole('link', { name: /agregar primera deuda/i });
    expect(cta).toHaveAttribute('href', '/debts?new=1');
  });

  it('renders an accessible "how it works" trigger button', () => {
    render(<FirstRunWelcome userName="Ana" />);
    expect(
      screen.getByRole('button', { name: /ver cómo funciona/i })
    ).toBeInTheDocument();
  });

  it('opens the "how it works" modal and shows the steps', async () => {
    const user = userEvent.setup();
    render(<FirstRunWelcome userName="Ana" />);
    await user.click(
      screen.getByRole('button', { name: /ver cómo funciona/i })
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /así funciona rutacero/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/agregá tus deudas/i)).toBeInTheDocument();
    expect(screen.getByText(/configurá tu presupuesto/i)).toBeInTheDocument();
    expect(screen.getByText(/generá un plan/i)).toBeInTheDocument();
    expect(screen.getByText(/seguí tu progreso/i)).toBeInTheDocument();
  });

  it('seeds sample data and refreshes when the sample button is clicked', async () => {
    seedSampleData.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<FirstRunWelcome userName="Ana" />);

    await user.click(
      screen.getByRole('button', { name: /ver con datos de ejemplo/i })
    );

    await waitFor(() => {
      expect(seedSampleData).toHaveBeenCalledTimes(1);
      expect(routerRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('does not refresh when seeding sample data fails', async () => {
    seedSampleData.mockResolvedValue({ success: false, error: 'nope' });
    const user = userEvent.setup();
    render(<FirstRunWelcome userName="Ana" />);

    await user.click(
      screen.getByRole('button', { name: /ver con datos de ejemplo/i })
    );

    await waitFor(() => {
      expect(seedSampleData).toHaveBeenCalledTimes(1);
    });
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
