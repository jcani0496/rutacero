"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { SerwistProvider, useSerwist } from "@serwist/turbopack/react";
import { toast } from "@/components/ui/toast";

const SW_URL = "/serwist/sw.js";
const isProd = process.env.NODE_ENV === "production";

/**
 * Drop the legacy stub at `/sw.js` so we never run dual service workers.
 */
async function unregisterLegacyServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      const scriptURL =
        registration.active?.scriptURL ||
        registration.waiting?.scriptURL ||
        registration.installing?.scriptURL ||
        "";
      if (scriptURL.endsWith("/sw.js") && !scriptURL.includes("/serwist/")) {
        try {
          await registration.unregister();
        } catch {
          // ignore — best-effort cleanup
        }
      }
    })
  );
}

function SwUpdateListener() {
  const { serwist } = useSerwist();
  const toastShown = useRef(false);

  useEffect(() => {
    void unregisterLegacyServiceWorkers();
  }, []);

  useEffect(() => {
    if (!serwist || !isProd) return;

    const promptReload = () => {
      if (toastShown.current) return;
      toastShown.current = true;
      toast.info("Nueva versión disponible", {
        description: "Recargá para actualizar RutaCero.",
        duration: 20_000,
        action: {
          label: "Recargar",
          onClick: () => {
            window.location.reload();
          },
        },
      });
    };

    // With skipWaiting:true the new SW activates immediately; `waiting` usually
    // does not fire. Prompt on update install instead.
    const onInstalled = (event: { isUpdate?: boolean }) => {
      if (event.isUpdate) promptReload();
    };
    const onWaiting = () => {
      promptReload();
      serwist.messageSkipWaiting();
    };

    serwist.addEventListener("installed", onInstalled);
    serwist.addEventListener("waiting", onWaiting);

    return () => {
      serwist.removeEventListener("installed", onInstalled);
      serwist.removeEventListener("waiting", onWaiting);
    };
  }, [serwist]);

  return null;
}

/**
 * Registers Serwist in production only. `cacheOnNavigation` stays false so
 * authenticated HTML/RSC routes are never pushed into the SW cache.
 */
export function SWRegister({ children }: { children?: ReactNode }) {
  return (
    <SerwistProvider
      swUrl={SW_URL}
      disable={!isProd}
      register={isProd}
      cacheOnNavigation={false}
      reloadOnOnline={false}
    >
      <SwUpdateListener />
      {children}
    </SerwistProvider>
  );
}
