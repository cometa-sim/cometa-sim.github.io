import type { Env } from "./env.ts";

/* CORS: solo le origini in ALLOWED_ORIGINS. La pagina della stazione e'
   servita dal sito stesso, quindi le sue richieste arrivano da una di
   queste origini. Il CORS non e' la protezione del Worker — la protezione
   e' la chiave — ma evita che una pagina qualunque, aperta da chi ha la
   chiave salvata nel browser, possa leggere le risposte. Il simulatore e
   gli script non mandano Origin e il CORS non li riguarda. */
export function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const ammesse = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  const h: Record<string, string> = { Vary: "Origin" };
  if (ammesse.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

export function rispostaJson(dati: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(dati), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

/* "Authorization: Bearer <CHIAVE_STAZIONE>". Senza secret configurato non
   passa nessuno: meglio un Worker che rifiuta tutto che uno aperto. */
export function chiaveValida(req: Request, env: Env): boolean {
  const attesa = env.CHIAVE_STAZIONE;
  if (!attesa) return false;
  const m = (req.headers.get("Authorization") || "").match(/^Bearer (.+)$/);
  if (!m || !m[1]) return false;
  return confrontoCostante(m[1], attesa);
}

/* Confronto a tempo costante: un confronto normale si ferma al primo
   carattere diverso, e dal tempo di risposta si potrebbe indovinare la
   chiave un carattere alla volta. */
function confrontoCostante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
