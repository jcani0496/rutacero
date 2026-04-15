import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert, AlertDescription, AlertTitle } from './alert';

describe('AlertDescription', () => {
  it('renders a block container for rich content', () => {
    render(
      <Alert>
        <AlertTitle>Plan recomendado</AlertTitle>
        <AlertDescription data-testid="alert-description">
          <div>Comparacion lista</div>
          <ul>
            <li>Menos interes total</li>
          </ul>
          <p>Conserva contexto adicional.</p>
        </AlertDescription>
      </Alert>
    );

    expect(screen.getByTestId('alert-description').tagName).toBe('DIV');
    expect(screen.getByText('Comparacion lista')).toBeInTheDocument();
    expect(screen.getByText('Menos interes total')).toBeInTheDocument();
    expect(screen.getByText('Conserva contexto adicional.')).toBeInTheDocument();
  });
});
