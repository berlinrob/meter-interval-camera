const CACHE = "meter-watch-v3";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(async (saved) => {
    if (saved) return saved;
    const response = await fetch(event.request);
    if (response.ok) void caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }));
});
