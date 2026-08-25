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

  navHome:"Inizio", navMission:"Missione", navPhysics:"La fisica", navProbe:"La sonda", navWinds:"Studio dei venti", navAbout:"Chi siamo e contatti",

  /* — Inizio — */
  heroEyebrow:"Scuola Italiana di Montevideo · 2EMS · IIIS · 3EMS · IVL · IVS",
  introSub:"Sonda Klo-01 · un pallone stratosferico fino a oltre 37 chilometri di quota.",
  launchBtn:"Simula il decollo", scrollCue:"Scorri per salire",
  countHead:"Lancio tra", cDays:"Giorni", cHours:"Ore", cMins:"Minuti", cSecs:"Secondi",
  cTentative:"Data provvisoria", cLate:"fine settembre 2026", cUnit:"g",
  afterKicker:"Progetto COMETA",
  afterHead:"Da terra al bordo dello spazio.",
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
  ix8t:"Chi siamo e contatti", ix8n:"Vieni a conoscerci!",

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
  srcUpdated:"<strong>Simulazione eseguita nel:</strong> {date}",
  wDate:"giugno 2026",

  /* — Chi siamo — */
  aboutKicker:"Chi siamo", aboutTitle:"Chi siamo", aboutSub:"Le persone dietro COMETA.",
  aboutBody:"Siamo studentesse e studenti di 2EMS, IIIS, 3EMS, IVL e IVS della Scuola Italiana di Montevideo.",
  contactHead:"Seguici", contactSub:"Per vedere i nostri contenuti e scoprire le novità sulla missione.", igCta:"Seguici su Instagram",

  /* — Pie di pagina e altimetro — */
  footNav:"Pagine", footFollow:"Seguici", footStatus:"Stato: in corso", footRights:"Testi e immagini CC BY 4.0",

  /* — La fisica del volo — */
  physKicker:"Fase 1 · Come funziona", physTitle:"La fisica del volo",
  physSub:"Perché sale, perché si gonfia, perché scoppia, perché fa così freddo.",
  physScroll:"Scorri per salire",
  ph1t:"A terra — la spinta di Archimede",
  ph1p:"Il pallone viene spinto in alto dall'aria che ha intorno. L'elio è circa <strong>sette volte meno denso</strong> dell'aria, e questa differenza deve sollevare tutto il resto: il payload, il pallone stesso, il paracadute, il cordame. Più elio si mette dentro, più rapidamente il pallone sale.",
  ph2t:"Troposfera, 0–11 km — fa sempre più freddo",
  ph2p:"Salendo, l'aria si dirada e la temperatura scende di circa <strong>6,5 °C ogni chilometro</strong>: a undici chilometri siamo a −56 °C.",
  ph3t:"Tropopausa, 11–18 km — il punto più freddo",
  ph3p:"La discesa della temperatura si ferma: la tropopausa è il minimo, <strong>fino a −60 °C</strong> all'esterno. A 18 km il GPS principale smette di inviarci segnali: la sonda «si perde».",
  ph4t:"Stratosfera, sopra i 18 km — l'aria finisce",
  ph4p:"A trentun chilometri il sensore di pressione arriva a fondo scala: 10 hPa, un <strong>centesimo</strong> della pressione al suolo. La temperatura ricomincia a salire, per la presenza dell'ozono che assorbe i raggi ultravioletti.",
  ph5t:"Il pallone si gonfia",
  ph5p:"Fra il suolo e i 37,8 km la pressione esterna cala di <strong>oltre duecento volte</strong>, e il volume del pallone cresce nella stessa proporzione: il diametro passa da circa 2 m a più di dieci. Il pallone parte grande come un'automobile e arriva grande come una casa.",
  ph6t:"Lo scoppio, 37,8 km",
  ph6p:"Il lattice ha un limite di allungamento, e a un certo punto lo raggiunge. Per il nostro pallone riempito, il calcolo del progetto mette lo scoppio a <strong>37,8 chilometri</strong>. Da quell'istante la sonda comincia a cadere.",
  ph7t:"La discesa",
  ph7p:"Il paracadute si apre da solo, tirato dall'aria. In alto frena poco, perché non c'è quasi niente su cui fare presa. Più si scende, più rallenta.",
  ph8t:"Il recupero", ph8p:"Tre ore in tutto, fra salita e discesa. Poi la sonda è per terra, da qualche parte — circa <strong>190 chilometri più a est</strong> — e nel frattempo i GPS hanno ricominciato a inviarci la posizione. Parte la ricerca.",

  /* — Contatti — */
  contactMailHead:"Scrivici", contactMailSub:"Per informazioni, collaborazioni, proposte.",
  mailCta:"Manda una mail", tiktokCta:"Seguici su TikTok", footContact:"Contatti",
  classesNote:"Cinque classi dei due sistemi che convivono nella scuola, quello italiano e quello uruguaiano.",

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
  lClassIntro:"Le categorie sono tre. <strong>Ligero</strong>: carico utile complessivo sotto i 4 kg. <strong>Mediano</strong>: da 4 a 6 kg, distribuiti su due o più colli. <strong>Pesado</strong>: 6 kg o più. Ma la massa non decide da sola — tre condizioni fanno scattare la categoria «pesado» a qualunque peso, e sono le ultime tre righe della tabella. Basta che una sia soddisfatta.",
  thCriterion:"Criterio", thThreshold:"Per restare «ligero»", thOurs:"Klo-01",
  lc1:"Massa complessiva del carico utile", lc1t:"sotto 4 kg",
  lc2:"Massa del collo più pesante", lc2t:"sotto 3 kg",
  lc3:"Colli da 2 kg o più con densità oltre 13 g/cm²", lc3t:"nessuno",
  lc4:"Forza per separare il carico dal pallone", lc4t:"sotto 230 N", lc4v:"sotto soglia", lc3v:"1,3 kg · ≈ 3 g/cm²",
  lClassOut:"Quattro criteri, quattro volte dentro. La sonda Klo-01 è un pallone <strong>«ligero»</strong>: pesa un terzo della soglia dei 4 kg, il collo è unico e ben sotto i 3 kg, la sua densità è quattro volte inferiore al limite, e il cordame cede prima dei 230 N. Quest'ultimo è il criterio meno intuitivo e vale la pena spiegarlo: 230 N sono circa 23 chili di forza, e un cordame più robusto renderebbe la sonda «pesada» anche pesando un chilo e mezzo. Il nostro cede sotto quella soglia, ed è una scelta di progetto, non un caso.",

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

  /* — Missione: misure, scelte, limiti — */
  msKicker:"Cosa misuriamo", msHead:"Dieci sensori e i loro limiti",
  msIntro:"Ogni sensore ha un intervallo di validità, e conoscerlo è ciò che permette, in fase di analisi, di distinguere una misura da un numero. Salendo e scendendo, la sonda percorre due volte le stesse quote: ogni grandezza diventa un profilo verticale, ed è in questo che consiste studiare l'atmosfera con un pallone.",
  thVar:"Grandezza", thSens:"Strumento", thValid:"Dato valido fino a",
  mv1:"Quota, velocità, traiettoria", mv1v:"tutto il volo",
  mv2:"Pressione",
  mv3:"Temperatura dell'aria", mv3v:"tutto il volo",
  mv4:"Temperature interne", mv4v:"tutto il volo",
  mv5:"Umidità relativa",
  mv6:"Anidride carbonica",
  mv7:"Particolato", mv7v:"4–5 km",
  mv8:"Radiazione ionizzante", mv8s:"tubo Geiger", mv8v:"tutto il volo",
  mv9:"Ultravioletto", mv9v:"tutto il volo",
  mv10:"Assetto, rotazione e scoppio", mv10v:"tutto il volo",
  msNotKicker:"Cosa non misuriamo",
  msNot1:"<strong>L'ozono e gli ossidi di azoto.</strong> I sensori disponibili a questo costo sono tarati per l'aria a livello del mare; alle pressioni della stratosfera la loro risposta non è interpretabile, e non esiste un modo praticabile di calibrarli per quelle condizioni. Avremmo ottenuto numeri, non misure.",
  msCamKicker:"Le immagini e il ritrovamento",
  msCam1:"La <strong>Space Cam</strong> di StratoFlights è montata in orizzontale e riprende per tutta la durata del volo. La posizione è vincolata: serviva una vista libera, senza alette né sonde nel campo inquadrato, e questo ha fissato la parete. Di conseguenza il sensore di particolato è stato spostato sulla parete anteriore, per non assottigliare due volte lo stesso lato della scatola.",
  msCam2:"Per ritrovarla ci sono due apparati indipendenti: lo <strong>STRATOfinder 4G</strong>, che trasmette la posizione dove c'è copertura di rete cellulare, e uno <strong>SPOT Trace</strong>, che usa i satelliti e funziona anche dove la rete non arriva. Nessuno dei due può comunicarci la posizione durante tutto il volo.",

  msFwKicker:"La scheda che programmiamo",
  msFw1:"Il calcolatore è un <strong>Teensy 4.1</strong>, e il programma che gira sopra lo scriviamo noi: legge i sensori, li interroga ciascuno al proprio ritmo, e scrive tutto su microSD. Accanto, un secondo registratore completamente separato — <strong>Feather M0 Adalogger</strong>, con il proprio GPS, le proprie pile e la propria memoria — registra quota e traiettoria senza condividere nulla con il primo.",
  msEngKicker:"Cinque scelte di progetto",
  msE1t:"Due termometri invece di uno",
  msE1:"Sulla misura della temperatura dell'aria esistono due scuole: elemento nudo in aria libera, come le radiosonde classiche, oppure elemento schermato dentro un condotto. La prima è più fedele ai cambiamenti rapidi ma prende il sole; la seconda è protetta ma più lenta. Invece di sceglierne una, montiamo <strong>entrambe</strong> e confrontiamo le due curve. La differenza fra loro misura direttamente l'errore da irraggiamento — con dati nostri, invece che per argomenti.",
  msE2t:"Una curva a 90° per togliere il ghiaccio",
  msE2:"Il condotto del secondo termometro ha un gomito. Non serve a far scolare l'acqua: serve a <strong>separare le gocce</strong>. Attraversando le nubi, l'aria svolta l'angolo, ma le goccioline sopraffuse hanno troppa inerzia per seguirla e finiscono contro la parete esterna della curva. A valle il sensore riceve aria ripulita, e non si copre di ghiaccio. È lo stesso principio dei tubi di Pitot degli aerei.",
  msE3t:"Una finestra di PTFE, non di quarzo",
  msE3:"Il polistirolo è opaco all'ultravioletto: senza un'apertura il sensore non leggerebbe nulla. Il quarzo sarebbe la scelta ovvia, ma il PTFE fa due cose meglio: <strong>diffonde</strong> la luce, il che conta molto su una sonda che ruota su sé stessa, e conduce circa sei volte meno calore, il che conta molto in una scatola che deve restare tiepida.",
  msE4t:"Quattrocento volt lontani dal calcolatore",
  msE4:"Il tubo Geiger lavora a circa 400 volt. Fra il suo circuito e il piedino del calcolatore che conta gli impulsi abbiamo messo un <strong>optoisolatore</strong>: il segnale passa come luce, non come corrente, e i due lati restano elettricamente separati.",
  msE5t:"Il baricentro sull'asse",
  msE5:"Le masse pesanti — pacco pile e power bank — stanno sul ripiano più basso, e la disposizione di ogni componente è stata calcolata perché il centro di massa cada sull'<strong>asse di sospensione</strong>. Lo scarto residuo è di 3 millimetri su 780 grammi, che appesi tre metri sotto il paracadute danno un'inclinazione statica di appena 0,74 gradi. Una sonda che pende storta riprende storto e misura storto.",
  msWipTag:"In lavorazione",
  msWip:"La lista dei componenti <strong>non è definitiva</strong>. Il progetto è ancora in corso, e cambierà sia prima delle prove a terra sia dopo.",
},

