import { afterEach, describe, expect, it, vi } from "vitest";

describe("data provider switch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to supabase", async () => {
    vi.stubEnv("DATA_PROVIDER", "");
    const { getDataProvider, isDrizzleEnabled } = await import(
      "@/lib/data/provider"
    );
    expect(getDataProvider()).toBe("supabase");
    expect(isDrizzleEnabled()).toBe(false);
  });

  it("enables drizzle when DATA_PROVIDER is set", async () => {
    vi.stubEnv("DATA_PROVIDER", "drizzle");
    const { getDataProvider, isDrizzleEnabled } = await import(
      "@/lib/data/provider"
    );
    expect(getDataProvider()).toBe("drizzle");
    expect(isDrizzleEnabled()).toBe(true);
  });

  it("treats unknown values as supabase", async () => {
    vi.stubEnv("DATA_PROVIDER", "postgres");
    const { getDataProvider, isDrizzleEnabled } = await import(
      "@/lib/data/provider"
    );
    expect(getDataProvider()).toBe("supabase");
    expect(isDrizzleEnabled()).toBe(false);
  });
});
