/* ============================================================
   COMETA — formato della riga radio LoRa: l'unico posto dove si
   definisce.

   La sonda (Adalogger, livello 2) manda ogni 5 s una riga CSV:

     C2,412,143210,-33.245678,-58.031234,18240.0,5.20,9,3,4.98
     id,n,  utc,   lat,       lon,       alt_m,  vz_ms,sats,fix,v_batt

   e senza fix la stessa riga con le celle vuote:

     C2,413,,,,,,4,0,4.98

   La definizione vera sta nel firmware (cometa-firmware,
   REQUISITOS.md §2.2, e src/adalogger/main.cpp, enviarTramaRadio):
   se cambia la' va cambiata qui, e solo qui. Questo file lo usano
   tutti quelli che a terra leggono la riga:

   - il Worker (lora/worker/), che lo importa;
   - la pagina della stazione di terra, che ne incorpora una copia:
     deve restare un file HTML unico, senza moduli da caricare. Per
     questo tutto quello che serve sta fra i due marcatori
     "inizio formato" e "fine formato", senza import ne' export
     dentro: la copia si fa prendendo quel blocco tale e quale;
   - il simulatore (lora/simulatore/), che e' in Python e non puo'
     importarlo: genera le righe da una tabella sua, e i casi di
     lora/formato/casi.json verificano che i due dicano lo stesso.

   Cambiando il formato: aggiornare CAMPI qui sotto, i casi in
   casi.json, e far girare i test (vedi lora/README.md).
   ============================================================ */

// --- inizio formato ---

/* I campi, nell'ordine in cui arrivano. tipo:
   - "id": l'identificativo della sonda, lettere e cifre;
   - "intero": cifre e basta, niente segno ne' decimali;
   - "numero": decimale col punto, eventualmente negativo;
   - "ora": hhmmss del GPS.
   obbligatorio: senza quel campo la riga si scarta. Gli altri
   possono arrivare vuoti: il firmware lascia la cella vuota quando
   non ha il dato (REQUISITOS.md §4.2), non manda uno zero. Anche
   fix e sats possono mancare: vengono dal ricevitore GPS, e se il
   ricevitore non risponde non ci sono.

   min e max non sono i limiti fisici del volo ma quelli oltre cui
   un numero e' certamente spazzatura: servono a scartare una riga
   rotta, non a giudicare il volo. vz_ms, per esempio, appena dopo
   lo scoppio puo' superare i 100 m/s in giu', nell'aria rarefatta. */
const CAMPI = [
  { nome: "id",     tipo: "id",     obbligatorio: true },
  { nome: "n",      tipo: "intero", obbligatorio: true, min: 0, max: 4294967295 },
  { nome: "utc",    tipo: "ora" },
  { nome: "lat",    tipo: "numero", min: -90,   max: 90 },
  { nome: "lon",    tipo: "numero", min: -180,  max: 180 },
  { nome: "alt_m",  tipo: "numero", min: -1000, max: 60000 },
  { nome: "vz_ms",  tipo: "numero", min: -500,  max: 500 },
  { nome: "sats",   tipo: "intero", min: 0,     max: 99 },
  { nome: "fix",    tipo: "intero", min: 0,     max: 9 },
  { nome: "v_batt", tipo: "numero", min: 0,     max: 30 }
];

/* Il firmware tiene la riga sotto gli 80 caratteri
   (COMETA_RADIO_LARGO_MAX): una riga molto piu' lunga non e' una
   riga della sonda, e' rumore o due righe incollate. */
const LUNGHEZZA_MASSIMA = 120;

/** I tipi, per chi legge il file con TypeScript (il Worker): sono
   commenti, il browser li ignora. Vanno tenuti allineati con CAMPI
   qui sopra.
   @typedef {{ id: string, n: number, utc: string | null,
     lat: number | null, lon: number | null, alt_m: number | null,
     vz_ms: number | null, sats: number | null, fix: number | null,
     v_batt: number | null }} Dati
   @typedef {{ ok: true, dati: Dati } | { ok: false, errore: string }} Esito
   @typedef {(number | string | null)[]} Riga */

/* Le espressioni sono volutamente strette: "1e3", "+5", " 5" o
   "5," sono numeri per parseFloat ma non escono mai dal firmware,
   e accettarli vorrebbe dire accettare una riga arrivata storta. */
const RE_ID = /^[A-Za-z0-9]{1,8}$/;
const RE_INTERO = /^\d{1,10}$/;
const RE_NUMERO = /^-?\d{1,6}(\.\d{1,8})?$/;
const RE_ORA = /^([01]\d|2[0-3])[0-5]\d[0-5]\d$/;

/** Legge una riga. Restituisce
     { ok: true,  dati: { id, n, utc, lat, lon, alt_m, vz_ms, sats, fix, v_batt } }
   con null nei campi vuoti, oppure
     { ok: false, errore: "..." }
   con il motivo, in italiano, da mostrare o da contare. Non lancia
   eccezioni: una riga storta e' normale, non un guasto.
   @param {unknown} testo
   @returns {Esito} */
