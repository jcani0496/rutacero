import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA manifest (P0)", () => {
  const m = manifest();

  it("keeps start_url at / and Spanish locale", () => {
    expect(m.start_url).toBe("/");
    expect(m.id).toBe("/");
    expect(m.lang).toBe("es-GT");
    expect(m.display).toBe("standalone");
  });

  it("uses paper/brand colors instead of leftover blue", () => {
    expect(m.theme_color).toBe("#0D9488");
    expect(m.background_color).toBe("#FAF6EC");
    expect(m.theme_color).not.toBe("#3B82F6");
  });

  it("ships square launcher icons with any + maskable purposes", () => {
    const icons = m.icons ?? [];
    const srcs = icons.map((i) => i.src);
    expect(srcs).toContain("/icons/icon-192.png");
    expect(srcs).toContain("/icons/icon-512.png");
    expect(srcs).toContain("/icons/icon-maskable-512.png");
    expect(srcs.every((s) => !s.includes("logo.png"))).toBe(true);

    const purposes = icons.map((i) => i.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
  });
});
