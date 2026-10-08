# cometa-sim-github-io (Worker SPOT tracker)

Backend per la diretta COMETA: un Cloudflare Worker con un Durable Object
(storage SQLite) che riceve e conserva la traccia del volo dello SPOT
Trace, deduplicata, e la espone in JSON/CSV al sito.

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

**SPOT blocca le richieste che arrivano dai Worker di Cloudflare** (403
con la pagina anti-bot), ma accetta quelle da un browser normale. Per
questo non è il Worker a interrogare SPOT: lo fa **`admin-diretta.html`**
(alla radice del sito, non collegata dal sito, `noindex` — vedi più
sotto), una pagina aperta in un browser il giorno del lancio, che ogni
~155 secondi:

1. chiede il permesso al Worker con `POST /claim`;
2. se concesso, interroga SPOT direttamente dal browser;
3. manda il risultato (successo o errore) al Worker con `POST /ingest`,
   che lo salva con la stessa logica di sempre (deduplica per `id`,
   `last_fetch`/`last_fetch_ok`/`last_error`).

`/claim` concede il permesso solo se sono passati almeno 150 secondi
(`MIN_INTERVAL_MS`, lo stesso limite di SPOT) dall'ultimo permesso
concesso — non da quando è arrivato l'ultimo `/ingest`: il permesso è
speso appena concesso, anche se chi lo ottiene non arriva mai a
chiamare `/ingest` (pagina chiusa, rete caduta). Così, se più pagine di
amministrazione sono aperte insieme (una di riserva), SPOT non viene
mai interrogato più di una volta ogni 150 secondi in tutto — un Durable
Object processa le proprie richieste una alla volta, mai in parallelo,
quindi il controllo e l'aggiornamento del permesso non vengono mai
interallacciati da un'altra richiesta nel mezzo.

Ogni messaggio ricevuto si salva deduplicato per `id` (upsert: un
messaggio già visto si aggiorna, uno nuovo si inserisce), insieme al
messaggio originale completo — così una chiamata fallita si recupera
da sola al giro successivo, e campi non ancora usati restano comunque
conservati. Nessun filtro su `messageType`: il tracker manda anche
`EXTREME-TRACK` e `NEWMOVEMENT`, non solo `TRACK` — si salva qualunque
messaggio abbia latitudine e longitudine, il tipo resta conservato nel
dato.

### Data Push: SPOT manda lui i dati (canale aggiuntivo)

SPOT offre anche un **Data Push**: una volta attivato sull'account
(va chiesto al supporto SPOT — vedi "SPOT Commercial Account Data
Push User Guide"), manda lui un messaggio XML a `POST /` quasi appena
arriva, invece di dover essere interrogato. Configurato dalla pagina
`myaccount.findmespot.com` → **SPOT API** → **Data Push**, protocollo
**HTTPS**, con l'URL del Worker (quello intero, senza percorso dopo —
SPOT **non supporta query string** nell'URL, vedi "Known limitations"
della guida).

Non sostituisce `/claim`+`/ingest`: **il Data Push non manda mai la
quota** (`altitude` non esiste nel suo formato XML, a differenza del
feed REST pubblico) — resta la pagina di amministrazione l'unica fonte
della quota reale. `upsertPoints()` lo sa: un push senza quota non
cancella mai una quota già salvata per lo stesso `id` (`COALESCE` in
`tracker.ts`), aggiorna solo gli altri campi (posizione, tra l'altro
quasi in tempo reale, utile anche se la pagina admin dovesse restare
indietro). Tenere entrambi i canali attivi è voluto, non un
doppione da scegliere.

**Autenticazione**: non `ADMIN_TOKEN` — SPOT firma ogni chiamata con
un header `X-WSSE` (standard WSSE UsernameToken: `Username`, un
`Nonce` casuale, `Created`, e un `PasswordDigest` calcolato con
l'algoritmo descritto nella guida SPOT). `src/wsse.ts` verifica la
firma contro due secret nuovi (**mai nel repo**, si impostano come gli
altri — vedi "Deploy"):
- `SPOT_PUSH_USERNAME` — il "token cliente" nella scheda Data Push
- `SPOT_PUSH_SECRET` — il "token segreto" nella stessa scheda

Respinge anche i replay (lo stesso `Nonce` due volte) e i messaggi con
`Created` più vecchio di un'ora (la finestra di freschezza raccomandata
da SPOT) — i nonce già visti si tengono in storage solo per quella
finestra, poi si puliscono da soli. Senza i due secret configurati,
il Data Push viene sempre rifiutato (401): non è un guasto, resta
solo `/claim`+`/ingest` a funzionare.

