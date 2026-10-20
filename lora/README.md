# Telemetria LoRa

La sonda trasmette ogni 5 s una riga di testo via radio (modulo E220,
920 MHz). A terra due stazioni la ricevono, la mandano a un Worker di
Cloudflare, e il Worker la pubblica su R2, da dove la legge la mappa del
sito.

```
E220 → pagina della stazione → Worker (con chiave) → R2 → cache di Cloudflare → mappa del sito
```

```
lora/formato/formato.js     il formato della riga: campi, lettura, controlli — l'UNICO posto dove si definisce
lora/formato/casi.json      righe d'esempio, valide e non valide, per i test
lora/formato/formato.test.js
lora/worker/                il Worker (TypeScript): riceve le righe, scrive i file su R2
lora/simulatore/            un volo finto, ricevuto da due stazioni finte, per provare tutto senza hardware
```

In arrivo, ognuno con la sua richiesta di modifica: la pagina della
stazione di terra, l'integrazione nella mappa della Diretta.

## La riga radio

```
C2,412,143210,-33.245678,-58.031234,18240.0,5.20,9,3,4.98
id,n,  utc,   lat,       lon,       alt_m,  vz_ms,sats,fix,v_batt
```

La definizione vera è nel firmware (`cometa-firmware`, `REQUISITOS.md`
§2.2). Qui la legge `lora/formato/formato.js`, e la usano tutti: il Worker
lo importa, la pagina della stazione ne incorpora una copia, il simulatore
viene verificato sugli stessi casi. **Se il formato cambia nel firmware, si
cambia `formato.js` e basta**, più i casi in `casi.json`.

Una riga senza fix (`C2,413,,,,,,4,0,4.98`) è valida: dice che la sonda è
viva. Si conta e si conserva, ma sulla mappa non si disegna
(`haPosizione()`).

## I file pubblicati

Due file JSON nel bucket pubblico, letti da `https://dati.cometa.gripe/`:

- **`traccia.json`**: tutta la traccia. La mappa lo scarica una volta sola,
  all'apertura.
- **`ultimo.json`**: gli ultimi 20 punti, più quanto serve per dire se il
  dato è fresco. La mappa lo rilegge ogni 20-30 s.

Ogni punto è un array, non un oggetto, nell'ordine di `colonne`:

```json
{
  "formato": 1, "id": "C2", "revisione": 41, "aggiornato": 1792445164,
  "colonne": ["t", "n", "utc", "lat", "lon", "alt_m", "vz_ms", "sats", "fix", "v_batt"],
  "righe": [[1792445164, 412, "143210", -33.245678, -58.031234, 18240, 5.2, 9, 3, 4.98], …]
}
```

`ultimo.json` ha in più `totale` (le righe ricevute finora, anche senza
fix), `ultimo_pacchetto` (l'ora dell'ultima riga, con o senza fix) e
`ultima_posizione` (l'ultima riga con una posizione, che può non essere fra
le ultime 20).

- **`t`** è l'ora di ricezione a terra, in secondi unix: `utc` della sonda
  è solo `hhmmss`, senza data, e manca finché il GPS non ha il fix. È l'ora
  del computer della stazione che l'ha ricevuta per prima: una stazione
  rimasta senza rete manda le righe in ritardo, ma con l'ora giusta.
- **`revisione`** sale a ogni scrittura, anche quando la traccia si
  azzera. Se la mappa vede scendere `totale`, la traccia è stata azzerata
  e va riscaricata.
- Entrambi i file hanno `Cache-Control: public, max-age=10`.

### Perché R2 e la cache, e non il Worker

Gli spettatori possono essere più di mille. Se la mappa chiedesse i dati
al Worker, ogni lettura sarebbe una sua esecuzione. Leggendo invece da
`dati.cometa.gripe`, la cache di Cloudflare risponde a quasi tutti, e R2
vede al massimo una lettura ogni 10 s per file. Il Worker lo chiamano solo
le due stazioni, una volta ogni qualche secondo.

### Doppioni, riavvii, concorrenza

- **Doppioni.** Le due stazioni ricevono gli stessi pacchetti. Non basta
  confrontare `n`: se la sonda si riavvia in volo, `n` riparte da zero, e i
  pacchetti nuovi sembrerebbero già visti. Si confronta la riga intera
  (`chiaveDoppione()` in `formato.js`): due stazioni che ricevono lo stesso
  pacchetto ricevono gli stessi byte.