/* ==========================================================
   ESPAÑOL
   ========================================================== */
es:{
  code:"es", title:"COMETA · Sonda Klo-01 — Scuola Italiana di Montevideo",
  metaDesc:"COMETA es un programa de globos estratosféricos de la Scuola Italiana di Montevideo: mediciones atmosféricas hasta más de 37 km de altura, diseñadas y construidas por los estudiantes.",

  navHome:"Inicio", navMission:"Misión", navPhysics:"La física", navProbe:"La sonda", navWinds:"Estudio de vientos", navAbout:"Quiénes somos y contacto",

  heroEyebrow:"Scuola Italiana di Montevideo · 2EMS · IIIS · 3EMS · IVL · IVS",
  introSub:"Sonda Klo-01 · un globo estratosférico hasta más de 37 kilómetros de altura.",
  launchBtn:"Simular el despegue", scrollCue:"Desplazate para subir",
  countHead:"Lanzamiento en", cDays:"Días", cHours:"Horas", cMins:"Minutos", cSecs:"Segundos",
  cTentative:"Fecha tentativa", cLate:"fines de setiembre de 2026", cUnit:"d",
  afterKicker:"Proyecto COMETA",
  afterHead:"Desde tierra al borde del espacio.",
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
  ix8t:"Quiénes somos y contacto", ix8n:"¡Vení a conocernos!",

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
  srcUpdated:"<strong>Simulación realizada en:</strong> {date}",
  wDate:"junio de 2026",

  aboutKicker:"Nosotros", aboutTitle:"Nosotros", aboutSub:"Las personas detrás de COMETA.",
  aboutBody:"Somos estudiantes de 2EMS, IIIS, 3EMS, IVL y IVS de la Scuola Italiana di Montevideo.",
  contactHead:"Seguinos", contactSub:"Para ver nuestros contenidos y descubrir las novedades de la misión.", igCta:"Seguinos en Instagram",

  footNav:"Páginas", footFollow:"Seguinos", footStatus:"Estado: en curso", footRights:"Textos e imágenes CC BY 4.0",

  /* — La física del vuelo — */
  physKicker:"Fase 1 · Cómo funciona", physTitle:"La física del vuelo",
  physSub:"Por qué sube, por qué se infla, por qué revienta, por qué hace tanto frío.",
  physScroll:"Desplazate para subir",
  ph1t:"En tierra — el empuje de Arquímedes",
  ph1p:"El globo es empujado hacia arriba por el aire que lo rodea. El helio es unas <strong>siete veces menos denso</strong> que el aire, y esa diferencia tiene que levantar todo lo demás: la carga útil, el propio globo, el paracaídas, el cordaje. Cuanto más helio se pone, más rápido sube el globo.",
  ph2t:"Troposfera, 0–11 km — cada vez más frío",
  ph2p:"Al subir, el aire se enrarece y la temperatura baja unos <strong>6,5 °C por kilómetro</strong>: a once kilómetros estamos a −56 °C.",
  ph3t:"Tropopausa, 11–18 km — el punto más frío",
  ph3p:"La caída de la temperatura se detiene: la tropopausa es el mínimo, <strong>hasta −60 °C</strong> en el exterior. A 18 km el GPS principal deja de enviarnos señal: la sonda «se pierde».",
  ph4t:"Estratosfera, por encima de 18 km — el aire se acaba",
  ph4p:"A treinta y un kilómetros el sensor de presión llega al fondo de escala: 10 hPa, una <strong>centésima</strong> de la presión a nivel del suelo. La temperatura vuelve a subir, por el ozono que absorbe los rayos ultravioleta.",
  ph5t:"El globo se infla",
  ph5p:"Entre el suelo y los 37,8 km la presión exterior baja <strong>más de doscientas veces</strong>, y el volumen del globo crece en la misma proporción: el diámetro pasa de unos 2 m a más de diez. El globo sale del tamaño de un auto y llega del tamaño de una casa.",
  ph6t:"El estallido, 37,8 km",
  ph6p:"El látex tiene un límite de estiramiento, y en algún momento lo alcanza. Para nuestro globo, con el llenado previsto, el cálculo del proyecto sitúa el estallido en <strong>37,8 kilómetros</strong>. Desde ese instante la sonda empieza a caer.",
  ph7t:"El descenso",
  ph7p:"El paracaídas se abre solo, tirado por el aire. Arriba frena poco, porque casi no hay nada de lo que agarrarse. Cuanto más baja, más frena.",
  ph8t:"La recuperación", ph8p:"Tres horas en total, entre subida y bajada. Después la sonda está en el suelo, en algún lugar — unos <strong>190 kilómetros más al este</strong> — y mientras tanto los GPS han vuelto a enviarnos la posición. Empieza la búsqueda.",

  /* — Contacto — */
  contactMailHead:"Escribinos", contactMailSub:"Para información, colaboraciones, propuestas.",
  mailCta:"Mandanos un correo", tiktokCta:"Seguinos en TikTok", footContact:"Contacto",
  classesNote:"Cinco clases de los dos sistemas que conviven en la escuela, el italiano y el uruguayo.",

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
  lClassIntro:"Las categorías son tres. <strong>Ligero</strong>: carga útil combinada por debajo de 4 kg. <strong>Mediano</strong>: de 4 a 6 kg, repartidos en dos o más bultos. <strong>Pesado</strong>: 6 kg o más. Pero la masa no decide sola — tres condiciones hacen saltar la categoría «pesado» con cualquier peso, y son las tres últimas filas de la tabla. Basta con que se cumpla una.",
  thCriterion:"Criterio", thThreshold:"Para seguir siendo «ligero»", thOurs:"Klo-01",
  lc1:"Masa combinada de la carga útil", lc1t:"menos de 4 kg",
  lc2:"Masa del bulto más pesado", lc2t:"menos de 3 kg",
  lc3:"Bultos de 2 kg o más con densidad superior a 13 g/cm²", lc3t:"ninguno",
  lc4:"Fuerza para separar la carga del globo", lc4t:"menos de 230 N", lc4v:"bajo el umbral", lc3v:"1,3 kg · ≈ 3 g/cm²",
  lClassOut:"Cuatro criterios, cuatro veces dentro. La sonda Klo-01 es un globo <strong>«ligero»</strong>: pesa un tercio del umbral de 4 kg, el bulto es único y muy por debajo de 3 kg, su densidad es cuatro veces menor que el límite, y el cordaje se corta antes de los 230 N. Este último es el criterio menos intuitivo y vale la pena explicarlo: 230 N son unos 23 kilos de fuerza, y un cordaje más resistente haría «pesada» a la sonda aun pesando kilo y medio. El nuestro cede por debajo de ese umbral, y es una decisión de diseño, no una casualidad.",

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

  /* — Misión: medidas, decisiones, límites — */
  msKicker:"Qué medimos", msHead:"Diez sensores y sus límites",
  msIntro:"Cada sensor tiene un intervalo de validez, y conocerlo es lo que permite, en el análisis, distinguir una medición de un número. Subiendo y bajando, la sonda recorre dos veces las mismas alturas: cada magnitud se convierte en un perfil vertical, y en eso consiste estudiar la atmósfera con un globo.",
  thVar:"Magnitud", thSens:"Instrumento", thValid:"Dato válido hasta",
  mv1:"Altura, velocidad, trayectoria", mv1v:"todo el vuelo",
  mv2:"Presión",
  mv3:"Temperatura del aire", mv3v:"todo el vuelo",
  mv4:"Temperaturas internas", mv4v:"todo el vuelo",
  mv5:"Humedad relativa",
  mv6:"Dióxido de carbono",
  mv7:"Material particulado", mv7v:"4–5 km",
  mv8:"Radiación ionizante", mv8s:"tubo Geiger", mv8v:"todo el vuelo",
  mv9:"Ultravioleta", mv9v:"todo el vuelo",
  mv10:"Actitud, rotación y estallido", mv10v:"todo el vuelo",
  msNotKicker:"Qué no medimos",
  msNot1:"<strong>El ozono y los óxidos de nitrógeno.</strong> Los sensores disponibles a este costo están calibrados para aire a nivel del mar; a las presiones de la estratosfera su respuesta no es interpretable, y no existe una forma practicable de calibrarlos para esas condiciones. Habríamos obtenido números, no mediciones.",
  msCamKicker:"Las imágenes y el hallazgo",
  msCam1:"La <strong>Space Cam</strong> de StratoFlights va montada en horizontal y graba durante todo el vuelo. La posición está condicionada: hacía falta una vista libre, sin aletas ni sondas en el encuadre, y eso fijó la pared. En consecuencia el sensor de material particulado se pasó a la pared delantera, para no adelgazar dos veces el mismo lado de la caja.",
  msCam2:"Para encontrarla hay dos aparatos independientes: el <strong>STRATOfinder 4G</strong>, que transmite la posición donde hay cobertura de red celular, y un <strong>SPOT Trace</strong>, que usa satélites y funciona también donde la red no llega. Ninguno de los dos puede comunicarnos la posición durante todo el vuelo.",

  msFwKicker:"La placa que programamos",
  msFw1:"El computador es un <strong>Teensy 4.1</strong>, y el programa que corre en él lo escribimos nosotros: lee los sensores, interroga a cada uno a su propio ritmo y escribe todo en una microSD. Al lado, un segundo registrador completamente separado — <strong>Feather M0 Adalogger</strong>, con su propio GPS, sus propias pilas y su propia memoria — registra altura y trayectoria sin compartir nada con el primero.",
  msEngKicker:"Cinco decisiones de diseño",
  msE1t:"Dos termómetros en vez de uno",
  msE1:"Sobre la medición de la temperatura del aire hay dos escuelas: elemento desnudo al aire libre, como las radiosondas clásicas, o elemento protegido dentro de un conducto. La primera es más fiel a los cambios rápidos pero recibe el sol; la segunda está protegida pero es más lenta. En vez de elegir una, montamos <strong>las dos</strong> y comparamos las curvas. La diferencia entre ellas mide directamente el error por radiación solar — con datos propios, en vez de con argumentos.",
  msE2t:"Una curva de 90° para quitar el hielo",
  msE2:"El conducto del segundo termómetro tiene un codo. No sirve para que escurra el agua: sirve para <strong>separar las gotas</strong>. Al atravesar las nubes, el aire dobla la esquina, pero las gotitas sobreenfriadas tienen demasiada inercia para seguirlo y terminan contra la pared exterior de la curva. Aguas abajo el sensor recibe aire limpio y no se cubre de hielo. Es el mismo principio de los tubos de Pitot de los aviones.",
  msE3t:"Una ventana de PTFE, no de cuarzo",
  msE3:"El poliestireno es opaco al ultravioleta: sin una abertura el sensor no leería nada. El cuarzo sería la opción obvia, pero el PTFE hace dos cosas mejor: <strong>difunde</strong> la luz, lo que importa mucho en una sonda que gira sobre sí misma, y conduce unas seis veces menos calor, lo que importa mucho en una caja que debe mantenerse tibia.",
  msE4t:"Cuatrocientos voltios lejos del computador",
  msE4:"El tubo Geiger trabaja a unos 400 voltios. Entre su circuito y el pin del computador que cuenta los pulsos pusimos un <strong>optoacoplador</strong>: la señal pasa como luz, no como corriente, y los dos lados quedan eléctricamente separados.",
  msE5t:"El centro de masa sobre el eje",
  msE5:"Las masas pesadas — el paquete de pilas y la batería externa — van en el estante más bajo, y la posición de cada componente se calculó para que el centro de masa caiga sobre el <strong>eje de suspensión</strong>. El desvío que queda es de 3 milímetros sobre 780 gramos, que colgados tres metros por debajo del paracaídas dan una inclinación estática de apenas 0,74 grados. Una sonda que cuelga torcida graba torcido y mide torcido.",
  msWipTag:"En proceso",
  msWip:"La lista de componentes <strong>no es definitiva</strong>. El proyecto sigue en curso y cambiará tanto antes de los ensayos en tierra como después.",
},

