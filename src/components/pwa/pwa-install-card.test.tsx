import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  showSettings: true,
  kind: "android" as "android" | "safari" | "open-safari" | null,
  promptInstall: vi.fn(),
}));

vi.mock("@/components/pwa/pwa-install-provider", () => ({
  usePwaInstall: () => ({
    ready: true,
    kind: mocks.kind,
    showBanner: false,
    showSettings: mocks.showSettings,
    promptInstall: mocks.promptInstall,
    dismiss: vi.fn(),
  }),
}));

import { PwaInstallCard } from "./pwa-install-card";

describe("PwaInstallCard", () => {
  beforeEach(() => {
    mocks.showSettings = true;
    mocks.kind = "android";
    mocks.promptInstall.mockReset();
  });

  it("renders nothing when Settings should hide the offer", () => {
    mocks.showSettings = false;
    const { container } = render(<PwaInstallCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the Android install action in Settings", () => {
    render(<PwaInstallCard />);
    fireEvent.click(screen.getByRole("button", { name: "Instalar RutaCero" }));
    expect(mocks.promptInstall).toHaveBeenCalledTimes(1);
  });

  it("shows Safari steps on iOS", () => {
    mocks.kind = "safari";
    render(<PwaInstallCard />);
    expect(screen.getByText(/Tocá Compartir/)).toBeInTheDocument();
    expect(screen.getByText(/Añadir a pantalla de inicio/)).toBeInTheDocument();
  });
});
