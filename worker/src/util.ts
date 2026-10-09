import type { Env } from "./env";

export interface Point {
  id: string;
  time: number; // unix, secondi
  lat: number | null;
  lon: number | null;
  altitude: number | null;
  messageType: string | null;
  batteryState: string | null;
}

/* CORS: solo le origini in ALLOWED_ORIGINS (CSV in wrangler.toml) possono
   leggere gli endpoint pubblici — e, da quando la pagina di
   amministrazione chiama /claim e /ingest dal browser, anche quelli
   protetti (il Bearer token resta il vero controllo d'accesso: i CORS
   header dicono solo al browser chi puo' LEGGERE la risposta). Serve
   "Authorization" fra gli header ammessi (altrimenti il preflight
   rifiuta la richiesta prima ancora che parta) e POST fra i metodi.
   Niente wildcard: qui girano anche i dati per DINACIA, meglio restare
   espliciti su chi li legge dal browser. */
export function corsHeaders(req: Request, env: Env): HeadersInit {
  const origin = req.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  const h: Record<string, string> = { Vary: "Origin" };
  if (allowed.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
  }
  return h;
}

export function jsonResponse(data: unknown, init: ResponseInit = {}, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders, ...init.headers },
  });
}

/* Gli endpoint protetti (start/stop/backfill/reset/public-from/simulate/
   track-all) vogliono "Authorization: Bearer <ADMIN_TOKEN>". Confronto a
   lunghezza costante per non prestare il fianco a un timing attack banale
   su un token comunque semplice. */
export function checkAuth(req: Request, env: Env): boolean {
  const h = req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer (.+)$/);
  if (!m || !m[1]) return false;
  return timingSafeEqual(m[1], env.ADMIN_TOKEN);
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

const MVD_TZ = "America/Montevideo";

/* "2026-10-14T11:03:27-03:00" circa — Workers ha l'ICU completa, stessa
   tecnica di isoDay() in assets/traiettoria.js, qui per il CSV. */
export function montevideoIso(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MVD_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}-03:00`;
}

export function pointsToCsv(points: Point[]): string {
  const header = ["time_utc", "time_montevideo", "lat", "lon", "altitude_m", "messageType", "batteryState"];
  const rows = points.map((p) => [
    new Date(p.time * 1000).toISOString(),
    montevideoIso(p.time),
    p.lat ?? "",
    p.lon ?? "",
    p.altitude ?? "",
    csvEscape(p.messageType ?? ""),
    csvEscape(p.batteryState ?? ""),
  ]);
  return [header, ...rows].map((r) => r.join(",")).join("\r\n") + "\r\n";
}

function csvEscape(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
