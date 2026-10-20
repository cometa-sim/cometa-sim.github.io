/* La pagina della stazione e' un file HTML unico, senza compilazione:
   un errore di sintassi nel suo codice la fermerebbe tutta, e nessun
   altro test se ne accorgerebbe. Qui si compila (senza eseguirlo) ogni
   blocco <script> scritto dentro la pagina. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("il codice della pagina della stazione non ha errori di sintassi", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const blocchi = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocchi.length >= 2, "blocchi <script> non trovati");
  blocchi.forEach((codice, i) => {
    assert.doesNotThrow(() => new vm.Script(codice, { filename: "stazione/index.html, blocco " + (i + 1) }));
  });
});
