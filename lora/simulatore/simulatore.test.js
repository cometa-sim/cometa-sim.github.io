/* Test del simulatore: le righe che inventa devono essere righe che
   formato.js accetta, e il volo deve avere le fasi giuste. E' qui, in
   JavaScript, perche' il formato e' definito in formato.js e il
   simulatore Python non lo puo' importare: questo test e' il ponte fra i
   due. Gira con npm test in lora/worker/ (serve python3). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analizzaRiga, haPosizione } from "../formato/formato.js";

const SCRIPT = fileURLToPath(new URL("./simulatore.py", import.meta.url));

function simula(...opzioni) {
  const r = spawnSync("python3", [SCRIPT, "--solo-righe", "--seme", "7", ...opzioni], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim().split("\n");
}

test("senza righe rotte, ogni riga del simulatore e' valida per formato.js", () => {
  const righe = simula("--righe-rotte", "0");
  assert.ok(righe.length > 1000);
  for (const riga of righe) {
    const e = analizzaRiga(riga);
    assert.equal(e.ok, true, riga + ": " + (e.ok ? "" : e.errore));
    assert.equal(e.dati.id, "C2");
  }
});

test("il volo ha attesa senza fix, salita, scoppio, discesa e atterraggio", () => {
  const dati = simula("--righe-rotte", "0").map((r) => analizzaRiga(r)).map((e) => (e.ok ? e.dati : null));
  /* Il primo minuto il GPS non ha ancora il fix. */
  assert.equal(haPosizione(dati[0]), false);
  const conPos = dati.filter((d) => haPosizione(d));
  const quote = conPos.map((d) => d.alt_m);
  const massima = Math.max(...quote);
  assert.ok(massima > 37000 && massima < 39000, "quota massima " + massima);
  /* Subito dopo lo scoppio si scende veloci, poi il paracadute rallenta. */
  const vzMin = Math.min(...conPos.map((d) => d.vz_ms));
  assert.ok(vzMin < -40, "vz minima " + vzMin);
  const ultima = conPos[conPos.length - 1];
  assert.equal(ultima.vz_ms, 0);
  assert.ok(ultima.alt_m < 100);
  /* n cresce di uno a ogni riga. */
  dati.forEach((d, i) => assert.equal(d.n, i));
});

test("le righe rotte, quando ci sono, formato.js le scarta", () => {
  const righe = simula("--righe-rotte", "0.2");
  const scartate = righe.filter((r) => !analizzaRiga(r).ok).length;
  assert.ok(scartate > righe.length * 0.1 && scartate < righe.length * 0.3, "scartate " + scartate);
});

test("con --riavvio-min il contatore riparte da zero", () => {
  const dati = simula("--righe-rotte", "0", "--riavvio-min", "30").map((r) => analizzaRiga(r).dati);
  const zeri = dati.filter((d) => d.n === 0).length;
  assert.equal(zeri, 2);
});
