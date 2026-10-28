/* Test della discesa prevista dall'ultima posizione (discesa.js): npm test in lora/worker/. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analizzaRiga, haPosizione } from "./formato.js";
import "./fasi.js";
import "./discesa.js";

const F = globalThis.COMETA_FASI;
const D = globalThis.COMETA_DISCESA;
const T0 = Date.UTC(2026, 9, 28, 14, 0, 0);

/* Un volo del simulatore col paracadute a v0 m/s, passato per il filtro
   della Diretta come fa la stazione: i punti buoni, in ordine. */
function puntiBuoni(v0) {
  const sim = fileURLToPath(new URL("../simulatore/simulatore.py", import.meta.url));
  const r = spawnSync("python3", [sim, "--solo-righe", "--seme", "11", "--righe-rotte", "0", "--discesa", String(v0)], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const filtro = F.nuovoFiltro();
  r.stdout.trim().split("\n").forEach(function (riga, i) {
    const d = analizzaRiga(riga).dati;
    if (haPosizione(d)) F.filtra(filtro, { t: T0 + 5000 * i, lat: d.lat, lon: d.lon, alt: d.alt_m, vz: d.vz_ms, sats: d.sats, fix: d.fix });
  });
  return filtro.buoni;
}

/* I punti fino a quello a quota h, in discesa. */
function finoA(punti, h) {
  const i = punti.findIndex((p, k) => k > 0 && p.vz < -1 && p.alt <= h);
  assert.ok(i > 0, "il volo non scende sotto " + h + " m");
  return punti.slice(0, i + 1);
}

test("la velocita' del paracadute al suolo si ritrova dalla vz, a ogni quota", () => {
  const punti = puntiBuoni(6.0);
  for (const h of [30000, 15000, 5000, 1000]) {
    const v0 = D.v0Misurata(finoA(punti, h));
    assert.ok(v0 !== null && Math.abs(v0 - 6.0) < 0.3, "a " + h + " m: " + v0);
  }
});

test("in salita, o con meno di 3 punti in discesa, la velocita' non si misura", () => {
  const punti = puntiBuoni(4.6);
  const salita = punti.filter((p) => p.vz > 1).slice(0, 40);
  assert.equal(D.v0Misurata(salita), null);
  const inizio = finoA(punti, 1e9);
  assert.equal(D.v0Misurata(inizio.slice(-2)), null);
  assert.equal(D.v0Misurata([]), null);
});

test("una misura impossibile non si usa", () => {
  const p = (t, vz) => ({ t, alt: 1000, vz });
  assert.equal(D.v0Misurata([p(0, -80), p(5000, -80), p(10000, -80)]), null);   // 80 m/s a 1 km: non e' un paracadute
  const v = D.v0Misurata([p(0, -5), p(5000, -60), p(10000, -5.2), p(15000, -5.1)]);   // un punto storto non sposta la mediana
  assert.ok(Math.abs(v - 5.2 / F.vParacadute(1000, 1)) < 0.2, String(v));
});

test("si parte solo da un punto fresco, con la quota", () => {
  const u = { t: T0, lat: -34, lon: -55, alt: 12000, vz: -9 };
  assert.equal(D.partenza([u], T0 + 30000), u);
  assert.equal(D.partenza([u], T0 + 31000), null);
  assert.equal(D.partenza([{ ...u, alt: null }], T0), null);
  assert.equal(D.partenza([], T0), null);
});

test("si ricalcola ogni minuto, ogni 30 s sotto i 3 km", () => {
  const p = (t, alt) => ({ t, alt });
  assert.equal(D.daRifare(null, p(0, 20000)), true);
  assert.equal(D.daRifare(p(0, 20000), p(55000, 19700)), false);
  assert.equal(D.daRifare(p(0, 20000), p(60000, 19600)), true);
  assert.equal(D.daRifare(p(0, 3100), p(30000, 2950)), true);
  assert.equal(D.daRifare(p(0, 3100), p(25000, 2980)), false);
});

test("la richiesta a Tawhiri parte dalla posizione, con lo scoppio 1 m sopra", () => {
  const q = D.parametri({ t: T0 + 1234, lat: -34.123456, lon: -55.5, alt: 12345.6 }, 5.437);
  assert.deepEqual(q, {
    profile: "standard_profile",
    launch_latitude: "-34.12346",
    launch_longitude: "304.50000",
    launch_altitude: "12346",
    launch_datetime: "2026-10-28T14:00:01Z",
    ascent_rate: "5.00",
    burst_altitude: "12347",
    descent_rate: "5.44"
  });
});

test("dalla risposta di Tawhiri si prende la discesa", () => {
  const punto = (m, lat, lon, alt) => ({ datetime: new Date(T0 + m * 60000).toISOString(), latitude: lat, longitude: lon, altitude: alt });
  const d = { prediction: [
    { stage: "ascent", trajectory: [punto(0, -34, 304.5, 12346), punto(0, -34, 304.5, 12347)] },
    { stage: "descent", trajectory: [punto(0, -34, 304.5, 12347), punto(20, -34.05, 304.62, 6000), punto(45, -34.1, 304.7, 120)] }
  ] };
  const r = D.leggi(d);
  assert.equal(r.pts.length, 3);
  assert.deepEqual(r.end, { t: T0 + 45 * 60000, lat: -34.1, lon: 304.7 - 360, alt: 120 });
  assert.equal(D.leggi({ error: { description: "x" } }), null);
  assert.equal(D.leggi({ prediction: [{ stage: "ascent", trajectory: [] }] }), null);
  assert.equal(D.leggi(null), null);
});
