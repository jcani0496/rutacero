"use client";

import { DeviceMobile } from "@phosphor-icons/react";
import { ICON } from "@/components/icons/phosphor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IosInstallSteps } from "@/components/pwa/ios-install-steps";
import { usePwaInstall } from "@/components/pwa/pwa-install-provider";

export function PwaInstallCard() {
  const { showSettings, kind, promptInstall } = usePwaInstall();

  if (!showSettings || !kind) return null;

  const isAndroid = kind === "android";
  const isOpenSafari = kind === "open-safari";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DeviceMobile {...ICON} className="h-5 w-5" />
          Instalar RutaCero
        </CardTitle>
        <CardDescription>
          {isAndroid
            ? "Instalá la app en tu teléfono para abrirla más rápido, sin el navegador."
            : isOpenSafari
              ? "La instalación en iPhone y iPad solo funciona desde Safari."
              : "Agregá RutaCero a tu pantalla de inicio desde Safari."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAndroid ? (
          <Button onClick={() => void promptInstall()}>Instalar RutaCero</Button>
        ) : isOpenSafari ? (
          <p className="text-sm text-muted-foreground">
            Abrí esta misma página en Safari, tocá Compartir y elegí{" "}
            <span className="font-medium text-foreground">
              Añadir a pantalla de inicio
            </span>
            .
          </p>
        ) : (
          <IosInstallSteps />
        )}
      </CardContent>
    </Card>
  );
}
