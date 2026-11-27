// Clio: lucrează și fără internet după prima vizită.
// Paginile și lecțiile se iau întâi de pe internet (ca să fie mereu la zi),
// iar dacă nu e conexiune, din copia salvată pe telefon.
const CACHE = "clio-v3";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const DATA = ["5.json", "6.json", "7.json", "8.json", "articole.json", "data/5.json", "data/6.json", "data/7.json", "data/8.json", "data/articole.json"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled([...CORE, ...DATA].map(async (u) => {
      const r = await fetch(u, { cache: "no-cache" });
      if (r.ok) await c.put(u, r);
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== self.location.origin && !fonts) return;

  if (fonts) {
    // fonturile se schimbă rar: întâi din copie, apoi de pe internet
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); c.put(req, r.clone()); return r; }
      catch (err) { return new Response("", { status: 504 }); }
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetch(req);
      if (r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") {
        const home = await c.match("index.html");
        if (home) return home;
      }
      return new Response("", { status: 404, statusText: "Offline" });
    }
  })());
});
