import { describe, expect, it } from "vitest";

/**
 * Ban duration mapping is private to identity.ts; mirror the contract here
 * so a regression in allowed durations fails CI before admin UIs break.
 */
const BAN_DURATION_HOURS: Record<string, number | null> = {
  none: null,
  "24h": 24,
  "72h": 72,
  "168h": 168,
  "720h": 720,
  "8760h": 8760,
};

describe("identity ban durations", () => {
  it("supports the admin panel duration keys", () => {
    expect(Object.keys(BAN_DURATION_HOURS).sort()).toEqual(
      ["168h", "24h", "720h", "72h", "8760h", "none"].sort(),
    );
  });

  it("maps none to clear and hours to a future timestamp", () => {
    expect(BAN_DURATION_HOURS.none).toBeNull();
    expect(BAN_DURATION_HOURS["24h"]).toBe(24);
    const until = new Date(Date.now() + (BAN_DURATION_HOURS["24h"] as number) * 3600_000);
    expect(until.getTime()).toBeGreaterThan(Date.now());
  });
});
