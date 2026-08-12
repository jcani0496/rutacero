import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("PWA service worker policy (P0)", () => {
  const swSrc = readFileSync(join(process.cwd(), "src/app/sw.ts"), "utf8");
  const registerSrc = readFileSync(
    join(process.cwd(), "src/components/sw-register.tsx"),
    "utf8"
  );
  const proxySrc = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");

  it("never uses Serwist defaultCache (which NetworkFirst-caches HTML/RSC/API)", () => {
    expect(swSrc).not.toMatch(/defaultCache/);
    expect(swSrc).toMatch(/NetworkOnly/);
    expect(swSrc).toMatch(/\/api\//);
    expect(swSrc).toMatch(/RSC/);
    expect(swSrc).toMatch(/skipWaiting:\s*true/);
    expect(swSrc).toMatch(/\/offline/);
  });

  it("registers Serwist only in production and disables navigation caching", () => {
    expect(registerSrc).toMatch(/cacheOnNavigation=\{false\}/);
    expect(registerSrc).toMatch(/disable=\{!isProd\}/);
    expect(registerSrc).toMatch(/\/serwist\/sw\.js/);
  });

  it("excludes /serwist from the proxy matcher and keeps worker-src", () => {
    expect(proxySrc).toMatch(/serwist/);
    expect(proxySrc).toMatch(/worker-src 'self' blob:/);
  });
});
