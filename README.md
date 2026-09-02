# cometa-sim.github.io

Sito del **Progetto COMETA** — Scuola Italiana di Montevideo.
Un pallone stratosferico fino a 38 km di quota, progettato, costruito e
programmato dagli studenti di 2EMS, IIIS, 3EMS, IVL e IVS.

🌐 https://cometa.scuolaitaliana.edu.uy

## Com'è fatto il sito

Una sola pagina con navigazione interna (`#missione`, `#fisica`, `#sonda`,
`#venti`, `#legale`, `#qa`, `#about`): nessun ricaricamento, la lingua scelta
resta. Senza indirizzo si apre `#home`.

```
index.html                          tutte le sezioni
sonda.html · venti.html             rimandi ai vecchi indirizzi

assets/cometa.css                   colori, caratteri, impaginazione
assets/i18n.js                      i testi in italiano, spagnolo e inglese
assets/sonda.js                     i 26 componenti + il modello 3D (Three.js)
assets/catena.js                    la catena di volo in 3D, nella pagina Missione
assets/app.js                       lingua, navigazione, salita, fisica, conto alla rovescia
assets/vendor/three.min.js          Three.js r128, copia locale (vedi sotto)

assets/img/cometa-logo.png          marchio COMETA, fondo trasparente
assets/img/sim-logo.png             stemma della Scuola, fondo trasparente
assets/img/catena-volo.png          schema della catena di volo
assets/img/zona-exclusion-dinacia.jpg   area di esclusione aeronautica
assets/img/og.png                   anteprima per social e messaggistica

mappe/uru2000_footprint.html        mappa generata da cometa_venti.py — NON modificare a mano

LICENSE · README.md · .gitignore
```

Sezioni: Inizio · Missione · La fisica del volo · La sonda · Studio dei venti ·
Norme e autorizzazioni · Domande · Chi siamo.

## Dove si modificano le cose

| Cosa | Dove |
|---|---|
| Un testo, in una qualsiasi delle tre lingue | `assets/i18n.js` |
| Misure, peso o nota di un componente | l'elenco `PARTS` in `assets/sonda.js` |
| Nomi delle cinque parti della catena di volo | la chiave `chain` in `assets/i18n.js` |
| Colori e caratteri di tutto il sito | il blocco `:root` in `assets/cometa.css` |
| Data del lancio (conto alla rovescia) | la costante `LAUNCH` in `assets/app.js` |
| Fondo scala delle animazioni | la costante `SCALA_KM` in `assets/app.js` |
| Numeri delle quattro schede della pagina iniziale | direttamente in `index.html` |
| Stato di una tappa del progetto | la classe `done`, `wip` o `todo` della riga in `index.html` |

### Dopo ogni modifica: il numero di versione

In `index.html` i cinque file di `assets/` sono richiamati con un numero in
coda — oggi `?v=83`:

```html
<link rel="stylesheet" href="assets/cometa.css?v=83">
<script src="assets/i18n.js?v=83"></script>
```

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
grep -o '?v=[0-9]*' index.html | sort -u
```

Deve uscire un solo valore, e diverso da quello di prima.

Riguarda solo `index.html`: `sonda.html` e `venti.html` sono rimandi con il
foglio di stile scritto dentro, e non richiamano nessun file di `assets/`.

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
cosa, a che punto siamo — e non una per sezione: le sezioni sono nove,
ma non sono tutte dello stesso livello, e un elenco che mette «la
scheda che programmiamo» accanto a «a che punto siamo» non aiuta a
orientarsi. Ogni voce porta all'inizio del blocco che la riguarda.

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

I **valori esatti stanno solo nello studio dei venti**, dove c'è la
discussione che li giustifica: la chiave `wParP` per i parametri della
simulazione, e le chiavi `wA4P`…`wA4P4` per il bilancio d'incertezza.

Nelle due animazioni con la scala — la pagina iniziale e la fisica — il
punto di scoppio è un numero tondo, **38 km**, nella costante `SCALA_KM`
di `assets/app.js`. È un fondo scala, non una dichiarazione, e non
compare in nessuna etichetta: il contatore che segue la salita mostra i
decimali fino a 37 e poi si ferma su `37+`, con la funzione
`quotaLetta()`. La cifra grande in fondo a Missione fa la stessa cosa —
sale con i decimali e resta `37+` — e la tappa 06 della fisica dice
`37+ km`.

Quando il calcolo verrà rifatto, i posti da toccare sono tre: la
costante in `app.js`, `wParP` e il blocco `wA4P` in `i18n.js`.

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

- **La data definitiva del lancio**, quando la DINACIA autorizza. Oggi la
  costante `LAUNCH` in `assets/app.js` vale `2026-10-07T11:00:00-03:00`: è
  provvisoria, e il conto alla rovescia la mostra come se fosse certa.

## Licenza

Codice: MIT (vedi `LICENSE`). Testi e immagini: CC BY 4.0.
I materiali di terze parti — Three.js, Leaflet, OpenStreetMap, Open-Meteo,
i caratteri — sono elencati con le rispettive licenze nella sezione 3 del
`LICENSE`.

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
