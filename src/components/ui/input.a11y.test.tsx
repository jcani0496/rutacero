import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/input';

describe('Input accessibility', () => {
  it('exposes label, hint and error semantics without violations', async () => {
    const { container, rerender } = render(
      <Input
        id="email"
        type="email"
        label="Correo electrónico"
        hint="Te enviaremos recordatorios"
      />
    );

    expect(await axe(container)).toHaveNoViolations();

    rerender(
      <Input
        id="email"
        type="email"
        label="Correo electrónico"
        error="Correo inválido"
      />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
