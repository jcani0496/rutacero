import { afterEach, describe, expect, it, vi } from "vitest";

describe("data provider switch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to drizzle", async () => {
    vi.stubEnv("DATA_PROVIDER", "");
    const { getDataProvider, isDrizzleEnabled } = await import(
      "@/lib/data/provider"
    );
    expect(getDataProvider()).toBe("drizzle");
    expect(isDrizzleEnabled()).toBe(true);
  });

  it("keeps supabase when DATA_PROVIDER is set", async () => {
    vi.stubEnv("DATA_PROVIDER", "supabase");
    const { getDataProvider, isDrizzleEnabled } = await import(
      "@/lib/data/provider"
    );
    expect(getDataProvider()).toBe("supabase");
    expect(isDrizzleEnabled()).toBe(false);
  });

  it("treats unknown values as drizzle", async () => {
    vi.stubEnv("DATA_PROVIDER", "postgres");
    const { getDataProvider, isDrizzleEnabled } = await import(
      "@/lib/data/provider"
    );
    expect(getDataProvider()).toBe("drizzle");
    expect(isDrizzleEnabled()).toBe(true);
  });
});
