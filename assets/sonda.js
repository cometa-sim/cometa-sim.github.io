/* ============================================================
   COMETA — modello tridimensionale della sonda Klo-01

   DATI: modificare l'elenco PARTS qui sotto per aggiornare il
   modello. x,y = pianta in mm dall'angolo interno · z = quota
   dal fondo. Nomi e note esistono in tre lingue (it/es/en).

   Il modulo si inizializza solo quando si apre la pagina della
   sonda: Three.js viene caricato in quel momento, non prima.
   ============================================================ */

window.COMETA_SONDA = (function(){
"use strict";

/* ---------- Geometria della scatola ---------- */
const INT = {w:160, d:160, h:130}, WALL = 30;

/* Colori delle categorie: gli stessi di assets/cometa.css */
const PAL = {
  atmo:"#5FE3FF", pos:"#6E9BFF", rad:"#A98CFF",
  alim:"#FFB84D", kit:"#8FA6BC", eps:"#E6E4DC"
};

/* ------------------------------------------------------------------
   FOTOGRAFIE REALI (facoltative)
   Mettere le immagini in "assets/img/" e indicarle qui: la chiave è
   il numero del componente. Scatto dall'alto, sfondo bianco, luce
   diffusa, ritaglio esatto sul contorno. Vanno sulla faccia superiore.
------------------------------------------------------------------ */
const TEX = {
  // 9:  "assets/img/teensy41.jpg",
  // 5:  "assets/img/scd30.jpg",
};
/* Fondale della modalità Volo: una foto vera scattata in quota. */
const SKYIMG = ""; // es. "assets/img/stratosfera.jpg"

/* ---------- I 26 componenti ---------- */
const PARTS = [
{id:1, deck:1, cat:"rad", x:31, y:28, z:0, w:126, d:30, h:12, g:40,
 n:{it:"GGreg20_V3 + tubo J305", es:"GGreg20_V3 + tubo J305", en:"GGreg20_V3 + J305 tube"},
 note:{
  it:"400 V a bordo: la sorgente di guasto più pericolosa. Optoaccoppiatore sulla linea impulsi e polyfuse sull'alimentazione. Tubo di vetro: imbottire su tutta la lunghezza.",
  es:"400 V a bordo: la fuente de falla más peligrosa. Optoacoplador en la línea de pulsos y polyfuse en la alimentación. Tubo de vidrio: acolcharlo en todo su largo.",
  en:"400 V aboard: the most dangerous failure source. Optocoupler on the pulse line and a polyfuse on the supply. Glass tube: pad it along its whole length."}},
{id:2, deck:1, cat:"kit", x:48, y:58, z:0, w:103, d:41, h:28, g:126,
 n:{it:"Power bank Space Cam", es:"Power bank Space Cam", en:"Space Cam power bank"},
 note:{
  it:"Misure reali. Cella 21700 Li-ion da 4500 mAh, 16,6 Wh. StratoFlights la fa volare in questa scatola: è un dato utile sulla temperatura interna.",
  es:"Medidas reales. Celda 21700 Li-ion de 4500 mAh, 16,6 Wh. StratoFlights la hace volar en esta caja: es un dato útil sobre la temperatura interna.",
  en:"Real measurements. 21700 Li-ion cell, 4500 mAh, 16.6 Wh. StratoFlights flies it in this box: a useful data point on internal temperature."}},
{id:3, deck:1, cat:"atmo", x:-30, y:55, z:0, w:38, d:50, h:21, g:45,
 n:{it:"PMS5003 particolato", es:"PMS5003 material particulado", en:"PMS5003 particulate"},
 note:{
  it:"INCASSATO NELLA PARETE −X, la stessa della staffa ma a quota diversa: la staffa esce a z≈80, il PMS sta sul ripiano 1 (z 0-21). Faccia a filo esterno, perimetro sigillato con silicone NEUTRO, bocche sulla faccia stretta 50 × 21 inclinate in basso con visiera anti-ghiaccio. Ruotato 90°. Le pareti ±Y restano libere per le alette centrate, la +X per la camera. Sporge 8 mm all'interno, da fasciare con un collare di XPS. Ponte termico ~0,3 W.",
  es:"EMPOTRADO EN LA PARED −X, la misma que la ménsula pero a otra altura: la ménsula sale a z≈80, el PMS va en el estante 1 (z 0-21). Cara a ras del exterior, perímetro sellado con silicona NEUTRA, bocas en la cara angosta de 50 × 21 inclinadas hacia abajo con visera antihielo. Rotado 90°. Las paredes ±Y quedan libres para las aletas centradas, y la +X para la cámara. Sobresale 8 mm hacia adentro: envolverlo con un collar de XPS. Puente térmico ~0,3 W.",
  en:"RECESSED INTO THE −X WALL, the same one as the bracket but at a different height: the bracket exits at z≈80, the PMS sits on deck 1 (z 0-21). Face flush with the outside, perimeter sealed with NEUTRAL silicone, inlets on the narrow 50 × 21 face angled downwards with an anti-icing visor. Rotated 90°. The ±Y walls stay free for the centred fins, and +X for the camera. It protrudes 8 mm inwards and must be wrapped in an XPS collar. Thermal bridge ~0.3 W."}},
{id:4, deck:1, cat:"alim", x:85, y:102, z:0, w:60, d:48, h:18, g:90,
 n:{it:"Pacco 6 × AA litio L91", es:"Pack 6 × AA litio L91", en:"6 × AA lithium pack L91"},
 note:{
  it:"Massa pesante in basso. Fili saldati ai contatti e pile compresse con nastro: un micro-spostamento all'impatto riavvia il sistema.",
  es:"Masa pesada abajo. Cables soldados a los contactos y pilas comprimidas con cinta: un micro-desplazamiento en el impacto reinicia el sistema.",
  en:"Heavy mass down low. Wires soldered to the contacts and cells compressed with tape: a micro-shift on impact reboots the system."}},
{id:5, deck:2, cat:"alim", x:94, y:96, z:40, w:55, d:32, h:18, g:45,
 n:{it:"Pacco 3 × AA (livello 2)", es:"Pack 3 × AA (nivel 2)", en:"3 × AA pack (level 2)"},
 note:{
  it:"Alimenta SOLO l'Adalogger. Nessun contatto elettrico con il pacco principale: è ciò che rende indipendente il livello 2.",
  es:"Alimenta SOLO al Adalogger. Ningún contacto eléctrico con el pack principal: es lo que hace independiente al nivel 2.",
  en:"Powers ONLY the Adalogger. No electrical contact with the main pack: that is what makes level 2 independent."}},
{id:6, deck:1, cat:"atmo", x:110, y:3, z:0, w:35, d:23, h:7, g:12,
 n:{it:"SCD30 CO₂", es:"SCD30 CO₂", en:"SCD30 CO₂"},
 note:{
  it:"L'aria interna si rinnova dalle sole fughe naturali della scatola: il profilo di CO₂ risulta 'spalmato' su qualche centinaio di metri, limite dichiarato. Tenerlo FUORI dal flusso della ventola del PMS5003 (turbolenza e riscaldamento locale) e lontano dalle fonti di calore. Il DS18B20 n. 30 gli sta a contatto: offset di autoriscaldamento e temperatura del gas per la correzione di densità dell'NDIR.",
  es:"El aire interior se renueva solo por las fugas naturales de la caja: el perfil de CO₂ queda repartido sobre algunos cientos de metros, límite declarado. Mantenerlo FUERA del flujo del ventilador del PMS5003 (turbulencia y calentamiento local) y lejos de las fuentes de calor. El DS18B20 n.º 30 está en contacto con él: aporta el offset de autocalentamiento y la temperatura del gas para la corrección de densidad del NDIR.",
  en:"The air inside is renewed only through the natural leaks of the box: the CO₂ profile ends up smeared over a few hundred metres, a declared limitation. Keep it OUT of the PMS5003 fan flow (turbulence and local heating) and away from heat sources. DS18B20 no. 30 sits in contact with it: self-heating offset and gas temperature for the NDIR density correction."}},
{id:7, deck:2, cat:"kit", x:27, y:33, z:40, w:75, d:45, h:21, g:96,
 n:{it:"GPS STRATOfinder 4G", es:"GPS STRATOfinder 4G", en:"STRATOfinder 4G GPS"},
 note:{
  it:"Misure reali. Livello 1: batteria propria, nessun cavo verso il resto.",
  es:"Medidas reales. Nivel 1: batería propia, ningún cable hacia el resto.",
  en:"Real measurements. Level 1: its own battery, no cable to anything else."}},
{id:8, deck:2, cat:"kit", x:169, y:51, z:40, w:21, d:59, h:41, g:69,
 n:{it:"Space Cam", es:"Space Cam", en:"Space Cam"},
 note:{
  it:"INCASSATA NELLA PARETE +X, A FILO DELLA SUPERFICIE ESTERNA: la tasca si scava dall'esterno, così batteria e microSD restano accessibili da fuori e la registrazione si avvia all'ultimo momento senza aprire la sonda. Restano ~9 mm di polistirolo fra il dorso della camera e l'interno: lasciarli SENZA ovatta, perché il calore della camera entri nella scatola. Fissaggio removibile, perimetro nastrato prima del volo. Guardando in +X, le alette su ±Y restano a 90° dall'asse ottico, fuori dal campo anche di un grandangolare: possono restare CENTRATE e simmetriche. Il PMS sta sulla parete opposta (−X): due tasche grandi nella stessa parete la indebolirebbero.",
  es:"EMPOTRADA EN LA PARED +X, AL RAS DE LA SUPERFICIE EXTERIOR: el hueco se cava desde afuera, así la batería y la microSD quedan accesibles desde fuera y la grabación se inicia en el último momento sin abrir la sonda. Quedan ~9 mm de poliestireno entre el dorso de la cámara y el interior: dejarlos SIN guata, para que el calor de la cámara entre en la caja. Fijación removible, perímetro encintado antes del vuelo. Mirando hacia +X, las aletas sobre ±Y quedan a 90° del eje óptico, fuera del campo incluso de un gran angular: pueden quedar CENTRADAS y simétricas. El PMS está en la pared opuesta (−X): dos huecos grandes en la misma pared la debilitarían.",
  en:"RECESSED INTO THE +X WALL, FLUSH WITH THE OUTER SURFACE: the pocket is cut from the outside, so battery and microSD stay reachable from outside and recording starts at the last moment without opening the probe. About 9 mm of polystyrene is left between the camera's back and the interior: leave it WITHOUT wadding, so the camera's heat goes into the box. Removable mounting, perimeter taped before flight. Looking along +X, the fins on ±Y stay at 90° from the optical axis, outside the field even of a wide-angle lens: they can remain CENTRED and symmetrical. The PMS is on the opposite wall (−X): two large pockets in the same wall would weaken it."}},
{id:9, deck:2, cat:"pos", x:35, y:15, z:40, w:61, d:18, h:5, g:10,
 n:{it:"Teensy 4.1", es:"Teensy 4.1", en:"Teensy 4.1"},
 note:{
  it:"Controllore principale, microSD integrata. Clock ridotto a 150-300 MHz per limitare la dissipazione: a bassa pressione il calore fatica a uscire.",
  es:"Controlador principal, microSD integrada. Reloj bajado a 150-300 MHz para limitar la disipación: a baja presión al calor le cuesta salir.",
  en:"Main controller, integrated microSD. Clock reduced to 150-300 MHz to limit dissipation: at low pressure heat struggles to escape."}},
{id:10, deck:2, cat:"pos", x:104, y:73, z:40, w:51, d:23, h:8, g:12,
 n:{it:"Feather M0 Adalogger", es:"Feather M0 Adalogger", en:"Feather M0 Adalogger"},
 note:{
  it:"LIVELLO 2. Pile, microSD e GPS propri. Registra quota e traiettoria anche se il Teensy si blocca del tutto.",
  es:"NIVEL 2. Pilas, microSD y GPS propios. Registra altura y trayectoria incluso si el Teensy se cuelga por completo.",
  en:"LEVEL 2. Its own cells, microSD and GPS. Records altitude and trajectory even if the Teensy locks up completely."}},
{id:11, deck:2, cat:"atmo", x:109, y:135, z:40, w:25, d:18, h:3, g:4,
 n:{it:"MAX31865 + PT1000", es:"MAX31865 + PT1000", en:"MAX31865 + PT1000"},
 note:{
  it:"SPI, non I²C: sta fuori dalla catena Qwiic ed è per questo l'unico pezzo da saldare. L'elemento sensibile è sul braccetto esterno.",
  es:"SPI, no I²C: queda fuera de la cadena Qwiic y por eso es la única pieza a soldar. El elemento sensible va en el brazo exterior.",
  en:"SPI, not I²C: it sits outside the Qwiic chain and is therefore the only part to be soldered. The sensing element is on the external arm."}},
{id:12, deck:2, cat:"alim", x:6, y:95, z:40, w:81, d:51, h:14, g:35,
 n:{it:"Perfboard: optoacc. + polyfuse + MOSFET", es:"Perfboard: optoacop. + polyfuse + MOSFET", en:"Perfboard: optocoupler + polyfuse + MOSFET"},
 note:{
  it:"Isolamento guasti concentrato su una sola scheda: optoaccoppiatore del Geiger, polyfuse, driver MOSFET e morsettiere.",
  es:"Aislamiento de fallas concentrado en una sola placa: optoacoplador del Geiger, polyfuse, driver MOSFET y borneras.",
  en:"Fault isolation concentrated on a single board: the Geiger optocoupler, polyfuse, MOSFET driver and terminal blocks."}},
{id:13, deck:3, cat:"kit", x:87, y:62, z:80, w:68, d:51, h:21, g:88,
 n:{it:"SPOT Trace", es:"SPOT Trace", en:"SPOT Trace"},
 note:{
  it:"Misure reali, 87,9 g. Trasmette verso l'alto: niente sopra di lui. Copre la salita fino al limite COCOM.",
  es:"Medidas reales, 87,9 g. Transmite hacia arriba: nada por encima. Cubre el ascenso hasta el límite COCOM.",
  en:"Real measurements, 87.9 g. Transmits upwards: nothing above it. Covers the ascent up to the COCOM limit."}},
{id:14, deck:3, cat:"pos", x:17, y:3, z:80, w:41, d:41, h:6, g:8,
 n:{it:"GPS SAM-M8Q (principale)", es:"GPS SAM-M8Q (principal)", en:"SAM-M8Q GPS (main)"},
 note:{
  it:"Antenna integrata verso il cielo. Il polistirolo è trasparente alle radiofrequenze: non serve forare. Modo Airborne <1g salvato in flash.",
  es:"Antena integrada hacia el cielo. El poliestireno es transparente a las radiofrecuencias: no hace falta perforar. Modo Airborne <1g guardado en flash.",
  en:"Integrated antenna facing the sky. Polystyrene is transparent to radio frequencies: no need to drill. Airborne <1g mode saved to flash."}},
{id:15, deck:3, cat:"pos", x:116, y:18, z:80, w:41, d:41, h:6, g:8,
 n:{it:"GPS SAM-M8Q (livello 2)", es:"GPS SAM-M8Q (nivel 2)", en:"SAM-M8Q GPS (level 2)"},
 note:{
  it:"MONTATO, non di scorta: è il GPS dell'Adalogger. Quota e istante di scoppio registrati su due catene che non condividono nulla.",
  es:"MONTADO, no de repuesto: es el GPS del Adalogger. Altura e instante del reventado registrados en dos cadenas que no comparten nada.",
  en:"FITTED, not a spare: it is the Adalogger's GPS. Altitude and burst instant recorded on two chains that share nothing."}},
{id:16, deck:3, cat:"atmo", x:61, y:3, z:80, w:25, d:17, h:3, g:3,
 n:{it:"MS8607 p/T/RH", es:"MS8607 p/T/HR", en:"MS8607 p/T/RH"},
 note:{
  it:"Fondo scala 10 hPa: dato valido fino a ~31 km. Sopra, l'altimetria è solo GPS.",
  es:"Fondo de escala 10 hPa: dato válido hasta ~31 km. Más arriba, la altimetría es solo GPS.",
  en:"Full scale 10 hPa: valid up to ~31 km. Above that, altimetry is GPS only."}},
{id:17, deck:3, cat:"rad", x:119, y:3, z:80, w:25, d:13, h:3, g:3,
 n:{it:"LTR390 UV", es:"LTR390 UV", en:"LTR390 UV"},
 note:{
  it:"Sotto la finestra in PTFE sul coperchio: il PTFE diffonde la luce e riduce la dipendenza dall'angolo su una sonda che ruota; policarbonato e acrilico assorbono l'UV. Banda singola UVA: NON consente di ricavare l'ozono.",
  es:"Bajo la ventana de PTFE en la tapa: el PTFE difunde la luz y reduce la dependencia del ángulo en una sonda que rota; el policarbonato y el acrílico absorben el UV. Banda única UVA: NO permite deducir el ozono.",
  en:"Under the PTFE window on the lid: PTFE diffuses the light and reduces the angular dependence on a rotating probe; polycarbonate and acrylic absorb UV. Single UVA band: it does NOT allow ozone to be derived."}},
{id:18, deck:3, cat:"pos", x:87, y:42, z:80, w:26, d:18, h:5, g:3,
 n:{it:"ICM-20948 IMU", es:"ICM-20948 IMU", en:"ICM-20948 IMU"},
 note:{
  it:"Il ripiano più lontano dai pacchi pile e dai cavi di potenza: il magnetometro va calibrato hard/soft iron a sonda chiusa.",
  es:"El estante más lejano de los packs de pilas y de los cables de potencia: el magnetómetro se calibra hard/soft iron con la sonda cerrada.",
  en:"The deck farthest from the battery packs and power cables: the magnetometer must be hard/soft-iron calibrated with the probe closed."}},
{id:20, deck:3, cat:"alim", x:75, y:22, z:80, w:18, d:18, h:8, g:5,
 n:{it:"MPM3610 buck 5 V", es:"MPM3610 buck 5 V", en:"MPM3610 buck 5 V"},
 note:{
  it:"Da 9-10,8 V a 5 V. Senza questo il Teensy, che accetta al massimo 5,5 V, si distrugge.",
  es:"De 9-10,8 V a 5 V. Sin esto el Teensy, que acepta 5,5 V como máximo, se destruye.",
  en:"From 9-10.8 V down to 5 V. Without it the Teensy, which takes 5.5 V maximum, is destroyed."}},
{id:21, deck:3, cat:"atmo", x:-159, y:94, z:72, w:18, d:12, h:4, g:2,
 n:{it:"SHT45 + PTFE (braccetto esterno)", es:"SHT45 + PTFE (brazo exterior)", en:"SHT45 + PTFE (external arm)"},
 note:{
  it:"FUORI DALLA SONDA, accanto al PT1000: va l'INTERA scheda sul braccetto — il chip non si separa dal breakout, e l'I²C corre senza problemi nei 15 cm di cavo. L'umidità dentro una scatola tiepida non ha nulla a che vedere con quella dell'aria esterna. La membrana in PTFE protegge da polvere e condensa. Serve anche a marcare i minuti in cui si attraversa una nube e il PT1000 è impaccato di ghiaccio.",
  es:"FUERA DE LA SONDA, junto al PT1000: va la PLACA ENTERA en el brazo — el chip no se separa del breakout, y el I²C funciona sin problemas en los 15 cm de cable. La humedad dentro de una caja tibia no tiene nada que ver con la del aire exterior. La membrana de PTFE protege del polvo y de la condensación. Sirve además para marcar los minutos en que se atraviesa una nube y el PT1000 queda cargado de hielo.",
  en:"OUTSIDE THE PROBE, next to the PT1000: the WHOLE board goes on the arm — the chip is not separated from the breakout, and I²C runs without trouble over the 15 cm of cable. Humidity inside a warm box has nothing to do with that of the outside air. The PTFE membrane protects against dust and condensation. It also marks the minutes when a cloud is crossed and the PT1000 is caked with ice."}},
{id:23, deck:2, cat:"atmo", x:112, y:27, z:40, w:25, d:18, h:3, g:4,
 n:{it:"2° MAX31865 (PT1000 nel tubo)", es:"2.º MAX31865 (PT1000 en el tubo)", en:"2nd MAX31865 (PT1000 in the tube)"},
 note:{
  it:"Legge un secondo PT1000 alloggiato nel tubo esterno, in parallelo a quello esposto sul braccetto. Le due curve dicono con i dati quanto pesa la termalizzazione dell'aria nel tubo.",
  es:"Lee un segundo PT1000 alojado en el tubo externo, en paralelo al expuesto en el brazo. Las dos curvas dicen con los datos cuánto pesa la termalización del aire en el tubo.",
  en:"It reads a second PT1000 housed in the external tube, in parallel with the one exposed on the arm. The two curves show, from the data, how much the thermalisation of the air inside the tube matters."}},
{id:24, deck:3, cat:"atmo", x:-175, y:95, z:76, w:6, d:10, h:8, g:19,
 n:{it:"Sonda PT1000 (braccetto esterno)", es:"Sonda PT1000 (brazo exterior)", en:"PT1000 probe (external arm)"},
 note:{
  it:"In punta al braccetto, in aria libera e senza schermatura completa: è il TERMINE DI PARAGONE del tubo aspirato. Da verniciare di BIANCO OPACO, non lasciare l'acciaio lucido: il metallo riflette bene il sole ma irradia male, mentre il bianco opaco riflette e irradia. Il piattino ripara solo dall'alto, perché la sonda ruota e il sole arriva da ogni azimut: il bias residuo si dichiara e il tubo dice quanto vale.",
  es:"En la punta del brazo, en aire libre y sin blindaje completo: es el TÉRMINO DE COMPARACIÓN del tubo. Pintarlo de BLANCO MATE, no dejar el acero pulido: el metal refleja bien el sol pero irradia mal, mientras que el blanco mate refleja e irradia. El platillo protege solo desde arriba, porque la sonda rota y el sol llega desde cualquier azimut: el sesgo residual se declara y el tubo dice cuánto vale.",
  en:"At the tip of the arm, in free air and without full shielding: it is the REFERENCE against which the aspirated tube is judged. Paint it MATT WHITE, do not leave the steel polished: metal reflects the sun well but radiates poorly, whereas matt white both reflects and radiates. The small plate shields only from above, because the probe rotates and the sun arrives from every azimuth: the residual bias is declared, and the tube tells you how large it is."}},
{id:26, deck:3, cat:"atmo", x:-88, y:51, z:41, w:10, d:8, h:8, g:19,
 n:{it:"PT1000 nel tubo (confronto)", es:"PT1000 en el tubo (comparación)", en:"PT1000 in the tube (comparison)"},
 note:{
  it:"Condotto INTERAMENTE ESTERNO con CURVA A 90°, orientato verso il vento relativo della salita: PRESA RIVOLTA IN ALTO, gomito in basso con foro di scarico da 2 mm nel punto più basso, sensore nel tratto ORIZZONTALE a valle del gomito, uscita laterale inclinata in basso. In salita l'aria investe la sonda dall'alto: entra dalla presa, svolta il gomito; le goccioline sopraffuse (St≈0,5 a 20 µm) non svoltano, impattano e drenano. In discesa il flusso si inverte e la separazione non opera: dato dichiarato non protetto, come per il PMS. Solo i fili entrano nella sonda, da un foro da 3 mm sigillato: nessun ponte termico.",
  es:"Conducto ÍNTEGRAMENTE EXTERIOR con CURVA DE 90°, orientado hacia el viento relativo del ascenso: TOMA HACIA ARRIBA, codo abajo con orificio de drenaje de 2 mm en el punto más bajo, sensor en el tramo HORIZONTAL aguas abajo del codo, salida lateral inclinada hacia abajo. En el ascenso el aire golpea la sonda desde arriba: entra por la toma y dobla en el codo; las gotitas sobreenfriadas (St≈0,5 a 20 µm) no doblan, impactan y drenan. En el descenso el flujo se invierte y la separación no opera: dato declarado como no protegido, igual que en el PMS. Solo los cables entran en la sonda, por un orificio de 3 mm sellado: ningún puente térmico.",
  en:"Duct ENTIRELY EXTERNAL with a 90° BEND, facing the relative wind of the ascent: INLET POINTING UP, elbow below with a 2 mm drain hole at the lowest point, sensor in the HORIZONTAL run downstream of the elbow, side outlet angled downwards. On the way up the air hits the probe from above: it enters the inlet and turns at the elbow; supercooled droplets (St≈0.5 at 20 µm) do not turn, they impact and drain. On the way down the flow reverses and the separation does not work: the data is declared unprotected, as for the PMS. Only the wires enter the probe, through a sealed 3 mm hole: no thermal bridge."}},
{id:27, deck:2, cat:"atmo", x:5, y:29, z:58, w:10, d:4, h:6, g:1,
 n:{it:"DS18B20 — cassa", es:"DS18B20 — caja", en:"DS18B20 — shell"},
 note:{
  it:"Incollato alla faccia interna della parete: misura la temperatura della cassa. I quattro DS18B20 condividono un solo pin (bus 1-Wire, pull-up 4,7 kΩ verso 3,3 V).",
  es:"Pegado a la cara interna de la pared: mide la temperatura de la caja. Los cuatro DS18B20 comparten un solo pin (bus 1-Wire, pull-up de 4,7 kΩ a 3,3 V).",
  en:"Glued to the inner face of the wall: it measures the temperature of the shell. The four DS18B20 share a single pin (1-Wire bus, 4.7 kΩ pull-up to 3.3 V)."}},
{id:28, deck:1, cat:"atmo", x:115, y:115, z:18, w:10, d:4, h:6, g:1,
 n:{it:"DS18B20 — pacco pile", es:"DS18B20 — paquete de pilas", en:"DS18B20 — battery pack"},
 note:{
  it:"Sul pacco principale: la capacità delle L91 dipende dalla temperatura, ed è questo dato — con la prova in congelatore — a dire se un riscaldamento sarà necessario.",
  es:"Sobre el paquete principal: la capacidad de las L91 depende de la temperatura, y es este dato — junto con la prueba en el congelador — el que dice si hará falta calefacción.",
  en:"On the main pack: the capacity of the L91 cells depends on temperature, and it is this measurement — together with the freezer test — that tells whether any heating will be needed."}},
{id:29, deck:2, cat:"atmo", x:75, y:82, z:62, w:10, d:4, h:6, g:1,
 n:{it:"DS18B20 — centro del volume", es:"DS18B20 — centro del volumen", en:"DS18B20 — centre of the volume"},
 note:{
  it:"Sospeso a metà altezza, lontano da ogni componente: misura l'ARIA interna, non una scheda. Con uno scarto di ~40 K fra modello stazionario e dato di volo, il profilo termico interno è fra le misure più interessanti del volo.",
  es:"Suspendido a media altura, lejos de todo componente: mide el AIRE interior, no una placa. Con una diferencia de ~40 K entre el modelo estacionario y el dato de vuelo, el perfil térmico interno está entre las medidas más interesantes del vuelo.",
  en:"Suspended at mid-height, away from every component: it measures the internal AIR, not a board. With a spread of about 40 K between the steady-state model and the flight data, the internal thermal profile is among the most interesting measurements of the flight."}},
{id:30, deck:1, cat:"atmo", x:122, y:27, z:7, w:10, d:4, h:6, g:1,
 n:{it:"DS18B20 — SCD30", es:"DS18B20 — SCD30", en:"DS18B20 — SCD30"},
 note:{
  it:"A contatto con l'SCD30: fornisce l'offset di autoriscaldamento e la temperatura del gas per la correzione di densità dell'NDIR — le ppm richiedono T e p del gas effettivamente misurato.",
  es:"En contacto con el SCD30: aporta el offset de autocalentamiento y la temperatura del gas para la corrección de densidad del NDIR — las ppm requieren la T y la p del gas efectivamente medido.",
  en:"In contact with the SCD30: it supplies the self-heating offset and the gas temperature for the NDIR density correction — ppm figures require the T and p of the gas actually measured."}}
];

const DECKS = [{n:1, key:"deck1", z:0,  plate:null},
               {n:2, key:"deck2", z:40, plate:37},
               {n:3, key:"deck3", z:80, plate:77}];
const CATS  = [["atmo","catAtmo"],["pos","catPos"],["rad","catRad"],["alim","catAlim"],["kit","catKit"]];
const FLOOR = (INT.w * INT.d) / 100;      /* cm² utili di un ripiano */
const EXT_IDS = [21,24,26];               /* componenti fuori dalla scatola */

/* ---------- Stato ---------- */
const S = 0.01;                            /* mm → unità di scena */
const state = {mode:"banco", explode:0, decks:[true,true,true], pins:true, sel:null, hover:null};
let lang = "it", ready = false, active = false, failed = false;
let stage, cv, renderer, scene, cam, root, ray, ndc;
let panels = [], plates = [], groups = [], wings, vano, holes, lidKit, extHW, riser = null;
let az = -0.72, pol = 1.02, dist = 4.6, drag = false, lx = 0, ly = 0, pinch = 0, moved = false, lastTouch = 0;
const tgt = {x:0, y:0.62, z:0};
const pinEls = {};
let reduce = false;

const T = k => (window.I18N[lang] && window.I18N[lang][k]) || k;
const el = id => document.getElementById(id);

/* ---------- Caricamento differito di Three.js ----------
   Copia locale in assets/vendor/: il sito non dipende da una CDN.
   Se il file manca, si ripiega sulla CDN.                        */
const THREE_LOCAL = ["assets/vendor/three.min.js", "assets/vendor/three_min.js"];
const THREE_CDN   = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

function script(src){
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error(src));
    document.head.appendChild(s);
  });
}
function loadThree(){
  if(window.THREE) return Promise.resolve();
  return THREE_LOCAL.reduce(
    (p, url) => p.catch(() => script(url)),
    Promise.reject()
  ).catch(() => script(THREE_CDN));
}

