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
| Numeri delle quattro schede della pagina iniziale | direttamente in `index.html` |

### Dopo ogni modifica: il numero di versione

In `index.html` i cinque file di `assets/` sono richiamati con un numero in
coda — oggi `?v=48`:

```html
<link rel="stylesheet" href="assets/cometa.css?v=48">
<script src="assets/i18n.js?v=48"></script>
```

Serve a costringere il browser a riscaricarli. **Chi modifica un file in
`assets/` deve alzare quel numero di uno**, altrimenti i visitatori che hanno
già aperto il sito continuano a vedere la versione vecchia, e la modifica
sembra non aver funzionato.

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
siti di partenza, i 240 atterraggi, le ellissi: il file resta com'è.

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

## Da completare

- **La data definitiva del lancio**, quando la DINACIA autorizza. Oggi la
  costante `LAUNCH` in `assets/app.js` vale `2026-10-07T11:00:00-03:00`: è
  provvisoria, e il conto alla rovescia la mostra come se fosse certa.

## Licenza

Codice: MIT (vedi `LICENSE`). Testi e immagini: CC BY 4.0.
I materiali di terze parti — Three.js, Leaflet, OpenStreetMap, Open-Meteo,
i caratteri — sono elencati con le rispettive licenze nella sezione 3 del
`LICENSE`.
