"use client";

import { useState } from "react";
import { DeviceMobile, X } from "@phosphor-icons/react";
import { ICON } from "@/components/icons/phosphor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IosInstallSteps } from "@/components/pwa/ios-install-steps";
import { usePwaInstall } from "@/components/pwa/pwa-install-provider";

export function PwaInstallBanner() {
  const { showBanner, kind, promptInstall, dismiss } = usePwaInstall();
  const [iosOpen, setIosOpen] = useState(false);

  if (!showBanner || !kind) return null;

  const isAndroid = kind === "android";
  const isOpenSafari = kind === "open-safari";

  return (
    <div
      role="region"
      aria-label="Instalar RutaCero"
      className="border-b border-border bg-primary/5 px-4 py-3 lg:px-8"
    >
      <div className="flex items-start gap-3 sm:items-center">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[var(--rc-teal-text)] sm:mt-0"
        >
          <DeviceMobile {...ICON} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Instalá RutaCero en tu teléfono
          </p>
          <p className="text-sm text-muted-foreground">
            {isAndroid
              ? "Abrila desde la pantalla de inicio, sin el navegador."
              : isOpenSafari
                ? "Para instalarla, abrí esta página en Safari."
                : "En Safari: Compartir → Añadir a pantalla de inicio."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isAndroid ? (
            <Button size="sm" onClick={() => void promptInstall()}>
              Instalar RutaCero
            </Button>
          ) : isOpenSafari ? null : (
            <Button size="sm" onClick={() => setIosOpen(true)}>
              Cómo instalar
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={dismiss}
            aria-label="Ahora no"
          >
            <X {...ICON} className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Instalar RutaCero</DialogTitle>
            <DialogDescription>
              Safari no muestra un botón nativo. Seguí estos pasos una vez:
            </DialogDescription>
          </DialogHeader>
          <IosInstallSteps />
        </DialogContent>
      </Dialog>
    </div>
  );
}