/* ---------- Costruzione della scena ---------- */
function V(x,y,z){ return new THREE.Vector3((x - INT.w/2)*S, z*S, (y - INT.d/2)*S); }

function buildScene(){
  reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  cv = renderer.domElement;
  stage.appendChild(cv);
  root = new THREE.Group(); scene.add(root);

  const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(2.2, 3.4, 2.0); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd4e8, 0.55); rim.position.set(-2.4, 0.8, -1.8); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3a4a, 0.65));

  /* Guscio di polistirolo */
  const epsBase = new THREE.MeshStandardMaterial({color:PAL.eps, roughness:.95, metalness:0,
    transparent:true, opacity:.45, side:THREE.DoubleSide});
  function panel(w,h,d,pos,tag){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w*S, h*S, d*S), epsBase.clone());
    m.position.copy(pos); m.userData.tag = tag; m.userData.y0 = pos.y; root.add(m); panels.push(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),
      new THREE.LineBasicMaterial({color:0x8e9aa6, transparent:true, opacity:.55}));
    e.position.copy(pos); e.userData.tag = tag; e.userData.y0 = pos.y; root.add(e); panels.push(e);
  }
  const OW = INT.w + 2*WALL, OD = INT.d + 2*WALL;
  panel(OW, WALL, OD, V(INT.w/2, INT.d/2, -WALL/2), "base");
  panel(OW, WALL, OD, V(INT.w/2, INT.d/2, INT.h + WALL/2), "lid");
  panel(WALL, INT.h, OD, V(-WALL/2, INT.d/2, INT.h/2), "wx-");
  panel(WALL, INT.h, OD, V(INT.w + WALL/2, INT.d/2, INT.h/2), "wx+");
  panel(INT.w, INT.h, WALL, V(INT.w/2, -WALL/2, INT.h/2), "wy-");
  panel(INT.w, INT.h, WALL, V(INT.w/2, INT.d + WALL/2, INT.h/2), "wy+");

  /* Alette di stabilizzazione — centrate e simmetriche */
  const wingMat = new THREE.MeshStandardMaterial({color:PAL.eps, roughness:.95, transparent:true, opacity:.85, side:THREE.DoubleSide});
  wings = new THREE.Group();
  [-1,1].forEach(sg => {
    const XW = INT.w/2;
    const w = new THREE.Mesh(new THREE.BoxGeometry(8*S, 200*S, 250*S), wingMat);
    w.position.copy(V(XW, sg > 0 ? INT.d + WALL + 125 : -WALL - 125, INT.h/2)); wings.add(w);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(14*S, 30*S, 20*S), wingMat);
    rib.position.copy(V(XW, sg > 0 ? INT.d + WALL + 6 : -WALL - 6, INT.h/2)); wings.add(rib);
  });
  root.add(wings);

  /* Braccetto esterno */
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(3*S, 3*S, 150*S, 12),
    new THREE.MeshStandardMaterial({color:0x4a5560, roughness:.6}));
  rod.rotation.z = Math.PI/2; rod.position.copy(V(-WALL - 75, 100, INT.h*.62)); root.add(rod);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(14*S, 10*S, 10*S),
    new THREE.MeshStandardMaterial({color:0xF5F7F8, roughness:.92, metalness:.02}));
  tip.position.copy(V(-WALL - 150, 100, INT.h*.62)); root.add(tip);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(30*S, 2*S, 24*S),
    new THREE.MeshStandardMaterial({color:0xF5F7F8, metalness:.05, roughness:.9, side:THREE.DoubleSide}));
  shield.position.copy(V(-WALL - 140, 100, INT.h*.62 + 16)); root.add(shield);

  /* Struttura interna, coibentazione, finestra UV, aperture */
  vano = new THREE.Group(); holes = new THREE.Group(); lidKit = new THREE.Group(); extHW = new THREE.Group();
  const part = id => PARTS.find(q => q.id === id);
  (function(){
    const RODS = [[9,9],[151,9],[9,151],[151,151]];
    const steel = new THREE.MeshStandardMaterial({color:0xB8C2CC, metalness:.85, roughness:.3});
    const nylon = new THREE.MeshStandardMaterial({color:0x6E8092, roughness:.7});
    RODS.forEach(([rx,ry]) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(1.5*S, 1.5*S, 124*S, 10), steel);
      r.position.copy(V(rx, ry, 62)); vano.add(r);
      [20,60,100].forEach(zz => {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(3*S, 3*S, 26*S, 10), nylon);
        sp.position.copy(V(rx, ry, zz)); vano.add(sp);
      });
    });

    const xps = new THREE.MeshStandardMaterial({color:0xF0D9A8, roughness:.95, transparent:true, opacity:.4, side:THREE.DoubleSide});
    const wFloor = new THREE.Mesh(new THREE.BoxGeometry(150*S, 10*S, 150*S), xps);
    wFloor.position.copy(V(80, 80, -6)); vano.add(wFloor);
    const wLid = new THREE.Mesh(new THREE.BoxGeometry(150*S, 10*S, 150*S), xps);
    wLid.position.copy(V(80, 80, 136)); lidKit.add(wLid);

    /* Collare e bocche del PMS5003 */
    const pms = part(3);
    if(pms){
      const col = new THREE.Mesh(new THREE.BoxGeometry(12*S, (pms.h + 16)*S, (pms.d + 16)*S), xps);
      col.position.copy(V(pms.x + pms.w/2, pms.y + pms.d/2, pms.z + pms.h/2)); vano.add(col);
      const hm = new THREE.MeshStandardMaterial({color:0x1a2733, roughness:.8, side:THREE.DoubleSide});
      [pms.y + 12, pms.y + pms.d - 12].forEach(yy => {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(5*S, 5*S, 12*S, 14), hm);
        h.rotation.z = Math.PI/2; h.rotation.y = 0.35;
        h.position.copy(V(-WALL + 4, yy, pms.z + pms.h/2)); holes.add(h);
      });
      const vis = new THREE.Mesh(new THREE.BoxGeometry(3*S, 10*S, (pms.d + 10)*S),
        new THREE.MeshStandardMaterial({color:0xD8DDE2, metalness:.6, roughness:.4, side:THREE.DoubleSide}));
      vis.position.copy(V(-WALL - 3, pms.y + pms.d/2, pms.z + pms.h/2 + 15)); holes.add(vis);
    }

    /* Finestra UV in PTFE sul coperchio */
    const uv = part(17);
    if(uv){
      const bore = new THREE.Mesh(new THREE.CylinderGeometry(11*S, 11*S, WALL*S, 24),
        new THREE.MeshStandardMaterial({color:0x1a2733, transparent:true, opacity:.22, side:THREE.DoubleSide}));
      bore.position.copy(V(uv.x + uv.w/2, uv.y + uv.d/2, INT.h + WALL/2)); lidKit.add(bore);
      const memb = new THREE.Mesh(new THREE.CylinderGeometry(13*S, 13*S, 0.6*S, 28),
        new THREE.MeshStandardMaterial({color:0xF2F6F9, roughness:.55, transparent:true, opacity:.9,
          emissive:new THREE.Color(PAL.rad), emissiveIntensity:.2, side:THREE.DoubleSide}));
      memb.position.copy(V(uv.x + uv.w/2, uv.y + uv.d/2, INT.h + WALL + 0.5)); lidKit.add(memb);
      const rise = new THREE.Mesh(new THREE.BoxGeometry(uv.w*S, 26*S, uv.d*S), nylon);
      rise.position.copy(V(uv.x + uv.w/2, uv.y + uv.d/2, uv.z + uv.h + 13));
      rise.userData.y0 = rise.position.y; riser = rise; vano.add(rise);
    }

    /* Staffa esterna ancorata al blocco dei ripiani */
    const brk = new THREE.MeshStandardMaterial({color:0x8894A0, metalness:.5, roughness:.5});
    const plate = new THREE.Mesh(new THREE.BoxGeometry((WALL + 40)*S, 4*S, 50*S), brk);
    plate.position.copy(V(-WALL - 10, INT.d/2, INT.h*0.62)); extHW.add(plate);
    const anchor = new THREE.Mesh(new THREE.BoxGeometry(30*S, 4*S, 50*S), brk);
    anchor.position.copy(V(12, INT.d/2, INT.h*0.62)); extHW.add(anchor);

    /* Tubo di confronto: esterno, con curva a 90° (separatore inerziale) */
    const tp = part(26);
    if(tp){
      const tm = new THREE.MeshStandardMaterial({color:0x9FB0BF, roughness:.6, metalness:.2,
        transparent:true, opacity:.55, side:THREE.DoubleSide});
      const yy = tp.y + tp.d/2, zc = tp.z + 4, XT = -WALL - 24;
      const th = new THREE.Mesh(new THREE.CylinderGeometry(6*S, 6*S, 40*S, 16), tm);
      th.rotation.z = Math.PI/2; th.position.copy(V(XT - 20, yy, zc - 34)); extHW.add(th);
      const elb = new THREE.Mesh(new THREE.SphereGeometry(6.5*S, 14, 12), tm);
      elb.position.copy(V(XT, yy, zc - 34)); extHW.add(elb);
      const tv = new THREE.Mesh(new THREE.CylinderGeometry(6*S, 6*S, 72*S, 16), tm);
      tv.position.copy(V(XT, yy, zc)); extHW.add(tv);
      const hm3 = new THREE.MeshStandardMaterial({color:0x1a2733, roughness:.8, side:THREE.DoubleSide});
      const inlet = new THREE.Mesh(new THREE.CylinderGeometry(6*S, 6*S, 3*S, 16), hm3);
      inlet.rotation.z = Math.PI/2; inlet.position.copy(V(XT - 41, yy, zc - 34)); holes.add(inlet);
      const outlet = new THREE.Mesh(new THREE.CylinderGeometry(6*S, 6*S, 3*S, 16), hm3);
      outlet.position.copy(V(XT, yy, zc + 36)); holes.add(outlet);
      const drain = new THREE.Mesh(new THREE.CylinderGeometry(1.6*S, 1.6*S, 4*S, 10), hm3);
      drain.position.copy(V(XT, yy, zc - 41)); holes.add(drain);
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(1.5*S, 1.5*S, WALL*S, 10), hm3);
      wire.rotation.z = Math.PI/2; wire.position.copy(V(-WALL/2, yy, zc)); holes.add(wire);
    }

    /* Obiettivo della camera e passaggio del cavo */
    const camL = part(8);
    if(camL){
      const glass = new THREE.MeshStandardMaterial({color:0x11181F, roughness:.15, metalness:.6});
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(9*S, 9*S, 2*S, 24), glass);
      lens.rotation.z = Math.PI/2;
      lens.position.copy(V(INT.w + WALL + 1, camL.y + camL.d/2, camL.z + camL.h/2)); holes.add(lens);
      const bez = new THREE.Mesh(new THREE.BoxGeometry(1.5*S, camL.h*S, camL.d*S),
        new THREE.MeshStandardMaterial({color:0x39434D, roughness:.7}));
      bez.position.copy(V(INT.w + WALL + 0.5, camL.y + camL.d/2, camL.z + camL.h/2)); holes.add(bez);
      const hm2 = new THREE.MeshStandardMaterial({color:0x1a2733, roughness:.8, side:THREE.DoubleSide});
      const c = new THREE.Mesh(new THREE.CylinderGeometry(3*S, 3*S, 12*S, 12), hm2);
      c.rotation.z = Math.PI/2; c.position.copy(V(INT.w + WALL/2, camL.y + camL.d/2, camL.z - 4)); holes.add(c);
    }
  })();
  root.add(vano); root.add(holes); root.add(lidKit); root.add(extHW);

  /* Ripiani */
  DECKS.forEach(d => {
    if(d.plate == null) return;
    const p = new THREE.Mesh(new THREE.BoxGeometry(150*S, 3*S, 150*S),
      new THREE.MeshStandardMaterial({color:0xb9c2cb, roughness:.75, transparent:true, opacity:.5}));
    p.position.copy(V(INT.w/2, INT.d/2, d.plate + 1.5));
    p.userData.deck = d.n; p.userData.y0 = p.position.y;
    root.add(p); plates.push(p);
  });

  /* Componenti */
  const loader = new THREE.TextureLoader();
  PARTS.forEach(p => {
    const g = new THREE.Group();
    const side = new THREE.MeshStandardMaterial({color:new THREE.Color(PAL[p.cat]), roughness:.42, metalness:.12,
      transparent:true, opacity:.94, emissive:new THREE.Color(0x000000)});
    let top = side;
    if(TEX[p.id]){
      top = new THREE.MeshStandardMaterial({map:loader.load(TEX[p.id]), roughness:.55, metalness:.05, transparent:true, opacity:1});
    }
    const mats = [side, side, top, side, side, side];      /* +X −X +Y(alto) −Y +Z −Z */
    const box = new THREE.Mesh(new THREE.BoxGeometry(p.w*S, p.h*S, p.d*S), mats);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry),
      new THREE.LineBasicMaterial({color:0x0a1018, transparent:true, opacity:.45}));
    g.add(box); g.add(edge);
    g.position.copy(V(p.x + p.w/2, p.y + p.d/2, p.z + p.h/2));
    g.userData = {part:p, side:side, top:top, box:box, y0:g.position.y};
    root.add(g); groups.push(g);
  });

  ray = new THREE.Raycaster(); ndc = new THREE.Vector2();
  place();
}

