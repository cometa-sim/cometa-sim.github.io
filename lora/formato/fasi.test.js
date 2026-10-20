/* Test delle fasi del volo (fasi.js): npm test in lora/worker/. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
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

test("assets/volo.js da' l'ora del lancio e i dati del volo, anche fuori dal sito", () => {
  /* La pagina della stazione lo carica da solo, senza app.js: deve
     bastare a se stesso. */
  const codice = readFileSync(new URL("../../assets/volo.js", import.meta.url), "utf8");
  const finestra = {};
  vm.runInNewContext(codice, { window: finestra, URLSearchParams, fetch: () => Promise.reject(new Error("no")) });
  /* instanceof Date non vale fra due contesti vm diversi: si guarda getTime. */
  assert.ok(finestra.COMETA_LAUNCH && Number.isFinite(finestra.COMETA_LAUNCH.getTime()), "COMETA_LAUNCH mancante");
  assert.ok(finestra.COMETA_FLIGHT.descentV0Ms > 0 && finestra.COMETA_FLIGHT.site, "COMETA_FLIGHT incompleto");
  assert.equal(typeof finestra.COMETA_PREVISIONE, "function");
  assert.match(finestra.COMETA_LORA_DATI, /^https:\/\//);
});

test("filtro della Diretta: fix scarsi e quote impossibili non passano", () => {
  const f = F.nuovoFiltro();
  const p = (t, extra) => Object.assign({ t: T0 + t * 1000, lat: -33.2, lon: -58.0, alt: 50, vz: 0, sats: 9, fix: 3 }, extra);
  assert.equal(F.filtra(f, p(0, { fix: 0 })).length, 0);
  assert.equal(F.filtra(f, p(5, { sats: 4 })).length, 0);
  assert.equal(F.filtra(f, p(10, { alt: -225 })).length, 0);         // come alla prova a scuola
  assert.equal(F.statoFiltro(f, T0 + 10000), "attesa");
  assert.equal(F.filtra(f, p(15)).length, 1);
  assert.equal(F.statoFiltro(f, T0 + 20000), "ok");
});

test("filtro della Diretta: un salto isolato si ignora, tre punti concordi si accettano", () => {
  const f = F.nuovoFiltro();
  const p = (t, lat, alt) => ({ t: T0 + t * 1000, lat: lat, lon: -58.0, alt: alt, vz: 5, sats: 9, fix: 3 });
  F.filtra(f, p(0, -33.20, 1000));
  F.filtra(f, p(5, -33.2001, 1025));
  assert.equal(F.filtra(f, p(10, -32.0, 1050)).length, 0);           // 130 km in 5 s: impossibile
  assert.equal(F.filtra(f, p(15, -33.2002, 1075)).length, 1);        // si riprende dal buono
  /* Un buono che era sbagliato: tre punti concordi lo scavalcano. */
  const g = F.nuovoFiltro();
  F.filtra(g, p(0, -31.0, 1000));                                     // il primo era sbagliato
  assert.equal(F.filtra(g, p(5, -33.20, 1025)).length, 0);
  assert.equal(F.filtra(g, p(10, -33.2001, 1050)).length, 0);
  assert.equal(F.filtra(g, p(15, -33.2002, 1075)).length, 3);
});

test("filtro della Diretta: senza punti buoni da un minuto, segnale perso", () => {
  const f = F.nuovoFiltro();
  F.filtra(f, { t: T0, lat: -33.2, lon: -58, alt: 100, vz: 5, sats: 9, fix: 3 });
  for (let i = 1; i <= 15; i++) F.filtra(f, { t: T0 + 5000 * i, lat: null, lon: null, alt: null, vz: null, sats: 3, fix: 0 });
  assert.equal(F.statoFiltro(f, T0 + 59000), "ok");
  assert.equal(F.statoFiltro(f, T0 + 75000), "perso");
});

test("un volo intero del simulatore passa il filtro quasi tutto", () => {
  const righe = voloSimulato();
  const f = F.nuovoFiltro();
  let con = 0, presi = 0;
  for (const { t, d } of righe) {
    if (!haPosizione(d)) continue;
    con++;
    presi += F.filtra(f, { t, lat: d.lat, lon: d.lon, alt: d.alt_m, vz: d.vz_ms, sats: d.sats, fix: d.fix }).length;
  }
  assert.ok(presi / con > 0.98, presi + " su " + con);
});
