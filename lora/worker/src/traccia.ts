/* La traccia come dato: leggerla, unirci righe nuove, ricavarne
   ultimo.json. Niente R2 qui dentro, solo calcolo: cosi' si prova con
   node --test senza Cloudflare (vedi test/traccia.test.ts). Lo
   scambio con R2 sta in archivio.ts. */
import { COLONNE, inRiga, daRiga, chiaveDoppione, haPosizione } from "../../formato/formato.js";
import type { Dati, Riga } from "../../formato/formato.js";

/* Il numero del formato dei due file JSON, non della riga radio: sale
   solo se cambia la struttura dei file, cosi' la mappa puo' accorgersi
   di leggere un file che non capisce invece di disegnare a caso. */
export const FORMATO_FILE = 1;

/* Quanti punti in ultimo.json: a un punto ogni 5 s sono 100 s di volo,
   piu' dei 20-30 s fra una lettura e l'altra della mappa, quindi chi
   guarda non perde punti anche se una lettura salta. */
export const PUNTI_IN_ULTIMO = 20;

export interface Traccia {
  formato: number;
  id: string;
  colonne: string[];
  /* Sale di uno a ogni scrittura, anche dopo un azzeramento: e' quello
     che permette di non scrivere mai un ultimo.json piu' vecchio di
     quello che c'e' gia' (vedi aggiornaUltimo in archivio.ts). */
  revisione: number;
  aggiornato: number | null; // secondi unix dell'ultima scrittura
  righe: Riga[];
}

export interface Ultimo {
  formato: number;
  id: string;
  colonne: string[];
  revisione: number;
  aggiornato: number | null;
  totale: number; // righe valide e distinte ricevute finora, anche senza fix
  ultimo_pacchetto: number | null; // t dell'ultima riga, con o senza fix
  /* L'ultima riga con una posizione. Puo' non essere fra le ultime 20:
     senza fix la sonda continua a trasmettere, e la mappa deve poter
     mostrare comunque dov'era l'ultima volta. */
  ultima_posizione: Riga | null;
  righe: Riga[];
}

/* Una riga appena ricevuta: t e' l'ora di ricezione a terra, in secondi
   unix. */
export interface Ricevuta {
  t: number;
  dati: Dati;
}

export function tracciaVuota(id: string, revisione = 0): Traccia {
  return { formato: FORMATO_FILE, id, colonne: [...COLONNE], revisione, aggiornato: null, righe: [] };
}

/* Legge traccia.json da R2. Se le colonne non sono quelle di adesso,
   il formato e' cambiato con un volo gia' in corso: meglio fermarsi con
   un errore chiaro che mescolare righe di due formati. Si risolve con
   POST /azzera (vedi lora/README.md). */
export function leggiTraccia(testo: string, id: string): Traccia {
  const t = JSON.parse(testo) as Traccia;
  if (!t || !Array.isArray(t.righe) || typeof t.revisione !== "number") {
    throw new Error("traccia.json non valido");
  }
  if (t.formato !== FORMATO_FILE || JSON.stringify(t.colonne) !== JSON.stringify(COLONNE)) {
    throw new Error("traccia.json ha un formato diverso da quello attuale: azzerare");
  }
  if (t.id !== id) throw new Error("traccia.json e' di un'altra sonda (" + t.id + "): azzerare");
  return t;
}

/* Unisce le righe nuove alla traccia. Un doppione (vedi chiaveDoppione
   in formato.js) non si aggiunge; se pero' arriva con un'ora di
   ricezione piu' vecchia, quella si tiene: e' la stazione che l'ha
   ricevuto per prima, e una stazione rimasta senza rete manda le righe
   in ritardo, ma con l'ora in cui le aveva ricevute.

   L'ordine e' quello di ricezione, non quello di n: dopo un riavvio
   della sonda n ricomincia da zero, e ordinare per n mescolerebbe i
   due tratti. */
export function unisci(attuale: Traccia, nuove: Ricevuta[]): { traccia: Traccia; aggiunte: number; cambiate: boolean } {
  /* Questo gira a ogni lotto, su tutta la traccia, e un Worker sul piano
     gratuito ha 10 ms di CPU per richiesta. Calcolare la chiave di
     ognuna delle migliaia di righe gia' salvate costava da solo quasi
     tutto quel tempo: l'indice si fa quindi solo su n, che e' gia' un
     numero, e la chiave intera si calcola solo per le poche righe con lo
     stesso n di una riga nuova. */
  const righe = attuale.righe.slice();
  const perN = new Map<number, number[]>();
  righe.forEach((r, i) => {
    const n = r[1] as number;
    const lista = perN.get(n);
    if (lista) lista.push(i);
    else perN.set(n, [i]);
  });
  let aggiunte = 0;
  let cambiate = false;
  let ordinate = true;
  for (const { t, dati } of nuove) {
    const k = chiaveDoppione(dati);
    const candidati = perN.get(dati.n) || [];
    const i = candidati.find((j) => chiaveDoppione(daRiga(righe[j]!)) === k);
    if (i === undefined) {
      const ultima = righe[righe.length - 1];
      if (ultima && t < (ultima[0] as number)) ordinate = false;
      candidati.push(righe.length);
      perN.set(dati.n, candidati);
      righe.push(inRiga(dati, t));
      aggiunte++;
      cambiate = true;
    } else if (t < (righe[i]![0] as number)) {
      /* Si copia solo la riga che cambia: le altre sono condivise con la
         traccia letta, che cosi' resta intatta. */
      const copia = righe[i]!.slice();
      copia[0] = t;
      righe[i] = copia;
      cambiate = true;
      ordinate = false;
    }
  }
  /* Di solito le righe arrivano gia' in ordine e si aggiungono in coda:
     si riordina solo quando serve. Dopo il riordino gli indici in perN
     non valgono piu', ma a quel punto non servono. */
  if (!ordinate) {
    righe.sort((a, b) => (a[0] as number) - (b[0] as number) || (a[1] as number) - (b[1] as number));
  }
  return { traccia: { ...attuale, righe }, aggiunte, cambiate };
}

export function ultimoDa(traccia: Traccia): Ultimo {
  const righe = traccia.righe;
  let ultimaPosizione: Riga | null = null;
  for (let i = righe.length - 1; i >= 0; i--) {
    if (haPosizione(daRiga(righe[i]!))) {
      ultimaPosizione = righe[i]!;
      break;
    }
  }
  const ultima = righe[righe.length - 1];
  return {
    formato: FORMATO_FILE,
    id: traccia.id,
    colonne: traccia.colonne,
    revisione: traccia.revisione,
    aggiornato: traccia.aggiornato,
    totale: righe.length,
    ultimo_pacchetto: ultima ? (ultima[0] as number) : null,
    ultima_posizione: ultimaPosizione,
    righe: righe.slice(-PUNTI_IN_ULTIMO),
  };
}
