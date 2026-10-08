/* ============================================================
   COMETA — proxy per le mattonelle nuvole di OpenWeatherMap.
   La chiave OWM sta come secret (dashboard Cloudflare: Settings >
   Variables and Secrets, nome OWM_KEY), mai nel codice pubblico del
   sito. Controlla anche che le richieste arrivino dal dominio del
   sito (Referer), una protezione che OpenWeatherMap stesso non offre
   sulla chiave — e tiene le mattonelle in cache 10 minuti (le nuvole
   non cambiano piu' spesso di cosi'), cosi' tante richieste alla
   stessa mattonella consumano una sola chiamata vera a OpenWeatherMap.

   URL atteso dal sito: https://<questo-worker>.workers.dev/clouds/{z}/{x}/{y}.png
   ============================================================ */

const ALLOWED_ORIGINS = [
  "https://cometa-sim.github.io"
  // aggiungi qui altri domini se il sito e' raggiungibile anche da li'
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/clouds\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (!m) return new Response("Not found", { status: 404 });

    const referer = request.headers.get("Referer") || request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.some(function (o) { return referer.indexOf(o) === 0; });
    if (!allowed) return new Response("Forbidden", { status: 403 });

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const [, z, x, y] = m;
    const owmUrl = "https://tile.openweathermap.org/map/clouds_new/" + z + "/" + x + "/" + y + ".png?appid=" + env.OWM_KEY;
    const owmResp = await fetch(owmUrl);

    const resp = new Response(owmResp.body, owmResp);
    resp.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0]);
    resp.headers.set("Cache-Control", "public, max-age=600");
    ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  }
};
