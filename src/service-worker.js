/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from "$service-worker";

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (globalThis.self));

const CACHE_NAME = `longbox-${version}`;
const APP_ASSETS = new Set([...build, ...files]);

sw.addEventListener("install", (event) => {
  async function cacheAppAssets() {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_ASSETS);
  }

  event.waitUntil(cacheAppAssets());
  void sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  async function removeOldCaches() {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
  }

  event.waitUntil(removeOldCaches());
  void sw.clients.claim();
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== sw.location.origin || url.pathname.startsWith("/api/")) return;

  async function respond() {
    const cache = await caches.open(CACHE_NAME);

    if (APP_ASSETS.has(url.pathname)) {
      const cachedAsset = await cache.match(url.pathname);
      if (cachedAsset) return cachedAsset;
    }

    try {
      const response = await fetch(request);

      if (
        response instanceof Response &&
        response.status === 200 &&
        !response.headers.get("cache-control")?.includes("no-store")
      ) {
        await cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) return cachedResponse;

      throw error;
    }
  }

  event.respondWith(respond());
});
