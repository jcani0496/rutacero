import { describe, expect, it } from 'vitest';

import { maskEmailAddress } from '@/lib/privacy/email';

describe('maskEmailAddress', () => {
  it('masks the local part while preserving the domain', () => {
    expect(maskEmailAddress('jane.doe@example.com')).toBe('j*******@example.com');
  });

  it('returns a fallback-safe mask for one-letter local parts', () => {
    expect(maskEmailAddress('a@example.com')).toBe('a***@example.com');
  });

  it('returns null when email is missing', () => {
    expect(maskEmailAddress(null)).toBeNull();
  });
});
