/**
 * S3-compatible client for Railway Buckets (payment receipts).
 *
 * Credential resolution (first match wins per field):
 *   STORAGE_S3_*  →  AWS_* (Railway auto-inject / `railway bucket credentials`)
 *
 * The logical product bucket is `payment-receipts`; Railway's S3 API name is
 * globally unique (e.g. `payment-receipts-d1yaxfcz`) and must come from env.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface ReceiptS3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Railway uses virtual-hosted style by default. */
  forcePathStyle: boolean;
}

let cachedClient: S3Client | null = null;
let cachedConfigKey: string | null = null;

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function resolveReceiptS3Config(): ReceiptS3Config {
  const endpoint = firstEnv("STORAGE_S3_ENDPOINT", "AWS_ENDPOINT_URL");
  const accessKeyId = firstEnv(
    "STORAGE_S3_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID"
  );
  const secretAccessKey = firstEnv(
    "STORAGE_S3_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY"
  );
  const bucket = firstEnv(
    "STORAGE_S3_BUCKET",
    "AWS_S3_BUCKET_NAME",
    "BUCKET"
  );
  const region = firstEnv("STORAGE_S3_REGION", "AWS_DEFAULT_REGION") || "auto";
  const urlStyle = (
    firstEnv("STORAGE_S3_URL_STYLE", "AWS_S3_URL_STYLE") || "virtual"
  ).toLowerCase();

  const missing: string[] = [];
  if (!endpoint) missing.push("STORAGE_S3_ENDPOINT|AWS_ENDPOINT_URL");
  if (!accessKeyId) missing.push("STORAGE_S3_ACCESS_KEY_ID|AWS_ACCESS_KEY_ID");
  if (!secretAccessKey) {
    missing.push("STORAGE_S3_SECRET_ACCESS_KEY|AWS_SECRET_ACCESS_KEY");
  }
  if (!bucket) missing.push("STORAGE_S3_BUCKET|AWS_S3_BUCKET_NAME");
  if (missing.length > 0) {
    throw new Error(
      `Railway storage misconfigured — missing: ${missing.join(", ")}`
    );
  }

  return {
    endpoint: endpoint!,
    region,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
    forcePathStyle: urlStyle === "path",
  };
}

export function getReceiptS3Client(): { client: S3Client; bucket: string } {
  const config = resolveReceiptS3Config();
  const key = [
    config.endpoint,
    config.region,
    config.accessKeyId,
    config.bucket,
    config.forcePathStyle ? "path" : "virtual",
  ].join("|");

  if (!cachedClient || cachedConfigKey !== key) {
    const clientConfig: S3ClientConfig = {
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };
    cachedClient = new S3Client(clientConfig);
    cachedConfigKey = key;
  }

  return { client: cachedClient, bucket: config.bucket };
}

/** Test helper — clears the module-level S3 client cache. */
export function resetReceiptS3ClientCache(): void {
  cachedClient = null;
  cachedConfigKey = null;
}

export async function s3PutReceiptObject(params: {
  key: string;
  body: Buffer | Uint8Array | Blob;
  contentType: string;
}): Promise<void> {
  const { client, bucket } = getReceiptS3Client();
  let body: Buffer | Uint8Array;
  if (params.body instanceof Blob) {
    body = new Uint8Array(await params.body.arrayBuffer());
  } else {
    body = params.body;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: body,
      ContentType: params.contentType,
    })
  );
}

export async function s3GetReceiptSignedUrl(
  key: string,
  expiresSeconds: number
): Promise<string> {
  const { client, bucket } = getReceiptS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresSeconds }
  );
}

/**
 * List all object keys under `userId/` (one tenant-folder level deep) and
 * delete them. Mirrors the Supabase Storage walk used by process-deletions.
 */
export async function s3DeleteUserReceiptObjects(
  userId: string
): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  try {
    const { client, bucket } = getReceiptS3Client();
    const prefix = `${userId}/`;
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
      );
      for (const obj of listed.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);

    if (keys.length === 0) {
      return { ok: true, removed: 0 };
    }

    // DeleteObjects accepts up to 1000 keys per request.
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: chunk.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
      if (result.Errors && result.Errors.length > 0) {
        const first = result.Errors[0];
        return {
          ok: false,
          error:
            first.Message ||
            first.Code ||
            `Failed to delete ${result.Errors.length} object(s)`,
        };
      }
    }

    return { ok: true, removed: keys.length };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
