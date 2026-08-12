import { describe, expect, it } from "vitest";
import {
  getIosInstallMode,
  isDismissedValue,
  isIosDevice,
  isIosSafari,
  isNativeCapacitorShell,
  isStandaloneDisplay,
  resolvePwaInstallOffer,
} from "./install-eligibility";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

describe("isStandaloneDisplay", () => {
  it("is true when display-mode is standalone", () => {
    expect(
      isStandaloneDisplay({ displayModeStandalone: true, navigatorStandalone: false }),
    ).toBe(true);
  });

  it("is true when navigator.standalone is set (iOS)", () => {
    expect(
      isStandaloneDisplay({ displayModeStandalone: false, navigatorStandalone: true }),
    ).toBe(true);
  });

  it("is false in a regular browser tab", () => {
    expect(
      isStandaloneDisplay({ displayModeStandalone: false, navigatorStandalone: false }),
    ).toBe(false);
  });
});

describe("isIosDevice / isIosSafari", () => {
  it("detects iPhone Safari", () => {
    expect(
      isIosDevice({ userAgent: IPHONE_SAFARI, platform: "iPhone", maxTouchPoints: 5 }),
    ).toBe(true);
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(
      getIosInstallMode({
        userAgent: IPHONE_SAFARI,
        platform: "iPhone",
        maxTouchPoints: 5,
      }),
    ).toBe("safari");
  });

  it("asks Chrome-on-iOS users to open Safari", () => {
    expect(
      getIosInstallMode({
        userAgent: IPHONE_CHROME,
        platform: "iPhone",
        maxTouchPoints: 5,
      }),
    ).toBe("open-safari");
  });

  it("detects iPadOS that reports as Macintosh", () => {
    expect(
      isIosDevice({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("does not treat Android Chrome as iOS", () => {
    expect(
      isIosDevice({ userAgent: ANDROID_CHROME, platform: "Linux armv8l", maxTouchPoints: 5 }),
    ).toBe(false);
    expect(getIosInstallMode({
      userAgent: ANDROID_CHROME,
      platform: "Linux armv8l",
      maxTouchPoints: 5,
    })).toBeNull();
  });
});

describe("isNativeCapacitorShell", () => {
  it("is true only when Capacitor reports a native platform", () => {
    expect(isNativeCapacitorShell({ isNativePlatform: () => true })).toBe(true);
    expect(isNativeCapacitorShell({ isNativePlatform: () => false })).toBe(false);
    expect(isNativeCapacitorShell(undefined)).toBe(false);
  });
});

describe("resolvePwaInstallOffer", () => {
  it("hides everything when already installed", () => {
    expect(
      resolvePwaInstallOffer({
        standalone: true,
        native: false,
        dismissed: false,
        hasDeferredPrompt: true,
        iosMode: null,
      }),
    ).toEqual({ kind: null, showBanner: false, showSettings: false });
  });

  it("hides everything inside Capacitor", () => {
    expect(
      resolvePwaInstallOffer({
        standalone: false,
        native: true,
        dismissed: false,
        hasDeferredPrompt: true,
        iosMode: "safari",
      }),
    ).toEqual({ kind: null, showBanner: false, showSettings: false });
  });

  it("shows Android CTA when beforeinstallprompt was captured", () => {
    expect(
      resolvePwaInstallOffer({
        standalone: false,
        native: false,
        dismissed: false,
        hasDeferredPrompt: true,
        iosMode: null,
      }),
    ).toEqual({ kind: "android", showBanner: true, showSettings: true });
  });

  it("keeps Settings after banner dismissal", () => {
    expect(
      resolvePwaInstallOffer({
        standalone: false,
        native: false,
        dismissed: true,
        hasDeferredPrompt: true,
        iosMode: null,
      }),
    ).toEqual({ kind: "android", showBanner: false, showSettings: true });
  });

  it("offers iOS Safari instructions without a native prompt", () => {
    expect(
      resolvePwaInstallOffer({
        standalone: false,
        native: false,
        dismissed: false,
        hasDeferredPrompt: false,
        iosMode: "safari",
      }),
    ).toEqual({ kind: "safari", showBanner: true, showSettings: true });
  });

  it("does not offer install on desktop without a prompt", () => {
    expect(
      resolvePwaInstallOffer({
        standalone: false,
        native: false,
        dismissed: false,
        hasDeferredPrompt: false,
        iosMode: null,
      }),
    ).toEqual({ kind: null, showBanner: false, showSettings: false });
  });
});

describe("isDismissedValue", () => {
  it("accepts persisted dismissal tokens", () => {
    expect(isDismissedValue("1")).toBe(true);
    expect(isDismissedValue("true")).toBe(true);
    expect(isDismissedValue(null)).toBe(false);
    expect(isDismissedValue("0")).toBe(false);
  });
});
