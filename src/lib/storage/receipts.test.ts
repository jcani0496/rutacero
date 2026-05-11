import { describe, it, expect, vi } from 'vitest';
import { uploadReceipt, getReceiptSignedUrl, extensionFromFile } from './receipts';

function makeStorageMock(
    uploadImpl: (path: string, file: Blob, opts: unknown) => Promise<{ error: unknown }>,
    signedImpl?: () => Promise<{ data: { signedUrl: string } | null; error: unknown }>
) {
    const uploadSpy = vi.fn(uploadImpl);
    const signedSpy = vi.fn(signedImpl ?? (async () => ({ data: { signedUrl: 'https://x/y' }, error: null })));
    return {
        spies: { uploadSpy, signedSpy },
        client: {
            storage: {
                from: () => ({
                    upload: uploadSpy,
                    createSignedUrl: signedSpy,
                }),
            },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
    };
}

describe('uploadReceipt', () => {
    const baseParams = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        paymentId: 'pay-1',
        file: new Blob(['hello']),
        contentType: 'image/jpeg',
        extension: 'jpg',
    };

    it('rejects unsupported MIME type', async () => {
        const { client } = makeStorageMock(async () => ({ error: null }));
        await expect(
            uploadReceipt({ ...baseParams, supabase: client, contentType: 'application/x-msdownload' })
        ).rejects.toThrow(/Tipo de archivo no permitido/);
    });

    it('rejects empty file', async () => {
        const { client } = makeStorageMock(async () => ({ error: null }));
        await expect(
            uploadReceipt({ ...baseParams, supabase: client, file: new Blob([]) })
        ).rejects.toThrow(/vacío/);
    });

    it('rejects file > 5 MB', async () => {
        const { client } = makeStorageMock(async () => ({ error: null }));
        const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
        await expect(
            uploadReceipt({ ...baseParams, supabase: client, file: big })
        ).rejects.toThrow(/5 MB/);
    });

    it('sanitizes injected extension characters', async () => {
        const { client, spies } = makeStorageMock(async () => ({ error: null }));
        const result = await uploadReceipt({
            ...baseParams,
            supabase: client,
            extension: 'JPG;DROP TABLE',
        });
        expect(result.path).toBe('user-1/tenant-1/pay-1.jpgdroptable');
        expect(spies.uploadSpy).toHaveBeenCalledTimes(1);
        const [pathArg] = spies.uploadSpy.mock.calls[0];
        expect(pathArg).toBe('user-1/tenant-1/pay-1.jpgdroptable');
    });

    it('rejects extension that sanitizes to empty', async () => {
        const { client } = makeStorageMock(async () => ({ error: null }));
        await expect(
            uploadReceipt({ ...baseParams, supabase: client, extension: '...' })
        ).rejects.toThrow(/extensión/);
    });

    it('rejects an empty extension (extensionFromFile fallback)', async () => {
        // Simulates extensionFromFile() returning '' for an unknown MIME —
        // the upload must fail loudly rather than store the file under a
        // generic key.
        const { client, spies } = makeStorageMock(async () => ({ error: null }));
        const unknownFile = new File(['x'], 'mystery', { type: 'application/octet-stream' });
        const ext = extensionFromFile(unknownFile);
        expect(ext).toBe('');
        await expect(
            uploadReceipt({
                ...baseParams,
                supabase: client,
                contentType: 'image/jpeg', // satisfy MIME guard
                extension: ext,
            })
        ).rejects.toThrow(/extensión/);
        expect(spies.uploadSpy).not.toHaveBeenCalled();
    });

    it('builds correct path and uploads with upsert', async () => {
        const { client, spies } = makeStorageMock(async () => ({ error: null }));
        const result = await uploadReceipt({ ...baseParams, supabase: client });
        expect(result.path).toBe('user-1/tenant-1/pay-1.jpg');
        const [, , opts] = spies.uploadSpy.mock.calls[0];
        expect(opts).toMatchObject({ contentType: 'image/jpeg', upsert: true });
    });

    it('propagates storage error', async () => {
        const { client } = makeStorageMock(async () => ({ error: new Error('storage boom') }));
        await expect(
            uploadReceipt({ ...baseParams, supabase: client })
        ).rejects.toThrow(/storage boom/);
    });
});

describe('getReceiptSignedUrl', () => {
    it('returns the signed URL on success', async () => {
        const { client } = makeStorageMock(
            async () => ({ error: null }),
            async () => ({ data: { signedUrl: 'https://signed/abc' }, error: null })
        );
        const url = await getReceiptSignedUrl(client, 'user/tenant/pay.jpg');
        expect(url).toBe('https://signed/abc');
    });

    it('throws when supabase returns an error', async () => {
        const { client } = makeStorageMock(
            async () => ({ error: null }),
            async () => ({ data: null, error: new Error('nope') })
        );
        await expect(
            getReceiptSignedUrl(client, 'user/tenant/pay.jpg')
        ).rejects.toThrow(/nope/);
    });

    it('throws when no signed URL is returned', async () => {
        const { client } = makeStorageMock(
            async () => ({ error: null }),
            async () => ({ data: null, error: null })
        );
        await expect(
            getReceiptSignedUrl(client, 'user/tenant/pay.jpg')
        ).rejects.toThrow(/firmar/);
    });
});