- **Concorrenza.** R2 non sa aggiungere una riga a un file: per aggiungere
  punti bisogna leggere `traccia.json`, modificarlo e riscriverlo. Se le due
  stazioni lo fanno insieme, una cancellerebbe i punti dell'altra. Per
  questo ogni scrittura è condizionale (`onlyIf` con l'etag letto) e, se il
  file è cambiato nel frattempo, si rilegge e si riprova
  (`src/archivio.ts`).
- **Rimandare è innocuo.** Se una stazione non riceve risposta, rimanda lo
  stesso lotto: nel grezzo finisce due volte, nella traccia una sola.

### Il grezzo

Il Worker salva anche tutte le righe così come arrivano, comprese quelle
scartate, nel bucket **privato** `cometa-lora-grezzo`: un file per lotto,
`grezzo/<stazione>/<giorno>/<ora>Z-<casuale>.txt`, una riga per riga
ricevuta (ora del computer della stazione, un tab, la riga). È la copia di
sicurezza dei log locali delle stazioni. Sta in un bucket a parte perché
tutto quello che è nel bucket pubblico lo può leggere chiunque, e qui
finiscono anche le prove a terra, con le loro posizioni.

## Il Worker

Tutte le chiamate vogliono `Authorization: Bearer <CHIAVE_STAZIONE>`.

| | |
|---|---|
| `GET /verifica` | `{"ok":true,"id_sonda":"C2"}`: la stazione lo chiama all'apertura, per sapere subito se la chiave è giusta. |
| `POST /righe` | Un lotto: `{"stazione":"portatile","righe":[{"t":<ms unix>,"r":"<riga>"}, …]}`, al massimo 5000 righe. Risponde quante erano valide, nuove, doppioni e scartate, con il motivo. |
| `POST /azzera` | Corpo `{"conferma":"azzera"}`. Svuota `traccia.json` e `ultimo.json` (il grezzo resta). Da usare dopo le prove, prima del lancio. |

`stazione` è un nome a scelta, in minuscolo (`portatile`, `telefono`): serve
solo a separare il grezzo. Le righe con un `id` diverso da `ID_SONDA` (in
`wrangler.toml`) si scartano.

Con `LETTURA_DAL_WORKER = "true"` il Worker serve anche `GET /traccia.json` e
`GET /ultimo.json`: solo per le prove, dove davanti al bucket non c'è un
dominio pubblico. In produzione è spento.

## Da configurare su Cloudflare

La dashboard è in inglese, i nomi qui sotto sono quelli da usare.

1. **I bucket.** *R2 Object Storage → Create bucket*, tre volte:
   `cometa-lora`, `cometa-lora-grezzo`, `cometa-lora-prova`. Nessuno dei tre
   con l'accesso pubblico `r2.dev`: l'URL `r2.dev` non passa dalla cache.
2. **Il dominio dei dati.** *R2 → cometa-lora → Settings → Custom Domains →
   Add* → `dati.cometa.gripe`. Solo su questo bucket.
3. **La cache.** Nella zona `cometa.gripe`: *Caching → Cache Rules → Create
   rule*. Condizione: *Hostname equals `dati.cometa.gripe`*. Azione:
   *Eligible for cache*; *Edge TTL → Use cache-control header if present*;
   *Browser TTL → Respect origin*. **Senza questa regola Cloudflare non
   mette in cache i `.json`**, che non sono fra le estensioni che tiene da
   sola: tutte le letture finirebbero su R2.
4. **Il CORS dei dati.** *Rules → Transform Rules → Modify Response Header →
   Create rule*. Condizione: *Hostname equals `dati.cometa.gripe`*. Azione:
   *Set static* `Access-Control-Allow-Origin` =
   `https://cometa.scuolaitaliana.edu.uy`. Non si usa il CORS del bucket:
   R2 mette l'header solo alle richieste che hanno un `Origin`, e la copia in
   cache di una richiesta senza `Origin` lo perderebbe per tutti gli altri.
5. **Il Worker.** *Workers & Pages → Create → Import a repository* →
   `cometa-sim/cometa-sim.github.io`, come per il Worker dello SPOT.
   - Nome del progetto: `cometa-lora` (lo stesso di `wrangler.toml`).
   - *Root directory*: `lora/worker`.
   - *Build command*: vuoto. *Deploy command*: `npx wrangler deploy`.
   - *Build watch paths → Include*: `lora/worker/*` e `lora/formato/*`. Il
     secondo serve perché il Worker importa `formato.js`, che sta fuori dalla
     sua cartella: senza, una modifica al formato non ripubblicherebbe il
     Worker.
   - I bucket devono già esistere, o il primo deploy fallisce.
6. **La chiave.** Sul Worker: *Settings → Variables and Secrets → Add*, tipo
   **Secret**, nome `CHIAVE_STAZIONE`, valore generato con
   `openssl rand -hex 32`. Non va scritta in nessun file del repository: si
   comunica a chi gestisce le stazioni, che la digita a mano all'apertura
   della pagina.
7. **Facoltativo: un dominio per il Worker.** *Settings → Domains & Routes →
   Add → Custom domain* → per esempio `ingresso.cometa.gripe`. Altrimenti
   resta l'indirizzo `cometa-lora.<account>.workers.dev`.

### L'ambiente di prova

Il simulatore non deve mai scrivere sulla mappa vera. Per questo c'è un
secondo Worker, `cometa-lora-prova`, con il suo bucket (`cometa-lora-prova`,
anche per il grezzo) e la sua chiave. Serve i file da sé
(`LETTURA_DAL_WORKER`), quindi il bucket non ha bisogno di nessun dominio.

Si crea dalla dashboard come quello vero, con tre differenze:

| Campo | Valore |
|---|---|
| Project name | `cometa-lora-prova` |
| Root directory | `lora/worker` |
| Deploy command | `npx wrangler deploy --env prova` |
| Build watch paths | `lora/worker/*` e `lora/formato/*` |

Poi, sul Worker `cometa-lora-prova`: il secret `CHIAVE_STAZIONE`, con una
chiave **diversa** da quella vera, e in *Domains* lo stesso schema
dell'altro (*Production* acceso, *Preview* spento).

In alternativa, da terminale:

```sh
cd lora/worker
npm install
npx wrangler login
npx wrangler secret put CHIAVE_STAZIONE --env prova
npm run deploy:prova
```

## Provare in locale

```sh
cd lora/worker
npm install
npm test            # formato, traccia, scritture concorrenti (con un R2 finto), simulatore
npm run typecheck
npm run dev         # il Worker su http://localhost:8787, con R2 simulato
```

Per `npm run dev` serve un file `lora/worker/.dev.vars` (già in
`.gitignore`, non va mai aggiunto al repository):

```
CHIAVE_STAZIONE=una-chiave-qualsiasi-per-le-prove
LETTURA_DAL_WORKER=true
```

Poi, per esempio:

```sh
curl -X POST http://localhost:8787/righe -H "Authorization: Bearer una-chiave-qualsiasi-per-le-prove" \
  -d '{"stazione":"prova","righe":[{"t":1792445164000,"r":"C2,1,143210,-33.2,-58.0,100.0,5.00,8,3,4.98"}]}'
curl http://localhost:8787/ultimo.json
```

I test con il R2 finto provano la logica; che R2 vero rispetti le
scritture condizionali si è verificato con `npm run dev` (due stazioni, 40
lotti in parallelo, nessun punto perso; sei stazioni che creano il file
nello stesso istante) e con il simulatore. Sul Cloudflare vero si
riverifica con il simulatore sull'ambiente di prova.

Un volo di quattro ore sono circa 2900 righe e 150 kB di `traccia.json`: ogni
lotto costa al Worker 3-4 ms di CPU, sotto i 10 ms del piano gratuito. Il
test «unire tremila righe resta veloce» se ne accorge, se un giorno non è
più così.

## Il simulatore

`lora/simulatore/simulatore.py` inventa un volo completo — tre minuti a
terra, salita a 5 m/s, scoppio a 37,9 km, discesa col paracadute,
atterraggio, dieci minuti a terra — e lo fa ricevere da due stazioni
finte, `portatile` e `telefono`, che mandano le righe al Worker come farà
la pagina vera: a lotti, ognuna per conto suo. Ci mette dentro quello che
può andare storto il giorno del volo:

- pacchetti persi, diversi per le due stazioni (8 % ciascuna);
- doppioni: quasi tutti i pacchetti li ricevono tutte e due, e ogni tanto
  una stazione rimanda un lotto intero;
- il telefono senza rete per un po', a metà volo: poi manda tutto insieme;
- il GPS senza fix nel primo minuto e, ogni tanto, per qualche pacchetto;
- qualche riga rotta, che il Worker deve scartare;
- a richiesta (`--riavvio-min 40`), la sonda che si riavvia e ricomincia
  a contare da zero.

Alla fine legge `ultimo.json` e confronta: le righe distinte ricevute da
almeno una stazione devono essere esattamente quelle che il Worker ha
contato.

```
[portatile] ricevute 2099, inviate 2099, invii falliti 0
[telefono] ricevute 2117, inviate 2117, invii falliti 0
righe distinte ricevute da almeno una stazione: 2276 (piu' 7 rotte)
il Worker ne ha contate 2276 nuove (totale 2276, revisione 139)
OK: nessuna riga persa, nessun doppione
```

Serve solo Python 3, senza niente da installare. La chiave si legge dalla
variabile `CHIAVE_STAZIONE`, o la chiede all'avvio: non va mai scritta sulla
riga di comando, dove resterebbe nella cronologia del terminale.

```sh
cd lora/simulatore

# solo le righe, a schermo (per vedere come sono)
python3 simulatore.py --solo-righe | head

# contro il Worker locale (npm run dev in lora/worker), velocissimo
python3 simulatore.py --url http://localhost:8787 --azzera --velocita 150

# contro il Worker di prova su Cloudflare: un volo di tre ore in dieci minuti
python3 simulatore.py --url https://cometa-lora-prova.<account>.workers.dev --azzera --velocita 20
```

Si rifiuta di scrivere su un indirizzo che non sia `localhost` o non abbia
`prova` nel nome: il Worker vero non lo tocca mai, a meno di aggiungere
`--produzione` apposta. `python3 simulatore.py --help` elenca tutte le
opzioni (quota di scoppio, perdite, durata della mancanza di rete…); con
`--seme 3` si ripete esattamente lo stesso volo.

Che le righe del simulatore rispettino il formato lo controlla
`simulatore.test.js` con `formato.js` stesso, dentro `npm test`: il
simulatore scrive le righe a mano, perché Python non può importare il file
JavaScript, e questo test è il ponte fra i due.

## Il giorno del lancio

Dopo le prove a terra, prima del decollo:

```sh
curl -X POST https://<indirizzo-del-worker>/azzera \
  -H "Authorization: Bearer <CHIAVE_STAZIONE>" -d '{"conferma":"azzera"}'
```

La mappa riparte vuota. Il grezzo delle prove resta nel bucket privato.

Non cancellare a mano `traccia.json` o `ultimo.json` dalla dashboard: la
revisione ripartirebbe da zero e `ultimo.json`, che ha una revisione più
alta, non si aggiornerebbe più. Se capita, cancellarli tutti e due.

## Dopo il volo

Tutto il volo va archiviato nel repository `cometa-datos`
dell'organizzazione, non in questo: qui c'è il sito, non i dati.

1. **I log locali delle stazioni**: il file scritto dalla pagina della
   stazione sul portatile, e quello scaricato dal telefono.
2. **Il grezzo del Worker**: tutto il bucket `cometa-lora-grezzo`. Dalla
   dashboard si scarica un file alla volta; per scaricarlo tutto conviene
   `rclone` con un token R2 (*R2 → Manage API tokens*, permesso di sola
   lettura):
   ```sh
   rclone copy r2:cometa-lora-grezzo/grezzo ./grezzo
   ```
3. **I file elaborati**: `traccia.json` e `ultimo.json` dal bucket
   `cometa-lora`.
4. **Le microSD** del Teensy e dell'Adalogger.

I log locali e il grezzo del Worker dovrebbero contenere le stesse righe:
confrontarli dice se qualcosa si è perso fra la stazione e Cloudflare.

## Cambiare il formato

1. Cambiare `CAMPI` in `lora/formato/formato.js` (e i tipi `Dati`, nello
   stesso file, subito sotto).
2. Aggiornare `lora/formato/casi.json` con righe del formato nuovo.
3. `npm test` in `lora/worker/`.
4. Se cambiano le colonne, `traccia.json` già su R2 non si legge più: il
   Worker risponde con un errore che dice di azzerare. È voluto: è meglio
   fermarsi che mescolare righe di due formati.