function analizzaRiga(testo) {
  if (typeof testo !== "string") return { ok: false, errore: "non e' testo" };
  /* println() del firmware chiude con CR LF: il CR resta attaccato
     se chi legge divide solo sul LF. Gli spazi in testa e in coda
     invece no, il firmware non ne mette: si tolgono solo CR e LF. */
  const riga = testo.replace(/[\r\n]+$/, "");
  if (riga === "") return { ok: false, errore: "riga vuota" };
  if (riga.length > LUNGHEZZA_MASSIMA) return { ok: false, errore: "riga troppo lunga" };
  const celle = riga.split(",");
  if (celle.length !== CAMPI.length) {
    return { ok: false, errore: "campi: " + celle.length + " invece di " + CAMPI.length };
  }
  /** @type {Record<string, string | number | null>} */
  const dati = {};
  for (let i = 0; i < CAMPI.length; i++) {
    const campo = CAMPI[i];
    const cella = celle[i];
    if (cella === "") {
      if (campo.obbligatorio) return { ok: false, errore: campo.nome + " vuoto" };
      dati[campo.nome] = null;
      continue;
    }
    let valore;
    if (campo.tipo === "id") {
      if (!RE_ID.test(cella)) return { ok: false, errore: campo.nome + " non valido" };
      valore = cella;
    } else if (campo.tipo === "ora") {
      if (!RE_ORA.test(cella)) return { ok: false, errore: campo.nome + " non valido" };
      valore = cella;
    } else {
      const re = campo.tipo === "intero" ? RE_INTERO : RE_NUMERO;
      if (!re.test(cella)) return { ok: false, errore: campo.nome + " non numerico" };
      valore = Number(cella);
      if (valore < campo.min || valore > campo.max) {
        return { ok: false, errore: campo.nome + " fuori intervallo" };
      }
    }
    dati[campo.nome] = valore;
  }
  /* Una sola coordinata non e' una posizione: il firmware le
     svuota sempre insieme, quindi se ne arriva una sola la riga e'
     rotta. */
  if ((dati.lat === null) !== (dati.lon === null)) {
    return { ok: false, errore: "lat e lon non vanno in coppia" };
  }
  return { ok: true, dati: /** @type {Dati} */ (/** @type {unknown} */ (dati)) };
}

/** Se la riga va disegnata sulla mappa. Una riga con fix=0 e'
   valida (dice che la sonda e' viva) ma la sua posizione, se
   c'e', non vale. Il firmware svuota gia' lat e lon quando il fix
   non basta: il controllo su fix e' una seconda cintura, per
   non disegnare mai un punto che il GPS stesso non garantisce.
   @param {Dati} dati */
function haPosizione(dati) {
  return dati.lat !== null && dati.lon !== null && dati.fix !== null && dati.fix > 0;
}

/* Nei file JSON pubblicati (traccia.json, ultimo.json) ogni punto
   e' un array, non un oggetto: con qualche migliaio di punti i
   nomi ripetuti a ogni punto peserebbero piu' dei numeri.
   L'ordine delle colonne e' questo, e il file lo riporta in
   "colonne", cosi' chi legge non deve indovinarlo.

   "t" non viene dalla sonda: e' l'ora in cui la riga e' stata
   ricevuta a terra, in secondi unix. Serve perche' utc e' solo
   hhmmss, senza data, e manca del tutto finche' il GPS non ha il
   fix. L'id non c'e': un file contiene una sola sonda, e lo dice
   una volta sola, in testa. */
const COLONNE = ["t", "n", "utc", "lat", "lon", "alt_m", "vz_ms", "sats", "fix", "v_batt"];

/** @param {Dati} dati @param {number} t @returns {Riga} */
function inRiga(dati, t) {
  return COLONNE.map(function (c) { return c === "t" ? t : dati[c]; });
}

/** @param {Riga} riga @returns {Dati & { t: number }} */
function daRiga(riga) {
  /** @type {Record<string, string | number | null>} */
  const dati = {};
  COLONNE.forEach(function (c, i) { const v = riga[i]; dati[c] = v === undefined ? null : v; });
  return /** @type {Dati & { t: number }} */ (/** @type {unknown} */ (dati));
}

/** Le due stazioni ricevono gli stessi pacchetti: per riconoscere i
   doppioni non basta n. Se la sonda si riavvia in volo, n riparte
   da zero (REQUISITOS.md §2.2), e i pacchetti nuovi verrebbero
   scartati come gia' visti; lo stesso succede con le prove a terra
   fatte prima del lancio con la stessa sonda. Due stazioni che
   ricevono lo stesso pacchetto ricevono invece gli stessi byte
   (il modulo E220 scarta quelli con il CRC sbagliato): la chiave
   e' quindi la riga intera. Due pacchetti diversi con tutti i
   campi uguali, n compreso, si confondono solo dopo un riavvio e
   senza fix: perderne uno costa poco, sono identici.
   @param {Dati} dati */
function chiaveDoppione(dati) {
  return COLONNE.filter(function (c) { return c !== "t"; })
    .map(function (c) {
      const v = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (dati))[c];
      return v === null || v === undefined ? "" : String(v);
    })
    .join(",");
}

// --- fine formato ---

export { CAMPI, LUNGHEZZA_MASSIMA, COLONNE, analizzaRiga, haPosizione, inRiga, daRiga, chiaveDoppione };
