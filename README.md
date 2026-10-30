# cometa-sim.github.io

Sito del **Progetto COMETA** — Scuola Italiana di Montevideo.
Un pallone stratosferico a quasi 36 km di quota, progettato, costruito e
programmato dagli studenti di 2EMS, IIIS, 3EMS, IVL e IVS.

🌐 https://cometa.scuolaitaliana.edu.uy

## Com'è fatto il sito

Una sola pagina con navigazione interna (`#missione`, `#fisica`, `#sonda`,
`#venti`, `#legale`, `#qa`, `#about`): nessun ricaricamento, la lingua scelta
resta. Senza indirizzo si apre `#home`.

```
index.html                          tutte le sezioni
sonda.html · venti.html             rimandi ai vecchi indirizzi
simulazione-diretta.html            prova la pagina Diretta con un orologio accelerato
                                     e un feed GPS finto, senza aspettare il lancio vero
                                     (NON è una pagina del sito, non è linkata da nessuna parte)

assets/cometa.css                   colori, caratteri, impaginazione
assets/i18n.js                      i testi in italiano, spagnolo e inglese
assets/sonda.js                     i 25 componenti + il modello 3D (Three.js)
assets/catena.js                    la catena di volo in 3D, nella pagina Missione
assets/volo.js                      ora del lancio (LAUNCH) e dati del volo (FLIGHT_*), la richiesta della traiettoria prevista
assets/app.js                       lingua, navigazione, salita, fisica, conto alla rovescia
assets/traiettoria.js               prevedere il volo: pallone, partenza, Tawhiri
assets/msis.js                      NRLMSIS 2.1 tabulato, generato da calcolo/genera_msis.py
assets/spot.js                      pagina Diretta: mappa (SPOT e LoRa), legenda, quota stimata in volo
assets/lora.js                      pagina Diretta: i dati LoRa da dati.cometa.gripe, filtrati
assets/profilo.js                   pagina Diretta: il grafico della quota dai dati LoRa
assets/mapkit.js                    controlli comuni alle due mappe: satellite, nuvole/pioggia,
                                     schermo intero, salva — vedi «I livelli della mappa»
assets/vendor/three.min.js          Three.js r128, copia locale (vedi sotto)
assets/vendor/leaflet/              Leaflet 1.9.4, copia locale, per la previsione del giorno

assets/img/cometa-logo.png          marchio COMETA, fondo trasparente
assets/img/sim-140-logo.png         marchio dei 140 anni della Scuola, fondo
                                    trasparente. Porta scritte BIANCHE: si vede
                                    solo su fondo scuro, ed e' li' che sta (fondo
                                    pagina). Ritagliato al contenuto, cosi' la
                                    larghezza combacia con quella del logo COMETA
assets/img/sim-logo.png             stemma della Scuola da solo, fondo trasparente.
                                    Non e' piu' usato in pagina: tenuto perche' e'
                                    il marchio senza la ricorrenza
assets/img/catena-volo.png          schema della catena di volo
assets/img/zona-exclusion-dinacia.jpg   area di esclusione aeronautica
assets/img/og.png                   anteprima per social e messaggistica

mappe/uru2000_footprint.html        mappa generata da cometa_venti.py — NON modificare a mano
calcolo/cometa_venti.py             lo script della simulazione e della previsione
calcolo/convergenza_raccolta.py     raccolta quotidiana delle previsioni di Tawhiri (workflow)
calcolo/convergenza_analisi.py      di quanto si sposta l'atterraggio previsto al variare dell'anticipo
.github/workflows/convergenza.yml   il workflow quotidiano, scrive sul branch dati

worker/                             backend SPOT (Cloudflare Worker + Durable Object) — vedi worker/README.md
lora/                               telemetria LoRa: formato, Worker su R2, simulatore, pagina della stazione di terra
                                     (lora/stazione/, non collegata dal sito, noindex) — vedi lora/README.md
admin-diretta.html                  pagina di amministrazione della diretta (posizioni, polling, riserva) —
                                     non collegata dal sito, noindex, vedi worker/README.md

LICENSE · README.md · .gitignore
```

Sezioni: Inizio · Missione · La fisica del volo · La sonda · La traiettoria ·
Norme e autorizzazioni · Domande · Chi siamo.

## Dove si modificano le cose

| Cosa | Dove |
|---|---|
| Un testo, in una qualsiasi delle tre lingue | `assets/i18n.js` |
| Misure, peso o nota di un componente | l'elenco `PARTS` in `assets/sonda.js` |
| Nomi delle cinque parti della catena di volo | la chiave `chain` in `assets/i18n.js` |
| Colori e caratteri di tutto il sito | il blocco `:root` in `assets/cometa.css` |
| Data del lancio (conto alla rovescia, Diretta, stazione LoRa) | la costante `LAUNCH` in `assets/volo.js` |
| Fondo scala delle animazioni | la costante `SCALA_KM` in `assets/app.js` |
| Quota di scoppio, velocità di salita/discesa e sito di lancio attesi (pagina Diretta) | `FLIGHT_BURST_KM`, `FLIGHT_ASCENT_MS`, `FLIGHT_DESCENT_V0_MS`, `FLIGHT_SITE` in `assets/volo.js` |
| Payload pesato e portanza al collo misurata (pagina Diretta) | `FLIGHT_PAYLOAD_KG`, `FLIGHT_NECK_LIFT_G` in `assets/volo.js` |
| Indirizzo del backend che interroga SPOT (pagina Diretta) | la costante `TRACK_URL` in `assets/app.js` |
| Se la Diretta compare in nav (oggi sì, dal 25 ottobre) | `DIRETTA_PUBLIC` in `assets/app.js` |
| Quando compare "Diretta" in nav e quando diventa rossa, se pubblica | `DIRETTA_WINDOW` e `DIRETTA_START` in `assets/app.js` |
| Numeri delle quattro schede della pagina iniziale | direttamente in `index.html` |
| Stato di una tappa del progetto | la classe `done`, `wip` o `todo` della riga in `index.html` |

### Dopo ogni modifica: il numero di versione

In `index.html` i file di `assets/`, e la mappa, sono richiamati con un numero in
coda — oggi `?v=255`:

```html
<link rel="stylesheet" href="assets/cometa.css?v=255">
<script src="assets/i18n.js?v=255"></script>
```

Lo stesso numero compare anche in punti meno visibili, che vanno alzati
insieme: il caricamento di `assets/mapkit.js` dentro `assets/traiettoria.js`
e dentro `assets/spot.js`, quello di `assets/map3d.js` dentro
`assets/traiettoria.js` (li caricano loro, non `index.html`), e la pagina di
prova `simulazione-diretta.html`.

Serve a costringere il browser a riscaricarli. **Chi modifica un file in
`assets/` deve alzare quel numero di uno**, altrimenti i visitatori che hanno
già aperto il sito continuano a vedere la versione vecchia, e la modifica
sembra non aver funzionato.

