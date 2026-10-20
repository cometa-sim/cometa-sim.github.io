/* Service worker della pagina della stazione: la fa riaprire anche
   senza rete. Al sito di lancio o in macchina internet puo' mancare, e
   una pagina ricaricata per sbaglio non deve diventare una pagina
   bianca proprio allora.

   - La pagina e Leaflet: prima la rete (cosi' una versione nuova arriva
     appena c'e' connessione), e se la rete non c'e' la copia salvata.
   - Le mattonelle della mappa: prima la copia salvata, e intanto si
     salvano quelle nuove. Guardare la zona del volo sulla mappa a casa,
     con la rete, la rende disponibile anche offline.
   - Il Worker (lora.cometa.gripe) non passa mai di qui: le richieste
     verso altri domini che non siano le mattonelle si lasciano stare. */
const CACHE = "cometa-stazione-v5";
const MATTONELLE = "cometa-stazione-mattonelle";
const GUSCIO = ["./", "../../assets/vendor/leaflet/leaflet.js", "../../assets/vendor/leaflet/leaflet.css",
  "../../assets/i18n.js?v=stazione-2", "../../assets/mapkit.js?v=stazione-2", "../../assets/map3d.js?v=stazione-2",
  "../formato/fasi.js?v=stazione-4", "../../assets/volo.js?v=stazione-4", "../../assets/msis.js?v=stazione-4",
  "../../assets/traiettoria.js?v=stazione-4"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(GUSCIO); }).then(function () { return self.skipWaiting(); }));
});

/* Le copie delle versioni precedenti si buttano: non devono mai
   ripresentarsi. */
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (nomi) {
    return Promise.all(nomi.filter(function (n) { return n !== CACHE && n !== MATTONELLE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname === "tile.openstreetmap.org") {
    e.respondWith(caches.open(MATTONELLE).then(function (c) {
      return c.match(e.request).then(function (salvata) {
        const rete = fetch(e.request).then(function (r) { if (r.ok) c.put(e.request, r.clone()); return r; });
        return salvata || rete;
      });
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  /* cache: "no-cache" chiede sempre al server se la pagina e' cambiata
     (GitHub Pages risponde 304 se no): senza, il browser puo' usare la
     sua copia per 10 minuti, e una correzione appena pubblicata non
     arriva. */
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(function (r) {
    if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copia); }); }
    return r;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true });
  }));
});