Se l'account SPOT dovesse avere più di un dispositivo, il Data Push
manda i messaggi di tutti — `SPOT_PUSH_ESN` (opzionale) filtra solo
quelli con l'ESN della nostra sonda; vuoto accetta tutto (va bene con
un solo dispositivo, il caso di oggi).

### Il vecchio polling interno (presente, spento)

Il Worker sapeva anche interrogare SPOT da solo, con un ciclo basato
sull'**alarm** del Durable Object (i Cron Trigger di Cloudflare hanno
granularità di un minuto, non permettono 150s) invece che sui Cron
Trigger. Quel codice c'è ancora — non è stato cancellato, solo spento,
nel caso SPOT smetta un giorno di bloccare i Worker. `alarm()` esce
subito a meno che la variabile `INTERNAL_POLLING_ENABLED` in
`wrangler.toml` non sia `"true"` (oggi è `"false"`); `/start` e `/stop`
restano gli endpoint di allora, ma con il polling interno spento non
fanno più nulla di utile.

## Endpoint

### Pubblici (CORS limitato alle origini in `ALLOWED_ORIGINS`)

| | |
|---|---|
| `GET /track.json` | Punti ordinati per tempo + metadati (`last_fetch`, `last_fetch_ok`, `last_point_time`, `polling_active`). Cache 30s. Solo i punti con `time >= PUBLIC_FROM`; se `PUBLIC_FROM` non è impostato, nessun punto. |
| `GET /track.csv` | Stessi dati in CSV (orario UTC e locale America/Montevideo, lat, lon, quota, tipo messaggio, batteria). |

### Data Push di SPOT (autenticato con firma X-WSSE, non ADMIN_TOKEN)

| | |
|---|---|
| `POST /` | SPOT manda qui l'XML del Data Push appena un nuovo messaggio arriva — vedi "Data Push" sopra. Verifica `X-WSSE` (`SPOT_PUSH_USERNAME`/`SPOT_PUSH_SECRET`), scarta replay e messaggi troppo vecchi. Risponde `200 OK` (testo semplice, come SPOT si aspetta) se tutto va bene, `401` se la firma non torna, `500` su un errore di elaborazione (SPOT riprova da solo fino a 10 volte). |

### Protetti (header `Authorization: Bearer <ADMIN_TOKEN>`)

| | |
|---|---|
| `GET /track-all.json` | Tutti i punti salvati, senza il filtro `PUBLIC_FROM` — per verificare le prove. |
| `POST /claim` | Chiede il permesso di interrogare SPOT. Risponde `{"granted":true}` se sono passati almeno 150s dall'ultimo permesso concesso (a chiunque), altrimenti `{"granted":false,"retry_after_s":N}`. Lo usa `admin-diretta.html`. |
| `POST /ingest` | Corpo `{"ok":bool,"status"?:number,"body"?:JSON\|testo,"error"?:string}` — il risultato di una chiamata a SPOT fatta dal browser (da `admin-diretta.html`), così com'è arrivata. `ok:false` = il fetch dal browser è fallito del tutto (rete/CORS); altrimenti `status`/`body` sono quelli della risposta HTTP di SPOT, errore applicativo incluso. Risponde sempre `{"ok":true,"spot_ok":bool,"upserted":N,"received":M}` — anche quando `spot_ok` è `false`: l'errore si registra comunque (`last_error`), non si rifiuta l'ingest. "Nessun messaggio ancora" (`E-0195`) conta come successo. |
| `POST /start` | Avvia il *polling interno* (oggi spento, vedi sopra — non serve più per l'uso normale). |
| `POST /stop` | Ferma il polling interno. |
| `POST /reset` | Cancella tutti i punti salvati. Da usare dopo le prove, prima del giorno vero. Non tocca `publicFrom`/`simulate`. |
| `POST /backfill` | Riscarica l'intero volo da SPOT **dal Worker** (occasionale e manuale: se anche questa iniziasse a essere bloccata da SPOT andrà spostata sul browser come il resto) e lo reinserisce, stessa deduplica. Corpo vuoto → pagina con `start=51,101,…` fino a 7 giorni; oppure `{"startDate":"...", "endDate":"..."}` (formato SPOT) per un intervallo preciso. |
| `POST /public-from` | Corpo `{"time": <unix secondi>}` oppure `{"time": null}` per nascondere di nuovo tutto. |
| `POST /simulate` | Corpo `{"enabled": true\|false}`. Riguarda solo il polling interno (spento): con `simulate` attivo e `INTERNAL_POLLING_ENABLED="true"`, l'alarm genera un volo finto invece di chiamare SPOT davvero — vedi sotto. |

## Proxy mattonelle nuvole (OpenWeatherMap)

`GET /clouds/{z}/{x}/{y}.png` — non ha niente a che fare con SPOT: vive
in questo Worker solo perché è lo stesso repo/stesso deploy. Il
livello "nuvole" della mappa (`assets/mapkit.js` sul sito) lo usa al
posto di chiamare `tile.openweathermap.org` direttamente, perché
OpenWeatherMap non supporta restrizioni per dominio/referrer sulle
chiavi API: una chiave nel JS pubblico del sito potrebbe essere letta
e riusata da chiunque, consumando la quota. Qui la chiave vera
(`OWM_KEY`, secret — vedi "Deploy" sopra) non lascia mai il Worker; il
controllo di chi può usarla lo fa `src/cloud-proxy.ts` leggendo
l'header `Referer` (le mattonelle arrivano come `<img src>` di
Leaflet, non `fetch()`: niente header `Origin` da controllare come per
gli altri endpoint — vedi `corsHeaders()` in `util.ts`) contro la
stessa lista `ALLOWED_ORIGINS` degli altri endpoint. Le mattonelle
restano in cache (Cache API di Cloudflare) 10 minuti.

