import type { Env } from "./env";
import type { Point } from "./util";

const SPOT_BASE = "https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed";

export interface RawFetchResult {
  points: Point[];
  raws: Map<string, unknown>; // id -> messaggio originale completo
}

/* Un messaggio SPOT grezzo diventa un Point normalizzato — qualunque sia
   messageType (il nostro tracker manda anche EXTREME-TRACK e
   NEWMOVEMENT, non solo TRACK: nessun filtro sul tipo, si salva e si
   conserva cosi' com'e', in modo da poterlo distinguere a posteriori).
   L'unico criterio e' avere lat/lon: senza una posizione un messaggio
   non serve alla traccia (un SOS o un OK senza GPS, per esempio) e non
   diventa un Point. Niente scarti ne' correzioni sulla quota (vedi
   spec): se altitude manca resta null, non si inventa uno zero. */
function normalize(m: Record<string, unknown>): Point | null {
  if (m.latitude == null || m.longitude == null) return null;
  const time = m.unixTime != null ? Number(m.unixTime) : m.dateTime ? Math.floor(Date.parse(String(m.dateTime)) / 1000) : null;
  if (time == null || Number.isNaN(time)) return null;
  const id = m.id != null ? String(m.id) : `t${time}`; // fallback raro: SPOT manda sempre un id, ma non si sa mai
  return {
    id,
    time,
    lat: Number(m.latitude),
    lon: Number(m.longitude),
    altitude: m.altitude != null ? Number(m.altitude) : null,
    messageType: m.messageType != null ? String(m.messageType) : null,
    batteryState: m.batteryState != null ? String(m.batteryState) : null,
  };
}

/* Una chiamata al feed pubblico SPOT. extraParams permette la paginazione
   del backfill (start=51, 101, ... oppure startDate/endDate). "nessun
   messaggio ancora" (E-0195) non e' un guasto: torna una pagina vuota.

   Ogni altro esito negativo (HTTP non-ok, risposta senza "response",
   errore SPOT strutturato) finisce per intero nei log del Worker
   (console.error, visibili in Logs sulla dashboard e con `npm run
   tail` — vedi [observability] in wrangler.toml), non solo come
   messaggio corto nell'eccezione: qui' c'e' lo status HTTP e il corpo
   completo della risposta, utile per capire un guasto reale di SPOT
   senza doverlo riprodurre. Mai l'URL della richiesta nei log: contiene
   FEED_ID e, se impostata, FEED_PASSWORD — sono secret apposta. */
export async function fetchSpotPage(env: Env, extraParams: Record<string, string> = {}): Promise<RawFetchResult> {
  const q = new URLSearchParams(extraParams);
  if (env.FEED_PASSWORD) q.set("feedPassword", env.FEED_PASSWORD);
  const qs = q.toString();
  const url = `${SPOT_BASE}/${env.FEED_ID}/message.json${qs ? "?" + qs : ""}`;
  const res = await fetch(url, { cf: { cacheTtl: 0 } });
  if (!res.ok) {
    const body = await res.text().catch(() => "(corpo non leggibile)");
    console.error(`[SPOT] HTTP ${res.status} ${res.statusText}\n${body}`);
    throw new Error(`SPOT HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  const r = data?.response;
  if (!r) {
    console.error(`[SPOT] risposta senza "response": ${JSON.stringify(data)}`);
    throw new Error("risposta SPOT vuota");
  }
  if (r.errors) {
    const e = r.errors.error || {};
    if (e.code === "E-0195") return { points: [], raws: new Map() }; // nessun messaggio, non e' un errore
    console.error(`[SPOT] errore ${e.code ?? "?"}: ${JSON.stringify(r.errors)}`);
    throw new Error(e.description || e.text || "errore SPOT sconosciuto");
  }
  const fr = r.feedMessageResponse;
  if (!fr || !fr.messages) return { points: [], raws: new Map() };
  // SPOT manda "message" come oggetto singolo (non in un array) quando c'e' un solo messaggio.
  let msgs: unknown = fr.messages.message || [];
  if (!Array.isArray(msgs)) msgs = [msgs];
  const points: Point[] = [];
  const raws = new Map<string, unknown>();
  for (const raw of msgs as Record<string, unknown>[]) {
    const p = normalize(raw);
    if (!p) continue;
    points.push(p);
    raws.set(p.id, raw);
  }
  return { points, raws };
}

/* --------------------------------------------------------------------
   Modalita' simulazione: niente chiamate vere a SPOT. Genera un volo
   finto, con buchi di segnale e id duplicati apposta, per provare il
   polling, la deduplica e la cadenza del Worker senza il tracker vero.
   simStartMs e' l'unico stato persistito (in SpotTracker): da quello,
   ogni chiamata ricostruisce deterministicamente tutta la sequenza di
   slot fino ad ora, cosi' due chiamate ravvicinate restano coerenti.
   -------------------------------------------------------------------- */
const SIM_STEP_S = 150; // lo stesso ritmo del tracker vero
const SIM_LAT0 = -33.2486, SIM_LON0 = -58.0736, SIM_BURST_KM = 37.9, SIM_ASC_MS = 5, SIM_DESC_MS = 4.6;

function simAltKm(s: number): number {
  if (s <= 0) return 0;
  const ascSec = (SIM_BURST_KM * 1000) / SIM_ASC_MS;
  if (s <= ascSec) return (s * SIM_ASC_MS) / 1000;
  // discesa: lineare va benissimo qui, questa simulazione prova il
  // Worker (dedup/cadenza), non la fisica — quella e' gia' in assets/spot.js
  const descSec = (SIM_BURST_KM * 1000) / SIM_DESC_MS;
  const t = Math.min(s - ascSec, descSec);
  return Math.max(SIM_BURST_KM - (t * SIM_DESC_MS) / 1000, 0);
}

/* Rumore/scelte deterministiche a partire dallo slot (non Math.random):
   lo stesso slot deve dare sempre lo stesso risultato, altrimenti un
   punto "vecchio" cambierebbe a ogni poll — lo stesso bug gia' preso e
   corretto nella simulazione lato browser (simulazione-diretta.html). */
function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function fetchFakeSpot(simStartS: number, nowS: number): RawFetchResult {
  const points: Point[] = [];
  const raws = new Map<string, unknown>();
  let lastId: string | null = null;
  for (let t = simStartS, slot = 0; t <= nowS; t += SIM_STEP_S, slot++) {
    const r1 = seeded(slot * 2), r2 = seeded(slot * 2 + 1);
    if (r1 < 0.1) continue; // buco di segnale: questo slot non manda nulla
    const s = t - simStartS;
    const driftKm = (Math.max(0, s) / 3600) * 15;
    const duplicate = r2 < 0.1 && lastId != null; // a volte rimanda l'ultimo id invariato
    const id = duplicate ? (lastId as string) : `sim${t}`;
    const raw = {
      id,
      unixTime: t,
      dateTime: new Date(t * 1000).toISOString(),
      latitude: SIM_LAT0 + driftKm / 111,
      longitude: SIM_LON0 + driftKm / 92,
      altitude: Math.round(simAltKm(s) * 1000),
      messageType: "TRACK",
      batteryState: "GOOD",
    };
    const p = normalize(raw);
    if (p) { points.push(p); raws.set(p.id, raw); lastId = p.id; }
  }
  return { points, raws };
}
