import { afterEach, describe, expect, it } from "vitest";
import { PWA_INSTALL_DISMISS_KEY } from "./install-eligibility";
import { readPwaInstallDismissed, writePwaInstallDismissed } from "./install-storage";

describe("pwa install storage", () => {
  afterEach(() => {
    window.localStorage.removeItem(PWA_INSTALL_DISMISS_KEY);
  });

  it("starts un-dismissed", () => {
    expect(readPwaInstallDismissed()).toBe(false);
  });

  it("persists dismissal in localStorage", () => {
    writePwaInstallDismissed();
    expect(window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY)).toBe("1");
    expect(readPwaInstallDismissed()).toBe(true);
  });
});
