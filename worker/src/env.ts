// I binding del Worker: wrangler.toml descrive dove vivono (var, secret,
// Durable Object). I secret (FEED_ID, FEED_PASSWORD, ADMIN_TOKEN) si
// impostano con `wrangler secret put`, mai nel repo — vedi README.
export interface Env {
  TRACKER: DurableObjectNamespace;
  ALLOWED_ORIGINS: string; // CSV di origini ammesse per CORS, es. "https://a.it,https://b.it"
  FEED_ID: string;
  FEED_PASSWORD?: string;
  ADMIN_TOKEN: string;
  /* "true" per far interrogare SPOT al Worker stesso (alarm interno).
     SPOT blocca le richieste dai Worker di Cloudflare (403 anti-bot) ma
     accetta quelle da un browser: finche' non si trova un modo per
     farla funzionare da qui, resta spento (assente o diverso da "true")
     e il polling lo fa la pagina di amministrazione via /claim+/ingest.
     Il codice del polling interno resta, solo disattivato — vedi
     alarm() in tracker.ts. */
  INTERNAL_POLLING_ENABLED?: string;
}
