/* Lo scambio con R2: le righe grezze, traccia.json e ultimo.json.

   Il problema di fondo e' che R2 non sa aggiungere una riga a un file:
   per aggiungere punti a traccia.json bisogna leggerlo, modificarlo e
   riscriverlo intero. Se le due stazioni lo fanno nello stesso momento,
   tutte e due leggono la stessa versione e la seconda scrittura
   cancella i punti della prima. Per questo ogni scrittura e'
   condizionale: "scrivi solo se il file e' ancora quello che ho letto"
   (onlyIf con l'etag letto). Se nel frattempo e' cambiato, R2 rifiuta,
   e si ricomincia da capo rileggendo: i punti dell'altra stazione sono
   ormai dentro, e ci si aggiungono i propri. */
import { tracciaVuota, leggiTraccia, unisci, ultimoDa } from "./traccia.ts";
import type { Traccia, Ultimo, Ricevuta } from "./traccia.ts";

export const FILE_TRACCIA = "traccia.json";
export const FILE_ULTIMO = "ultimo.json";

/* Quello che serve di R2Bucket, e niente di piu': i test ci mettono al
   posto un secchio finto in memoria (vedi test/archivio.test.ts). */
export interface OggettoLetto {
  etag: string;
  text(): Promise<string>;
}
export interface Secchio {
  get(key: string): Promise<OggettoLetto | null>;
  put(key: string, value: string, options?: R2PutOptions): Promise<unknown | null>;
}

/* max-age=10 vale per la cache di Cloudflare e per il browser: con piu'
   di mille spettatori che leggono ogni 20-30 s, la cache risponde a
   quasi tutti e R2 vede al massimo una lettura ogni 10 s per file. */
const OPZIONI_JSON: R2PutOptions = {
  httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "public, max-age=10" },
};

/* Con due stazioni le collisioni sono rare e si risolvono al secondo
   tentativo; dodici tentativi coprono anche una raffica di lotti
   arretrati che arrivano tutti insieme quando torna la rete. L'attesa
   e' in parte casuale perche', se fosse fissa, le due stazioni
   riproverebbero di nuovo nello stesso istante. */
const TENTATIVI = 12;

export class TroppiTentativi extends Error {}

async function conTentativi<T>(prova: () => Promise<T | null>): Promise<T> {
  for (let i = 0; i < TENTATIVI; i++) {
    const esito = await prova();
    if (esito !== null) return esito;
    const attesa = Math.min(500, 20 * 2 ** i) * (0.5 + Math.random());
    await new Promise((ok) => setTimeout(ok, attesa));
  }
  throw new TroppiTentativi("troppe scritture concorrenti");
}

/* La condizione per la scrittura: il file deve essere ancora quello
   letto, oppure, se non c'era, non deve essere comparso nel frattempo
   ("If-None-Match: *"). Senza il secondo caso, al primo pacchetto del
   volo le due stazioni creerebbero il file insieme e una delle due
   perderebbe il suo punto. */
function condizione(letto: OggettoLetto | null): R2Conditional | Headers {
  return letto ? { etagMatches: letto.etag } : new Headers({ "If-None-Match": "*" });
}

export async function aggiungiPunti(
  secchio: Secchio,
  idSonda: string,
  nuove: Ricevuta[],
  adesso: number,
): Promise<{ traccia: Traccia; aggiunte: number }> {
  const esito = await conTentativi(async () => {
    const letto = await secchio.get(FILE_TRACCIA);
    const attuale = letto ? leggiTraccia(await letto.text(), idSonda) : tracciaVuota(idSonda);
    const { traccia, aggiunte, cambiate } = unisci(attuale, nuove);
    if (!cambiate) return { traccia: attuale, aggiunte: 0 };
    traccia.revisione = attuale.revisione + 1;
    traccia.aggiornato = adesso;
    const scritto = await secchio.put(FILE_TRACCIA, JSON.stringify(traccia), { ...OPZIONI_JSON, onlyIf: condizione(letto) });
    return scritto ? { traccia, aggiunte } : null;
  });
  /* Anche se non c'era niente di nuovo: se una richiesta precedente si
     e' interrotta fra le due scritture, ultimo.json e' rimasto indietro,
     e questo lo rimette in pari. */
  await aggiornaUltimo(secchio, esito.traccia);
  return esito;
}

