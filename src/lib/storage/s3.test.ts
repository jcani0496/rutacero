import { afterEach, describe, expect, it } from "vitest";
import { resetReceiptS3ClientCache, resolveReceiptS3Config } from "./s3";

const KEYS = [
  "STORAGE_S3_ENDPOINT",
  "STORAGE_S3_ACCESS_KEY_ID",
  "STORAGE_S3_SECRET_ACCESS_KEY",
  "STORAGE_S3_BUCKET",
  "STORAGE_S3_REGION",
  "STORAGE_S3_URL_STYLE",
  "AWS_ENDPOINT_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET_NAME",
  "AWS_DEFAULT_REGION",
  "AWS_S3_URL_STYLE",
  "BUCKET",
] as const;

const ORIGINAL: Record<string, string | undefined> = {};
for (const key of KEYS) {
  ORIGINAL[key] = process.env[key];
}

function clearAll() {
  for (const key of KEYS) {
    delete process.env[key];
  }
  resetReceiptS3ClientCache();
}

afterEach(() => {
  clearAll();
  for (const key of KEYS) {
    if (ORIGINAL[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL[key];
    }
  }
  resetReceiptS3ClientCache();
});

describe("resolveReceiptS3Config", () => {
  it("prefers STORAGE_S3_* over AWS_*", () => {
    clearAll();
    process.env.STORAGE_S3_ENDPOINT = "https://storage.example";
    process.env.STORAGE_S3_ACCESS_KEY_ID = "sid";
    process.env.STORAGE_S3_SECRET_ACCESS_KEY = "ssec";
    process.env.STORAGE_S3_BUCKET = "payment-receipts-abc";
    process.env.STORAGE_S3_REGION = "auto";
    process.env.AWS_ENDPOINT_URL = "https://ignored.example";
    process.env.AWS_ACCESS_KEY_ID = "aid";
    process.env.AWS_SECRET_ACCESS_KEY = "asec";
    process.env.AWS_S3_BUCKET_NAME = "ignored-bucket";

    expect(resolveReceiptS3Config()).toEqual({
      endpoint: "https://storage.example",
      region: "auto",
      accessKeyId: "sid",
      secretAccessKey: "ssec",
      bucket: "payment-receipts-abc",
      forcePathStyle: false,
    });
  });

  it("falls back to Railway AWS_* injection vars", () => {
    clearAll();
    process.env.AWS_ENDPOINT_URL = "https://t3.storageapi.dev";
    process.env.AWS_ACCESS_KEY_ID = "tid_x";
    process.env.AWS_SECRET_ACCESS_KEY = "tsec_y";
    process.env.AWS_S3_BUCKET_NAME = "payment-receipts-d1yaxfcz";
    process.env.AWS_DEFAULT_REGION = "auto";

    expect(resolveReceiptS3Config()).toMatchObject({
      endpoint: "https://t3.storageapi.dev",
      accessKeyId: "tid_x",
      bucket: "payment-receipts-d1yaxfcz",
      forcePathStyle: false,
    });
  });

  it("sets forcePathStyle when url style is path", () => {
    clearAll();
    process.env.STORAGE_S3_ENDPOINT = "https://storage.example";
    process.env.STORAGE_S3_ACCESS_KEY_ID = "sid";
    process.env.STORAGE_S3_SECRET_ACCESS_KEY = "ssec";
    process.env.STORAGE_S3_BUCKET = "b";
    process.env.STORAGE_S3_URL_STYLE = "path";

    expect(resolveReceiptS3Config().forcePathStyle).toBe(true);
  });

  it("throws when required credentials are missing", () => {
    clearAll();
    expect(() => resolveReceiptS3Config()).toThrow(/misconfigured/);
  });
});
