import { describe, it, expect } from 'vitest';
import { getDisplayName, getFirstName } from './display-name';

describe('getDisplayName', () => {
    it('returns full_name when present', () => {
        const user = {
            email: 'ana@example.com',
            user_metadata: { full_name: 'Ana López', name: 'Ana' },
        };
        expect(getDisplayName(user)).toBe('Ana López');
    });

    it('falls back to name when full_name is missing', () => {
        const user = {
            email: 'ana@example.com',
            user_metadata: { name: 'Ana' },
        };
        expect(getDisplayName(user)).toBe('Ana');
    });

    it('treats empty and whitespace-only metadata as missing', () => {
        const user = {
            email: 'someone@example.com',
            user_metadata: { full_name: '   ', name: '' },
        };
        expect(getDisplayName(user)).toBe('someone');
    });

    it('falls back to the email prefix when metadata is empty', () => {
        const user = {
            email: 'first.last@example.com',
            user_metadata: {},
        };
        expect(getDisplayName(user)).toBe('first.last');
    });

    it('uses the entire email when there is no @ sign', () => {
        const user = {
            email: 'oddvalue',
            user_metadata: null,
        };
        expect(getDisplayName(user)).toBe('oddvalue');
    });

    it('returns "Usuario" for null user', () => {
        expect(getDisplayName(null)).toBe('Usuario');
    });

    it('returns "Usuario" for undefined user', () => {
        expect(getDisplayName(undefined)).toBe('Usuario');
    });

    it('returns "Usuario" when email and metadata are all empty', () => {
        const user = {
            email: '',
            user_metadata: { full_name: '', name: null },
        };
        expect(getDisplayName(user)).toBe('Usuario');
    });

    it('trims surrounding whitespace from full_name', () => {
        const user = {
            email: 'x@example.com',
            user_metadata: { full_name: '  María José  ' },
        };
        expect(getDisplayName(user)).toBe('María José');
    });
});

describe('getFirstName', () => {
    it('returns the first whitespace-separated token', () => {
        const user = {
            email: 'x@example.com',
            user_metadata: { full_name: 'Ana María López' },
        };
        expect(getFirstName(user)).toBe('Ana');
    });

    it('returns null when only the fallback is available', () => {
        expect(getFirstName(null)).toBeNull();
        expect(getFirstName({ email: '', user_metadata: {} })).toBeNull();
    });

    it('handles tabs and multiple spaces between tokens', () => {
        const user = {
            email: 'x@example.com',
            user_metadata: { full_name: 'Ana\t\t  María' },
        };
        expect(getFirstName(user)).toBe('Ana');
    });

    it('returns the email prefix first token when metadata is missing', () => {
        const user = {
            email: 'pedro.gomez@example.com',
            user_metadata: null,
        };
        expect(getFirstName(user)).toBe('pedro.gomez');
    });
});
