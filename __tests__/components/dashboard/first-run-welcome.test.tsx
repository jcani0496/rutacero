import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { FirstRunWelcome } from '@/components/dashboard/first-run-welcome';

describe('FirstRunWelcome', () => {
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

  it('renders the primary CTA pointing to /debts', () => {
    render(<FirstRunWelcome userName="Ana" />);
    const cta = screen.getByRole('link', { name: /agrega tu primera deuda/i });
    expect(cta).toHaveAttribute('href', '/debts');
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
    expect(screen.getByText(/agrega tus deudas/i)).toBeInTheDocument();
    expect(screen.getByText(/configura tu presupuesto/i)).toBeInTheDocument();
    expect(screen.getByText(/genera un plan/i)).toBeInTheDocument();
    expect(screen.getByText(/sigue tu progreso/i)).toBeInTheDocument();
  });
});
