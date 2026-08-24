/* ============================================================
   COMETA — testi del sito in italiano, spagnolo e inglese.

   Per cambiare un testo basta modificarlo qui: la stessa chiave
   compare nell'HTML come data-i18n="chiave" (testo semplice)
   oppure data-i18n-html="chiave" (testo con <strong>, <a>…).

   Le note dei 26 componenti della sonda NON stanno qui:
   stanno accanto alle loro misure, in assets/sonda.js.
   ============================================================ */

window.I18N = {

/* ==========================================================
   ITALIANO
   ========================================================== */
it:{
  code:"it", title:"COMETA · Sonda Klo-01 — Scuola Italiana di Montevideo",
  metaDesc:"COMETA è un programma di palloni stratosferici della Scuola Italiana di Montevideo: misure atmosferiche fino a oltre 37 km di quota, progettate e realizzate dagli studenti.",

  navHome:"Inizio", navMission:"Missione", navPhysics:"La fisica", navProbe:"La sonda", navWinds:"Studio dei venti", navAbout:"Chi siamo",

  /* — Inizio — */
  heroEyebrow:"Scuola Italiana di Montevideo · 2EMS · IIIS · 3EMS · IVL · IVS",
  introSub:"Sonda Klo-01 · un pallone stratosferico fino a oltre 37 chilometri di quota.",
  launchBtn:"Simula il decollo", scrollCue:"Scorri per salire",
  countHead:"Lancio tra", cDays:"Giorni", cHours:"Ore", cMins:"Minuti", cSecs:"Secondi",
  cTentative:"Data provvisoria", cLate:"fine settembre 2026", cUnit:"g",
  arrivedTag:"Quota raggiunta", afterKicker:"Progetto COMETA",
  afterHead:"Dalla pista al bordo dello spazio.",
  sAlt:"Quota prevista", sDur:"Durata del volo", sMass:"Massa della sonda", sStudents:"Studenti coinvolti",

  tzMission:"Obiettivi, profilo di volo e catena di volo.",
  tzProbe:"Modello tridimensionale esplorabile, con tutti i componenti.",
  tzWinds:"240 voli simulati per scegliere da dove partire.",
  tzAbout:"Le studentesse e gli studenti dietro COMETA.",
  teaserMore:"Scopri →",

  idxKicker:"Il sito",
  idxHead:"Stato del sito",
  idxIntro:"Stiamo pubblicando il progetto man mano che il materiale è pronto. Quello che segue è l'indice: le voci senza collegamento arriveranno nelle prossime settimane.",
  stOnline:"Online", stSoon:"In preparazione",
  ix1t:"Studio dei venti", ix1n:"240 voli simulati per scegliere da dove partire",
  ix2t:"La sonda", ix2n:"Modello tridimensionale esplorabile, con tutti i componenti",
  ix3t:"La fisica del volo", ix3n:"Perché sale, perché scoppia, perché fa così freddo",
  ix4t:"Come lavoriamo", ix4n:"I gruppi di lavoro e l'organizzazione del progetto",
  ix5t:"Aspetti legali", ix5n:"La normativa aeronautica e cosa comporta per noi",
  ix7t:"Domande frequenti", ix7n:"No, non è un satellite. E sì, lo andiamo a recuperare.",
  ix8t:"Contatti", ix8n:"Scuole, aziende, curiosi",

  /* — Missione — */
  pKicker:"Profilo di volo", missionTitle:"Missione",
  missionSub:"Cosa studiamo e come sale la sonda.",
  mBody:"Il progetto COMETA invia la sonda Klo-01 fino a circa 37,8 km di quota per studiare la stratosfera attraverso misure dirette, in una regione dell'atmosfera che gli aerei non raggiungono e i satelliti sorvolano. Tre ore di volo, un pallone che si gonfia fino a scoppiare, e una scatola di polistirolo che torna a terra col paracadute.",

  pHead2:"Condizioni della salita",
  pAlt:"Quota prevista", pTemp:"Temperatura esterna", pPress:"Pressione atmosferica", pPressU:"del livello del mare",
  pGas:"Gas di riempimento", pGasMain:"Elio", pVel:"Velocità di salita", pDur:"Durata del volo",
  pHe:"Elio disponibile", pMass:"Massa del payload", pMassU:"limite 2000 g",

  bKicker:"Il pallone", bHead:"Pallone 2000",
  bBody:"La missione utilizza il pallone da 2000 g. Riempito con circa 4,5 m³ di elio, raggiunge una quota di scoppio intorno ai 37,8 km.",
  specDiam:"Diametro iniziale", specBurst:"Quota di scoppio", specHe:"Elio necessario",
  specMass:"Massa del payload",

  cKicker:"Catena di volo", cHead:"Come è assemblata",
  chain:["Pallone","Corda","Paracadute","Corda antitorsione","Payload"],

  burstLbl:"Quota di scoppio prevista · Pallone 2000",

  /* — La sonda — */
  probeKicker:"Fase 1 · 2026", probeTitle:"Dentro la sonda Klo-01",
  modeBench:"Banco", modeFlight:"Volo",
  benchNote:"Trascina per ruotare · rotella o due dita per ingrandire",
  flightNote:"Sonda chiusa, con ali di stabilizzazione, braccetto esterno e tubo di confronto.",
  ctlExplode:"Esplodi", ctlDecks:"Ripiani", ctlPins:"Numeri",
  cardDetail:"Componente", cardLegend:"Legenda", cardParts:"Componenti",
  detailEmpty:"Tocca un componente nella scena o un numero nell'elenco per vederne misure, peso e funzione.",
  catAtmo:"Atmosfera", catPos:"Posizione e controllo", catRad:"Radiazione e luce", catAlim:"Alimentazione", catKit:"Kit 2000 (già a bordo)",
  legNote:"Il disco chiaro sul coperchio è la finestra in PTFE che lascia passare l'ultravioletto fino al sensore. Le fasce color sabbia sono la coibentazione: fuori fa fino a −60 °C. I componenti 24, 25 e 26 stanno all'esterno della sonda, perché devono misurare l'aria vera.",
  uOn:"su", uParts:"pezzi",
  massNote:"I {mass} g indicati sono la somma dei soli componenti disegnati dentro la scatola, di cui 379 g sono apparati del Kit 2000 già a bordo. Il payload completo è circa 1280 g: vanno aggiunti la scatola in polistirolo (200 g), il paracadute (80 g), il cordame (80 g), i ripiani con i tiranti (~70 g), cablaggio e isolamento (~90 g), riflettore radar ed etichette (~30 g). Il modello non sostituisce la prova di montaggio a secco né la pesata reale.",
  webglFail:"Il modello tridimensionale non è disponibile su questo dispositivo. L'elenco dei componenti qui sotto resta consultabile.",

  /* — Studio dei venti — */
  wKicker:"Fase 1 · Studio preliminare", windsTitle:"Dove va a finire la sonda",
  windsSub:"240 traiettorie simulate per scegliere da dove partire.",
  wLede:"Prima di scegliere il luogo di lancio abbiamo simulato 240 voli da due località diverse, usando i venti realmente previsti nello stesso periodo di quattro anni passati.<br><br>Il risultato è che la sonda deriva verso est di circa 190 km.",
  wTraj:"Traiettorie simulate", wDrift:"Deriva media", wBearing:"Rotta media", wDur:"Durata media", wBearingU:"(est)",

  wSimHead:"La simulazione",
  wSimP1:"Abbiamo simulato il volo della sonda nel periodo <strong>15 settembre – 15 ottobre</strong>, un lancio al giorno, per quattro anni diversi: {years}. Centoventi date, ripetute per due punti di partenza — <strong>Durazno</strong> e <strong>Mercedes</strong> — per un totale di 240 voli simulati.",
  wSimP2:"Ogni punto sulla mappa è l'atterraggio di uno di questi voli. Le ellissi riassumono la dispersione: partendo dallo stesso luogo in quello stesso periodo dell'anno, un nuovo lancio avrebbe circa il <strong>50 % di probabilità di cadere nell'ellisse piccola</strong> e il <strong>90 % nell'ellisse grande</strong>.",
  wYears:"2021-2024",
  mDurazno:"Partenza da Durazno", mMercedes:"Partenza da Mercedes",
  mapHint:"Cliccando un punto compaiono deriva, rotta e durata di quel volo.",

  wApproxHead:"Le approssimazioni",
  wApproxIntro:"Ogni simulazione è un modello, e ogni modello semplifica. Queste sono le tre semplificazioni che abbiamo fatto, e quanto pesano.",
  wA1H:"Il vento cambia anche in orizzontale",
  wA1P:"La sonda non sale e scende nella stessa colonna d'aria: mentre vola si sposta di quasi duecento chilometri, dove il vento è diverso. Abbiamo tenuto conto della salita e della discesa in due colonne distinte, e poi abbiamo misurato quanto pesa questa semplificazione rifacendo lo stesso calcolo con una colonna sola. La differenza è in media di <strong>4 km su 190</strong>, con un massimo di 17: circa il 2 %. Trascurabile per quello che ci serve.",
  wA2H:"Il vento non è misurato, è ricostruito",
  wA2P:"Sopra l'Uruguay, a venti chilometri di quota, non c'è nessuno strumento che misuri il vento ora per ora. Quello che usiamo sono le previsioni archiviate di un modello meteorologico: com'era il vento secondo il modello, non com'era davvero. È una ricostruzione affidabile, ma resta una ricostruzione.",
  wA3H:"Le ellissi assumono una distribuzione gaussiana",
  wA3P:"I dati mostrano che le ipotesi su cui si basa il modello gaussiano sono ragionevolmente soddisfatte. Tuttavia, va detto che i dati non sono tutti veramente indipendenti perché lo stesso sistema meteorologico governa più giorni consecutivi.",

  wUseHead:"A cosa serve, e a cosa no",
  wUseTag:"Attenzione",
  wUseP1:"Questa analisi serve a <strong>scegliere il luogo di partenza</strong>. Non dice dove cadrà la nostra sonda.",
  wUseP2:"Per quello useremo uno strumento previsionale molto più preciso, che però funziona solo pochi giorni prima del lancio. E il luogo e la data effettivi del volo dipendono in ogni caso dall'autorizzazione della <strong>DINACIA</strong>.",

  srcMeteo:"<strong>Dati meteorologici:</strong> previsioni archiviate dell'Historical Forecast API di <a href=\"https://open-meteo.com/\" target=\"_blank\" rel=\"noopener\">Open-Meteo</a>, distribuite con licenza CC BY 4.0.",
  srcMap:"<strong>Mappa:</strong> Leaflet su sfondo cartografico OpenStreetMap, © contributori OpenStreetMap.",
  srcCalc:"<strong>Calcolo:</strong> <code>cometa_venti.py</code>, sviluppato all'interno del progetto — modello di atmosfera standard, integrazione della traiettoria strato per strato, ellissi da matrice di covarianza. Il codice è pubblico.",
  srcExcl:"<strong>Area di esclusione:</strong> poligono approssimato.",
  srcUpdated:"<strong>Sintesi aggiornata al:</strong> {date}",
  wDate:"[DATA]",

  /* — Chi siamo — */
  aboutKicker:"Chi siamo", aboutTitle:"Chi siamo", aboutSub:"Le persone dietro COMETA.",
  aboutBody:"Siamo studentesse e studenti di 2EMS, IIIS, 3EMS, IVL e IVS della Scuola Italiana di Montevideo.",
  contactHead:"Seguici", contactSub:"Aggiornamenti sulla missione su Instagram.", igCta:"Seguici su Instagram",

  /* — Pie di pagina e altimetro — */
  footNav:"Pagine", footFollow:"Seguici", footStatus:"Stato: in corso", footRights:"Testi e immagini CC BY 4.0",

  /* — La fisica del volo — */
  physKicker:"Fase 1 · Come funziona", physTitle:"La fisica del volo",
  physSub:"Perché sale, perché si gonfia, perché scoppia, perché fa così freddo.",
  physScroll:"Scorri per salire",
  ph1t:"A terra — la spinta di Archimede",
  ph1p:"Il pallone non viene sparato in alto: viene <strong>spinto</strong> dall'aria che ha intorno. Quattro metri cubi e mezzo di elio pesano molto meno dell'aria che occupano, e quella differenza deve sollevare tutto il resto — il payload da 1280 g, il lattice, il paracadute, il cordame. Quello che avanza decide la velocità: circa <strong>5 metri al secondo</strong>, sempre gli stessi, per tutta la salita.",
  ph2t:"Troposfera, 0–11 km — fa sempre più freddo",
  ph2p:"Salendo, l'aria si dirada e la temperatura scende di circa <strong>6,5 °C ogni chilometro</strong>: a undici chilometri siamo a −56 °C. È qui che il pad riscaldante fa il suo lavoro, avvolto attorno alle pile: scalda 90 g di batterie, non i tre litri d'aria della scatola.",
  ph3t:"Tropopausa, 11–17 km — il punto più freddo",
  ph3p:"La discesa della temperatura si ferma: la tropopausa è il minimo, <strong>fino a −60 °C</strong> all'esterno. Il bilancio termico rifatto mette l'interno della sonda a circa −45 °C proprio qui. Sopra, contro ogni intuizione, ricomincia a fare meno freddo.",
  ph4t:"Stratosfera, sopra i 18 km — l'aria finisce",
  ph4p:"A trentun chilometri il sensore di pressione arriva a fondo scala: <strong>10 hPa</strong>, un centesimo della pressione al suolo. Da lì in su la quota la sappiamo solo dal GPS. E con così poca aria intorno il calore fatica a uscire: per questo il Teensy gira a clock ridotto, fra 150 e 300 MHz.",
  ph5t:"Il pallone si gonfia",
  ph5p:"Meno pressione fuori significa più volume dentro: l'elio si espande finché le due pressioni non tornano a pareggiare. Fra il suolo e i 37,8 km la pressione esterna cala di <strong>oltre duecento volte</strong>; il volume cresce nella stessa proporzione e il diametro passa da 2,05 m a più di dieci. Il pallone che parte grande come un'automobile arriva grande come una casa.",
  ph6t:"Lo scoppio, 37,8 km",
  ph6p:"Il lattice ha un limite di allungamento, e a un certo punto lo raggiunge. Per il Pallone 2000 riempito con 4,5 m³ il calcolo del progetto mette lo scoppio a <strong>37,8 chilometri</strong>. Da quell'istante la sonda non sale più: cade.",
  ph7t:"La discesa e il recupero",
  ph7p:"Il paracadute si apre da solo, tirato dall'aria. In alto frena poco, perché non c'è quasi niente su cui fare presa; più si scende, più rallenta. <strong>Tre ore in tutto</strong> fra salita e discesa. Poi la sonda è per terra, da qualche parte a est — circa 190 chilometri più in là — ed è lì che comincia l'altra metà del lavoro.",

  /* — Contatti — */
  contactMailHead:"Scrivici", contactMailSub:"Per informazioni, collaborazioni, proposte.",
  mailCta:"Manda una mail", tiktokCta:"Seguici su TikTok", footContact:"Contatti",
  classesNote:"Cinque classi dei due sistemi che convivono nella scuola, quello italiano e quello uruguaiano: 2EMS, IIIS, 3EMS, IVL e IVS.",

  bands:["Suolo","Troposfera","Tropopausa","Stratosfera"],
  skip:"Vai al contenuto",

  /* — Regole e autorizzazioni — */
  navLegal:"Aspetti legali",
  lKicker:"Fase 1 · Regole del volo", legalTitle:"Aspetti legali",
  legalSub:"Che cosa dice la norma aeronautica, e come si applica a noi.",
  lWarnTag:"Prima di leggere",
  lWarn1:"Questa pagina è un riassunto divulgativo, scritto da noi per spiegare il quadro in cui ci muoviamo. <strong>Fa fede il testo originale del regolamento</strong>, non questa sintesi.",
  lWarn2:"Ogni volo di pallone libero non pilotato deve essere <strong>autorizzato dalla DINACIA</strong>, l'autorità aeronautica uruguaiana. Nessuna informazione di questa pagina sostituisce quell'autorizzazione.",
  lLede:"Il riferimento che ci è stato indicato dalla DINACIA è il <strong>LAR 91, Parte I, Appendice P — Globos libres no tripulados</strong>, il regolamento aeronautico latinoamericano sui palloni liberi non pilotati. Stabilisce come si classificano, quali obblighi porta ogni categoria, e che cosa si può e non si può fare.",

  lClassHead:"Come viene classificata la nostra sonda",
  lClassIntro:"Il regolamento distingue tre categorie — <em>ligero</em>, <em>mediano</em> e <em>pesado</em> — in base a quattro criteri. Basta superarne uno per finire nella categoria più pesante, con tutti gli obblighi che comporta. Questi sono i quattro criteri e i nostri valori.",
  thCriterion:"Criterio", thThreshold:"Soglia per «pesado»", thOurs:"Klo-01",
  lc1:"Massa complessiva del carico utile", lc1t:"≥ 6 kg",
  lc2:"Massa del singolo collo", lc2t:"≥ 3 kg",
  lc3:"Densità del collo", lc3t:"≥ 2 kg e > 13 g/cm²",
  lc4:"Forza per separare il carico dal pallone", lc4t:"≥ 230 N", lc4v:"sotto soglia",
  lClassOut:"Sotto ogni soglia, e ampiamente. La sonda Klo-01 è quindi un pallone <strong>«ligero»</strong>. Il quarto criterio è quello meno intuitivo e vale la pena spiegarlo: se il cordame che unisce la sonda al pallone fosse troppo robusto — 230 N sono circa 23 chili di forza — la sonda diventerebbe «pesada» anche pesando un chilo e mezzo. Il nostro cordame si rompe sotto quella soglia, ed è una scelta di progetto, non un caso.",

  lDutyHead:"Che cosa comporta",
  lDuty1:"Quasi tutti gli obblighi operativi del regolamento — due sistemi indipendenti per interrompere il volo, il transponder radar, il riflettore radar, le notifiche al controllo del traffico aereo sette giorni prima, i rapporti di posizione ogni due ore — riguardano i palloni <em>mediani</em> e <em>pesados</em>. A un pallone leggero non si applicano.",
  lDuty2:"Restano due obblighi, e sono i più importanti. Il primo: <strong>nessun pallone libero non pilotato può essere utilizzato senza l'autorizzazione dello Stato dal quale viene lanciato</strong>. Vale per tutte le categorie, senza eccezioni. Il secondo: il pallone non può essere utilizzato in modo che l'impatto suo o di una sua parte, carico utile compreso, metta in pericolo persone o beni estranei all'operazione.",
  lDuty3:"È per questo che la DINACIA ci ha chiesto il tracciamento durante la salita e la discesa, e non l'apparato completo previsto per i palloni pesanti: non è una concessione, è la categoria in cui rientriamo.",

  lZoneHead:"La zona di esclusione",
  lZone1:"C'è una cosa che il regolamento non dice, e che va cercata altrove: attorno agli aeroporti esistono zone in cui non si può lanciare. L'Appendice P disciplina la classificazione dei palloni e gli obblighi che ne derivano; la protezione dello spazio aereo attorno agli aeroporti viene da una fonte diversa. Questa è l'area che la DINACIA ci ha indicato.",
  lZoneAlt:"Mappa dell'area di esclusione attorno a Montevideo indicata dalla DINACIA, con gli aeroporti di Carrasco, Ángel Adami, Laguna del Sauce e Punta del Este.",
  lZoneCap:"Area di esclusione indicata dalla DINACIA. Immagine fornita dall'autorità aeronautica.",
  lZone2:"È la ragione per cui non lanciamo da Montevideo. I luoghi che stiamo valutando — Durazno e Mercedes — stanno abbondantemente fuori da quest'area, e questo è il primo dei vincoli che hanno guidato lo <a href=\"#\" data-page=\"venti\">studio dei venti</a>.",

  lDiscTag:"Avvertenza",
  lDisc1:"Le informazioni di questa pagina sono pubblicate a scopo divulgativo e didattico. Non costituiscono consulenza tecnica o legale, e possono contenere errori o essere superate da modifiche normative successive.",
  lDisc2:"<strong>Chi volesse organizzare un proprio lancio deve rivolgersi direttamente alla DINACIA</strong> e attenersi al testo vigente del regolamento. Non ci assumiamo alcuna responsabilità per l'uso che altri facciano delle informazioni pubblicate qui.",
  lSrc1:"<strong>Norma:</strong> LAR 91 — Reglas de vuelo y operación general, Parte I, Apéndice P «Globos libres no tripulados». Seconda edizione, Emendamento 16, febbraio 2025 (il testo dell'Appendice P risale all'Emendamento 11).",
  lSrc2:"<strong>Autorità:</strong> <a href=\"https://www.dinacia.gub.uy/\" target=\"_blank\" rel=\"noopener\">DINACIA</a> — Dirección Nacional de Aviación Civil e Infraestructura Aeronáutica, Uruguay.",
},

/* ==========================================================
   ESPAÑOL
   ========================================================== */
es:{
  code:"es", title:"COMETA · Sonda Klo-01 — Scuola Italiana di Montevideo",
  metaDesc:"COMETA es un programa de globos estratosféricos de la Scuola Italiana di Montevideo: mediciones atmosféricas hasta más de 37 km de altura, diseñadas y construidas por los estudiantes.",

  navHome:"Inicio", navMission:"Misión", navPhysics:"La física", navProbe:"La sonda", navWinds:"Estudio de vientos", navAbout:"Nosotros",

  heroEyebrow:"Scuola Italiana di Montevideo · 2EMS · IIIS · 3EMS · IVL · IVS",
  introSub:"Sonda Klo-01 · un globo estratosférico hasta más de 37 kilómetros de altura.",
  launchBtn:"Simular el despegue", scrollCue:"Desplazate para subir",
  countHead:"Lanzamiento en", cDays:"Días", cHours:"Horas", cMins:"Minutos", cSecs:"Segundos",
  cTentative:"Fecha tentativa", cLate:"fines de setiembre de 2026", cUnit:"d",
  arrivedTag:"Altura alcanzada", afterKicker:"Proyecto COMETA",
  afterHead:"De la pista al borde del espacio.",
  sAlt:"Altura prevista", sDur:"Duración del vuelo", sMass:"Masa de la sonda", sStudents:"Estudiantes involucrados",

  tzMission:"Objetivos, perfil de vuelo y cadena de vuelo.",
  tzProbe:"Modelo tridimensional explorable, con todos los componentes.",
  tzWinds:"240 vuelos simulados para elegir desde dónde partir.",
  tzAbout:"Las y los estudiantes detrás de COMETA.",
  teaserMore:"Ver más →",

  idxKicker:"El sitio",
  idxHead:"Estado de la página",
  idxIntro:"Estamos publicando el proyecto a medida que el material está listo. Lo que sigue es el índice: las entradas sin enlace llegan en las próximas semanas.",
  stOnline:"En línea", stSoon:"En preparación",
  ix1t:"Estudio de vientos", ix1n:"240 vuelos simulados para elegir desde dónde partir",
  ix2t:"La sonda", ix2n:"Modelo tridimensional explorable, con todos los componentes",
  ix3t:"La física del vuelo", ix3n:"Por qué sube, por qué revienta, por qué hace tanto frío",
  ix4t:"Cómo trabajamos", ix4n:"Los grupos de trabajo y la organización del proyecto",
  ix5t:"Aspectos legales", ix5n:"La normativa aeronáutica y qué implica para nosotros",
  ix7t:"Preguntas frecuentes", ix7n:"No, no es un satélite. Y sí, la vamos a buscar.",
  ix8t:"Contacto", ix8n:"Escuelas, empresas, curiosos",

  pKicker:"Perfil de vuelo", missionTitle:"Misión",
  missionSub:"Qué estudiamos y cómo asciende la sonda.",
  mBody:"El proyecto COMETA envía la sonda Klo-01 hasta unos 37,8 km de altura para estudiar la estratósfera mediante mediciones directas, en una región de la atmósfera que los aviones no alcanzan y los satélites sobrevuelan. Tres horas de vuelo, un globo que se infla hasta reventar, y una caja de poliestireno que vuelve al suelo en paracaídas.",

  pHead2:"Condiciones del ascenso",
  pAlt:"Altura prevista", pTemp:"Temperatura exterior", pPress:"Presión atmosférica", pPressU:"del nivel del mar",
  pGas:"Gas de llenado", pGasMain:"Helio", pVel:"Velocidad de ascenso", pDur:"Duración del vuelo",
  pHe:"Helio disponible", pMass:"Masa del payload", pMassU:"límite 2000 g",

  bKicker:"El globo", bHead:"Globo 2000",
  bBody:"La misión usa el globo de 2000 g. Lleno con unos 4,5 m³ de helio, alcanza una altura de reventado en torno a los 37,8 km.",
  specDiam:"Diámetro inicial", specBurst:"Altura de reventado", specHe:"Helio necesario",
  specMass:"Masa del payload",

  cKicker:"Cadena de vuelo", cHead:"Cómo está armada",
  chain:["Globo","Cuerda","Paracaídas","Cuerda antitorsión","Payload"],

  burstLbl:"Altura de reventado prevista · Globo 2000",

  probeKicker:"Fase 1 · 2026", probeTitle:"Dentro de la sonda Klo-01",
  modeBench:"Banco", modeFlight:"Vuelo",
  benchNote:"Arrastrá para rotar · rueda o dos dedos para ampliar",
  flightNote:"Sonda cerrada, con aletas de estabilización, brazo exterior y tubo de comparación.",
  ctlExplode:"Explotar", ctlDecks:"Estantes", ctlPins:"Números",
  cardDetail:"Componente", cardLegend:"Referencias", cardParts:"Componentes",
  detailEmpty:"Tocá un componente en la escena o un número en la lista para ver sus medidas, peso y función.",
  catAtmo:"Atmósfera", catPos:"Posición y control", catRad:"Radiación y luz", catAlim:"Alimentación", catKit:"Kit 2000 (ya a bordo)",
  legNote:"El disco claro sobre la tapa es la ventana de PTFE que deja pasar el ultravioleta hasta el sensor. Las franjas color arena son el aislamiento: afuera hace hasta −60 °C. Los componentes 24, 25 y 26 van fuera de la sonda, porque tienen que medir el aire de verdad.",
  uOn:"de", uParts:"piezas",
  massNote:"Los {mass} g indicados son la suma de los componentes dibujados dentro de la caja, de los cuales 379 g son equipos del Kit 2000 que ya están a bordo. El payload completo es de unos 1280 g: hay que sumar la caja de poliestireno (200 g), el paracaídas (80 g), la cuerda (80 g), los estantes con sus tensores (~70 g), el cableado y el aislamiento (~90 g), el reflector de radar y las etiquetas (~30 g). El modelo no reemplaza la prueba de armado en seco ni el pesaje real.",
  webglFail:"El modelo tridimensional no está disponible en este dispositivo. La lista de componentes de abajo sigue disponible.",

  wKicker:"Fase 1 · Estudio preliminar", windsTitle:"Dónde va a caer la sonda",
  windsSub:"240 trayectorias simuladas para elegir desde dónde partir.",
  wLede:"Antes de elegir el lugar de lanzamiento simulamos 240 vuelos desde dos localidades distintas, usando los vientos realmente previstos en el mismo período de cuatro años pasados.<br><br>El resultado es que la sonda deriva hacia el este unos 190 km.",
  wTraj:"Trayectorias simuladas", wDrift:"Deriva media", wBearing:"Rumbo medio", wDur:"Duración media", wBearingU:"(este)",

  wSimHead:"La simulación",
  wSimP1:"Simulamos el vuelo de la sonda en el período <strong>15 de setiembre – 15 de octubre</strong>, un lanzamiento por día, para cuatro años distintos: {years}. Ciento veinte fechas, repetidas para dos puntos de partida — <strong>Durazno</strong> y <strong>Mercedes</strong> — para un total de 240 vuelos simulados.",
  wSimP2:"Cada punto del mapa es el aterrizaje de uno de esos vuelos. Las elipses resumen la dispersión: partiendo del mismo lugar en esa misma época del año, un lanzamiento nuevo tendría alrededor del <strong>50 % de probabilidad de caer en la elipse chica</strong> y el <strong>90 % en la elipse grande</strong>.",
  wYears:"2021-2024",
  mDurazno:"Partida desde Durazno", mMercedes:"Partida desde Mercedes",
  mapHint:"Al hacer clic en un punto aparecen la deriva, el rumbo y la duración de ese vuelo.",

  wApproxHead:"Las aproximaciones",
  wApproxIntro:"Toda simulación es un modelo, y todo modelo simplifica. Estas son las tres simplificaciones que hicimos, y cuánto pesan.",
  wA1H:"El viento también cambia en horizontal",
  wA1P:"La sonda no sube y baja por la misma columna de aire: mientras vuela se desplaza casi doscientos kilómetros, donde el viento es distinto. Tuvimos en cuenta el ascenso y el descenso en dos columnas separadas, y después medimos cuánto pesa esta simplificación rehaciendo el mismo cálculo con una sola columna. La diferencia es en promedio de <strong>4 km sobre 190</strong>, con un máximo de 17: alrededor del 2 %. Despreciable para lo que necesitamos.",
  wA2H:"El viento no está medido, está reconstruido",
  wA2P:"Sobre Uruguay, a veinte kilómetros de altura, no hay ningún instrumento que mida el viento hora por hora. Lo que usamos son las previsiones archivadas de un modelo meteorológico: cómo estaba el viento según el modelo, no cómo estaba realmente. Es una reconstrucción confiable, pero sigue siendo una reconstrucción.",
  wA3H:"Las elipses suponen una distribución gaussiana",
  wA3P:"Los datos muestran que las hipótesis en las que se basa el modelo gaussiano se cumplen razonablemente. Hay que decir, sin embargo, que los datos no son todos verdaderamente independientes, porque el mismo sistema meteorológico gobierna varios días seguidos.",

  wUseHead:"Para qué sirve, y para qué no",
  wUseTag:"Atención",
  wUseP1:"Este análisis sirve para <strong>elegir el lugar de partida</strong>. No dice dónde va a caer nuestra sonda.",
  wUseP2:"Para eso vamos a usar una herramienta de pronóstico mucho más precisa, que sin embargo funciona solo pocos días antes del lanzamiento. Y el lugar y la fecha efectivos del vuelo dependen en todos los casos de la autorización de la <strong>DINACIA</strong>.",

  srcMeteo:"<strong>Datos meteorológicos:</strong> previsiones archivadas de la Historical Forecast API de <a href=\"https://open-meteo.com/\" target=\"_blank\" rel=\"noopener\">Open-Meteo</a>, distribuidas con licencia CC BY 4.0.",
  srcMap:"<strong>Mapa:</strong> Leaflet sobre cartografía de OpenStreetMap, © colaboradores de OpenStreetMap.",
  srcCalc:"<strong>Cálculo:</strong> <code>cometa_venti.py</code>, desarrollado dentro del proyecto — modelo de atmósfera estándar, integración de la trayectoria capa por capa, elipses a partir de la matriz de covarianza. El código es público.",
  srcExcl:"<strong>Área de exclusión:</strong> polígono aproximado.",
  srcUpdated:"<strong>Síntesis actualizada al:</strong> {date}",
  wDate:"[FECHA]",

  aboutKicker:"Nosotros", aboutTitle:"Nosotros", aboutSub:"Las personas detrás de COMETA.",
  aboutBody:"Somos estudiantes de 2EMS, IIIS, 3EMS, IVL y IVS de la Scuola Italiana di Montevideo.",
  contactHead:"Seguinos", contactSub:"Novedades de la misión en Instagram.", igCta:"Seguinos en Instagram",

  footNav:"Páginas", footFollow:"Seguinos", footStatus:"Estado: en curso", footRights:"Textos e imágenes CC BY 4.0",

  /* — La física del vuelo — */
  physKicker:"Fase 1 · Cómo funciona", physTitle:"La física del vuelo",
  physSub:"Por qué sube, por qué se infla, por qué revienta, por qué hace tanto frío.",
  physScroll:"Desplazate para subir",
  ph1t:"En tierra — el empuje de Arquímedes",
  ph1p:"Al globo no lo disparan hacia arriba: lo <strong>empuja</strong> el aire que tiene alrededor. Cuatro metros cúbicos y medio de helio pesan mucho menos que el aire que ocupan, y esa diferencia tiene que levantar todo lo demás — el payload de 1280 g, el látex, el paracaídas, la cuerda. Lo que sobra decide la velocidad: unos <strong>5 metros por segundo</strong>, siempre los mismos, durante todo el ascenso.",
  ph2t:"Troposfera, 0–11 km — cada vez más frío",
  ph2p:"Al subir, el aire se enrarece y la temperatura baja unos <strong>6,5 °C por kilómetro</strong>: a once kilómetros estamos a −56 °C. Acá es donde la manta calefactora hace su trabajo, envuelta alrededor de las pilas: calienta 90 g de baterías, no los tres litros de aire de la caja.",
  ph3t:"Tropopausa, 11–17 km — el punto más frío",
  ph3p:"La caída de temperatura se detiene: la tropopausa es el mínimo, <strong>hasta −60 °C</strong> afuera. El balance térmico rehecho pone el interior de la sonda en unos −45 °C justamente acá. Más arriba, contra toda intuición, vuelve a hacer menos frío.",
  ph4t:"Estratósfera, por encima de 18 km — se acaba el aire",
  ph4p:"A treinta y un kilómetros el sensor de presión llega a fondo de escala: <strong>10 hPa</strong>, la centésima parte de la presión al nivel del suelo. De ahí para arriba la altura la sabemos solo por GPS. Y con tan poco aire alrededor al calor le cuesta salir: por eso el Teensy gira a reloj reducido, entre 150 y 300 MHz.",
  ph5t:"El globo se infla",
  ph5p:"Menos presión afuera significa más volumen adentro: el helio se expande hasta que las dos presiones vuelven a igualarse. Entre el suelo y los 37,8 km la presión exterior cae <strong>más de doscientas veces</strong>; el volumen crece en la misma proporción y el diámetro pasa de 2,05 m a más de diez. El globo que sale del tamaño de un auto llega del tamaño de una casa.",
  ph6t:"El reventado, 37,8 km",
  ph6p:"El látex tiene un límite de estiramiento, y en algún momento lo alcanza. Para el Globo 2000 lleno con 4,5 m³ el cálculo del proyecto pone el reventado a <strong>37,8 kilómetros</strong>. Desde ese instante la sonda deja de subir: cae.",
  ph7t:"El descenso y el rescate",
  ph7p:"El paracaídas se abre solo, tirado por el aire. Arriba frena poco, porque casi no hay de qué agarrarse; cuanto más baja, más frena. <strong>Tres horas en total</strong> entre subida y bajada. Después la sonda está en el suelo, en algún lugar hacia el este — unos 190 kilómetros más allá — y ahí empieza la otra mitad del trabajo.",

  /* — Contacto — */
  contactMailHead:"Escribinos", contactMailSub:"Para información, colaboraciones, propuestas.",
  mailCta:"Mandanos un correo", tiktokCta:"Seguinos en TikTok", footContact:"Contacto",
  classesNote:"Cinco clases de los dos sistemas que conviven en la escuela, el italiano y el uruguayo: 2EMS, IIIS, 3EMS, IVL y IVS.",

  bands:["Suelo","Troposfera","Tropopausa","Estratósfera"],
  skip:"Ir al contenido",

  /* — Reglas y autorizaciones — */
  navLegal:"Aspectos legales",
  lKicker:"Fase 1 · Reglas del vuelo", legalTitle:"Aspectos legales",
  legalSub:"Qué dice la norma aeronáutica y cómo se aplica a nosotros.",
  lWarnTag:"Antes de leer",
  lWarn1:"Esta página es un resumen divulgativo, escrito por nosotros para explicar el marco en el que trabajamos. <strong>Vale el texto original del reglamento</strong>, no esta síntesis.",
  lWarn2:"Todo vuelo de globo libre no tripulado debe ser <strong>autorizado por la DINACIA</strong>, la autoridad aeronáutica uruguaya. Ninguna información de esta página sustituye esa autorización.",
  lLede:"La referencia que nos indicó la DINACIA es el <strong>LAR 91, Parte I, Apéndice P — Globos libres no tripulados</strong>, el reglamento aeronáutico latinoamericano sobre globos libres no tripulados. Establece cómo se clasifican, qué obligaciones trae cada categoría y qué se puede y qué no se puede hacer.",

  lClassHead:"Cómo se clasifica nuestra sonda",
  lClassIntro:"El reglamento distingue tres categorías — <em>ligero</em>, <em>mediano</em> y <em>pesado</em> — según cuatro criterios. Basta superar uno para caer en la categoría más pesada, con todas las obligaciones que eso implica. Estos son los cuatro criterios y nuestros valores.",
  thCriterion:"Criterio", thThreshold:"Umbral para «pesado»", thOurs:"Klo-01",
  lc1:"Masa combinada de la carga útil", lc1t:"≥ 6 kg",
  lc2:"Masa de un solo bulto", lc2t:"≥ 3 kg",
  lc3:"Densidad del bulto", lc3t:"≥ 2 kg y > 13 g/cm²",
  lc4:"Fuerza para separar la carga del globo", lc4t:"≥ 230 N", lc4v:"bajo el umbral",
  lClassOut:"Por debajo de todos los umbrales, y con holgura. La sonda Klo-01 es entonces un globo <strong>«ligero»</strong>. El cuarto criterio es el menos intuitivo y vale la pena explicarlo: si el cordaje que une la sonda al globo fuera demasiado resistente — 230 N son unos 23 kilos de fuerza — la sonda pasaría a ser «pesada» aun pesando kilo y medio. Nuestro cordaje se corta por debajo de ese umbral, y es una decisión de diseño, no una casualidad.",

  lDutyHead:"Qué implica",
  lDuty1:"Casi todas las obligaciones operativas del reglamento — dos sistemas independientes para interrumpir el vuelo, el transpondedor de radar, el reflector radar, la notificación al control de tránsito aéreo siete días antes, los informes de posición cada dos horas — corresponden a los globos <em>medianos</em> y <em>pesados</em>. A un globo ligero no se le aplican.",
  lDuty2:"Quedan dos obligaciones, y son las más importantes. La primera: <strong>ningún globo libre no tripulado se utilizará sin la autorización del Estado desde el cual se efectúa el lanzamiento</strong>. Vale para todas las categorías, sin excepción. La segunda: el globo no puede utilizarse de modo que su impacto, o el de cualquiera de sus partes incluida la carga útil, provoque peligro a personas o bienes no vinculados a la operación.",
  lDuty3:"Por eso la DINACIA nos pidió el seguimiento durante el ascenso y el descenso, y no el equipamiento completo previsto para los globos pesados: no es una concesión, es la categoría que nos corresponde.",

  lZoneHead:"La zona de exclusión",
  lZone1:"Hay algo que el reglamento no dice y que hay que buscar en otro lado: alrededor de los aeropuertos existen zonas donde no se puede lanzar. El Apéndice P regula la clasificación de los globos y las obligaciones que se derivan de ella; la protección del espacio aéreo alrededor de los aeropuertos viene de otra fuente. Esta es el área que nos indicó la DINACIA.",
  lZoneAlt:"Mapa del área de exclusión alrededor de Montevideo indicada por la DINACIA, con los aeropuertos de Carrasco, Ángel Adami, Laguna del Sauce y Punta del Este.",
  lZoneCap:"Área de exclusión indicada por la DINACIA. Imagen proporcionada por la autoridad aeronáutica.",
  lZone2:"Es la razón por la que no lanzamos desde Montevideo. Los lugares que estamos evaluando — Durazno y Mercedes — quedan holgadamente fuera de esta área, y ésta es la primera de las restricciones que guiaron el estudio de los vientos.",

  lDiscTag:"Advertencia",
  lDisc1:"La información de esta página se publica con fines divulgativos y educativos. No constituye asesoramiento técnico ni legal, y puede contener errores o quedar superada por modificaciones normativas posteriores.",
  lDisc2:"<strong>Quien quiera organizar su propio lanzamiento debe dirigirse directamente a la DINACIA</strong> y atenerse al texto vigente del reglamento. No asumimos ninguna responsabilidad por el uso que terceros hagan de la información publicada aquí.",
  lSrc1:"<strong>Norma:</strong> LAR 91 — Reglas de vuelo y operación general, Parte I, Apéndice P «Globos libres no tripulados». Segunda edición, Enmienda 16, febrero 2025 (el texto del Apéndice P corresponde a la Enmienda 11).",
  lSrc2:"<strong>Autoridad:</strong> <a href=\"https://www.dinacia.gub.uy/\" target=\"_blank\" rel=\"noopener\">DINACIA</a> — Dirección Nacional de Aviación Civil e Infraestructura Aeronáutica, Uruguay.",
},

/* ==========================================================
   ENGLISH
   ========================================================== */
en:{
  code:"en", title:"COMETA · Klo-01 Probe — Scuola Italiana di Montevideo",
  metaDesc:"COMETA is a stratospheric balloon programme at the Scuola Italiana di Montevideo: atmospheric measurements up to over 37 km, designed and built by students.",

  navHome:"Home", navMission:"Mission", navPhysics:"The physics", navProbe:"The probe", navWinds:"Wind study", navAbout:"About",

  heroEyebrow:"Scuola Italiana di Montevideo · 2EMS · IIIS · 3EMS · IVL · IVS",
  introSub:"Klo-01 probe · a stratospheric balloon to over 37 kilometres.",
  launchBtn:"Simulate the launch", scrollCue:"Scroll to ascend",
  countHead:"Launch in", cDays:"Days", cHours:"Hours", cMins:"Minutes", cSecs:"Seconds",
  cTentative:"Tentative date", cLate:"late September 2026", cUnit:"d",
  arrivedTag:"Altitude reached", afterKicker:"Project COMETA",
  afterHead:"From the pad to the edge of space.",
  sAlt:"Target altitude", sDur:"Flight duration", sMass:"Probe mass", sStudents:"Students involved",

  tzMission:"Objectives, flight profile and flight chain.",
  tzProbe:"Explorable three-dimensional model with every component.",
  tzWinds:"240 simulated flights to choose the launch site.",
  tzAbout:"The students behind COMETA.",
  teaserMore:"Explore →",

  idxKicker:"The site",
  idxHead:"Site status",
  idxIntro:"We publish the project as the material is ready. What follows is the index: entries without a link are coming in the next few weeks.",
  stOnline:"Online", stSoon:"In preparation",
  ix1t:"Wind study", ix1n:"240 simulated flights to choose the launch site",
  ix2t:"The probe", ix2n:"Explorable three-dimensional model with every component",
  ix3t:"The physics of the flight", ix3n:"Why it rises, why it bursts, why it gets so cold",
  ix4t:"How we work", ix4n:"The working groups and how the project is organised",
  ix5t:"Legal aspects", ix5n:"Aviation regulation and what it means for us",
  ix7t:"Frequently asked questions", ix7n:"No, it is not a satellite. And yes, we go and get it back.",
  ix8t:"Contact", ix8n:"Schools, companies, curious people",

  pKicker:"Flight profile", missionTitle:"Mission",
  missionSub:"What we study and how the probe ascends.",
  mBody:"Project COMETA sends the Klo-01 probe to about 37.8 km to study the stratosphere through direct measurements, in a region of the atmosphere that aircraft cannot reach and satellites fly over. Three hours of flight, a balloon that inflates until it bursts, and a polystyrene box that comes back down on a parachute.",

  pHead2:"Conditions of the ascent",
  pAlt:"Target altitude", pTemp:"External temperature", pPress:"Atmospheric pressure", pPressU:"of sea level",
  pGas:"Fill gas", pGasMain:"Helium", pVel:"Ascent rate", pDur:"Flight duration",
  pHe:"Helium available", pMass:"Payload mass", pMassU:"limit 2000 g",

  bKicker:"The balloon", bHead:"Balloon 2000",
  bBody:"The mission uses the 2000 g balloon. Filled with about 4.5 m³ of helium, it reaches a burst altitude of around 37.8 km.",
  specDiam:"Initial diameter", specBurst:"Burst altitude", specHe:"Helium required",
  specMass:"Payload mass",

  cKicker:"Flight chain", cHead:"How it is assembled",
  chain:["Balloon","Cord","Parachute","Anti-torsion cord","Payload"],

  burstLbl:"Predicted burst altitude · Balloon 2000",

  probeKicker:"Phase 1 · 2026", probeTitle:"Inside the Klo-01 probe",
  modeBench:"Bench", modeFlight:"Flight",
  benchNote:"Drag to rotate · wheel or two fingers to zoom",
  flightNote:"Closed probe, with stabilising fins, external arm and comparison tube.",
  ctlExplode:"Explode", ctlDecks:"Decks", ctlPins:"Numbers",
  cardDetail:"Component", cardLegend:"Legend", cardParts:"Components",
  detailEmpty:"Tap a component in the scene or a number in the list to see its dimensions, mass and function.",
  catAtmo:"Atmosphere", catPos:"Position and control", catRad:"Radiation and light", catAlim:"Power", catKit:"Kit 2000 (already aboard)",
  legNote:"The pale disc on the lid is the PTFE window that lets ultraviolet through to the sensor. The sand-coloured bands are the insulation: outside it gets down to −60 °C. Components 24, 25 and 26 sit outside the probe, because they have to measure the real air.",
  uOn:"of", uParts:"parts",
  massNote:"The {mass} g given here is the sum of the components drawn inside the box alone, of which 379 g are Kit 2000 units already aboard. The full payload is about 1280 g: add the polystyrene box (200 g), the parachute (80 g), the cordage (80 g), the decks with their tie rods (~70 g), wiring and insulation (~90 g), radar reflector and labels (~30 g). The model does not replace the dry-fit test or a real weigh-in.",
  webglFail:"The three-dimensional model is not available on this device. The component list below still works.",

  wKicker:"Phase 1 · Preliminary study", windsTitle:"Where the probe ends up",
  windsSub:"240 simulated trajectories to choose the launch site.",
  wLede:"Before choosing a launch site we simulated 240 flights from two different towns, using the winds actually forecast over the same period in four past years.<br><br>The result is that the probe drifts about 190 km east.",
  wTraj:"Simulated trajectories", wDrift:"Mean drift", wBearing:"Mean bearing", wDur:"Mean duration", wBearingU:"(east)",

  wSimHead:"The simulation",
  wSimP1:"We simulated the probe's flight over the period <strong>15 September – 15 October</strong>, one launch per day, for four different years: {years}. One hundred and twenty dates, repeated for two starting points — <strong>Durazno</strong> and <strong>Mercedes</strong> — for a total of 240 simulated flights.",
  wSimP2:"Every dot on the map is the landing of one of those flights. The ellipses summarise the dispersion: starting from the same place at the same time of year, a new launch would have roughly a <strong>50 % chance of landing inside the small ellipse</strong> and <strong>90 % inside the large one</strong>.",
  wYears:"2021-2024",
  mDurazno:"Launched from Durazno", mMercedes:"Launched from Mercedes",
  mapHint:"Clicking a dot shows the drift, bearing and duration of that flight.",

  wApproxHead:"The approximations",
  wApproxIntro:"Every simulation is a model, and every model simplifies. These are the three simplifications we made, and how much they matter.",
  wA1H:"Wind changes horizontally too",
  wA1P:"The probe does not rise and fall through the same column of air: while flying it moves almost two hundred kilometres, where the wind is different. We treated the ascent and the descent as two separate columns, then measured how much this simplification costs by redoing the same calculation with a single column. The difference averages <strong>4 km out of 190</strong>, with a maximum of 17: about 2 %. Negligible for our purposes.",
  wA2H:"The wind is not measured, it is reconstructed",
  wA2P:"Over Uruguay, at twenty kilometres, there is no instrument measuring the wind hour by hour. What we use are the archived forecasts of a weather model: what the wind was according to the model, not what it actually was. It is a reliable reconstruction, but it remains a reconstruction.",
  wA3H:"The ellipses assume a Gaussian distribution",
  wA3P:"The data show that the assumptions behind the Gaussian model hold reasonably well. It should be said, however, that the data are not all truly independent, because the same weather system governs several consecutive days.",

  wUseHead:"What it is for, and what it is not",
  wUseTag:"Please note",
  wUseP1:"This analysis is for <strong>choosing the launch site</strong>. It does not say where our probe will land.",
  wUseP2:"For that we will use a far more precise forecasting tool, which however only works a few days before launch. And the actual site and date of the flight depend in every case on authorisation from <strong>DINACIA</strong>.",

  srcMeteo:"<strong>Weather data:</strong> archived forecasts from the Historical Forecast API of <a href=\"https://open-meteo.com/\" target=\"_blank\" rel=\"noopener\">Open-Meteo</a>, distributed under CC BY 4.0.",
  srcMap:"<strong>Map:</strong> Leaflet over OpenStreetMap cartography, © OpenStreetMap contributors.",
  srcCalc:"<strong>Computation:</strong> <code>cometa_venti.py</code>, developed within the project — standard atmosphere model, layer-by-layer trajectory integration, ellipses from the covariance matrix. The code is public.",
  srcExcl:"<strong>Exclusion area:</strong> approximate polygon.",
  srcUpdated:"<strong>Summary updated:</strong> {date}",
  wDate:"[DATE]",

  aboutKicker:"About", aboutTitle:"About us", aboutSub:"The people behind COMETA.",
  aboutBody:"We are students of 2EMS, IIIS, 3EMS, IVL and IVS at the Scuola Italiana di Montevideo.",
  contactHead:"Follow us", contactSub:"Mission updates on Instagram.", igCta:"Follow on Instagram",

  footNav:"Pages", footFollow:"Follow us", footStatus:"Status: in progress", footRights:"Text and images CC BY 4.0",

  /* — The physics of the flight — */
  physKicker:"Phase 1 · How it works", physTitle:"The physics of the flight",
  physSub:"Why it rises, why it swells, why it bursts, why it gets so cold.",
  physScroll:"Scroll to ascend",
  ph1t:"On the ground — Archimedes' push",
  ph1p:"The balloon is not fired upwards: it is <strong>pushed</strong> by the air around it. Four and a half cubic metres of helium weigh far less than the air they displace, and that difference has to lift everything else — the 1280 g payload, the latex, the parachute, the cordage. What is left over sets the speed: about <strong>5 metres per second</strong>, the same all the way up.",
  ph2t:"Troposphere, 0–11 km — colder and colder",
  ph2p:"As it climbs, the air thins and the temperature falls by about <strong>6.5 °C per kilometre</strong>: at eleven kilometres we are at −56 °C. This is where the heating pad earns its place, wrapped around the cells: it warms 90 g of batteries, not the three litres of air in the box.",
  ph3t:"Tropopause, 11–17 km — the coldest point",
  ph3p:"The temperature stops falling: the tropopause is the minimum, <strong>down to −60 °C</strong> outside. The reworked thermal budget puts the inside of the probe at about −45 °C right here. Above it, against all intuition, it starts getting warmer again.",
  ph4t:"Stratosphere, above 18 km — the air runs out",
  ph4p:"At thirty-one kilometres the pressure sensor reaches full scale: <strong>10 hPa</strong>, a hundredth of the pressure at the ground. From there up, altitude comes from GPS alone. And with so little air around, heat struggles to escape: this is why the Teensy runs at a reduced clock, between 150 and 300 MHz.",
  ph5t:"The balloon swells",
  ph5p:"Less pressure outside means more volume inside: the helium expands until the two pressures match again. Between the ground and 37.8 km the outside pressure drops <strong>more than two hundredfold</strong>; the volume grows in the same proportion and the diameter goes from 2.05 m to over ten. The balloon that leaves the size of a car arrives the size of a house.",
  ph6t:"The burst, 37.8 km",
  ph6p:"Latex has a stretch limit, and sooner or later it reaches it. For the 2000 balloon filled with 4.5 m³ the project's own calculation puts the burst at <strong>37.8 kilometres</strong>. From that instant the probe stops rising: it falls.",
  ph7t:"The descent and the recovery",
  ph7p:"The parachute opens by itself, pulled open by the air. High up it slows very little, because there is almost nothing to push against; the lower it gets, the more it brakes. <strong>Three hours in all</strong>, up and down. Then the probe is on the ground somewhere to the east — about 190 kilometres away — and that is where the other half of the work begins.",

  /* — Contact — */
  contactMailHead:"Write to us", contactMailSub:"For information, collaborations, proposals.",
  mailCta:"Send us an email", tiktokCta:"Follow us on TikTok", footContact:"Contact",
  classesNote:"Five classes from the two systems that coexist in the school, the Italian one and the Uruguayan one: 2EMS, IIIS, 3EMS, IVL and IVS.",

  bands:["Ground","Troposphere","Tropopause","Stratosphere"],
  skip:"Skip to content",

  /* — Rules and authorisations — */
  navLegal:"Legal",
  lKicker:"Phase 1 · Flight rules", legalTitle:"Legal aspects",
  legalSub:"What the aviation regulation says, and how it applies to us.",
  lWarnTag:"Before you read",
  lWarn1:"This page is a plain-language summary, written by us to explain the framework we work within. <strong>The original text of the regulation prevails</strong>, not this summary.",
  lWarn2:"Every unmanned free balloon flight must be <strong>authorised by DINACIA</strong>, the Uruguayan civil aviation authority. Nothing on this page replaces that authorisation.",
  lLede:"The reference DINACIA pointed us to is <strong>LAR 91, Part I, Appendix P — Unmanned free balloons</strong>, the Latin American aviation regulation covering unmanned free balloons. It sets out how they are classified, what obligations each category carries, and what may and may not be done.",

  lClassHead:"How our probe is classified",
  lClassIntro:"The regulation distinguishes three categories — <em>light</em>, <em>medium</em> and <em>heavy</em> — using four criteria. Exceeding any one of them puts a balloon in the heavier category, with all the obligations that follow. These are the four criteria and our figures.",
  thCriterion:"Criterion", thThreshold:"Threshold for «heavy»", thOurs:"Klo-01",
  lc1:"Combined payload mass", lc1t:"≥ 6 kg",
  lc2:"Mass of a single package", lc2t:"≥ 3 kg",
  lc3:"Package density", lc3t:"≥ 2 kg and > 13 g/cm²",
  lc4:"Force needed to separate the payload", lc4t:"≥ 230 N", lc4v:"below threshold",
  lClassOut:"Below every threshold, and comfortably so. The Klo-01 probe is therefore a <strong>«light»</strong> balloon. The fourth criterion is the least intuitive and worth explaining: if the cord joining probe and balloon were too strong — 230 N is roughly 23 kilograms of force — the probe would count as heavy even at one and a half kilos. Our cord breaks below that threshold, and that is a design decision, not an accident.",

  lDutyHead:"What it means in practice",
  lDuty1:"Almost every operational obligation in the regulation — two independent flight termination systems, a radar transponder, a radar reflector, notification to air traffic control seven days ahead, position reports every two hours — applies to <em>medium</em> and <em>heavy</em> balloons. A light balloon is exempt.",
  lDuty2:"Two obligations remain, and they are the important ones. First: <strong>no unmanned free balloon may be operated without the authorisation of the State from which it is launched</strong>. This applies to every category, without exception. Second: a balloon may not be operated in such a way that it, or any part of it including the payload, endangers people or property not involved in the operation on impact.",
  lDuty3:"That is why DINACIA asked us for tracking during ascent and descent rather than the full equipment required of heavy balloons: it is not a concession, it is the category we fall into.",

  lZoneHead:"The exclusion zone",
  lZone1:"There is something the regulation does not cover, and that has to be looked up elsewhere: around airports there are areas where launching is not permitted. Appendix P governs balloon classification and the obligations that follow from it; protection of the airspace around airports comes from a different source. This is the area DINACIA indicated to us.",
  lZoneAlt:"Map of the exclusion area around Montevideo indicated by DINACIA, showing Carrasco, Ángel Adami, Laguna del Sauce and Punta del Este airports.",
  lZoneCap:"Exclusion area as indicated by DINACIA. Image supplied by the aviation authority.",
  lZone2:"It is the reason we are not launching from Montevideo. The sites we are considering — Durazno and Mercedes — lie well outside this area, and this was the first of the constraints that shaped the wind study.",

  lDiscTag:"Disclaimer",
  lDisc1:"The information on this page is published for educational purposes. It is not technical or legal advice, and it may contain errors or be superseded by later amendments to the regulation.",
  lDisc2:"<strong>Anyone planning their own launch must contact DINACIA directly</strong> and follow the regulation as currently in force. We accept no responsibility for any use others make of the information published here.",
  lSrc1:"<strong>Regulation:</strong> LAR 91 — Reglas de vuelo y operación general, Part I, Appendix P «Globos libres no tripulados». Second edition, Amendment 16, February 2025 (the Appendix P text dates from Amendment 11).",
  lSrc2:"<strong>Authority:</strong> <a href=\"https://www.dinacia.gub.uy/\" target=\"_blank\" rel=\"noopener\">DINACIA</a> — Dirección Nacional de Aviación Civil e Infraestructura Aeronáutica, Uruguay.",
}
};