Il guasto è subdolo, perché colpisce **solo chi il sito l'ha già visto**: a
chi arriva per la prima volta il server manda comunque i file nuovi, quindi
provando da una finestra pulita sembra tutto a posto. Il sintomo tipico è una
pagina mezza rotta — l'impaginazione nuova con i testi vecchi, o un grafico
senza il suo foglio di stile. Prima di pubblicare conviene quindi controllare
che il numero sia davvero cambiato:

```
grep -o '?v=[0-9]*' index.html simulazione-diretta.html assets/traiettoria.js assets/spot.js | cut -d: -f2 | sort -u
```

Deve uscire un solo valore, e diverso da quello di prima.

`sonda.html` e `venti.html` sono rimandi con il foglio di stile scritto
dentro, e non richiamano nessun file di `assets/`.

### Lingua

Alla prima visita il sito sceglie da solo tra italiano, spagnolo e inglese
guardando le preferenze del browser; se il visitatore cambia lingua, la scelta
viene ricordata. Ogni testo tradotto ha una chiave: nell'HTML compare come
`data-i18n="chiave"` (testo semplice) o `data-i18n-html="chiave"` (testo che
contiene `<strong>`, `<a>`…).

### Come si scrivono i testi

Le due sezioni hanno registri diversi, e conviene non mescolarli. Nelle pagine
espositive — missione, la fisica del volo, studio dei venti — i numeri e i
passaggi chiave vanno in `<strong>`. Nelle **Domande** no: lì l'unica
sottolineatura è `<em>`, usata per le parole, e i dati stanno nella frase senza
risalto tipografico.

Le fonti seguono la stessa logica. Nelle pagine espositive stanno in un blocco
in fondo, nella forma `<strong>Etichetta:</strong>` (le chiavi `srcMeteo`,
`srcMap`, `srcCalc` per i venti, `lSrc1` e `lSrc2` per gli aspetti legali).
Nelle Domande, che non hanno quel blocco, la fonte si nomina dentro la frase.
Il collegamento si mette all'ente o al servizio, non al documento: la DINACIA e
Open-Meteo sono linkati, il regolamento LAR 91 no.

### Come si aggiunge uno stile

`assets/cometa.css` è cresciuto insieme al sito, e ha due abitudini su cui
è facile inciampare.

**Nomi di classe generici.** `.todo` non è «da fare»: è il segnaposto giallo
tratteggiato per i contenuti incompleti, e contiene `white-space:nowrap`.
`.bk` non è «blocco»: sono le quattro parentesi angolari agli angoli dei
riquadri, in posizione assoluta. Riusarli per altro non dà nessun errore —
il testo semplicemente smette di andare a capo, o compaiono trattini
azzurri dove non dovrebbero.

**Stili su elementi nudi.** `nav`, `table`, `th`, `td`, `a`, `body`, `html`,
`footer` e `img,svg,iframe` hanno una regola propria. Un `<nav>` scritto in
buona fede dentro una pagina diventa una seconda barra fissa in cima allo
schermo, sovrapposta al titolo.

Quindi, prima di scrivere una classe o un elemento nuovo:

```
grep -n '\.nomeclasse[^a-zA-Z0-9_-]' assets/cometa.css
grep -oE '^[a-z]+(,[a-z]+)*\{' assets/cometa.css | sort -u
```

Il primo dice se il nome è già preso, il secondo elenca tutti gli elementi
che hanno già uno stile. Le classi nuove di una sezione conviene prefissarle
— `pg-done`, `bal-tag`, `org-grid` — così il problema non si ripresenta.

Vale la pena controllare anche il risultato a schermo stretto: quasi tutti
questi guasti si vedono solo lì, come testo che esce dal riquadro o come una
pagina più larga dello schermo, che il telefono mostra rimpicciolita.

### L'indice della pagina Missione

Missione è la pagina più lunga, e in cima ha un indice. Non usa gli
indirizzi — l'indirizzo qui sceglie la pagina, non un punto dentro —
ma l'attributo `data-jump`, che `jumpTo()` in `assets/app.js` risolve
in uno scorrimento morbido.

L'indice ha quattro voci — in sintesi, cosa misuriamo e come, chi fa
cosa, a che punto siamo — e non una per sezione: le sezioni sono sei,
ma non sono tutte dello stesso livello, e un elenco che mette «scelte
tecniche» accanto a «a che punto siamo» non aiuta a orientarsi. Ogni voce porta all'inizio del blocco che la riguarda.

Le sezioni hanno tutte il loro `id="m-qualcosa"`, anche quelle che
l'indice non nomina: servono se un giorno si vuole rimandare lì da
un'altra pagina. Aggiungendo una sezione, quindi, basta darle un id;
si aggiunge una voce all'indice solo se è di quel livello lì.

### A che punto siamo

In fondo alla pagina Missione ci sono due blocchi che raccontano il progetto
come processo: **Chi fa cosa**, i sei gruppi di lavoro (chiavi `org1t`…`org6`),
e **A che punto siamo**, le tappe del lavoro (chiavi `pg1t`…`pg12`).

Lo stato di ogni tappa non sta nei testi: è la classe della riga in
`index.html`, dentro l'elenco `<ol class="prog">`.

```html
<li class="pg-done">…   fatto      pallino verde
<li class="pg-wip">…    in corso   pallino azzurro
<li class="pg-todo">…   da fare    pallino vuoto
```

Per aggiornare una tappa si cambia solo quella parola, e si sposta la riga
nel punto giusto dell'elenco (fatto, poi in corso, poi da fare): l'etichetta
visibile è già tradotta nelle tre lingue dalle chiavi `pgDone`, `pgWip` e
`pgTodo`. Il pallone che sta sopra l'elenco **conta le righe da solo** —
`progBalloon()` in `assets/app.js` — quindi non c'è nessun numero né
percentuale da aggiornare a mano.

I nomi delle classi hanno il prefisso `pg-` di proposito: `.todo` senza
prefisso è già un'altra cosa nel foglio di stile (il segnaposto giallo per
i contenuti da completare), e usarlo qui rompeva l'impaginazione.

**È l'unica parte del sito che invecchia da sola**: conviene rileggerla ogni
volta che un gruppo chiude qualcosa.

### I numeri del volo

I numeri che escono dal calcolo — quota di scoppio, elio, velocità di
discesa, durata — cambieranno ancora: dipendono dalla massa del payload,
che sarà definitiva solo dopo la pesata in fase di assemblaggio, e dalla
velocità di salita, che si decide anche in base al meteo del giorno.

Per questo il sito li usa a due livelli. Nei testi la quota **non compare
mai come cifra precisa**: si scrive «più di 37 km», «oltre 37 km», «37+»,
«la quota di scoppio». Così restano veri anche quando il calcolo cambia.
Dopo il volo del 29 ottobre (scoppio a 35,7 km) la home, la descrizione per
la condivisione (`metaDesc`) e l'apertura della Missione (`mBody`) dicono
la quota raggiunta, «quasi 36 km»; le tabelle e il numero grande della
Missione restano sulla quota *prevista*, e le spiegazioni di fisica e lo
studio dei venti non cambiano.

