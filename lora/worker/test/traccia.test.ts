/* Test della traccia come dato (src/traccia.ts): npm test. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { analizzaRiga } from "../../formato/formato.js";
import type { Dati } from "../../formato/formato.js";
import { tracciaVuota, unisci, ultimoDa, leggiTraccia, PUNTI_IN_ULTIMO } from "../src/traccia.ts";

function dati(riga: string): Dati {
  const e = analizzaRiga(riga);
  if (!e.ok) throw new Error(e.errore);
  return e.dati;
}

const A = "C2,1,140000,-33.2,-58.0,100.0,5.00,8,3,4.98";
const B = "C2,2,140005,-33.2,-58.0,125.0,5.00,8,3,4.98";
const SENZA_FIX = "C2,3,,,,,,4,0,4.97";

test("le righe nuove si aggiungono, i doppioni no", () => {
  const t0 = tracciaVuota("C2");
  const r1 = unisci(t0, [{ t: 100, dati: dati(A) }, { t: 105, dati: dati(B) }]);
  assert.equal(r1.aggiunte, 2);
  /* La seconda stazione manda gli stessi due pacchetti, piu' uno. */
  const r2 = unisci(r1.traccia, [{ t: 101, dati: dati(A) }, { t: 106, dati: dati(B) }, { t: 110, dati: dati(SENZA_FIX) }]);
  assert.equal(r2.aggiunte, 1);
  assert.equal(r2.traccia.righe.length, 3);
  /* L'ora tenuta e' quella della prima ricezione. */
  assert.equal(r2.traccia.righe[0]![0], 100);
});

test("un doppione ricevuto prima da un'altra stazione corregge l'ora", () => {
  const r1 = unisci(tracciaVuota("C2"), [{ t: 105, dati: dati(A) }]);
  const r2 = unisci(r1.traccia, [{ t: 103, dati: dati(A) }]);
  assert.equal(r2.aggiunte, 0);
  assert.equal(r2.cambiate, true);
  assert.equal(r2.traccia.righe[0]![0], 103);
});

test("niente di nuovo: nessun cambiamento, e la traccia letta resta intatta", () => {
  const r1 = unisci(tracciaVuota("C2"), [{ t: 100, dati: dati(A) }]);
  const prima = JSON.stringify(r1.traccia);
  const r2 = unisci(r1.traccia, [{ t: 100, dati: dati(A) }, { t: 120, dati: dati(A) }]);
  assert.equal(r2.cambiate, false);
  assert.equal(JSON.stringify(r1.traccia), prima);
});

test("dopo un riavvio della sonda n riparte da zero e i punti nuovi si tengono", () => {
  const prima = "C2,5,141000,-33.1,-57.9,3000.0,5.00,9,3,4.90";
  const dopo = "C2,5,141500,-33.0,-57.8,5500.0,5.00,9,3,4.89";
  const r = unisci(tracciaVuota("C2"), [{ t: 1000, dati: dati(prima) }, { t: 1500, dati: dati(dopo) }]);
  assert.equal(r.aggiunte, 2);
});

test("l'ordine e' quello di ricezione, anche se arrivano mescolate", () => {
  const r = unisci(tracciaVuota("C2"), [{ t: 105, dati: dati(B) }, { t: 100, dati: dati(A) }]);
  assert.deepEqual(r.traccia.righe.map((x) => x[1]), [1, 2]);
});

test("ultimo.json: ultimi punti, totale, ultima posizione anche se gli ultimi sono senza fix", () => {
  const nuove = [{ t: 100, dati: dati(A) }];
  for (let i = 0; i < 30; i++) nuove.push({ t: 200 + 5 * i, dati: dati(`C2,${10 + i},,,,,,3,0,4.90`) });
  const { traccia } = unisci(tracciaVuota("C2"), nuove);
  const u = ultimoDa(traccia);
  assert.equal(u.totale, 31);
  assert.equal(u.righe.length, PUNTI_IN_ULTIMO);
  assert.equal(u.ultimo_pacchetto, 200 + 5 * 29);
  assert.ok(u.ultima_posizione);
  assert.equal(u.ultima_posizione![1], 1);
});

test("ultimo.json di una traccia vuota", () => {
  const u = ultimoDa(tracciaVuota("C2"));
  assert.equal(u.totale, 0);
  assert.equal(u.ultimo_pacchetto, null);
  assert.equal(u.ultima_posizione, null);
  assert.deepEqual(u.righe, []);
});

test("una traccia di un altro formato o di un'altra sonda non si legge", () => {
  const t = tracciaVuota("C2");
  assert.doesNotThrow(() => leggiTraccia(JSON.stringify(t), "C2"));
  assert.throws(() => leggiTraccia(JSON.stringify(t), "C3"), /altra sonda/);
  assert.throws(() => leggiTraccia(JSON.stringify({ ...t, colonne: ["t", "n"] }), "C2"), /formato diverso/);
  assert.throws(() => leggiTraccia("{}", "C2"), /non valido/);
});

test("unire tremila righe resta veloce", () => {
  /* Un volo di quattro ore a una riga ogni 5 s. Sul piano gratuito un
     Worker ha 10 ms di CPU per richiesta: qui si controlla che il
     calcolo resti lontano da quel limite (su un computer normale ci
     mette pochi millisecondi). */
  const nuove = [];
  for (let i = 0; i < 2880; i++) {
    nuove.push({ t: 1000 + 5 * i, dati: dati(`C2,${i},14${String(i % 60).padStart(2, "0")}00,-33.${i},-58.${i},${i * 10}.0,5.00,9,3,4.90`) });
  }
  const { traccia } = unisci(tracciaVuota("C2"), nuove);
  const testo = JSON.stringify(traccia);
  const inizio = performance.now();
  const letta = leggiTraccia(testo, "C2");
  const r = unisci(letta, [{ t: 99999, dati: dati("C2,99999,150000,-33.5,-58.5,100.0,5.00,9,3,4.90") }]);
  JSON.stringify(r.traccia);
  JSON.stringify(ultimoDa(r.traccia));
  const ms = performance.now() - inizio;
  assert.equal(r.aggiunte, 1);
  assert.ok(ms < 50, `troppo lento: ${ms.toFixed(1)} ms`);
  console.log(`  ${traccia.righe.length} righe, ${(testo.length / 1024).toFixed(0)} kB, unione in ${ms.toFixed(1)} ms`);
});
