// I binding del Worker: wrangler.toml descrive dove vivono (var, secret,
// Durable Object). I secret (FEED_ID, FEED_PASSWORD, ADMIN_TOKEN) si
// impostano con `wrangler secret put`, mai nel repo — vedi README.
export interface Env {
  TRACKER: DurableObjectNamespace;
  ALLOWED_ORIGINS: string; // CSV di origini ammesse per CORS, es. "https://a.it,https://b.it"
  FEED_ID: string;
  FEED_PASSWORD?: string;
  ADMIN_TOKEN: string;
}
