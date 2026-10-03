# cometa-spot-tracker

Backend per la diretta COMETA: un Cloudflare Worker con un Durable Object
(storage SQLite) che interroga il feed pubblico dello SPOT Trace **una
sola volta per tutti i visitatori**, salva la traccia completa del volo
e la espone in JSON/CSV al sito.

## Perché

- SPOT chiede di non interrogare un feed più spesso di una volta ogni
  2,5 minuti; se lo facesse ogni browser dei visitatori, con molte
  persone collegate durante la diretta il feed rischierebbe il blocco.
- Il feed restituisce solo gli ultimi messaggi, non l'intera storia del
  volo: la traccia va conservata da qualche parte, non solo letta al
  volo.
- La quota misurata serve anche per la comunicazione a DINACIA: i dati
  vanno conservati integri (niente scarti né correzioni) ed esportabili
  in CSV.

## Come funziona

Un'unica istanza del Durable Object `SpotTracker` (sempre la stessa,
`idFromName("cometa-spot-2026")` in `src/index.ts`) tiene tutto: lo
stato del polling, la tabella SQLite dei punti, e risponde a tutti gli
endpoint.

Il ritmo del polling (ogni 155 secondi: i 150 richiesti da SPOT, più un
margine) non usa i Cron Trigger di Cloudflare — hanno granularità di un
minuto, non permettono un intervallo di 150s — ma l'**alarm** del
Durable Object: a ogni esecuzione interroga SPOT (o il feed finto, in
modalità simulazione) e riprogramma da solo l'alarm successivo. Un
guardiano su `lastFetchMs` garantisce che due chiamate vere non siano
mai più vicine di 150s, anche in caso di alarm duplicati o di un
riavvio del Worker.

Ogni messaggio ricevuto si salva deduplicato per `id` (upsert: un
messaggio già visto si aggiorna, uno nuovo si inserisce), insieme al
messaggio originale completo — così una chiamata fallita si recupera
da sola al giro successivo, e campi non ancora usati restano comunque
conservati.

## Endpoint

### Pubblici (CORS limitato alle origini in `ALLOWED_ORIGINS`)

| | |
|---|---|
| `GET /track.json` | Punti ordinati per tempo + metadati (`last_fetch`, `last_fetch_ok`, `last_point_time`, `polling_active`). Cache 30s. Solo i punti con `time >= PUBLIC_FROM`; se `PUBLIC_FROM` non è impostato, nessun punto. |
| `GET /track.csv` | Stessi dati in CSV (orario UTC e locale America/Montevideo, lat, lon, quota, tipo messaggio, batteria). |

### Protetti (header `Authorization: Bearer <ADMIN_TOKEN>`)

| | |
|---|---|
| `GET /track-all.json` | Tutti i punti salvati, senza il filtro `PUBLIC_FROM` — per verificare le prove. |
| `POST /start` | Avvia il polling. |
| `POST /stop` | Ferma il polling (l'alarm in corso, se c'è, non si riprogramma). |
| `POST /reset` | Cancella tutti i punti salvati. Da usare dopo le prove, prima del giorno vero. Non tocca `polling_active`/`PUBLIC_FROM`/`simulate`. |
| `POST /backfill` | Riscarica l'intero volo da SPOT e lo reinserisce (stessa deduplica del polling). Corpo vuoto → pagina con `start=51,101,…` fino a 7 giorni; oppure `{"startDate":"...", "endDate":"..."}` (formato SPOT) per un intervallo preciso. |
| `POST /public-from` | Corpo `{"time": <unix secondi>}` oppure `{"time": null}` per nascondere di nuovo tutto. |
| `POST /simulate` | Corpo `{"enabled": true\|false}`. Con `true`, il polling genera un volo finto (vedi sotto) invece di chiamare SPOT davvero. |

## Privacy dei punti di prova

Il feed SPOT può contenere, fino a 7 giorni indietro, punti di prova
registrati in luoghi da non rendere pubblici. Per questo gli endpoint
pubblici restituiscono solo i punti con `time >= PUBLIC_FROM`, e senza
`PUBLIC_FROM` impostato non restituiscono nulla. **Prima del giorno del
lancio**: usare `POST /reset` per ripulire le prove, poi `POST
/public-from` con l'orario reale di decollo (o un po' prima).

## Modalità simulazione

`POST /simulate {"enabled": true}` fa generare, invece di chiamare
SPOT, un volo finto che segue lo stesso ritmo vero (un punto ogni 150s
reali — la simulazione non accelera il tempo, prova proprio la cadenza
del Worker), con buchi di segnale e messaggi duplicati inclusi apposta
(circa 1 su 10 ciascuno, scelta deterministica — lo stesso slot dà
sempre lo stesso risultato), per verificare la deduplica e la cadenza
senza il tracker vero. `POST /simulate {"enabled": false}` torna al
feed vero.

## Deploy

1. **Installare le dipendenze**
   ```sh
   cd worker
   npm install
   ```

2. **Accedere a Cloudflare** (serve un account Cloudflare, anche gratuito)
   ```sh
   npx wrangler login
   ```

3. **Impostare i secret** (mai nel repo — uno alla volta, wrangler chiede il valore)
   ```sh
   npx wrangler secret put FEED_ID
   npx wrangler secret put FEED_PASSWORD   # solo se il feed lo richiede
   npx wrangler secret put ADMIN_TOKEN     # un token lungo e casuale, es. `openssl rand -hex 32`
   ```

4. **Controllare `wrangler.toml`**: `ALLOWED_ORIGINS` deve elencare il
   dominio del sito (e, se serve durante le prove, l'anteprima
   raw.githack usata), separati da virgola.

5. **Deploy**
   ```sh
   npm run deploy
   ```
   Il comando stampa l'URL del Worker (del tipo
   `https://cometa-spot-tracker.<account>.workers.dev`): è quello da
   mettere nella costante di configurazione del sito (vedi il sito
   principale, non questa cartella).

6. **Verificare**
   ```sh
   curl https://<url-worker>/track.json
   # {"points":[],"last_fetch":null,"last_fetch_ok":null,"last_point_time":null,"polling_active":false}
   ```

### Sviluppo locale

```sh
npm run dev
```
Avvia un Worker locale (Durable Object e SQLite simulati, nessun
account necessario) su `http://localhost:8787`. Per i secret in
locale, creare un file `worker/.dev.vars` (già in `.gitignore`, non va
committato):
```
FEED_ID=...
ADMIN_TOKEN=...
```

### Il giorno del lancio

```sh
# ripulire le prove
curl -X POST https://<url-worker>/reset -H "Authorization: Bearer <ADMIN_TOKEN>"

# rendere pubblici solo i punti da ora in poi (unix secondi)
curl -X POST https://<url-worker>/public-from -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" -d '{"time": 1760000000}'

# avviare il polling vero
curl -X POST https://<url-worker>/start -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Dopo il volo, se ci sono buchi (per esempio dopo un'interruzione di
rete), `POST /backfill` riscarica tutto da SPOT e li colma.

### Verificare i tempi di polling

```sh
npm run tail
```
mostra i log in diretta: ogni giro logga l'esito; `lastFetchMs` in
`GET /track-all.json` (protetto) conferma che i giri reali non sono mai
più vicini di 150s fra loro, anche sotto `wrangler tail`.
