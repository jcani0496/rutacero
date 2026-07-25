// Receipt upload helper. Validates type + size before upload and returns
// the bucket-relative storage path that should be persisted on
// payments.receipt_url. Signed URLs for display are produced on demand by
// getReceiptSignedUrl — they expire and must not be stored.
//
// Dual-path behind STORAGE_PROVIDER (F6 default: railway):
// - railway: S3-compatible Railway Buckets (see `./s3.ts`)
// - supabase: removed at runtime in F6 (throws if selected)

import { getStorageProvider } from "@/lib/storage/provider";
import {
  s3DeleteUserReceiptObjects,
  s3GetReceiptSignedUrl,
  s3PutReceiptObject,
} from "@/lib/storage/s3";

export const ALLOWED_RECEIPT_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

/** Logical product bucket name (Supabase Storage). Railway S3 name comes from env. */
export const RECEIPT_BUCKET = "payment-receipts";

export interface UploadReceiptParams {
  /** Required when STORAGE_PROVIDER=supabase; ignored for railway. */
  supabase?: any;
  userId: string;
  tenantId: string;
  paymentId: string;
  file: Blob;
  contentType: string;
  extension: string;
}

export interface UploadReceiptResult {
  path: string;
}

export function sanitizeReceiptExtension(extension: string): string {
  // Strip any character that isn't alphanumeric to defeat path-traversal /
  // injection attempts like "JPG;DROP TABLE" or "../../etc/passwd". The
  // server only uses the extension for the object key — there is no shell
  // interpolation — but defense in depth is cheap.
  return extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function buildReceiptObjectPath(params: {
  userId: string;
  tenantId: string;
  paymentId: string;
  extension: string;
}): string {
  const safeExt = sanitizeReceiptExtension(params.extension);
  if (!safeExt) {
    throw new Error("La extensión del archivo es inválida.");
  }
  return `${params.userId}/${params.tenantId}/${params.paymentId}.${safeExt}`;
}

export function validateReceiptUpload(params: {
  contentType: string;
  file: Blob;
  extension: string;
}): void {
  if (!ALLOWED_RECEIPT_MIME.has(params.contentType)) {
    throw new Error(`Tipo de archivo no permitido: ${params.contentType}`);
  }
  if (params.file.size === 0) {
    throw new Error("El archivo está vacío.");
  }
  if (params.file.size > MAX_RECEIPT_BYTES) {
    throw new Error("El archivo supera los 5 MB.");
  }
  // Reject if the extension is missing or sanitized to nothing. With
  // extensionFromFile() now returning '' on unknown MIMEs (instead of the
  // generic 'bin'), an unknown file type fails loudly here rather than
  // silently being stored as `<paymentId>.bin`.
  if (!sanitizeReceiptExtension(params.extension)) {
    throw new Error("La extensión del archivo es inválida.");
  }
}

export async function uploadReceipt(
  params: UploadReceiptParams
): Promise<UploadReceiptResult> {
  validateReceiptUpload(params);
  const path = buildReceiptObjectPath(params);

  if (getStorageProvider() === "railway") {
    await s3PutReceiptObject({
      key: path,
      body: params.file,
      contentType: params.contentType,
    });
    return { path };
  }

  if (!params.supabase) {
    throw new Error("Cliente de storage no disponible.");
  }

  const { error } = await params.supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, params.file, {
      contentType: params.contentType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return { path };
}

export async function getReceiptSignedUrl(
  supabase: any | null | undefined,
  path: string,
  expiresSeconds: number = 60 * 10
): Promise<string> {
  if (getStorageProvider() === "railway") {
    return s3GetReceiptSignedUrl(path, expiresSeconds);
  }

  if (!supabase) {
    throw new Error("Cliente de storage no disponible.");
  }

  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, expiresSeconds);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("No se pudo firmar la URL");
  }
  return data.signedUrl;
}

export type DeleteUserReceiptsResult =
  | { ok: true; removed: number }
  | { ok: false; error: string };

/**
 * Removes every Storage object owned by the user. The DB cascade never
 * touches Storage, so without this step bank receipts under
 * payment-receipts/<user_id>/... outlive the account (audit 2026-07).
 *
 * Returns ok:false on ANY listing or removal error — the caller must then
 * NOT delete the auth user, or the orphaned objects would lose their owning
 * rows forever.
 */
export async function deleteUserReceiptObjects(
  supabase: any | null | undefined,
  userId: string
): Promise<DeleteUserReceiptsResult> {
  if (getStorageProvider() === "railway") {
    return s3DeleteUserReceiptObjects(userId);
  }

  if (!supabase) {
    return { ok: false, error: "Cliente de storage no disponible." };
  }

  const STORAGE_LIST_LIMIT = 1000;
  try {
    const bucket = supabase.storage.from(RECEIPT_BUCKET);
    const { data: entries, error: listError } = await bucket.list(userId, {
      limit: STORAGE_LIST_LIMIT,
    });
    if (listError) {
      return { ok: false, error: listError.message };
    }
    if (!entries || entries.length === 0) {
      return { ok: true, removed: 0 };
    }

    const paths: string[] = [];
    for (const entry of entries) {
      // Files have an id; folders (tenant dirs) do not.
      if (entry.id) {
        paths.push(`${userId}/${entry.name}`);
        continue;
      }
      const prefix = `${userId}/${entry.name}`;
      const { data: files, error: subError } = await bucket.list(prefix, {
        limit: STORAGE_LIST_LIMIT,
      });
      if (subError) {
        return { ok: false, error: subError.message };
      }
      for (const file of files ?? []) {
        if (file.id) paths.push(`${prefix}/${file.name}`);
      }
    }

    if (paths.length > 0) {
      const { error: removeError } = await bucket.remove(paths);
      if (removeError) {
        return { ok: false, error: removeError.message };
      }
    }
    return { ok: true, removed: paths.length };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// Helper: derive a safe extension from a File object (mostly for the web
// fallback where contentType + filename are both available).
export function extensionFromFile(file: File): string {
  const fromName = file.name.split(".").pop() ?? "";
  if (fromName && fromName.length <= 5) return fromName;
  // Fallback: derive from MIME.
  const mime = file.type;
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  if (mime === "application/pdf") return "pdf";
  // Unknown MIME — return empty so uploadReceipt() rejects rather than
  // storing the object under a generic `.bin` key.
  return "";
}