## Privacy dei punti di prova

Il feed SPOT può contenere, fino a 7 giorni indietro, punti di prova
registrati in luoghi da non rendere pubblici. Per questo gli endpoint
pubblici restituiscono solo i punti con `time >= PUBLIC_FROM`, e senza
`PUBLIC_FROM` impostato non restituiscono nulla. **Prima del giorno del
lancio**: usare `POST /reset` per ripulire le prove, poi `POST
/public-from` con l'orario reale di decollo (o un po' prima).

## Modalità simulazione (per il vecchio polling interno)

Riguarda solo `alarm()`, oggi spento (vedi sopra): `POST /simulate
{"enabled": true}`, con `INTERNAL_POLLING_ENABLED="true"`, fa generare
invece di chiamare SPOT un volo finto che segue lo stesso ritmo vero
(un punto ogni 150s reali — la simulazione non accelera il tempo,
prova proprio la cadenza del Worker), con buchi di segnale e messaggi
duplicati inclusi apposta (circa 1 su 10 ciascuno, scelta
deterministica — lo stesso slot dà sempre lo stesso risultato), per
verificare la deduplica e la cadenza senza il tracker vero. `POST
/simulate {"enabled": false}` torna al feed vero. Per provare
`/claim`+`/ingest` (il meccanismo vero, oggi) basta aprire
`admin-diretta.html` in locale (`npm run dev`) con un `WORKER_BASE`
che punta al Worker locale — non serve la modalità simulazione per
quello.

## Pagina di amministrazione

`admin-diretta.html`, alla radice del sito (non in `worker/`): non è
collegata da nessuna parte nel sito e ha `<meta name="robots"
content="noindex">`. È lei a interrogare SPOT, dal browser di chi la
tiene aperta — vedi "Come funziona" sopra.

- **All'apertura** chiede admin token, Feed ID e password del feed (se
  richiesta): restano solo nella memoria della pagina — niente nel
  repo, niente in `localStorage`. Si perdono ricaricando la pagina.
- **Ogni ~155s**: `POST /claim` → se concesso, interroga SPOT dal
  browser → `POST /ingest` col risultato, successo o errore. Se il
  permesso non è concesso (un'altra pagina di amministrazione ce l'ha
  già), salta il giro senza chiamare SPOT.
- **Mostra**: ultima chiamata, esito, punti nuovi arrivati, conto alla
  rovescia al prossimo giro, un registro degli ultimi eventi.
- **Wake Lock API** (`navigator.wakeLock`) per evitare che lo schermo
  si spenga da solo — da sola non basta: se il browser manda la scheda
  in background (si passa a un'altra scheda, si minimizza la finestra)
  i timer rallentano comunque, indipendentemente dallo schermo. La
  pagina lo segnala con un avviso che diventa urgente quando rileva
  che è andata in background (`document.visibilityState`), e con un
  simbolo nel titolo della scheda.
- **Niente pulsanti `/start`/`/stop`** (non servono più): restano
  `/reset` e l'impostazione di `PUBLIC_FROM` (con un selettore di data
  e ora, più una scorciatoia "ora").

