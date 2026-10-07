import type { Env } from "./env";

/* Verifica della firma X-WSSE che SPOT manda a ogni Data Push, secondo
   lo standard WSSE UsernameToken (SPOT Commercial Account Data Push
   User Guide, sez. "Reducing the security vulnerabilities"):

     X-WSSE: UsernameToken Username="...", PasswordDigest="...",
             Nonce="...", Created="..."

   PasswordDigest = base64(SHA-1(nonce_grezzo + created + secretToken))
   dove "nonce_grezzo" e' il Nonce decodificato da base64 (non la
   stringa base64 stessa), "created" e' la stringa ISO8601 cosi' com'e'
   nell'header, "secretToken" e' SPOT_PUSH_SECRET (il "token segreto"
   dalla scheda Data Push di SPOT MyAccount). Username deve coincidere
   con SPOT_PUSH_USERNAME (il "token cliente" della stessa scheda). */

export interface WsseCheckResult {
  ok: boolean;
  reason?: string;
  nonceB64?: string;
}

// SPOT raccomanda un intervallo di freschezza di 1 ora (stesso usato per
// la pulizia dei nonce visti, vedi checkAndStoreNonce in tracker.ts).
export const WSSE_FRESHNESS_MS = 60 * 60 * 1000;
const CLOCK_SKEW_FORWARD_MS = 5 * 60 * 1000; // tolleranza se Created e' un po' nel futuro

function parseWsseHeader(header: string): { username: string; passwordDigest: string; nonceB64: string; created: string } | null {
  const get = (name: string) => {
    const m = header.match(new RegExp(`${name}="([^"]*)"`));
    return m && m[1] != null ? m[1] : null;
  };
  const username = get("Username");
  const passwordDigest = get("PasswordDigest");
  const nonceB64 = get("Nonce");
  const created = get("Created");
  if (!username || !passwordDigest || !nonceB64 || !created) return null;
  return { username, passwordDigest, nonceB64, created };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i] as number);
  return btoa(bin);
}

export async function checkWsseSignature(xwsseHeader: string | null, env: Env): Promise<WsseCheckResult> {
  if (!env.SPOT_PUSH_USERNAME || !env.SPOT_PUSH_SECRET) {
    return { ok: false, reason: "SPOT_PUSH_USERNAME/SPOT_PUSH_SECRET non configurati sul Worker" };
  }
  if (!xwsseHeader) return { ok: false, reason: "manca l'header X-WSSE" };
  const parsed = parseWsseHeader(xwsseHeader);
  if (!parsed) return { ok: false, reason: "X-WSSE malformato" };
  if (parsed.username !== env.SPOT_PUSH_USERNAME) return { ok: false, reason: "Username errato" };

  const createdMs = Date.parse(parsed.created);
  if (Number.isNaN(createdMs)) return { ok: false, reason: "Created non e' una data valida" };
  const ageMs = Date.now() - createdMs;
  if (ageMs > WSSE_FRESHNESS_MS || ageMs < -CLOCK_SKEW_FORWARD_MS) {
    return { ok: false, reason: `Created fuori dall'intervallo di freschezza (${Math.round(ageMs / 1000)}s)` };
  }

  let nonceBytes: Uint8Array;
  try {
    nonceBytes = base64ToBytes(parsed.nonceB64);
  } catch {
    return { ok: false, reason: "Nonce non e' base64 valido" };
  }
  const createdBytes = new TextEncoder().encode(parsed.created);
  const secretBytes = new TextEncoder().encode(env.SPOT_PUSH_SECRET);
  const data = new Uint8Array(nonceBytes.length + createdBytes.length + secretBytes.length);
  data.set(nonceBytes, 0);
  data.set(createdBytes, nonceBytes.length);
  data.set(secretBytes, nonceBytes.length + createdBytes.length);

  const digest = await crypto.subtle.digest("SHA-1", data);
  const expected = bytesToBase64(digest);
  if (expected !== parsed.passwordDigest) return { ok: false, reason: "PasswordDigest non corrisponde" };

  return { ok: true, nonceB64: parsed.nonceB64 };
}