I **valori esatti stanno solo nello studio dei venti**, dove c'è la
discussione che li giustifica: la chiave `wParP2` per i parametri della
simulazione, e le chiavi `wA4P`…`wA4P4` per il bilancio d'incertezza.

Nella scala della fisica il punto di scoppio è un numero tondo, **38 km**,
nella costante `SCALA_KM` di `assets/app.js`. L'animazione della pagina
iniziale invece segue il volo vero, come il testo che dice «quasi 36 km»:
arriva a **36 km** (`HOME_KM`). È un fondo scala, non una dichiarazione, e non
compare in nessuna etichetta: il contatore che segue la salita mostra i
decimali fino a 37 e poi si ferma su `37+`, con la funzione
`quotaLetta()`. La cifra grande in fondo a Missione fa la stessa cosa —
sale con i decimali e resta `37+` — e la tappa 06 della fisica dice
`37+ km`.

Quando il calcolo verrà rifatto, i posti da toccare sono tre: la
costante in `app.js`, `wParP2` e il blocco `wA4P` in `i18n.js`.

### Il cielo della pagina iniziale

Il colore del cielo segue **l'ora vera di Montevideo**: giorno, tramonto,
notte, con passaggi morbidi. Chi apre il sito da Roma alle undici di sera
vede il cielo che c'è in quel momento sopra il luogo del lancio. Le tre
tavole di colore sono `SKY_DAY`, `SKY_DUSK` e `SKY_NIGHT` in
`assets/app.js`; gli orari dei passaggi stanno in `phaseWeights()`.

### La fisica del volo

Sette tappe, una per schermata, mentre il pallone sale e si gonfia. I testi
sono le chiavi `ph1t`…`ph7p` in `assets/i18n.js`; i confini delle tappe
lungo lo scorrimento sono l'elenco `PH_BANDS` in `assets/app.js`.

### La mappa

`mappe/uru2000_footprint.html` è prodotta da `cometa_venti.py` e va sostituita
rigenerandola, non modificandola. Il sito la scurisce dall'esterno, ne
ritinge i punti e la inquadra da solo su tutto quello che disegna — i due
siti di partenza, i 600 atterraggi, le ellissi: il file resta com'è.

Lo script produce un nome che contiene la data della corsa
(`010926_footprint.html`): rinominarlo in `uru2000_footprint.html`, che è
il nome che `index.html` cerca.

Cliccando un punto compare solo la data del volo: deriva e rotta si
leggono dalla mappa, la data serve a confrontare. Le mappe nuove escono
già così. In quella pubblicata, generata prima, le date sono state messe
da `calcolo/date_nei_popup.py`, che le ricava dall'ordine in cui lo script
scrive i punti e si ferma se i conteggi non tornano: non va rifatto, a
meno di rimettere una mappa vecchia.

### La traiettoria: prevedere il volo

La pagina `#venti` si chiama «La traiettoria» e ha un indice in
cima, come Missione (`data-jump` verso `v-previsione`, `v-calcolo`,
`v-studio`, `v-approx`). Prima viene lo strumento per prevedere il volo,
poi come si calcolano salita e discesa, poi lo studio dei venti che ci ha
fatto scegliere il sito.

Lo strumento sta tutto in `assets/traiettoria.js` e lavora nel browser di
chi guarda, senza server nostri:

1. **Il pallone.** Da modello (Strato 1600 o Strato 2000), payload,
   velocità di salita e bombola (20, 30, 40 o 50 L; proposta la 50 L)
   calcola elio necessario — in m³ e in bar da consumare, con l'elio
   trattato come gas reale (secondo coefficiente del viriale) —,
   portanza al collo, quota di scoppio e velocità di discesa al suolo;
   il tempo allo scoppio compare nella scheda della traiettoria.
   La bombola si considera a 200 bar e alla temperatura di gonfiaggio;
   pressione del manometro e temperatura si possono impostare a mano.
   Senza temperatura a mano valgono temperatura e pressione al suolo
   previste all'ora del lancio (come `--temp-gonfiaggio auto` dello
   script), altrimenti 15 °C e 1 atm. La temperatura cambia il volume da
   caricare e i bar, non la massa d'elio né la quota di scoppio.
   Salita, bar caricati e portanza al collo non sono indipendenti:
   fissata una, le altre due seguono. Per questo si sceglie quale
   scrivere con il **selettore che fa da etichetta al campo della
   salita** (`#twAscMode`): «Salita · m/s», di solito; il giorno del
   lancio «Elio · bar», i bar scesi nella bombola, e poi «Portanza · g»,
   quella pesata con la bilancia al collo del pallone chiuso. Le altre
   due compaiono nelle tessere sotto (la salita con due decimali, per
   vedere quanto pesa un bar), e passando da una grandezza all'altra il
   campo parte dall'equivalente di quella di prima. Dai bar si risale
   alle moli entrate con la stessa equazione della bombola (stessa
   pressione iniziale, stessa temperatura di gonfiaggio), poi al volume a
   15 °C e 1 atm e alla portanza al collo; da lì il motore del volo è
   quello di sempre (`motorePallone` con `neckG`, lo stesso della Diretta).
   È il porting delle funzioni di `cometa_venti.py`, e dà gli stessi
   numeri. La quota di scoppio usa l'atmosfera prevista per il luogo, il
   giorno e l'ora (Forecast API di Open-Meteo fino a 30 hPa, ~24 km) e
   più in alto la forma di NRLMSIS 2.1, ancorata all'ultimo livello: la
   stessa `Colonna` dello script. Il browser non può far girare NRLMSIS,
   quindi è tabulato in `assets/msis.js` per latitudine (tutto il globo,
   ogni 10°) e mese, da
   `calcolo/genera_msis.py` — non si modifica a mano. Senza dati del
   giorno si usa l'ISA, e la pagina lo dice. Nelle «Impostazioni
   avanzate» si cambiano diametro di scoppio e massa del pallone e il
   paracadute (quello del kit, 1,2 m, se resta vuoto), o si
   impongono quota di scoppio e discesa: vuoti, valgono quelli del
   modello e quelli calcolati.
2. **La partenza.** Si scrive una località (suggerimenti mentre si
   scrive: prima La Calera (Minas) e l'aerodromo di Mercedes, poi i due
   siti dello studio, Mercedes e Durazno, poi il geocoder di Open-Meteo),
   oppure le coordinate, oppure si tocca la mappa o si usa la posizione
   del telefono. La stella sulla mappa si può trascinare. Chi arriva
   trova La Calera, vicino a Minas, dove la DINACIA ci chiede di lanciare; l'ultimo luogo scelto dal visitatore resta nel
   `localStorage` del dispositivo (chiave `cometa-partenza-v2`).
   **Giorno e ora sono quelli del luogo di partenza**, non del browser:
   le 11 a Mercedes sono le 11 di Mercedes per chiunque guardi. Il fuso
   lo dà Open-Meteo (`timezone=auto`) con l'atmosfera del luogo, e
   l'etichetta dell'ora dice lo scarto da UTC («ora locale, UTC−3»);
   finché non arriva vale Montevideo. Anche gli orari dei risultati
   (tocca terra alle, corsa GFS, tabella dei giorni) sono nell'ora del
   luogo. La Diretta resta in ora di Montevideo, come `LAUNCH`.
