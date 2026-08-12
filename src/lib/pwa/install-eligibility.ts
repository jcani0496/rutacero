export const PWA_INSTALL_DISMISS_KEY = "rutacero-pwa-install-dismissed";

export type IosInstallMode = "safari" | "open-safari";

export type PwaInstallKind = "android" | IosInstallMode;

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export function isStandaloneDisplay(input: {
  displayModeStandalone: boolean;
  navigatorStandalone?: boolean;
}): boolean {
  return input.displayModeStandalone || input.navigatorStandalone === true;
}

export function isIosDevice(input: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): boolean {
  const ua = input.userAgent;
  if (/windows phone/i.test(ua)) return false;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Macintosh with touch.
  return input.platform === "MacIntel" && input.maxTouchPoints > 1;
}

export function isIosSafari(userAgent: string): boolean {
  return (
    /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|OPiOS|EdgiOS|Chrome|Android/i.test(userAgent)
  );
}

export function getIosInstallMode(input: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): IosInstallMode | null {
  if (!isIosDevice(input)) return null;
  return isIosSafari(input.userAgent) ? "safari" : "open-safari";
}

export function isNativeCapacitorShell(
  capacitor?: { isNativePlatform?: () => boolean } | null,
): boolean {
  return Boolean(capacitor?.isNativePlatform?.());
}

export function isDismissedValue(value: string | null): boolean {
  return value === "1" || value === "true";
}

/**
 * Banner (app chrome) is eligible when the device can install and the user
 * has not dismissed it. Settings ignores dismissal so the action stays available.
 */
export function resolvePwaInstallOffer(input: {
  standalone: boolean;
  native: boolean;
  dismissed: boolean;
  hasDeferredPrompt: boolean;
  iosMode: IosInstallMode | null;
}): { kind: PwaInstallKind | null; showBanner: boolean; showSettings: boolean } {
  if (input.standalone || input.native) {
    return { kind: null, showBanner: false, showSettings: false };
  }

  const kind: PwaInstallKind | null = input.hasDeferredPrompt
    ? "android"
    : input.iosMode;

  if (!kind) {
    return { kind: null, showBanner: false, showSettings: false };
  }

  return {
    kind,
    showBanner: !input.dismissed,
    showSettings: true,
  };
}