/* ---------- Camera in orbita ---------- */
function place(){
  pol = Math.max(.18, Math.min(Math.PI - .18, pol));
  dist = Math.max(2.2, Math.min(11, dist));
  cam.position.set(tgt.x + dist*Math.sin(pol)*Math.sin(az),
                   tgt.y + dist*Math.cos(pol),
                   tgt.z + dist*Math.sin(pol)*Math.cos(az));
  cam.lookAt(new THREE.Vector3(tgt.x, tgt.y, tgt.z));
}

function bindPointer(){
  cv.addEventListener("pointerdown", e => { drag = true; moved = false; lastTouch = performance.now(); lx = e.clientX; ly = e.clientY; });
  addEventListener("pointermove", e => {
    if(!drag) return;
    moved = true; lastTouch = performance.now();
    az -= (e.clientX - lx)*.007; pol -= (e.clientY - ly)*.007;
    lx = e.clientX; ly = e.clientY; place();
  });
  addEventListener("pointerup", () => { drag = false; });
  cv.addEventListener("wheel", e => { e.preventDefault(); dist *= 1 + e.deltaY*.0011; place(); }, {passive:false});
  cv.addEventListener("touchstart", e => {
    lastTouch = performance.now();
    if(e.touches.length === 2){
      drag = false;
      pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, {passive:true});
  cv.addEventListener("touchmove", e => {
    lastTouch = performance.now();
    if(e.touches.length === 2){
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if(pinch){ dist *= pinch/d; place(); }
      pinch = d;
    }
  }, {passive:true});
  cv.addEventListener("click", e => { if(!moved){ state.sel = pick(e); renderDetail(); renderList(); } });
  cv.addEventListener("pointermove", e => { if(!drag){ state.hover = pick(e); renderDetail(); } });
}

function pick(e){
  const r = cv.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left)/r.width)*2 - 1;
  ndc.y = -((e.clientY - r.top)/r.height)*2 + 1;
  ray.setFromCamera(ndc, cam);
  const hits = ray.intersectObjects(groups.filter(g => g.visible).map(g => g.userData.box), false);
  return hits.length ? hits[0].object.parent.userData.part : null;
}

