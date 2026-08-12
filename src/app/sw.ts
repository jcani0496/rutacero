/// <reference lib="webworker" />
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * P0 cache policy (debt data must never be cached):
 * - Documents / RSC / navigation → NetworkOnly (+ /offline fallback)
 * - /api/* and auth → NetworkOnly
 * - /_next/static/*, icons, fonts → CacheFirst / precache
 */
const runtimeCaching: RuntimeCaching[] =
  process.env.NODE_ENV !== "production"
    ? [{ matcher: /.*/i, handler: new NetworkOnly() }]
    : [
        {
          matcher: ({ url: { pathname }, sameOrigin }) =>
            sameOrigin &&
            (pathname.startsWith("/api/") ||
              pathname.startsWith("/auth/") ||
              pathname.startsWith("/api/auth")),
          handler: new NetworkOnly(),
        },
        {
          matcher: ({ request, sameOrigin }) =>
            sameOrigin &&
            (request.mode === "navigate" ||
              request.destination === "document" ||
              request.headers.get("RSC") === "1" ||
              request.headers.get("Next-Router-Prefetch") === "1" ||
              request.headers.get("Next-Router-State-Tree") !== null),
          handler: new NetworkOnly(),
        },
        {
          matcher: /\/_next\/static\/.*/i,
          handler: new CacheFirst({
            cacheName: "next-static-assets",
            plugins: [
              new ExpirationPlugin({
                maxEntries: 128,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                maxAgeFrom: "last-used",
              }),
            ],
          }),
        },
        {
          matcher: ({ url: { pathname }, sameOrigin }) =>
            sameOrigin &&
            (pathname.startsWith("/icons/") ||
              pathname === "/offline" ||
              pathname === "/favicon.ico" ||
              pathname === "/logo.svg" ||
              pathname === "/logo-dark.svg"),
          handler: new CacheFirst({
            cacheName: "static-icons-shell",
            plugins: [
              new ExpirationPlugin({
                maxEntries: 32,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                maxAgeFrom: "last-used",
              }),
            ],
          }),
        },
        {
          matcher: /\.(?:eot|otf|ttc|ttf|woff|woff2)$/i,
          handler: new CacheFirst({
            cacheName: "static-font-assets",
            plugins: [
              new ExpirationPlugin({
                maxEntries: 16,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                maxAgeFrom: "last-used",
              }),
            ],
          }),
        },
        {
          matcher: /.*/i,
          handler: new NetworkOnly(),
        },
      ];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return (
            request.mode === "navigate" || request.destination === "document"
          );
        },
      },
    ],
  },
});

serwist.addEventListeners();
