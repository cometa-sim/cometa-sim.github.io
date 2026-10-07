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
  /* Data Push: SPOT manda lui i dati a POST / (XML), invece di farceli
     chiedere — vedi handleDataPush in tracker.ts. Autenticato con la
     firma X-WSSE che SPOT stesso manda a ogni chiamata (vedi wsse.ts),
     non con ADMIN_TOKEN. Valori dalla scheda Data Push di SPOT
     MyAccount (myaccount.findmespot.com -> SPOT API -> Data Push):
     SPOT_PUSH_USERNAME e' il "token cliente", SPOT_PUSH_SECRET il
     "token segreto" — mai nel repo, si impostano con
     `wrangler secret put`, come ADMIN_TOKEN. Senza questi due il
     Data Push viene sempre rifiutato (401), non e' un guasto: resta
     solo /claim+/ingest dalla pagina di amministrazione. */
  SPOT_PUSH_USERNAME?: string;
  SPOT_PUSH_SECRET?: string;
  /* Opzionale: se l'account SPOT ha piu' di un dispositivo, il Data
     Push manda i messaggi di tutti — impostando l'ESN della nostra
     sonda qui, i messaggi di altri dispositivi vengono scartati senza
     nemmeno entrare nello storage. Lasciarlo vuoto accetta tutto
     (va bene se l'account ha un solo dispositivo). */
  SPOT_PUSH_ESN?: string;
}