/* ---------- Ridimensionamento ---------- */
let lastW = 0, lastH = 0, roPending = false;
function resize(){
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  if(w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  cam.aspect = w/h; cam.updateProjectionMatrix();
}

/* ---------- Ciclo di disegno ---------- */
function loop(){
  if(!ready) return;
  requestAnimationFrame(loop);
  if(!active) return;
  resize();

  if(state.mode === "volo" && !reduce && !drag && performance.now() - lastTouch > 3000){ az += .0022; place(); }
  const banco = state.mode === "banco";
  /* In modalità Volo la sonda è chiusa: nessuna esplosione, coperchio a posto.
     Il cursore «Esplodi» esiste solo a Banco, dove si vede davvero dentro. */
  const ex = banco ? state.explode : 0;

  groups.forEach(g => {
    const p = g.userData.part;
    g.position.y = g.userData.y0 + (p.deck - 1)*ex*.9;
    g.visible = banco && state.decks[p.deck - 1];
    const on = (state.sel && state.sel.id === p.id) || (state.hover && state.hover.id === p.id);
    g.userData.side.opacity = state.sel ? (state.sel.id === p.id ? 1 : .3) : (on ? 1 : .94);
    g.userData.side.emissive.set(on ? PAL[p.cat] : 0x000000);
    g.userData.side.emissiveIntensity = on ? .42 : 0;
  });
  plates.forEach(p => {
    p.position.y = p.userData.y0 + (p.userData.deck - 1)*ex*.9;
    p.visible = banco && state.decks[p.userData.deck - 1];
  });
  panels.forEach(m => {
    const t = m.userData.tag;
    if(t === "lid" && m.userData.y0 !== undefined) m.position.y = m.userData.y0 + ex*2.7;
    m.visible = true;
    if(m.type === "Mesh"){
      const front = (t === "wx+" || t === "wy+" || t === "lid");
      m.material.opacity = banco ? (front ? .07 : .30) : 1;
      m.material.transparent = banco;
      m.material.depthWrite = !banco;
    } else {
      m.material.opacity = banco ? (["wx+","wy+","lid"].indexOf(t) >= 0 ? .25 : .6) : .55;
    }
  });
  lidKit.position.y = ex*2.7;
  if(riser) riser.position.y = riser.userData.y0 + ex*1.8;
  wings.visible = !banco;
  vano.visible  = banco;

  /* Numeri sopra i componenti */
  const r = cv.getBoundingClientRect(), v = new THREE.Vector3();
  groups.forEach(g => {
    const p = g.userData.part;
    let e = pinEls[p.id];
    const show = banco && state.pins && g.visible;
    if(show && !e){
      e = document.createElement("button");
      e.className = "pin"; e.textContent = p.id; e.style.borderColor = PAL[p.cat];
      e.setAttribute("aria-label", p.n[lang]);
      e.onclick = () => { state.sel = p; renderDetail(); renderList(); };
      stage.appendChild(e); pinEls[p.id] = e;
    }
    if(!show){ if(e){ e.remove(); delete pinEls[p.id]; } return; }
    v.copy(g.position).project(cam);
    e.style.left = (v.x*.5 + .5)*r.width + "px";
    e.style.top  = (-v.y*.5 + .5)*r.height + "px";
    const act = (state.sel && state.sel.id === p.id) || (state.hover && state.hover.id === p.id);
    e.style.background = act ? PAL[p.cat] : "rgba(2,6,15,.86)";
    e.style.color = act ? "#02060f" : PAL[p.cat];
  });

  renderer.render(scene, cam);
}

/* ---------- Interfaccia ---------- */
const totMass = PARTS.reduce((s,p) => s + p.g, 0);
const totArea = PARTS.filter(p => EXT_IDS.indexOf(p.id) < 0).reduce((s,p) => s + p.w*p.d, 0)/100;

/* Esporta il fotogramma corrente come PNG a fondo trasparente, a
   risoluzione moltiplicata. Serve per riusare il modello nelle altre
   pagine e nel materiale stampa senza catturare lo schermo. */
function esportaPNG(scala){
  if(!renderer || !scene || !cam) return;
  scala = scala || 3;
  const c = renderer.domElement, w = c.clientWidth, h = c.clientHeight;
  const pr = renderer.getPixelRatio();
  renderer.setPixelRatio(scala);
  renderer.setSize(w, h, false);
  cam.aspect = w / h; cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  const url = c.toDataURL("image/png");
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  const a = document.createElement("a");
  a.href = url; a.download = "sonda-klo01.png"; a.click();
}
window.esportaPNG = esportaPNG;

function renderDecks(){
  const box = el("decks"); if(!box) return;
  box.innerHTML = DECKS.map(d => {
    const ps = PARTS.filter(p => p.deck === d.n && EXT_IDS.indexOf(p.id) < 0);
    const a = ps.reduce((s,p) => s + p.w*p.d, 0)/100;
    const m = ps.reduce((s,p) => s + p.g, 0);
    const f = a/FLOOR;
    return '<div class="row"><span class="nm">' + T(d.key) + '</span><span class="pc">' + Math.round(f*100) + '%</span></div>' +
           '<div class="bar"><i style="width:' + Math.min(100, f*100) + '%"></i></div>' +
           '<div class="meta">' + a.toFixed(1) + ' cm² ' + T("uOn") + ' ' + FLOOR + ' · ' + ps.length + ' ' + T("uParts") + ' · ' + m + ' g</div>';
  }).join("");
  const tot = el("tot");
  if(tot) tot.textContent = T("totLine").replace("{area}", totArea.toFixed(0)).replace("{mass}", totMass);
  const mn = el("massNote");
  if(mn) mn.textContent = T("massNote").replace("{mass}", totMass);
}

function renderLegend(){
  const l = el("leg"); if(!l) return;
  l.innerHTML = CATS.map(([k,key]) => '<div><i style="background:' + PAL[k] + '"></i>' + T(key) + '</div>').join("");
  const ln = el("legNote"); if(ln) ln.textContent = T("legNote");
}

function renderList(){
  const l = el("list"); if(!l) return;
  l.innerHTML = PARTS.map(p =>
    '<button type="button" data-id="' + p.id + '" class="' + (state.sel && state.sel.id === p.id ? "on" : "") + '">' +
    '<span class="i" style="color:' + PAL[p.cat] + '">' + p.id + '</span>' +
    '<span class="n">' + p.n[lang] + '</span><span class="g">' + p.g + ' g</span></button>').join("");
  l.querySelectorAll("button").forEach(b => {
    b.onclick        = () => { state.sel = PARTS.find(p => p.id == b.dataset.id); renderDetail(); renderList(); };
    b.onmouseenter   = () => { state.hover = PARTS.find(p => p.id == b.dataset.id); renderDetail(); };
    b.onmouseleave   = () => { state.hover = null; renderDetail(); };
  });
}

function renderDetail(){
  const p = state.sel || state.hover, box = el("detail"); if(!box) return;
  box.innerHTML = p
    ? '<div class="hd"><span class="num" style="background:' + PAL[p.cat] + '">' + p.id + '</span>' +
      '<h4 class="ttl">' + p.n[lang] + '</h4></div>' +
      '<div class="dims">' + p.w + ' × ' + p.d + ' × ' + p.h + ' mm · ' + p.g + ' g · ' + ((p.w*p.d)/100).toFixed(1) + ' cm²</div>' +
      '<p>' + p.note[lang] + '</p>'
    : '<p class="empty">' + T("detailEmpty") + '</p>';
}

function setMode(m){
  state.mode = m; state.sel = null;
  el("mBanco").classList.toggle("on", m === "banco");
  el("mVolo").classList.toggle("on", m === "volo");
  el("mBanco").setAttribute("aria-pressed", m === "banco");
  el("mVolo").setAttribute("aria-pressed", m === "volo");
  stage.classList.toggle("volo", m === "volo");
  dist = (m === "volo") ? 6.4 : 4.6;   /* a Volo servono anche le alette */
  if(ready) place();
  stage.style.backgroundImage = (m === "volo" && SKYIMG) ? "url(" + SKYIMG + ")" : "";
  el("ctlBanco").style.display = m === "banco" ? "flex" : "none";
  el("ctlVolo").style.display  = m === "volo" ? "block" : "none";
  el("caption3d").style.display = m === "volo" ? "block" : "none";
  renderDetail(); renderList();
}

function bindUI(){
  el("mBanco").onclick = () => setMode("banco");
  el("mVolo").onclick  = () => setMode("volo");
  el("explode").oninput = e => { state.explode = +e.target.value; };
  document.querySelectorAll("#ctlBanco .chip").forEach(c => {
    c.onclick = () => {
      const i = +c.dataset.deck;
      state.decks[i] = !state.decks[i];
      c.classList.toggle("on", state.decks[i]);
      c.setAttribute("aria-pressed", state.decks[i]);
    };
  });
  el("togPins").onclick = e => {
    state.pins = !state.pins;
    e.currentTarget.classList.toggle("on", state.pins);
    e.currentTarget.setAttribute("aria-pressed", state.pins);
  };
}

/* ---------- API pubblica ---------- */
function refresh(){
  renderDecks(); renderLegend(); renderList(); renderDetail();
}

function init(){
  if(ready || failed) return Promise.resolve(ready);
  stage = el("stage3d");
  if(!stage) return Promise.resolve(false);
  refresh();                                    /* elenco e legenda sono utili anche senza WebGL */
  bindUI();
  return loadThree().then(() => {
    buildScene();
    bindPointer();
    ready = true;
    const ld = el("stageLoading"); if(ld) ld.remove();
    new ResizeObserver(() => {
      if(roPending) return;
      roPending = true;
      requestAnimationFrame(() => { roPending = false; resize(); });
    }).observe(stage);
    addEventListener("resize", resize);
    setMode("banco");
    requestAnimationFrame(loop);
    return true;
  }).catch(() => {
    failed = true;
    const ld = el("stageLoading");
    if(ld) ld.textContent = T("webglFail");
    return false;
  });
}

function setActive(on){
  active = !!on;
  if(active && ready) { lastW = 0; requestAnimationFrame(() => { resize(); place(); }); }
}

function setLang(l){
  lang = l;
  if(el("stage3d")) refresh();
  const ld = el("stageLoading");
  if(ld && failed) ld.textContent = T("webglFail");
}

return {init:init, setLang:setLang, setActive:setActive};
})();
