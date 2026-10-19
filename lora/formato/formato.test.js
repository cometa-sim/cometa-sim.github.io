/* Test del formato della riga radio: node --test lora/formato/
   (vedi lora/README.md). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analizzaRiga, haPosizione, inRiga, daRiga, chiaveDoppione, COLONNE } from "./formato.js";

const casi = JSON.parse(readFileSync(new URL("./casi.json", import.meta.url), "utf8"));

test("le righe valide si leggono con i valori giusti", () => {
  for (const caso of casi.validi) {
    const r = analizzaRiga(caso.riga);
    assert.equal(r.ok, true, JSON.stringify(caso.riga) + ": " + r.errore);
    assert.deepEqual(r.dati, caso.dati, JSON.stringify(caso.riga));
    assert.equal(haPosizione(r.dati), caso.posizione, JSON.stringify(caso.riga));
  }
});

test("le righe non valide si scartano", () => {
  for (const caso of casi.non_validi) {
    const r = analizzaRiga(caso.riga);
    assert.equal(r.ok, false, JSON.stringify(caso.riga) + " (" + caso.motivo + ") e' stata accettata");
    assert.equal(typeof r.errore, "string");
  }
});

test("analizzaRiga non lancia mai, qualunque cosa riceva", () => {
  for (const x of [null, undefined, 42, {}, [], "\u0000\u0001", ",,,,,,,,,"]) {
    const r = analizzaRiga(x);
    assert.equal(r.ok, false);
  }
});

test("inRiga e daRiga sono una l'inversa dell'altra", () => {
  const { dati } = analizzaRiga(casi.validi[0].riga);
  const riga = inRiga(dati, 1760000000);
  assert.equal(riga.length, COLONNE.length);
  assert.equal(riga[0], 1760000000);
  const indietro = daRiga(riga);
  const { t, ...resto } = indietro;
  assert.equal(t, 1760000000);
  const { id, ...senzaId } = dati;
  assert.deepEqual(resto, senzaId);
});

test("la chiave dei doppioni non dipende da come sono scritti i numeri", () => {
  /* La stessa misura scritta in due modi: deve dare la stessa chiave,
     cosi' un doppione si riconosce anche se un giorno il firmware
     cambia il numero di decimali. */
  const a = analizzaRiga("C2,412,143210,-33.245678,-58.031234,18240.0,5.20,9,3,4.98").dati;
  const b = analizzaRiga("C2,412,143210,-33.245678,-58.031234,18240,5.2,9,3,4.98").dati;
  assert.equal(chiaveDoppione(a), chiaveDoppione(b));
  /* Stesso n dopo un riavvio, ma un altro pacchetto: chiavi diverse. */
  const c = analizzaRiga("C2,412,150001,-33.1,-57.9,25000.0,5.00,10,3,4.80").dati;
  assert.notEqual(chiaveDoppione(a), chiaveDoppione(c));
});

test("fra i marcatori non ci sono import ne' export", () => {
  /* La pagina della stazione incorpora il blocco tale e quale dentro
     un <script> normale: un export li' dentro la romperebbe. */
  const sorgente = readFileSync(new URL("./formato.js", import.meta.url), "utf8");
  const inizio = sorgente.indexOf("// --- inizio formato ---");
  const fine = sorgente.indexOf("// --- fine formato ---");
  assert.ok(inizio >= 0 && fine > inizio, "marcatori mancanti");
  const blocco = sorgente.slice(inizio, fine);
  assert.doesNotMatch(blocco, /^\s*(import|export)\b/m);
});