Prima di poterla usare va impostato `WORKER_BASE` nel file stesso (una
costante in cima allo `<script>`, vuota di default) con l'URL del
Worker distribuito — la stessa cosa di `TRACK_URL` in `assets/app.js`
sul sito, ma tenuta separata apposta: questa pagina non carica
`assets/app.js` (che fa tutt'altro — nav, lingua, conto alla rovescia
del sito — niente che serva qui).

## Deploy (dalla dashboard, collegato al repo GitHub)

Il Worker si distribuisce collegando questo repository a Cloudflare,
non da terminale: a ogni push su main che tocca `worker/`, Cloudflare
lo ricostruisce e lo pubblica da sola (Workers Builds). Il repo è un
monorepo — contiene anche il sito — quindi il passaggio che conta è
impostare la **root directory** su `worker/`, cosa che Cloudflare
chiede esplicitamente in fase di collegamento.

1. **Collegare il repository**
   Dashboard Cloudflare → **Compute (Workers)** → **Workers & Pages**
   → **Create** → scheda **Import a repository** (o **Connect to
   Git**, a seconda della versione della dashboard).
   - Autorizzare la GitHub App di Cloudflare, se non è già installata
     sull'organizzazione `cometa-sim`, e darle accesso al repository
     `cometa-sim.github.io` (basta anche solo a quel repository, non
     serve concedere accesso a tutti i repository dell'account).
   - Selezionare `cometa-sim/cometa-sim.github.io`.
   - **Branch di produzione**: `main` — ma `worker/` deve già esistere
     su quel branch, quindi questo passaggio va fatto *dopo* che la
     pull request del backend è stata unita a `main` (prima, per
     fare una prova, si può collegare temporaneamente al branch della
     pull request e cambiarlo a `main` dopo il merge).

2. **Impostazioni di build** (schermata "Set up builds and deployments",
   o "Build configuration")
   - **Root directory**: `worker`
   - **Build command**: lasciare vuoto — Wrangler compila il
     TypeScript da solo, non serve un passaggio di build separato
     (se la dashboard insiste per averne uno, `npm install` va bene).
   - **Deploy command**: `npx wrangler deploy`
   - Il nome del progetto proposto dovrebbe coincidere con `name` in
     `wrangler.toml` (`cometa-sim-github-io`); se la dashboard ne
     suggerisce uno diverso, meglio rinominarlo così prima di confermare.
   - **Deployments di anteprima per le pull request**: si può
     disattivare (non servono, questo progetto non ne ha bisogno); se
     restano attivi, ogni anteprima è un Worker separato con i suoi
     secret da impostare a parte — un dettaglio in più da gestire per
     niente, meglio spegnerli se la dashboard lo permette.
   - Confermare: la prima build parte subito, applica anche la
     migrazione del Durable Object (`new_sqlite_classes`, già descritta
     in `wrangler.toml`) e pubblica il Worker.
   - Da questo momento, Cloudflare ricostruisce e ripubblica da sola a
     ogni push su `main` — ma solo quando il push tocca file dentro
     `worker/`: un commit che cambia solo il sito (`index.html`,
     `assets/`, …) non fa ripartire una build qui.

3. **Impostare i secret dalla dashboard** (mai nel repo)
   Dopo il primo deploy, sulla pagina del Worker appena creato:
   **Settings** → **Variables and Secrets** → **Add** (o **Edit
   variables**, a seconda della versione).
   Per ciascuno di questi, Nome + Valore, tipo **Secret** (cifrato,
   non più leggibile dopo averlo salvato — non il tipo "Text", che
   resta in chiaro):
   - `FEED_ID` — l'id del feed pubblico SPOT
   - `FEED_PASSWORD` — solo se il canale la richiede
   - `ADMIN_TOKEN` — un token lungo e casuale, per esempio generato con
     `openssl rand -hex 32`
   - `SPOT_PUSH_USERNAME` — il "token cliente" dalla scheda Data Push
     di `myaccount.findmespot.com` → SPOT API → Data Push (solo se si
     usa il Data Push — vedi "Data Push" sopra; senza, resta solo
     `/claim`+`/ingest`)
   - `SPOT_PUSH_SECRET` — il "token segreto" nella stessa scheda
   - `OWM_KEY` — chiave OpenWeatherMap per il proxy `/clouds/{z}/{x}/{y}.png`
     (vedi "Proxy mattonelle nuvole" più sotto — non ha niente a che
     fare con SPOT, vive qui solo perché è lo stesso Worker/repo)

   `ALLOWED_ORIGINS` **non** va qui: è una variabile normale (non un
   segreto), già definita in `wrangler.toml` sotto `[vars]` — cambia
   il dominio lì, con un commit, non dalla dashboard. Salvare i
   secret fa ripartire da sola una nuova build (necessaria, o il
   Worker in esecuzione non li vede).

4. **Verificare**
   ```sh
   curl https://<url-worker>/track.json
   # {"points":[],"last_fetch":null,"last_fetch_ok":null,"last_point_time":null,"polling_active":false}
   ```
   L'URL del Worker (del tipo
   `https://cometa-sim-github-io.<account>.workers.dev`, o un dominio
   personalizzato se ne è stato collegato uno) è quello da mettere in
   **due posti**: la costante `TRACK_URL` in `assets/app.js` sul sito
   principale (legge `/track.json`), e la costante `WORKER_BASE` in
   cima allo `<script>` di `admin-diretta.html` (chiama `/claim` e
   `/ingest`) — vedi "Pagina di amministrazione" sopra.

