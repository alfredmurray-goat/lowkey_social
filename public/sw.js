/* Kill-switch cleanup worker: evicts old lowkey-v1 caches and unregisters itself. */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const ownCaches = cacheNames.filter(
          (name) =>
            name.startsWith("lowkey-") ||
            (/(^|-)precache-v\d+-|(^|-)runtime-/.test(name) && name.endsWith(self.registration.scope)),
        );
        await Promise.allSettled(ownCaches.map((name) => caches.delete(name)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(windowClients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);