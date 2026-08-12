import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PWA_INSTALL_DISMISS_KEY } from "@/lib/pwa/install-eligibility";

const toastSuccess = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

import {
  PwaInstallProvider,
  usePwaInstall,
} from "./pwa-install-provider";

function Probe() {
  const install = usePwaInstall();
  return (
    <div>
      <span data-testid="ready">{String(install.ready)}</span>
      <span data-testid="kind">{install.kind ?? "none"}</span>
      <span data-testid="banner">{String(install.showBanner)}</span>
      <span data-testid="settings">{String(install.showSettings)}</span>
      <button type="button" onClick={() => void install.promptInstall()}>
        prompt
      </button>
      <button type="button" onClick={install.dismiss}>
        dismiss
      </button>
    </div>
  );
}

function dispatchBeforeInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn(async () => {});
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    platforms: string[];
  };
  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome, platform: "play" });
  event.platforms = ["play"];
  window.dispatchEvent(event);
  return { prompt, event };
}

describe("PwaInstallProvider", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    window.localStorage.removeItem(PWA_INSTALL_DISMISS_KEY);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile Safari/537.36",
    });
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    window.localStorage.removeItem(PWA_INSTALL_DISMISS_KEY);
  });

  it("captures beforeinstallprompt and prompts on demand", async () => {
    render(
      <PwaInstallProvider>
        <Probe />
      </PwaInstallProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));

    let capturedPrompt: ReturnType<typeof vi.fn> | undefined;
    act(() => {
      capturedPrompt = dispatchBeforeInstallPrompt("accepted").prompt;
    });

    await waitFor(() => expect(screen.getByTestId("kind")).toHaveTextContent("android"));
    expect(screen.getByTestId("banner")).toHaveTextContent("true");

    fireEvent.click(screen.getByRole("button", { name: "prompt" }));
    await waitFor(() => expect(capturedPrompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY)).toBe("1");
  });

  it("hides the banner after dismiss but keeps Settings eligible until reload logic", async () => {
    render(
      <PwaInstallProvider>
        <Probe />
      </PwaInstallProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));

    act(() => {
      dispatchBeforeInstallPrompt("dismissed");
    });
    await waitFor(() => expect(screen.getByTestId("banner")).toHaveTextContent("true"));

    fireEvent.click(screen.getByRole("button", { name: "dismiss" }));
    expect(screen.getByTestId("banner")).toHaveTextContent("false");
    expect(screen.getByTestId("settings")).toHaveTextContent("true");
    expect(window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY)).toBe("1");
  });

  it("hides the offer when the app is already standalone", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("standalone"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    render(
      <PwaInstallProvider>
        <Probe />
      </PwaInstallProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    act(() => {
      dispatchBeforeInstallPrompt("accepted");
    });
    expect(screen.getByTestId("kind")).toHaveTextContent("none");
    expect(screen.getByTestId("banner")).toHaveTextContent("false");
    expect(screen.getByTestId("settings")).toHaveTextContent("false");
  });
});
