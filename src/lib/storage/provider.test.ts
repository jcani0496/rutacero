import { afterEach, describe, expect, it } from "vitest";
import { getStorageProvider, isRailwayStorageEnabled } from "./provider";

const ORIGINAL = {
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
  NEXT_PUBLIC_STORAGE_PROVIDER: process.env.NEXT_PUBLIC_STORAGE_PROVIDER,
};

afterEach(() => {
  if (ORIGINAL.STORAGE_PROVIDER === undefined) {
    delete process.env.STORAGE_PROVIDER;
  } else {
    process.env.STORAGE_PROVIDER = ORIGINAL.STORAGE_PROVIDER;
  }
  if (ORIGINAL.NEXT_PUBLIC_STORAGE_PROVIDER === undefined) {
    delete process.env.NEXT_PUBLIC_STORAGE_PROVIDER;
  } else {
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER =
      ORIGINAL.NEXT_PUBLIC_STORAGE_PROVIDER;
  }
});

describe("getStorageProvider", () => {
  it("defaults to supabase", () => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.NEXT_PUBLIC_STORAGE_PROVIDER;
    expect(getStorageProvider()).toBe("supabase");
    expect(isRailwayStorageEnabled()).toBe(false);
  });

  it("returns railway when STORAGE_PROVIDER=railway", () => {
    process.env.STORAGE_PROVIDER = "railway";
    delete process.env.NEXT_PUBLIC_STORAGE_PROVIDER;
    expect(getStorageProvider()).toBe("railway");
    expect(isRailwayStorageEnabled()).toBe(true);
  });

  it("reads NEXT_PUBLIC_STORAGE_PROVIDER when STORAGE_PROVIDER unset", () => {
    delete process.env.STORAGE_PROVIDER;
    process.env.NEXT_PUBLIC_STORAGE_PROVIDER = "railway";
    expect(getStorageProvider()).toBe("railway");
  });

  it("treats unknown values as supabase", () => {
    process.env.STORAGE_PROVIDER = "minio";
    expect(getStorageProvider()).toBe("supabase");
  });
});