/* ==========================================================
   ENGLISH
   ========================================================== */
en:{
  code:"en", title:"COMETA · Klo-01 Probe — Scuola Italiana di Montevideo",
  metaDesc:"COMETA is a stratospheric balloon programme at the Scuola Italiana di Montevideo: atmospheric measurements up to over 37 km, designed and built by students.",

  navHome:"Home", navMission:"Mission", navPhysics:"The physics", navProbe:"The probe", navWinds:"Wind study", navAbout:"About and contact",

  heroEyebrow:"Scuola Italiana di Montevideo · 2EMS · IIIS · 3EMS · IVL · IVS",
  introSub:"Klo-01 probe · a stratospheric balloon to over 37 kilometres.",
  launchBtn:"Simulate the launch", scrollCue:"Scroll to ascend",
  countHead:"Launch in", cDays:"Days", cHours:"Hours", cMins:"Minutes", cSecs:"Seconds",
  cTentative:"Tentative date", cLate:"late September 2026", cUnit:"d",
  afterKicker:"Project COMETA",
  afterHead:"From the ground to the edge of space.",
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
  ix8t:"About and contact", ix8n:"Come and meet us!",

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
  srcUpdated:"<strong>Simulation run in:</strong> {date}",
  wDate:"June 2026",

  aboutKicker:"About", aboutTitle:"About us", aboutSub:"The people behind COMETA.",
  aboutBody:"We are students of 2EMS, IIIS, 3EMS, IVL and IVS at the Scuola Italiana di Montevideo.",
  contactHead:"Follow us", contactSub:"To see what we are making and follow the mission news.", igCta:"Follow on Instagram",

  footNav:"Pages", footFollow:"Follow us", footStatus:"Status: in progress", footRights:"Text and images CC BY 4.0",

  /* — The physics of the flight — */
  physKicker:"Phase 1 · How it works", physTitle:"The physics of the flight",
  physSub:"Why it rises, why it swells, why it bursts, why it gets so cold.",
  physScroll:"Scroll to ascend",
  ph1t:"On the ground — Archimedes' push",
  ph1p:"The balloon is pushed upwards by the air around it. Helium is about <strong>seven times less dense</strong> than air, and that difference has to lift everything else: the payload, the balloon itself, the parachute, the cords. The more helium you put in, the faster the balloon climbs.",
  ph2t:"Troposphere, 0–11 km — colder and colder",
  ph2p:"As it climbs, the air thins and the temperature drops by about <strong>6.5 °C per kilometre</strong>: at eleven kilometres we are at −56 °C.",
  ph3t:"Tropopause, 11–18 km — the coldest point",
  ph3p:"The temperature stops falling: the tropopause is the minimum, <strong>down to −60 °C</strong> outside. At 18 km the main GPS stops sending us a signal: the probe «goes missing».",
  ph4t:"Stratosphere, above 18 km — the air runs out",
  ph4p:"At thirty-one kilometres the pressure sensor reaches the end of its scale: 10 hPa, one <strong>hundredth</strong> of the pressure at ground level. The temperature starts rising again, because of the ozone that absorbs ultraviolet light.",
  ph5t:"The balloon inflates",
  ph5p:"Between the ground and 37.8 km the outside pressure falls by <strong>more than two hundred times</strong>, and the balloon's volume grows in the same proportion: the diameter goes from about 2 m to more than ten. The balloon leaves the ground the size of a car and arrives the size of a house.",
  ph6t:"The burst, 37.8 km",
  ph6p:"Latex has a stretching limit, and at some point it reaches it. For our balloon, filled as planned, the project calculation puts the burst at <strong>37.8 kilometres</strong>. From that instant the probe begins to fall.",
  ph7t:"The descent",
  ph7p:"The parachute opens by itself, pulled open by the air. High up it slows the fall very little, because there is almost nothing to push against. The lower it gets, the more it brakes.",
  ph8t:"The recovery", ph8p:"Three hours in all, up and down. Then the probe is on the ground somewhere — about <strong>190 kilometres further east</strong> — and by then the GPS units have started sending us the position again. The search begins.",

  /* — Contact — */
  contactMailHead:"Write to us", contactMailSub:"For information, collaborations, proposals.",
  mailCta:"Send us an email", tiktokCta:"Follow us on TikTok", footContact:"Contact",
  classesNote:"Five classes from the two systems that coexist in the school, the Italian one and the Uruguayan one.",

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
  lClassIntro:"There are three categories. <strong>Light</strong>: combined payload under 4 kg. <strong>Medium</strong>: 4 to 6 kg, spread over two or more packages. <strong>Heavy</strong>: 6 kg or more. But mass does not decide on its own — three conditions trigger the «heavy» category at any weight, and they are the last three rows of the table. Meeting any one of them is enough.",
  thCriterion:"Criterion", thThreshold:"To stay «light»", thOurs:"Klo-01",
  lc1:"Combined payload mass", lc1t:"under 4 kg",
  lc2:"Mass of the heaviest package", lc2t:"under 3 kg",
  lc3:"Packages of 2 kg or more with density above 13 g/cm²", lc3t:"none",
  lc4:"Force needed to separate payload from balloon", lc4t:"under 230 N", lc4v:"below threshold", lc3v:"1.3 kg · ≈ 3 g/cm²",
  lClassOut:"Four criteria, inside on all four. The Klo-01 probe is a <strong>«light»</strong> balloon: it weighs a third of the 4 kg threshold, it is a single package well under 3 kg, its density is four times below the limit, and the cord breaks before 230 N. That last one is the least intuitive and worth explaining: 230 N is roughly 23 kilograms of force, and a stronger cord would make the probe «heavy» even at one and a half kilos. Ours gives way below that threshold, and that is a design decision, not an accident.",

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

  /* — Mission: measurements, decisions, limits — */
  msKicker:"What we measure", msHead:"Ten sensors and their limits",
  msIntro:"Every sensor has a range of validity, and knowing it is what allows you, when analysing the data, to tell a measurement from a number. Going up and coming down, the probe crosses the same altitudes twice: every quantity becomes a vertical profile, and that is what studying the atmosphere with a balloon consists of.",
  thVar:"Quantity", thSens:"Instrument", thValid:"Valid up to",
  mv1:"Altitude, speed, trajectory", mv1v:"whole flight",
  mv2:"Pressure",
  mv3:"Air temperature", mv3v:"whole flight",
  mv4:"Internal temperatures", mv4v:"whole flight",
  mv5:"Relative humidity",
  mv6:"Carbon dioxide",
  mv7:"Particulate matter", mv7v:"4–5 km",
  mv8:"Ionising radiation", mv8s:"Geiger tube", mv8v:"whole flight",
  mv9:"Ultraviolet", mv9v:"whole flight",
  mv10:"Attitude, rotation and burst", mv10v:"whole flight",
  msNotKicker:"What we do not measure",
  msNot1:"<strong>Ozone and nitrogen oxides.</strong> The sensors available at this price are calibrated for air at sea level; at stratospheric pressures their response cannot be interpreted, and there is no practical way to calibrate them for those conditions. We would have obtained numbers, not measurements.",
  msCamKicker:"The footage and the recovery",
  msCam1:"The StratoFlights <strong>Space Cam</strong> is mounted horizontally and films for the whole flight. Its position was constrained: we needed a clear view, with no fins or probes in frame, and that fixed the wall. As a result the particulate sensor moved to the front wall, so as not to thin the same side of the box twice.",
  msCam2:"Two independent devices are there to find it again: the <strong>STRATOfinder 4G</strong>, which transmits its position wherever there is mobile coverage, and a <strong>SPOT Trace</strong>, which uses satellites and works where the network does not reach. Neither can report its position for the whole flight.",

  msFwKicker:"The board we program",
  msFw1:"The computer is a <strong>Teensy 4.1</strong>, and we write the program that runs on it: it reads the sensors, polls each one at its own rate, and writes everything to a microSD card. Alongside it, a completely separate second logger — a <strong>Feather M0 Adalogger</strong> with its own GPS, its own batteries and its own memory — records altitude and trajectory while sharing nothing with the first.",
  msEngKicker:"Five design decisions",
  msE1t:"Two thermometers instead of one",
  msE1:"There are two schools of thought on measuring air temperature: a bare element in free air, as classic radiosondes use, or a shielded element inside a duct. The first follows rapid changes more faithfully but catches the sun; the second is protected but slower. Rather than choose, we fit <strong>both</strong> and compare the two curves. The difference between them measures the solar heating error directly — with our own data, rather than by argument.",
  msE2t:"A 90° bend to keep the ice off",
  msE2:"The duct holding the second thermometer has an elbow. It is not there to drain water: it is there to <strong>separate droplets</strong>. Crossing cloud, the air turns the corner, but supercooled droplets have too much inertia to follow and strike the outer wall of the bend instead. Downstream the sensor receives cleaned air and does not ice up. It is the same principle as an aircraft's pitot tube.",
  msE3t:"A PTFE window, not quartz",
  msE3:"Polystyrene is opaque to ultraviolet: without an opening the sensor would read nothing. Quartz would be the obvious choice, but PTFE does two things better: it <strong>diffuses</strong> the light, which matters a great deal on a probe that spins, and it conducts about six times less heat, which matters a great deal in a box that has to stay warm.",
  msE4t:"Four hundred volts, kept away from the computer",
  msE4:"The Geiger tube runs at about 400 volts. Between its circuit and the computer pin that counts the pulses we placed an <strong>optoisolator</strong>: the signal crosses as light rather than as current, and the two sides stay electrically separate.",
  msE5t:"The centre of mass on the axis",
  msE5:"The heavy masses — battery pack and power bank — sit on the lowest deck, and every component's position was calculated so that the centre of mass falls on the <strong>suspension axis</strong>. The residual offset is 3 millimetres on 780 grams, which hanging three metres below the parachute gives a static tilt of just 0.74 degrees. A probe that hangs crooked films crooked and measures crooked.",
  msWipTag:"Work in progress",
  msWip:"The component list is <strong>not final</strong>. The project is still under way, and it will change both before the ground tests and after them.",
}
};