3. **La traiettoria.** La chiede a **Tawhiri**, il predittore di
   [SondeHub](https://sondehub.org/), sui venti dell'ultima corsa del
   modello **GFS** della NOAA. La quota di partenza non la passiamo:
   Tawhiri usa quella del terreno nel punto scelto, e la scheda la
   mostra. «Confronta i prossimi giorni» ripete il calcolo per ogni
   giorno della settimana coperta dalla previsione.
   Nelle «Impostazioni avanzate» si possono chiedere più partenze
   (fino a un giorno e a un'ora, ogni 30 min-3 h, al massimo 48): la
   mappa le disegna come un'unica fascia — per ogni frazione del volo,
   l'involucro convesso delle posizioni di tutte le partenze — con in
   arancione la zona di atterraggio, e la scheda dà gli intervalli.
   Sempre lì, «Intervallo di atterraggio»: per una partenza singola si
   ricalcola la traiettoria con il diametro di scoppio a ±s % (quota di
   scoppio dal modello, stessa atmosfera), con la velocità di salita a
   ±s % e con quella di discesa a ±s % (5 % proposto per tutti). Con un
   solo parametro attivo si fanno 2 richieste a Tawhiri e la mappa
   disegna la linea fra i due atterraggi estremi passando per il nominale;
   con due o tre si ricalcola ogni combinazione degli estremi (4 o 8
   richieste) e l'area è l'involucro convesso di tutti gli atterraggi,
   nominale compreso (5 o 9 voli), senza ipotesi di linearità. Linea e
   area sono viola; la didascalia elenca i parametri attivi e la loro
   percentuale. Con 0 in una voce quel parametro non entra.
   Sotto, «Errore di previsione»: allarga linea o area (o, da solo, fa un
   cerchio intorno all'atterraggio) di quanto la previsione può ancora
   spostarsi fino al giorno del lancio; vedi «Quanto ci si può fidare
   della previsione a qualche giorno» più sotto. La scheda dà il raggio
   (R = … km) e, in una riga a parte («Run GFS»), l'età della corsa GFS
   usata rispetto al lancio (in giorni, sotto le 72 h in ore, «50 h»), e
   la didascalia dice il tempo al lancio invece del
   raggio, che si vede già sulla mappa: così si capisce che l'errore
   dipende da quanto manca. Con il solo errore di previsione la scheda non
   riporta l'estensione massima, che sarebbe solo il diametro.
   L'area dell'errore di previsione è **sfumata**: al centro (e dentro
   l'area del pallone) ha l'opacità di sempre, verso il bordo cala come
   exp(−d²/2σ²), con σ = RMS/√2 interpolato dalla curva come Q3. Gli
   spostamenti misurati seguono bene la distribuzione di Rayleigh di una
   gaussiana 2D isotropa (entro Q3 il 75% dei casi, entro 1,5 Q3 circa il
   95%), quindi al bordo R la densità è circa ¼ di quella al centro. Si
   disegnano 14 fasce annidate senza contorno, con opacità scelte perché
   sovrapposte diano quel profilo (`fcStrati()` in `assets/traiettoria.js`,
   la stessa costruzione con cerchi concentrici nella Diretta); il bordo a
   R resta disegnato a parte. La vista 3D della Diretta resta a tinta unita.

Sotto la mappa, il riquadro meteo (icona, temperatura, vento, nuvole,
probabilità di pioggia) è la previsione oraria di Open-Meteo per il punto, il
giorno e l'ora della partenza scelti, e si aggiorna quando cambiano.

Il giorno proposto è la data di `LAUNCH` in `assets/volo.js`, quando cade
nella settimana della previsione, altrimenti domani. L'area di esclusione
e il contorno dell'Uruguay sono ripetuti in cima a `assets/traiettoria.js`
e sono gli stessi di `cometa_venti.py`: se cambiano, vanno cambiati nei
due posti. Così i preset dei palloni.

Lo stesso calcolo si fa dal terminale:

```
python3 calcolo/cometa_venti.py --tawhiri --pallone 2000 --payload 1.5 --sito "Mercedes,-33.249,-58.030" --lancio 2026-10-07T11:00 --giorni-prev 3 --html
```

«Scarica l'immagine della mappa» produce un PNG largo almeno 3200 px, a
tema chiaro: non è una foto dello schermo, la stessa vista viene
ridisegnata con le mattonelle OSM a uno o due livelli di zoom in più (al
massimo 200 mattonelle, per rispetto del server) e i tracciati con
colori da fondo chiaro, più scala, titolo (luogo, data, corsa GFS),
legenda e attribuzione. Per questo il livello delle mattonelle è caricato
con `crossOrigin`: senza, il canvas non si potrebbe salvare.

Con il livello **nuvole/radar acceso** l'immagine porta via anche il meteo,
e la regola è una sola: le mattonelle sono lo stato di adesso, lo
specchietto è una previsione.

- lo **specchietto delle condizioni** (le stesse celle che si vedono sotto
  la mappa, in alto a destra nell'immagine, con sopra il giorno e l'ora)
  c'è sempre: è la previsione per il momento della partenza scelto, e i
  valori si leggono dal riquadro della pagina, non si richiedono di nuovo;
- le **mattonelle di nuvole e radar** finiscono nell'immagine solo
  salvando il giorno stesso della partenza. Su una mappa intitolata a un
  giorno futuro sarebbero una bugia: mostrerebbero il cielo di oggi.

Le mattonelle delle nuvole sono bianche su trasparente, ed è la
trasparenza a portare il dato: qui lo sfondo è chiaro, quindi si
ricolorano di ardesia tenendo la stessa trasparenza — più nuvole, più
scuro. Il radar no: i suoi colori sono la scala dell'intensità di
pioggia. Le fonti in più (OpenWeatherMap, Open-Meteo) si aggiungono
all'attribuzione solo quando sono davvero nell'immagine.

L'immagine 3D è invece una fotografia della vista, quindi le nuvole, se
accese, ci sono già; lo specchietto si aggiunge allo stesso modo.

Leaflet (`assets/vendor/leaflet/`) si scarica solo quando la mappa entra
nello schermo.

#### Quanto ci si può fidare della previsione a qualche giorno

Per costruire una curva «spostamento contro anticipo», il workflow
`.github/workflows/convergenza.yml` gira ogni giorno alle 03:37 UTC (non
al minuto 0, dove GitHub accoda le schedule; in pratica parte con ore di
ritardo, ma prima del lancio delle 14:00 UTC) e chiede a Tawhiri il volo
proposto dalla pagina — aerodromo di Mercedes, Strato 2000, payload
1,5 kg, salita 5 m/s, ore 11:00 — per oggi e per i sette giorni seguenti.
Quota di scoppio e discesa sono fisse (ISA), così cambia solo il vento. I
punti di atterraggio finiscono in `convergenza.csv` sul branch `dati`,
non protetto e non pubblicato: il bot ci scrive senza PR e il sito non
si rigenera. Una riga con lo stesso `(dataset, bersaglio)` di una già
presente si scarta, così un giro caduto sulla stessa corsa GFS del
precedente non aggiunge nulla.

Dal 12 ottobre 2026 lo stesso volo si chiede anche per altri siti, per
capire se la curva si può trasferire: Durazno, Rivera e Rocha in Uruguay,
Comodoro Rivadavia (Patagonia, correnti forti), Cuiabá (tropici, venti
deboli), Bologna (emisfero nord, altra stagione), e Mercedes con scoppio a
22 km (profilo diverso). Partenza alle 11 locali; un CSV per sito,
`convergenza_<sito>.csv`. Ogni riga registra anche durata del volo,
lunghezza del percorso e deriva: l'analisi ne ricava l'errore di vento
efficace e/T e l'errore relativo e/L, e con più file li confronta fra i
siti. Se le curve di e/T coincidono, scalare con la durata del volo regge.
L'elenco dei siti è `SITI` in `calcolo/convergenza_raccolta.py`.

Dal 24 ottobre 2026 c'è anche **La Calera** (SUCL), l'aerodromo vicino a
Minas da cui si lancerà: lo consiglia la DINACIA perché è il punto con meno
traffico aereo, quindi è anche quello che si userà di più in Uruguay. Per
questo sito il workflow gira **quattro volte al giorno** (03:37, 09:37,
15:37 e 21:37 UTC; gli altri siti solo alle 03:37), una per ciascuna corsa
GFS — 00, 06, 12 e 18 UTC, cioè 21, 03, 09 e 15 in Uruguay, disponibili in
Tawhiri qualche ora dopo — e l'analisi raggruppa l'anticipo a passo di 6 h
(`--passo 6`): la curva si misura corsa per corsa invece che interpolata
fra un giorno e l'altro. Il riferimento di ogni bersaglio è la corsa più
recente prima del lancio. Il punto (−34,2919, −55,3531) è quello di lancio
sul prato, lo stesso di `FLIGHT_SITE` in `assets/volo.js` e della pagina
Traiettoria; il punto di riferimento ufficiale dell'aerodromo (AIP DINACIA,
−34,2905, −55,3552, il centro delle piste) è a circa 250 m, una differenza
irrilevante per la statistica. Se il punto di lancio cambia, va cambiato nei
tre posti.

La pagina usa la curva di La Calera a passo di 6 h appena ha almeno tre
classi con 8 campioni (circa una settimana di raccolta), fino ad allora
quella di Mercedes a passo di 24 h, nell'opzione «Errore di previsione»
delle impostazioni avanzate. Ogni giorno il workflow scrive anche
`convergenza_curva.json` sul branch `dati` (età mediana e quartili per
classe di anticipo); `assets/traiettoria.js` lo legge da
raw.githubusercontent.com, interpola il terzo quartile sull'età della corsa
GFS usata e lo scala con la durata del volo (r = Q3 · T / T_rif). Il raggio
si somma all'area del pallone come somma di Minkowski: lo stesso errore di
vento trasla tutti i voli dell'area: gli spigoli dell'area diventano archi
di cerchio (contorno a 180 punti per vertice, disegnato senza
semplificazione e senza arrotondare i vertici al pixel, con lo stesso
`smoothPolygon` usato prima per l'ellisse: altrimenti i punti, più fitti di
un pixel, fanno un bordo a scalini). Vale zero per definizione solo con
l'ultima corsa GFS che arriva prima del lancio: le corse sono ogni 6 h
(00, 06, 12, 18 UTC), la corsa usata è quella che Tawhiri dichiara nella
risposta, e lo zero scatta quando la successiva arriverebbe dopo il lancio
(`ultimaCorsa()` in `assets/traiettoria.js`; il giorno del lancio, la
mattina, può ancora arrivarne una più recente). Il ritardo con cui le corse
arrivano in Tawhiri non è supposto: l'analisi lo misura ogni giorno dai giri
di tutti i siti (ogni giro dice quale corsa c'era e quale non ancora) e lo
scrive nella curva come `ritardo_gfs_h` = [min, max]; a fine ottobre 2026
era fra 4,5 e 4,7 h. Si usa il minimo: lo zero vale solo quando la corsa
successiva arriva di sicuro dopo il lancio. L'avviso compare dopo il
calcolo, fra quelli del pallone sotto le tessere. Le classi con meno di 8 campioni non
si usano. Se il file non si carica, lo dice un avviso nello stesso posto e
l'area resta quella del pallone. Accanto alla casella la pagina scrive solo
«Terzo quartile. Per ora affidabile solo in Uruguay» (`twFcHint` in
`assets/i18n.js`): va aggiornato quando la raccolta su più siti dirà dove
la curva vale (vedi «Da completare»).

L'analisi si fa a mano:

```
git fetch origin dati && mkdir -p dati && git archive origin/dati | tar -x -C dati
python3 calcolo/convergenza_analisi.py dati/convergenza.csv          # Mercedes
python3 calcolo/convergenza_analisi.py dati/convergenza*.csv         # tutti, con il confronto
```

L'anticipo τ è l'età della corsa GFS all'ora del lancio (bersaglio meno
dataset), a passo di 24 h: così non conta quando è partito il workflow né
quale corsa ha trovato. Per ogni bersaglio T il riferimento è la
previsione con τ = 0; e(τ) è la distanza fra il punto previsto con
anticipo τ e quello di riferimento. Con `--calendario` l'anticipo è
invece `lead_giorni`, i giorni fra emissione e bersaglio.

e(τ) misura la *convergenza* della previsione, non l'errore: il
riferimento non è la verità. Con X il punto vero,
P_τ − X = (P_τ − P₀) + (P₀ − X); se l'aggiornamento della previsione è
scorrelato dall'errore del riferimento (esatto per una previsione
ottimale, approssimato per il GFS), in media quadratica l'errore vero è
almeno l'RMS di e(τ), che lo script stampa accanto a mediana e quartili.
Non è un limite per il singolo volo, né per mediane e quartili. e(0) è
zero per costruzione. Se si cambiano i parametri del volo nello script,
le righe vecchie non sono più confrontabili: meglio un CSV nuovo.

### I livelli della mappa

Le due mappe del sito — quella della Traiettoria e quella GPS della Diretta —
hanno gli stessi controlli, scritti una volta sola in `assets/mapkit.js`:

- **Via / satellite**: sfondo OpenStreetMap (scurito dal CSS) oppure
  immagini satellitari Esri, a colori veri.
- **Nuvole / pioggia**: un livello sopra lo sfondo, scelto in base a dove è
  centrata la mappa quando si preme il pulsante. In Europa è il radar
  pioggia di **RainViewer** (lì la rete di radar a terra è fitta; mostra solo
  dove piove, e per questo il pulsante prende l'icona della pioggia).
  Altrove è la copertura nuvolosa di **OpenWeatherMap**. È lo stato attuale
  delle nuvole, non quello previsto per il giorno del lancio — per questo
  nell'immagine salvata entrano solo se si salva il giorno stesso della
  partenza (vedi sopra).
- **Schermo intero**, e solo nella Traiettoria **salva l'immagine**.

#### La vista 3D: terra tonda, e il cielo che ci si appoggia

La mappa 3D della Traiettoria (`assets/map3d.js`, MapLibre) disegna il
pianeta **tondo**, con la curvatura vera: non è un effetto, è la proiezione
`vertical-perspective` al posto di Mercatore.

Il motivo non è solo estetico. Con la proiezione piana il cielo è un velo
dipinto davanti alla scena, e il suo orizzonte è calcolato **senza** il
rilievo: inclinando molto la vista quel velo finisce un po' più in alto di
dove arriva il terreno, e fra i due si vedeva una riga — a volte una fascia
— del colore di sfondo. Sul globo l'orizzonte non è più disegnato ma è
geometria: il bordo del pianeta. La cucitura non può esistere.

Da vicino la curvatura non c'è più (su dieci chilometri il pianeta è
piatto) e MapLibre torna da solo alla proiezione piana. Il passaggio fra le
due è l'unico momento in cui i due cieli si sovrappongono, ed è lì che
ricompariva una riga: la finestra è tenuta stretta e spostata dove non ne
lascia nessuna, **11,4 → 12,2** invece dei due livelli di zoom di serie.

Sul globo il cielo non è più un gradiente ma un'atmosfera calcolata, che
però si stende anche **davanti** alla mappa: a piena forza la sbianca e il
tema scuro sparisce. `atmosphere-blend` sta a **0,2**, che lascia il filo
luminoso sull'orizzonte e la mappa scura; alzarlo schiarisce il cielo e
insieme la mappa. Le tre tinte dello `sky` continuano a servire da vicino,
dove il cielo torna a essere un gradiente.

Una conseguenza da ricordare: fuori dall'atmosfera il canvas WebGL resta
**trasparente** (a schermo si vede il fondo di `.tw-canvas`). Per questo
l'immagine salvata riempie il fondo prima di copiare il canvas, altrimenti
il cielo verrebbe fuori bianco.

La chiave di OpenWeatherMap non sta nel sito: OpenWeatherMap non permette
di limitarla a un dominio, quindi chiunque la vedesse nel codice potrebbe
consumarne la quota. Le mattonelle passano dal Worker di Cloudflare
(`/clouds/{z}/{x}/{y}.png`, vedi `worker/README.md`), che tiene la chiave
come secret, risponde solo alle richieste che arrivano dal sito e conserva
ogni mattonella 10 minuti, così molti visitatori sulla stessa zona
consumano una sola chiamata.

La scala sta in basso a destra, sopra l'attribuzione: da telefono
l'attribuzione va su più righe, e in basso a sinistra la copriva.

Fonti scartate, per non riprovarle: GPM IMERG e MODIS (NASA GIBS) — IMERG
non mostrava nulla sopra l'Uruguay, MODIS è una foto di un giorno prima e
nera di notte; CPTEC/INPE — le sue mattonelle pubbliche non sono in
proiezione di Mercatore ma nella griglia del disco del satellite, e non si
sovrappongono alla mappa.

### La pagina Diretta

Sta in `index.html` (sezione `#diretta`) e in `assets/spot.js`: la diretta
YouTube (il video `9xdbjGzU-Zk`, nel primo riquadro), la mappa
GPS, la quota stimata e il meteo sul punto di lancio (la previsione per il giorno e l'ora di `LAUNCH`, che compare solo quando
mancano al massimo 16 giorni).

Il video non è un iframe fisso: nella pagina c'è solo l'anteprima
(`.yt-facade`, con l'ID del video in `data-yt`), e il player di YouTube
nasce quando si preme play (`assets/app.js`). Caricato insieme alla pagina,
da telefono a volte apriva YouTube al posto del sito, anche con il solo
`sandbox`. L'iframe creato al tocco ha comunque `sandbox` senza
`allow-top-navigation`; «Guarda su YouTube» si apre in una nuova scheda
(`allow-popups`). Per cambiare video basta cambiare l'ID in `data-yt` e
nell'indirizzo dell'anteprima, in `index.html` e `simulazione-diretta.html`.

È pubblica: con `DIRETTA_PUBLIC = true` in `assets/app.js` voce in nav e
banner rosso seguono `DIRETTA_WINDOW` e `DIRETTA_START`, e l'avviso
«Pagina in costruzione» non compare.

Rimettendo `false` la pagina torna nascosta: niente voce in nav né banner,
qualunque sia la data, e in cima l'avviso «Pagina in costruzione». Funziona
comunque per intero, ma ci arriva solo chi conosce il link `…/#diretta` — è
il modo di usarla per le prove (non c'è più una copia a parte).

**Da dove arrivano i punti GPS.** Il browser non chiama mai SPOT: lo fa il
Worker di Cloudflare in `worker/`, che conserva la traccia e la espone in
`/track.json` (la costante `TRACK_URL` in `assets/app.js`). Il **Data
Push** di SPOT manda al Worker la posizione pochi secondi dopo il
messaggio, ma mai la quota: subito dopo il Worker legge il feed di SPOT
per avere la quota dello stesso messaggio, e con il polling avviato lo
legge comunque ogni ~155 s, nel caso un push tardi. La pagina
`admin-diretta.html` serve a controllare le posizioni, avviare il
polling e scegliere quali punti vanno sulla mappa; se il Worker non
riuscisse a leggere il feed, può interrogarlo lei dal browser. Il Data
Push arriva al Worker attraverso il dominio `cometa.gripe`, perché SPOT
non consegnava agli indirizzi `*.workers.dev`. È attivo sull'account SPOT
dal 10 ottobre 2026: provato con il tracker e la pagina admin chiusa, il
punto è arrivato al Worker pochi secondi dopo il messaggio. Tutti i
dettagli sono in `worker/README.md`.

**La telemetria LoRa** (viola) arriva dalla radio della sonda, una riga ogni
5 s per tutto il volo, attraverso le stazioni di terra e il Worker
`cometa-lora` (tutto in `lora/README.md`). `assets/lora.js` legge
`traccia.json` una volta e `ultimo.json` ogni 20 s da `dati.cometa.gripe`,
attraverso la cache di Cloudflare: il browser non chiama mai il Worker. La
Diretta non mostra i dati incoerenti (senza fix, meno di 6 satelliti, quote
sotto −100 m o sopra 45 km, salti impossibili): un punto così si ignora e
resta l'ultimo buono; se da un minuto non ne arriva nessuno buono, la legenda
dice «segnale perso». La regola, e le fasi del volo che compaiono in legenda
(in attesa, in salita, in caduta, col paracadute, atterrata: l'attesa finisce
all'ora di `LAUNCH`), stanno in `lora/formato/fasi.js`, la stessa della
pagina della stazione, che però mostra tutto.

Ogni lettura (LoRa e SPOT) ha un tempo massimo di 12 s: da telefono,
cambiando rete, una richiesta può restare appesa, e prima la Diretta
smetteva di aggiornarsi. Tornando sulla pagina (telefono sbloccato, scheda
di nuovo in primo piano) o quando torna la rete i dati si rileggono
subito, e il pulsante ↻ sulla mappa li rilegge da capo quando si vuole.

La **legenda**, sotto la mappa, dà per LoRa e SPOT da quanto è arrivato l'ultimo
dato: una posizione vecchia non deve sembrare attuale. La mappa segue l'ultimo
dato solo se è il più recente fra le due fonti, e solo quando ne arriva uno
nuovo. Dopo il recupero (29 ottobre) la riga sotto la mappa è in blu,
«Sonda recuperata · 16:20 (UTC −3)» (`data-recuperata="16:20"` su `#spotStatus`
in `index.html`, testo `dirRecuperata`), la legenda dice «volo concluso» per
LoRa e SPOT, i punti SPOT dopo il recupero non si disegnano (`data-spot-fino`
su `#spotMap`), le tessere della quota in tempo reale e la nota sono tolte:
resta il grafico. Da `DIRETTA_END` (`assets/app.js`, 16:20) voce in nav,
banner e stato sono blu, «Diretta conclusa»; la voce si chiama «Il volo»; e
dopo `LAUNCH` il conto alla rovescia diventa «Lancio effettuato il» con
giorno, mese, anno e ora. La quota dello SPOT non si usa (il giorno del lancio dava quote
assurde: `parse()` in `assets/spot.js` la scarta), dello SPOT resta solo la
posizione: «Ultimo punto GPS» è l'ultima quota LoRa, e la stessa riancora la
quota stimata. Nel 3D la traccia è quella LoRa
quando c'è (ha la quota a ogni punto), se no quella dello SPOT: un cubetto per
fix, senza proiezione a terra (sotto i cubetti non si leggeva). Sotto la quota,
il **grafico** della quota nel tempo dai dati LoRa (`assets/profilo.js`).
Quota e grafico compaiono solo dal giorno del lancio (ora di Montevideo).

**La traiettoria prevista** cambia aspetto il giorno del lancio, nel 2D e
nel 3D. Nei giorni prima è una previsione, e si disegna come nel predittore:
azzurra, piena fino allo scoppio e tratteggiata dopo, scoppio bianco,
atterraggio arancione e intorno l'area di atterraggio (sotto). Dal giorno del
lancio è grigia, per non confondersi con le tracce vere: stesse linee e
stessi punti, tutti grigi, e niente area (l'anticipo è zero). Lo stesso vale
per la proiezione a terra e i punti del 3D (`ombra` e `pin` nella scena di
`assets/map3d.js`). Sotto il meteo, la **scheda** della previsione, la
stessa del predittore (`COMETA_TRAIETTORIA.scheda` in
`assets/traiettoria.js`): partenza, atterraggio, deriva, tempi e quote.

La richiesta a
Tawhiri è `COMETA_PREVISIONE` in `assets/volo.js`, con i parametri fissi di
`FLIGHT_*` (partenza da `FLIGHT_SITE`, all'ora di `LAUNCH`) — non quelli che
un visitatore può aver cambiato nella pagina Traiettoria. La stessa richiesta
la fa la pagina della stazione LoRa, che quindi disegna la stessa linea.
`assets/spot.js` la richiede ogni 20 minuti, anche durante il volo, e la
ridisegna solo se nel frattempo è uscita una nuova corsa del GFS. Non usa mai
i punti GPS: non si corregge seguendo il pallone. Si accende e si spegne con il
pulsante sulla mappa (accesa all'inizio; la scelta resta nel browser di chi
guarda), insieme all'area di atterraggio.

**L'area di atterraggio**, arancione intorno all'arrivo previsto, è l'errore di
previsione, con la stessa curva dell'opzione della pagina Traiettoria
(`convergenza_curva.json` sul branch `dati`, terzo quartile interpolato
sull'età della corsa GFS e scalato con la durata del volo). Compare quando la
data del lancio entra nell'orizzonte del previsore, circa una settimana
prima, si restringe a ogni nuova corsa e sparisce con l'ultima corsa GFS
che arriva prima del lancio, quando vale zero per definizione (stessa regola
della pagina Traiettoria). In 2D è un `L.circle`
(il tooltip dice raggio ed età della corsa), in 3D un cerchio steso sul
terreno.

### Three.js

I due modelli 3D — la sonda e la catena di volo — usano **Three.js r128**,
tenuto in copia locale in `assets/vendor/` perché il sito non dipenda da una
CDN. Se il file manca, `assets/sonda.js` e `assets/catena.js` ripiegano da
soli sulla stessa revisione servita da cdnjs (costante `THREE_CDN`, presente
in entrambi). Aggiornando la libreria vanno allineati tre punti:
il file in `assets/vendor/`, la costante `THREE_CDN`, e la riga di three.js
nella sezione 3 del `LICENSE`.

### Fotografie dei componenti (facoltative)

Mettere le immagini in `assets/img/` e indicarle nella tabella `TEX` in
`assets/sonda.js`, con chiave il numero del componente. Scatto dall'alto,
sfondo bianco, luce diffusa, ritaglio esatto sul contorno del pezzo.

## Chi approva le modifiche

Nessuno scrive direttamente in `main`: si apre una richiesta di
modifica e qualcuno la approva. La regola «serve un'approvazione», da
sola, non dice **da chi**: vale quella di chiunque abbia accesso in
scrittura, quindi due studenti possono approvarsi a vicenda.

Per questo c'è `.github/CODEOWNERS`, che nomina @petrolio1975
proprietario di ogni file. Perché sia vincolante deve essere attiva
anche l'opzione **Require review from Code Owners** nella regola su
`main` (Settings → Rules → Rulesets). Con le due cose insieme, niente
entra nel sito senza l'approvazione di chi coordina il progetto.

L'unica cosa che GitHub impedisce sempre, anche senza regole, è
approvare la propria richiesta di modifica.

## Da completare

- **«Per ora affidabile solo in Uruguay»**, accanto all'opzione «Errore di
  previsione» (`twFcHint` in `assets/i18n.js`, nelle tre lingue, e il
  testo di riserva in `index.html` e `simulazione-diretta.html`). Dalla
  fine di ottobre 2026 la raccolta su più siti (`convergenza_*.csv` sul
  branch `dati`) basta a dire se la curva di e/T vale anche altrove:
  `python3 calcolo/convergenza_analisi.py dati/convergenza*.csv`. Se le
  curve dei siti coincidono, la frase si allarga o si toglie; se no,
  resta, e magari la pagina usa la curva solo per partenze in Uruguay.

- **La data definitiva del lancio**, quando la DINACIA autorizza. Oggi la
  costante `LAUNCH` in `assets/volo.js` vale `2026-10-29T09:39:00-03:00`: è
  provvisoria, e il conto alla rovescia la mostra come se fosse certa.
  È anche il via vero: il lancio **è** la scadenza di `LAUNCH`, non un
  segnale a parte — se il giorno stesso il lancio slitta rispetto all'ora
  prevista, si aggiorna `LAUNCH` all'ora vera (commit e push) e il resto
  (conto alla rovescia, quota stimata in `assets/spot.js`, fasi del volo
  nella Diretta e nella pagina della stazione LoRa) segue da solo.

- **Il payload pesato e la portanza al collo misurata**, prima e durante il
  lancio: `FLIGHT_PAYLOAD_KG` (oggi 1,5) e `FLIGHT_NECK_LIFT_G` (oggi
  `null`) in `assets/volo.js`, con uno o più commit. Finché la portanza è
  `null` vale la salita prevista `FLIGHT_ASCENT_MS` (5 m/s). Non c'è un
  calcolo a parte: `voloDiretta()` in `assets/traiettoria.js` usa lo stesso
  codice del modulo della pagina Traiettoria — volume d'elio dalla salita o
  dalla portanza, salita, discesa al suolo con il paracadute del kit, quota
  di scoppio con l'atmosfera prevista per il giorno e l'ora di `LAUNCH` (ISA
  se è più in là della settimana della previsione) — e i risultati
  sostituiscono `FLIGHT_BURST_KM` e `FLIGHT_DESCENT_V0_MS`, che restano solo
  come riserva finché il calcolo non arriva. `assets/spot.js` richiede
  allora di nuovo la traiettoria prevista con i numeri nuovi.

- **La quota di scoppio e le velocità di salita/discesa**, nella pagina
  Diretta. `FLIGHT_BURST_KM`, `FLIGHT_ASCENT_MS` e `FLIGHT_DESCENT_V0_MS`
  in `assets/volo.js` oggi hanno i numeri generici già scritti su Missione
  (37,9 km, 5 m/s di salita, 4,6 m/s di velocità terminale al suolo):
  il giorno del lancio vanno sostituiti con la previsione precisa di quel
  volo, altrimenti la quota stimata in volo (`assets/spot.js`) scoppia e
  scende al punto sbagliato. La discesa non è più una retta: la quota
  stimata sale linearmente fino a `FLIGHT_BURST_KM`, poi scende con la
  stessa formula di velocità terminale del paracadute di
  `assets/traiettoria.js` (`vAtterraggio`), scalata con la quota secondo
  l'atmosfera standard ISA (`densitaISA`) — non la previsione meteo del
  giorno con Open-Meteo e NRLMSIS 2.1 che usa invece la pagina Traiettoria
  quando ha i dati: qui, in diretta, non c'è tempo né bisogno di scaricare
  quella previsione, perché a correggere la curva ci pensano via via i
  punti GPS veri. Partendo da `FLIGHT_DESCENT_V0_MS` al suolo, la discesa
  è molto veloce appena dopo lo scoppio, dove l'aria è rarefatta, e via
  via più lenta scendendo. I punti GPS reali non spostano la curva in
  verticale — la riancorano: ogni punto vero dice a `assets/spot.js` "a
  che punto della curva (quale `tau`, il tempo del modello dal lancio)
  corrisponde questa quota misurata", trovato per bisezione sul ramo di
  salita o discesa; da lì il modello riparte con la pendenza giusta per
  quel punto, non quella nominale — segue cioè anche una deriva nel
  *ritmo* del volo reale (salita più lenta o veloce, scoppio prima o
  dopo), non solo uno scarto di quota. Il salto che un riancoraggio può
  produrre nel valore mostrato si assorbe con un decadimento di pochi
  secondi, non di scatto: può succedere che per qualche minuto attorno
  allo scoppio la quota stimata scenda già mentre l'ultimo fix GPS mostra
  ancora valori prossimi al massimo — è normale, non un errore, ed è
  proprio quello che il riancoraggio risolve appena arriva il punto
  giusto.

  `FLIGHT_SITE` (sempre in `assets/volo.js`, con il nome che compare in
  testa alla scheda) è il punto di partenza della traiettoria prevista,
  disegnata sulla mappa della pagina Diretta accanto alle tracce vere:
  La Calera, vicino a Minas, lo stesso sito proposto di default nella
  pagina Traiettoria. Dal 29 ottobre è la posizione esatta presa sul
  posto, l'ultima posizione LoRa della sonda sulla rampa (-34.292548,
  -55.352924); se cambia, basta un commit: la traiettoria si
  ricalcola da sola, al caricamento e ogni 20 minuti. `assets/spot.js` interroga Tawhiri (lo stesso
  previsore usato lì) in background, in silenzio, con questi parametri —
  non quelli che un visitatore potrebbe aver cambiato giocando col modulo
  della pagina Traiettoria — e ridisegna la linea ogni volta che la
  previsione (la corsa del modello GFS) cambia — vedi «La pagina
  Diretta». Se la data del lancio è troppo lontana per l'orizzonte del
  previsore la richiesta fallisce e non succede nulla: ci riprova da sola
  più avanti, senza bisogno di intervenire. Se si sposta `LAUNCH`, va
  spostata anche `REAL_LAUNCH_MS` in `simulazione-diretta.html`.

- **Diretta pubblica o nascosta** (`DIRETTA_PUBLIC` in `assets/app.js`):
  oggi `true`. Con `false` le date qui sotto non hanno effetto.

- **Quando compare la voce "Diretta"**, e quando passa dal ciano
  "diretta tra poco" al rosso "in diretta". Sono due date separate in
  `assets/app.js`: `DIRETTA_WINDOW` (oggi 25 ottobre, qualche giorno prima
  del lancio — da quel momento la voce appare in nav, in grigio/ciano) e
  `DIRETTA_START` (oggi 29 ottobre alle 8:30, quando parte la diretta YouTube, un'ora e nove minuti prima del lancio — da li' in poi
  diventa rossa e compare il banner sotto la nav). A differenza del via
  alla quota, questo passaggio non ha bisogno di un file da pushare
  nell'istante: la diretta la si accende quando si vuole, quindi basta
  che le due date siano giuste in anticipo.

## Licenza

Codice: MIT (vedi `LICENSE`). Testi e immagini: CC BY 4.0.
I materiali di terze parti — Three.js, Leaflet, OpenStreetMap, Esri,
OpenWeatherMap, RainViewer, Open-Meteo, i caratteri — sono elencati con le
rispettive licenze nella sezione 3 del `LICENSE`.

## I dati dello studio dei venti

`dati/atterraggi.csv` è l'uscita della simulazione: una riga per volo, 600 in
tutto, con sito, data, coordinate di atterraggio, deriva, rotta, durata e quota
di scoppio. Tutti i numeri pubblicati nella pagina dei venti vengono da qui, e
si ricalcolano con qualunque strumento sappia leggere un CSV.

I sei punti dei due grafici sono le **medie** su blocchi di dieci giorni
(10-19 set, 20-29 set, 30 set-9 ott, 10-19 ott, 20-29 ott, 30 ott-8 nov),
calcolate su tutti i 600 voli, senza filtrare per `stato`. Le schede in cima
alla pagina si riferiscono invece ai soli primi tre blocchi, cioè al periodo
10 settembre - 9 ottobre, quello della data prevista di lancio.

Se la simulazione viene rifatta, si sostituisce il file e si ricalcolano i
dodici numeri; le coordinate delle spezzate stanno in `index.html`, dentro le
due `<figure class="graf">`.
