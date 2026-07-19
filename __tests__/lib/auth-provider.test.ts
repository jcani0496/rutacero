import { afterEach, describe, expect, it, vi } from "vitest";

describe("auth provider switch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to supabase", async () => {
    vi.stubEnv("AUTH_PROVIDER", "");
    vi.stubEnv("NEXT_PUBLIC_AUTH_PROVIDER", "");
    const { getAuthProvider, isBetterAuthEnabled } = await import(
      "@/lib/auth/provider"
    );
    expect(getAuthProvider()).toBe("supabase");
    expect(isBetterAuthEnabled()).toBe(false);
  });

  it("enables better-auth when AUTH_PROVIDER is set", async () => {
    vi.stubEnv("AUTH_PROVIDER", "better-auth");
    const { getAuthProvider, isBetterAuthEnabled } = await import(
      "@/lib/auth/provider"
    );
    expect(getAuthProvider()).toBe("better-auth");
    expect(isBetterAuthEnabled()).toBe(true);
  });
});
