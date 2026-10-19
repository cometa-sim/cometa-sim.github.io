/* Test dello scambio con R2 (src/archivio.ts), con un secchio finto in
   memoria che si comporta come R2 sulle scritture condizionali: npm test.
   Il comportamento di R2 vero si prova con `npm run dev` (vedi
   lora/README.md). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { analizzaRiga } from "../../formato/formato.js";
import type { Dati } from "../../formato/formato.js";
import { aggiungiPunti, aggiornaUltimo, azzera, salvaGrezzo, FILE_TRACCIA, FILE_ULTIMO } from "../src/archivio.ts";
import type { Secchio, OggettoLetto } from "../src/archivio.ts";
import type { Traccia, Ultimo } from "../src/traccia.ts";

/* Ogni get e put aspetta un tempo casuale: e' quello che fa incrociare
   le richieste delle due "stazioni" nei test di concorrenza. */
class SecchioFinto implements Secchio {
  oggetti = new Map<string, { etag: string; testo: string; opzioni?: R2PutOptions }>();
  rifiuti = 0;
  private contatore = 0;

  private async pausa() {
    await new Promise((ok) => setTimeout(ok, Math.random() * 3));
  }

  async get(key: string): Promise<OggettoLetto | null> {
    await this.pausa();
    const o = this.oggetti.get(key);
    if (!o) return null;
    const testo = o.testo;
    return { etag: o.etag, text: async () => testo };
  }

  async put(key: string, value: string, options?: R2PutOptions): Promise<unknown | null> {
    await this.pausa();
    const presente = this.oggetti.get(key);
    const c = options?.onlyIf;
    if (c instanceof Headers) {
      if (c.get("If-None-Match") === "*" && presente) { this.rifiuti++; return null; }
    } else if (c?.etagMatches !== undefined) {
      if (!presente || presente.etag !== c.etagMatches) { this.rifiuti++; return null; }
    }
    const etag = "e" + ++this.contatore;
    this.oggetti.set(key, { etag, testo: value, opzioni: options });
    return { etag };
  }

  json<T>(key: string): T {
    return JSON.parse(this.oggetti.get(key)!.testo) as T;
  }
}

function dati(riga: string): Dati {
  const e = analizzaRiga(riga);
  if (!e.ok) throw new Error(e.errore);
  return e.dati;
}

function riga(n: number): string {
  return `C2,${n},14${String(Math.floor(n / 60) % 60).padStart(2, "0")}${String(n % 60).padStart(2, "0")},-33.2,-58.0,${100 + n}.0,5.00,8,3,4.98`;
}

test("il primo lotto crea i due file, con Cache-Control", async () => {
  const s = new SecchioFinto();
  const r = await aggiungiPunti(s, "C2", [{ t: 100, dati: dati(riga(1)) }], 100);
  assert.equal(r.aggiunte, 1);
  assert.equal(s.json<Traccia>(FILE_TRACCIA).righe.length, 1);
  assert.equal(s.json<Ultimo>(FILE_ULTIMO).totale, 1);
  assert.equal((s.oggetti.get(FILE_ULTIMO)!.opzioni!.httpMetadata as R2HTTPMetadata).cacheControl, "public, max-age=10");
});

