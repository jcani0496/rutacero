import {
  isDismissedValue,
  PWA_INSTALL_DISMISS_KEY,
} from "@/lib/pwa/install-eligibility";

export function readPwaInstallDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return isDismissedValue(window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY));
  } catch {
    return false;
  }
}

export function writePwaInstallDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PWA_INSTALL_DISMISS_KEY, "1");
  } catch {
    // Private browsing / disabled storage: in-memory dismiss still applies.
  }
}
