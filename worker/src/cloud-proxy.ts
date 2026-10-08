import type { Env } from "./env";

/* Proxy per le mattonelle nuvole di OpenWeatherMap (usato dal livello
   "nuvole" della mappa — vedi assets/mapkit.js sul sito). La chiave
   vera sta solo come secret (OWM_KEY, mai nel repo — vedi README):
   OpenWeatherMap non supporta restrizioni per dominio/referrer sulle
   chiavi, quindi una chiave nel JS pubblico del sito potrebbe essere
   letta e riusata da chiunque. Qui il controllo lo fa il Worker
   leggendo Referer, non Origin come corsHeaders() in util.ts: le
   mattonelle arrivano come <img src> di Leaflet, non fetch(), e un
   <img> non manda mai un header Origin.

   Mattonelle in cache 10 minuti (le nuvole non cambiano piu' spesso
   di cosi'), cosi' tante richieste alla stessa mattonella consumano
   una sola chiamata vera a OpenWeatherMap. */
export async function handleCloudTile(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const m = url.pathname.match(/^\/clouds\/(\d+)\/(\d+)\/(\d+)\.png$/);
  const z = m?.[1], x = m?.[2], y = m?.[3];
  if (z === undefined || x === undefined || y === undefined) return new Response("Not found", { status: 404 });

  const referer = req.headers.get("Referer") || "";
  const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  if (!allowedOrigins.some((o) => referer.startsWith(o))) return new Response("Forbidden", { status: 403 });

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), req);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const owmUrl = `https://tile.openweathermap.org/map/clouds_new/${z}/${x}/${y}.png?appid=${env.OWM_KEY}`;
  const owmResp = await fetch(owmUrl);

  const resp = new Response(owmResp.body, owmResp);
  resp.headers.set("Cache-Control", "public, max-age=600");
  ctx.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}
