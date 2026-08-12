import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  showBanner: true,
  kind: "android" as "android" | "safari" | "open-safari" | null,
  promptInstall: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("@/components/pwa/pwa-install-provider", () => ({
  usePwaInstall: () => ({
    ready: true,
    kind: mocks.kind,
    showBanner: mocks.showBanner,
    showSettings: true,
    promptInstall: mocks.promptInstall,
    dismiss: mocks.dismiss,
  }),
}));

import { PwaInstallBanner } from "./pwa-install-banner";

describe("PwaInstallBanner", () => {
  beforeEach(() => {
    mocks.showBanner = true;
    mocks.kind = "android";
    mocks.promptInstall.mockReset();
    mocks.dismiss.mockReset();
  });

  it("renders nothing when hidden", () => {
    mocks.showBanner = false;
    const { container } = render(<PwaInstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("prompts the native install dialog on Android", () => {
    render(<PwaInstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Instalar RutaCero" }));
    expect(mocks.promptInstall).toHaveBeenCalledTimes(1);
  });

  it("persists dismissal from the close control", () => {
    render(<PwaInstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(mocks.dismiss).toHaveBeenCalledTimes(1);
  });

  it("opens iOS instructions instead of a native prompt", () => {
    mocks.kind = "safari";
    render(<PwaInstallBanner />);
    expect(screen.queryByRole("button", { name: "Instalar RutaCero" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cómo instalar" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Añadir a pantalla de inicio");
  });

  it("tells Chrome-on-iOS users to open Safari", () => {
    mocks.kind = "open-safari";
    render(<PwaInstallBanner />);
    expect(screen.getByText(/abrí esta página en Safari/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Instalar RutaCero" })).not.toBeInTheDocument();
  });
});
