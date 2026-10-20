/* Test delle fasi del volo (fasi.js): npm test in lora/worker/. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analizzaRiga, haPosizione } from "./formato.js";
import "./fasi.js";

const F = globalThis.COMETA_FASI;
const T0 = Date.UTC(2026, 9, 28, 14, 0, 0);

/* Un volo del simulatore, con le ore "vere" di ogni riga (una ogni 5 s
   dall'accensione): l'attesa a terra e' di 3 minuti, quindi il lancio e'
   a T0 + 180 s. */
function voloSimulato() {
  const sim = fileURLToPath(new URL("../simulatore/simulatore.py", import.meta.url));
  const r = spawnSync("python3", [sim, "--solo-righe", "--seme", "11", "--righe-rotte", "0"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim().split("\n").map(function (riga, i) { return { t: T0 + 5000 * i, d: analizzaRiga(riga).dati }; });
}

function percorri(righe, lancioMs) {
  const s = F.nuovo(lancioMs, 4.6);
  const fasi = [];
  for (const { t, d } of righe) {
    if (haPosizione(d)) F.aggiungi(s, { t, lat: d.lat, lon: d.lon, alt: d.alt_m, vz: d.vz_ms });
    const f = F.fase(s, t);
    if (fasi[fasi.length - 1]?.f !== f) fasi.push({ f, t, alt: d.alt_m });
  }
  return { s, fasi };
}

test("un volo intero passa per attesa, salita, discesa, atterrata, in quest'ordine", () => {
  const righe = voloSimulato();
  const { s, fasi } = percorri(righe, T0 + 180000);
  const nomi = fasi.map((x) => x.f);
  assert.deepEqual(nomi, ["attesa", "salita", "paracadute", "atterrata"]);
  assert.equal(fasi[1].t, T0 + 180000);
  /* Lo scoppio riconosciuto al massimo della quota, entro pochi secondi. */
  const max = Math.max(...righe.filter((x) => x.d.alt_m !== null).map((x) => x.d.alt_m));
  assert.ok(Math.abs(s.scoppio.alt - max) < 50, "scoppio a " + s.scoppio.alt + ", massimo " + max);
  assert.ok(fasi[2].t - s.scoppio.t <= 15000, "scoppio riconosciuto dopo " + (fasi[2].t - s.scoppio.t) / 1000 + " s");
  /* L'atterraggio riconosciuto poco dopo che la sonda si e' fermata. */
  const fermaDa = righe.find((x, i) => i > 0 && x.d.vz_ms === 0 && righe[i - 1].d.vz_ms < 0);
  assert.ok(fasi[3].t - fermaDa.t <= 45000, "atterraggio riconosciuto dopo " + (fasi[3].t - fermaDa.t) / 1000 + " s");
});

test("prima dell'ora del lancio si resta in attesa, qualunque cosa faccia il GPS", () => {
  const righe = voloSimulato();
  const { fasi } = percorri(righe, T0 + 365 * 86400000);   // lancio fra un anno: e' una prova a terra
  assert.deepEqual(fasi.map((x) => x.f), ["attesa"]);
});

test("camminando, o con un GPS che scivola, dopo il lancio non si vede nessuno scoppio", () => {
  /* Come alla prova a scuola: vz fra -4 e +4 m/s, e una quota che scende
     piano fino a -225 m. */
  const s = F.nuovo(T0, 4.6);
  for (let i = 0; i < 400; i++) {
    const vz = Math.sin(i / 3) * 3.7;
    F.aggiungi(s, { t: T0 + 5000 * i, lat: -34.87 + i * 1e-5, lon: -56.05, alt: i < 200 ? -i * 1.1 : 10, vz });
  }
  assert.equal(F.fase(s, T0 + 5000 * 400), "salita");
  assert.equal(s.scoppio, null);
});

test("dopo lo scoppio, la caduta libera si distingue dalla discesa col paracadute", () => {
  const s = F.nuovo(T0, 4.6);
  F.aggiungi(s, { t: T0 + 1000, lat: -33, lon: -57, alt: 30000, vz: 5 });
  F.aggiungi(s, { t: T0 + 6000, lat: -33, lon: -57, alt: 29700, vz: -150 });
  F.aggiungi(s, { t: T0 + 11000, lat: -33, lon: -57, alt: 29000, vz: -150 });
  assert.equal(F.fase(s, T0 + 11000), "caduta");           // a 29 km il paracadute farebbe ~40 m/s
  F.aggiungi(s, { t: T0 + 16000, lat: -33, lon: -57, alt: 28800, vz: -35 });
  assert.equal(F.fase(s, T0 + 16000), "paracadute");
});

test("l'ora del lancio e la discesa si leggono da assets/app.js", () => {
  const app = readFileSync(new URL("../../assets/app.js", import.meta.url), "utf8");
  const t = F.lancioDaAppJs(app);
  assert.ok(Number.isFinite(t), "LAUNCH non trovato in assets/app.js: e' cambiato il modo in cui e' scritto?");
  assert.ok(F.v0DaAppJs(app) > 0, "FLIGHT_DESCENT_V0_MS non trovato in assets/app.js");
  assert.equal(F.lancioDaAppJs('const LAUNCH = new Date("2026-10-28T11:00:00-03:00");'), Date.parse("2026-10-28T14:00:00Z"));
  assert.equal(F.lancioDaAppJs("niente"), null);
});
