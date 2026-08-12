"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "@/components/ui/toast";
import {
  getIosInstallMode,
  isNativeCapacitorShell,
  isStandaloneDisplay,
  resolvePwaInstallOffer,
  type BeforeInstallPromptEvent,
  type IosInstallMode,
  type PwaInstallKind,
} from "@/lib/pwa/install-eligibility";
import {
  readPwaInstallDismissed,
  writePwaInstallDismissed,
} from "@/lib/pwa/install-storage";

interface PwaInstallContextValue {
  ready: boolean;
  kind: PwaInstallKind | null;
  showBanner: boolean;
  showSettings: boolean;
  promptInstall: () => Promise<void>;
  dismiss: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function subscribeNoop(): () => void {
  return () => {};
}

function subscribeDisplayMode(onStoreChange: () => void): () => void {
  const media = window.matchMedia?.("(display-mode: standalone)");
  media?.addEventListener?.("change", onStoreChange);
  return () => media?.removeEventListener?.("change", onStoreChange);
}

function readStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayModeStandalone = window.matchMedia?.(
    "(display-mode: standalone)",
  ).matches;
  const navigatorStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return isStandaloneDisplay({ displayModeStandalone, navigatorStandalone });
}

function readNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (
    window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  return isNativeCapacitorShell(cap);
}

function readIosMode(): IosInstallMode | null {
  if (typeof window === "undefined") return null;
  return getIosInstallMode({
    userAgent: window.navigator.userAgent,
    platform: window.navigator.platform,
    maxTouchPoints: window.navigator.maxTouchPoints ?? 0,
  });
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const mediaStandalone = useSyncExternalStore(
    subscribeDisplayMode,
    readStandalone,
    () => false,
  );
  const native = useSyncExternalStore(subscribeNoop, readNative, () => false);
  const storedDismissed = useSyncExternalStore(
    subscribeNoop,
    readPwaInstallDismissed,
    () => false,
  );
  const iosMode = useSyncExternalStore(subscribeNoop, readIosMode, () => null);

  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [sessionInstalled, setSessionInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setSessionInstalled(true);
      writePwaInstallDismissed();
      setSessionDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const offer = useMemo(
    () =>
      resolvePwaInstallOffer({
        standalone: mediaStandalone || sessionInstalled,
        native,
        dismissed: storedDismissed || sessionDismissed,
        hasDeferredPrompt: deferredPrompt !== null,
        iosMode,
      }),
    [
      mediaStandalone,
      sessionInstalled,
      native,
      storedDismissed,
      sessionDismissed,
      deferredPrompt,
      iosMode,
    ],
  );

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") {
        setSessionInstalled(true);
        writePwaInstallDismissed();
        setSessionDismissed(true);
        toast.success("Listo. RutaCero queda en tu pantalla de inicio.");
      }
    } catch {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    writePwaInstallDismissed();
    setSessionDismissed(true);
  }, []);

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      ready: true,
      kind: offer.kind,
      showBanner: offer.showBanner,
      showSettings: offer.showSettings,
      promptInstall,
      dismiss,
    }),
    [offer, promptInstall, dismiss],
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall(): PwaInstallContextValue {
  const context = useContext(PwaInstallContext);
  if (!context) {
    return {
      ready: false,
      kind: null,
      showBanner: false,
      showSettings: false,
      promptInstall: async () => {},
      dismiss: () => {},
    };
  }
  return context;
}
