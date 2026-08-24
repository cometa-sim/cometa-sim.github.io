# cometa-sim.github.io

Sito del **Progetto COMETA** — Scuola Italiana di Montevideo.
Un pallone stratosferico fino a 38 km di quota, progettato, costruito e
programmato dagli studenti di III e IV Liceo.

🌐 https://cometa-sim.github.io

## Com'è fatto il sito

Una sola pagina con navigazione interna (`#missione`, `#sonda`, `#venti`,
`#about`): nessun ricaricamento, la lingua scelta resta.

```
index.html                      tutte le sezioni
assets/cometa.css               colori, caratteri, impaginazione
assets/i18n.js                  i testi in italiano, spagnolo e inglese
assets/sonda.js                 i 26 componenti + il modello 3D (Three.js)
assets/app.js                   lingua, navigazione, salita, fisica, conto alla rovescia
assets/img/cometa-logo.png      marchio COMETA, fondo trasparente
assets/img/sim-logo.png         stemma della Scuola, fondo trasparente
mappe/uru2000_footprint.html    mappa generata da cometa_venti.py — NON modificare a mano
sonda.html · venti.html         rimandi ai vecchi indirizzi
```

Sezioni: Inizio · Missione · La fisica del volo · La sonda · Studio dei venti · Chi siamo.

## Dove si modificano le cose

| Cosa | Dove |
|---|---|
| Un testo, in una qualsiasi delle tre lingue | `assets/i18n.js` |
| Misure, peso o nota di un componente | l'elenco `PARTS` in `assets/sonda.js` |
| Colori e caratteri di tutto il sito | il blocco `:root` in `assets/cometa.css` |
| Data del lancio (conto alla rovescia) | la costante `LAUNCH` in `assets/app.js` |
| Numeri delle schede (quota, massa, deriva…) | direttamente in `index.html` |

### Lingua

Alla prima visita il sito sceglie da solo tra italiano, spagnolo e inglese
guardando le preferenze del browser; se il visitatore cambia lingua, la scelta
viene ricordata. Ogni testo tradotto ha una chiave: nell'HTML compare come
`data-i18n="chiave"` (testo semplice) o `data-i18n-html="chiave"` (testo che
contiene `<strong>`, `<a>`…).

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

### Fotografie dei componenti (facoltative)

Mettere le immagini in `assets/img/` e indicarle nella tabella `TEX` in
`assets/sonda.js`, con chiave il numero del componente. Scatto dall'alto,
sfondo bianco, luce diffusa, ritaglio esatto sul contorno del pezzo.

## Da completare

- Gli anni della simulazione dei venti (`wYears` in `assets/i18n.js`)
- La data della sintesi dello studio dei venti (`wDate`)
- La data definitiva del lancio, quando la DINACIA autorizza

Sono segnati in arancione sul sito, così non si dimenticano.

## Licenza

Codice: MIT (vedi `LICENSE`). Testi e immagini: CC BY 4.0.
