import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';

import { SkipToContentLink } from '@/components/accessibility/skip-to-content-link';
import { MAIN_CONTENT_ID } from '@/lib/accessibility';

describe('SkipToContentLink', () => {
  it('points to the main content target', () => {
    render(<SkipToContentLink />);

    expect(screen.getByRole('link', { name: 'Saltar al contenido principal' })).toHaveAttribute(
      'href',
      `#${MAIN_CONTENT_ID}`
    );
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(
      <>
        <SkipToContentLink />
        <main id={MAIN_CONTENT_ID}>Contenido</main>
      </>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
