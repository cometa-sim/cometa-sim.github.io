/* Copia il formato (il blocco fra "inizio formato" e "fine formato" di
   formato.js) dentro la pagina della stazione, che deve restare un file
   HTML unico e non puo' importarlo. Da lanciare dopo ogni modifica a
   formato.js:

     node lora/formato/sincronizza.js

   Il test "la pagina della stazione ha il formato aggiornato", in
   formato.test.js, fallisce finche' le due copie sono diverse. */
import { readFileSync, writeFileSync } from "node:fs";

const INIZIO = "// --- inizio formato ---";
const FINE = "// --- fine formato ---";

export function blocco(testo) {
  const a = testo.indexOf(INIZIO);
  const b = testo.indexOf(FINE);
  if (a < 0 || b < a) throw new Error("marcatori del formato mancanti");
  return testo.slice(a, b + FINE.length);
}

export const PAGINA = new URL("../stazione/index.html", import.meta.url);
export const FORMATO = new URL("./formato.js", import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  const pagina = readFileSync(PAGINA, "utf8");
  const nuova = pagina.replace(blocco(pagina), blocco(readFileSync(FORMATO, "utf8")));
  if (nuova === pagina) {
    console.log("la pagina della stazione aveva gia' il formato aggiornato");
  } else {
    writeFileSync(PAGINA, nuova);
    console.log("formato copiato in lora/stazione/index.html");
  }
}