### In alternativa: deploy da terminale

Utile per una prova rapida prima di collegare la dashboard, o se si
preferisce non usare Workers Builds:
```sh
cd worker
npm install
npx wrangler login
npx wrangler secret put FEED_ID
npx wrangler secret put FEED_PASSWORD   # solo se il feed lo richiede
npx wrangler secret put ADMIN_TOKEN
npm run deploy
```
Un deploy da terminale e uno da dashboard collegata pubblicano lo
stesso Worker (stesso `name` in `wrangler.toml`): usarli insieme non
rompe nulla, ma da quel momento ogni push su `main` sovrascrive quanto
pubblicato a mano dal terminale.

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
SPOT_PUSH_USERNAME=...
SPOT_PUSH_SECRET=...
OWM_KEY=...
```
(gli ultimi due solo per provare `POST /` in locale — vedi "Data Push"
sopra; un corpo XML firmato si costruisce con lo stesso algoritmo
descritto lì, non con `curl` a mano.)

### Il giorno del lancio

```sh
# ripulire le prove
curl -X POST https://<url-worker>/reset -H "Authorization: Bearer <ADMIN_TOKEN>"

# rendere pubblici solo i punti da ora in poi (unix secondi) — oppure
# dalla pagina di amministrazione stessa, con il selettore data/ora
curl -X POST https://<url-worker>/public-from -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" -d '{"time": 1760000000}'
```

Poi aprire `admin-diretta.html`, inserire admin token/Feed ID/password
del feed, premere "Avvia" e **tenere quella scheda in primo piano**
per tutto il volo (vedi "Pagina di amministrazione" sopra — il Wake
Lock evita che lo schermo si spenga, ma non basta da solo se si cambia
scheda). Se `SPOT_PUSH_USERNAME`/`SPOT_PUSH_SECRET` sono configurati e
il Data Push è attivo sull'account SPOT, la posizione arriva comunque
quasi in tempo reale anche se quella scheda restasse indietro — ma
tenerla aperta resta necessario per la quota, che il Data Push non
manda (vedi "Data Push" sopra).

Dopo il volo, se ci sono buchi (per esempio dopo un'interruzione di
rete), `POST /backfill` riscarica tutto da SPOT e li colma.

### Verificare i tempi

```sh
npm run tail
```
mostra i log in diretta: un `/ingest` fallito (errore SPOT, HTTP
non-ok) logga per intero status e corpo della risposta; un Data Push
rifiutato logga il motivo (`[SPOT Data Push] rifiutato: ...`), uno
accettato logga quanti punti ha ricevuto e quanti erano davvero nuovi.
`last_fetch` in `GET /track.json` conferma che i dati arrivano (da
`/ingest` o dal Data Push, ogni ~155s l'uno, quasi subito l'altro); se
più pagine di amministrazione sono aperte insieme, i `/claim` negati
negli eventi di `admin-diretta.html` confermano che solo una alla
volta sta davvero chiamando SPOT.