test("due stazioni che scrivono insieme non perdono punti", async () => {
  const s = new SecchioFinto();
  /* Ognuna riceve 60 pacchetti: 40 in comune (li sentono tutte e due),
     10 solo suoi. Li manda a lotti di 5, tutte e due nello stesso
     momento. */
  const comuni = Array.from({ length: 40 }, (_, i) => i);
  const soloA = Array.from({ length: 10 }, (_, i) => 100 + i);
  const soloB = Array.from({ length: 10 }, (_, i) => 200 + i);
  const lotti = (ns: number[]) => {
    const out = [];
    for (let i = 0; i < ns.length; i += 5) out.push(ns.slice(i, i + 5).map((n) => ({ t: 1000 + n, dati: dati(riga(n)) })));
    return out;
  };
  const stazione = async (ns: number[]) => {
    for (const l of lotti(ns)) await aggiungiPunti(s, "C2", l, 2000);
  };
  await Promise.all([stazione([...comuni, ...soloA]), stazione([...comuni, ...soloB])]);
  const traccia = s.json<Traccia>(FILE_TRACCIA);
  assert.equal(traccia.righe.length, 60);
  assert.deepEqual(new Set(traccia.righe.map((r) => r[1])).size, 60);
  /* ultimo.json e' allineato all'ultima revisione della traccia. */
  const ultimo = s.json<Ultimo>(FILE_ULTIMO);
  assert.equal(ultimo.revisione, traccia.revisione);
  assert.equal(ultimo.totale, 60);
  assert.ok(s.rifiuti > 0, "il test non ha prodotto nessuna collisione: non prova niente");
});

test("ultimo.json non torna mai indietro", async () => {
  const s = new SecchioFinto();
  const { traccia: nuova } = await aggiungiPunti(s, "C2", [{ t: 1, dati: dati(riga(1)) }, { t: 2, dati: dati(riga(2)) }], 2);
  /* Una richiesta in ritardo prova a scrivere ultimo.json da una
     traccia piu' vecchia. */
  const vecchia: Traccia = { ...nuova, revisione: nuova.revisione - 1, righe: nuova.righe.slice(0, 1) };
  await aggiornaUltimo(s, vecchia);
  assert.equal(s.json<Ultimo>(FILE_ULTIMO).totale, 2);
});

test("azzera svuota i file pubblici e fa salire la revisione", async () => {
  const s = new SecchioFinto();
  await aggiungiPunti(s, "C2", [{ t: 1, dati: dati(riga(1)) }], 1);
  const prima = s.json<Traccia>(FILE_TRACCIA).revisione;
  await azzera(s, "C2", 10);
  const t = s.json<Traccia>(FILE_TRACCIA);
  const u = s.json<Ultimo>(FILE_ULTIMO);
  assert.equal(t.righe.length, 0);
  assert.equal(u.totale, 0);
  assert.ok(t.revisione > prima);
  assert.equal(u.revisione, t.revisione);
  /* E dopo l'azzeramento i punti tornano ad aggiornare ultimo.json. */
  await aggiungiPunti(s, "C2", [{ t: 20, dati: dati(riga(1)) }], 20);
  assert.equal(s.json<Ultimo>(FILE_ULTIMO).totale, 1);
});

test("azzera funziona anche con una traccia di un altro formato", async () => {
  const s = new SecchioFinto();
  await s.put(FILE_TRACCIA, JSON.stringify({ formato: 0, revisione: 7, righe: [[1]] }));
  const t = await azzera(s, "C2", 10);
  assert.equal(t.revisione, 8);
});

test("il grezzo tiene tutte le righe, anche quelle storte, una per riga", async () => {
  const s = new SecchioFinto();
  const t = Date.UTC(2026, 9, 20, 14, 32, 10, 123);
  const chiave = await salvaGrezzo(s, "portatile", [
    { t, r: "C2,1,143210,-33.2,-58.0,100.0,5.00,8,3,4.98\r\n" },
    { t: t + 5000, r: "spazzatura\tcon un tab\ne un a capo" },
  ], new Date(t + 6000));
  assert.match(chiave, /^grezzo\/portatile\/2026-10-20\/143216\.123Z-[0-9a-f]{8}\.txt$/);
  const testo = s.oggetti.get(chiave)!.testo;
  assert.equal(testo,
    "2026-10-20T14:32:10.123Z\tC2,1,143210,-33.2,-58.0,100.0,5.00,8,3,4.98\n" +
    "2026-10-20T14:32:15.123Z\tspazzatura\\tcon un tab\\ne un a capo\n");
});
