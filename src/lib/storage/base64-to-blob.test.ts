import { afterEach, describe, expect, it, vi } from 'vitest';
import { base64ToBlob } from './base64-to-blob';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('base64ToBlob', () => {
    it('builds a data URL with the supplied mime and base64 payload', async () => {
        const fake = new Blob(['hello'], { type: 'image/jpeg' });
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(fake, { headers: { 'content-type': 'image/jpeg' } }),
        );

        const result = await base64ToBlob('aGVsbG8=', 'image/jpeg');

        expect(fetchSpy).toHaveBeenCalledOnce();
        expect(fetchSpy).toHaveBeenCalledWith('data:image/jpeg;base64,aGVsbG8=');
        expect(result).toBeInstanceOf(Blob);
        expect(result.size).toBeGreaterThan(0);
    });

    it('passes through PDF content type unchanged', async () => {
        const fake = new Blob(['x'], { type: 'application/pdf' });
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response(fake));

        await base64ToBlob('eA==', 'application/pdf');

        expect(fetchSpy).toHaveBeenCalledWith('data:application/pdf;base64,eA==');
    });

    it('returns a Blob even for a synthetic large payload (1 MB base64)', async () => {
        // The stubbed fetch resolves immediately; this test asserts that the
        // helper does not perform an O(n) JS-level decode loop that would
        // stall on very large inputs.
        const big = 'A'.repeat(1024 * 1024);
        const fake = new Blob([new ArrayBuffer(750 * 1024)], { type: 'image/jpeg' });
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(fake));

        const result = await base64ToBlob(big, 'image/jpeg');

        expect(fetchSpy).toHaveBeenCalledOnce();
        const url = fetchSpy.mock.calls[0]?.[0] as string;
        expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
        expect(url.length).toBe('data:image/jpeg;base64,'.length + big.length);
        expect(result).toBeInstanceOf(Blob);
    });

    it('propagates fetch failures to the caller', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('decode failed'));
        await expect(base64ToBlob('AAAA', 'image/jpeg')).rejects.toThrow('decode failed');
    });
});