/* ultimo.json si ricava sempre dalla traccia appena scritta, mai da
   quella letta prima. Resta un caso: la stazione A scrive la traccia,
   la B scrive dopo di lei una traccia con un punto in piu', poi B
   scrive ultimo.json e A, in ritardo, lo sovrascrive con la sua
   versione vecchia. Per evitarlo si confronta la revisione: si scrive
   solo se quella su R2 e' piu' vecchia della propria. */
export async function aggiornaUltimo(secchio: Secchio, traccia: Traccia): Promise<void> {
  const ultimo = ultimoDa(traccia);
  await conTentativi(async () => {
    const letto = await secchio.get(FILE_ULTIMO);
    if (letto) {
      const presente = JSON.parse(await letto.text()) as Ultimo;
      if (typeof presente.revisione === "number" && presente.revisione >= ultimo.revisione) return true;
    }
    const scritto = await secchio.put(FILE_ULTIMO, JSON.stringify(ultimo), { ...OPZIONI_JSON, onlyIf: condizione(letto) });
    return scritto ? true : null;
  });
}

/* Svuota i due file pubblici, per esempio dopo le prove e prima del
   lancio. Non li cancella: li riscrive vuoti con la revisione successiva.
   Cancellandoli la revisione ripartirebbe da zero, e ultimo.json, che ha
   una revisione piu' alta, non verrebbe piu' aggiornato. Le righe
   grezze restano: sono la copia di sicurezza, non si toccano mai. */
export async function azzera(secchio: Secchio, idSonda: string, adesso: number): Promise<Traccia> {
  const traccia = await conTentativi(async () => {
    const letto = await secchio.get(FILE_TRACCIA);
    let revisione = 0;
    if (letto) {
      /* Qui la traccia puo' anche essere di un formato vecchio o di
         un'altra sonda: e' proprio il caso in cui si azzera. Basta
         leggerne la revisione. */
      const vecchia = JSON.parse(await letto.text()) as Partial<Traccia>;
      revisione = typeof vecchia.revisione === "number" ? vecchia.revisione : 0;
    }
    const vuota = tracciaVuota(idSonda, revisione + 1);
    vuota.aggiornato = adesso;
    const scritto = await secchio.put(FILE_TRACCIA, JSON.stringify(vuota), { ...OPZIONI_JSON, onlyIf: condizione(letto) });
    return scritto ? vuota : null;
  });
  await aggiornaUltimo(secchio, traccia);
  return traccia;
}

/* Le righe grezze, tutte, anche quelle che poi si scartano: un oggetto
   per lotto, perche' R2 non sa aggiungere righe a un file esistente e
   un file per lotto non ha bisogno di nessuna scrittura condizionale.
   Il nome comincia dalla data e dall'ora d'arrivo, cosi' nella
   dashboard gli oggetti di una stazione si leggono in ordine; il pezzo
   casuale in coda evita che due lotti arrivati nello stesso millisecondo
   si sovrascrivano. Una riga per riga ricevuta: l'ora del computer della
   stazione in ISO 8601, un tab, la riga com'era. */
export async function salvaGrezzo(
  secchio: Secchio,
  stazione: string,
  righe: { t: number; r: string }[],
  adesso: Date,
): Promise<string> {
  const iso = adesso.toISOString(); // 2026-10-20T14:32:10.123Z
  const giorno = iso.slice(0, 10);
  const ora = iso.slice(11, 23).replace(/:/g, "");
  const casuale = crypto.getRandomValues(new Uint32Array(1))[0]!.toString(16).padStart(8, "0");
  const chiave = `grezzo/${stazione}/${giorno}/${ora}Z-${casuale}.txt`;
  const testo = righe.map((x) => `${oraIso(x.t)}\t${senzaACapo(x.r)}\n`).join("");
  await secchio.put(chiave, testo, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
    customMetadata: { stazione, ricevuto: iso },
  });
  return chiave;
}

function oraIso(ms: number): string {
  const d = new Date(ms);
  return Number.isFinite(d.getTime()) ? d.toISOString() : "ora-non-valida";
}

/* Il CR LF finale del firmware si toglie; un a capo o un tab dentro la
   riga (non dovrebbero esserci mai) si scrivono come \n e \t, perche'
   altrimenti spezzerebbero il file in righe che non sono righe. */
function senzaACapo(r: string): string {
  return r.replace(/[\r\n]+$/, "").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}
