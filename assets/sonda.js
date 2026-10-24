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
const INT = {w:165, d:165, h:140}, WALL = 30;

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

/* ---------- I 25 componenti ---------- */
const PARTS = [
{id:1, deck:1, cat:"rad", x:35, y:113, z:0, w:125, d:32, h:20, g:40,
 n:{it:"GGreg20_V3 + tubo J305", es:"GGreg20_V3 + tubo J305", en:"GGreg20_V3 + J305 tube"},
 note:{
  it:"400 V a bordo: la sorgente di guasto più pericolosa. Il modulo viene da IoT-devices.",
  es:"400 V a bordo: la fuente de falla más peligrosa. El módulo viene de IoT-devices.",
  en:"400 V on board: the most dangerous source of failure. The module comes from IoT-devices."}},
{id:2, deck:1, cat:"kit", x:59, y:71, z:0, w:103, d:41, h:28, g:126,
 n:{it:"Power bank Space Cam", es:"Power bank Space Cam", en:"Space Cam power bank"},
 note:{
  it:"Cella 21700 Li-ion da 4500 mAh, 16,6 Wh.",
  es:"Celda 21700 Li-ion de 4500 mAh, 16,6 Wh.",
  en:"21700 Li-ion cell, 4500 mAh, 16.6 Wh."}},
{id:3, deck:1, cat:"atmo", x:-30, y:57, z:0, w:38, d:50, h:21, g:41,
 n:{it:"PMS5003 particolato", es:"PMS5003 material particulado", en:"PMS5003 particulate"},
 note:{
  it:"Incassato nella parete −X, sul ripiano 1 (z 0-21). Faccia a filo esterno, perimetro sigillato con silicone neutro. Le pareti ±Y restano libere per le alette centrate, la +X per la camera. Ponte termico ~0,3 W.",
  es:"Empotrado en la pared −X, en el estante 1 (z 0-21). Cara a ras del exterior, perímetro sellado con silicona neutra. Las paredes ±Y quedan libres para las aletas centradas, y la +X para la cámara. Puente térmico ~0,3 W.",
  en:"Recessed into the −X wall, on deck 1 (z 0-21). Face flush with the outside, perimeter sealed with neutral silicone. The ±Y walls stay free for the centred fins, and +X for the camera. Thermal bridge ~0.3 W."}},
{id:4, deck:1, cat:"alim", x:38, y:18, z:0, w:60, d:48, h:18, g:90,
 n:{it:"Pacco 6 × AA litio L91", es:"Pack 6 × AA litio L91", en:"6 × AA lithium pack L91"},
 note:{
  it:"Le L91 funzionano fino a −40 °C. Alimentano il PMS5003, il GGreg, il Teensy e tutti i sensori collegati a quest'ultimo.",
  es:"Las L91 funcionan hasta −40 °C. Alimentan el PMS5003, el GGreg, el Teensy y todos los sensores conectados a este último.",
  en:"The L91 cells work down to −40 °C. They power the PMS5003, the GGreg, the Teensy and every sensor connected to it."}},
{id:5, deck:2, cat:"alim", x:19, y:20, z:40, w:55, d:32, h:18, g:45,
 n:{it:"Pacco 3 × AA (livello 2)", es:"Pack 3 × AA (nivel 2)", en:"3 × AA pack (level 2)"},
 note:{
  it:"Alimenta solo l'Adalogger con il suo GPS e il LoRa. Nessun contatto elettrico con il pacco principale: è ciò che rende indipendente il livello 2.",
  es:"Alimenta solo al Adalogger con su GPS y el LoRa. Ningún contacto eléctrico con el paquete principal: es lo que hace independiente al nivel 2.",
  en:"Powers only the Adalogger with its own GPS and the LoRa. No electrical contact with the main pack: that is what makes level 2 independent."}},
{id:6, deck:2, cat:"atmo", x:82, y:90, z:40, w:51, d:25, h:14, g:9,
 n:{it:"SCD30 CO₂", es:"SCD30 CO₂", en:"SCD30 CO₂"},
 note:{
  it:"L'aria interna si rinnova dalle sole fughe naturali della scatola: il profilo di CO₂ risulta «spalmato» su qualche centinaio di metri. Per la correzione di densità dell'NDIR usa il proprio sensore di temperatura interno e la pressione dell'MS8607.",
  es:"El aire interior se renueva solo por las fugas naturales de la caja: el perfil de CO₂ queda «untado» sobre algunos cientos de metros. Para la corrección de densidad del NDIR usa su propio sensor de temperatura interno y la presión del MS8607.",
  en:"The inside air is renewed only through the box's natural leaks: the CO₂ profile comes out smeared over a few hundred metres. For the NDIR density correction it uses its own internal temperature sensor and the pressure from the MS8607."}},
{id:8, deck:2, cat:"kit", x:164, y:53, z:35, w:31, d:60, h:41, g:66,
 n:{it:"Space Cam", es:"Space Cam", en:"Space Cam"},
 note:{
  it:"La camera registra tutto il volo in alta definizione, aiutata dalla power bank. Il calore che produce durante la registrazione aiuta a riscaldare la scatola.",
  es:"La cámara graba todo el vuelo en alta definición, ayudada por la batería externa. El calor que produce mientras graba ayuda a calentar la caja.",
  en:"The camera records the whole flight in high definition, helped by the power bank. The heat it gives off while recording helps warm the box."}},
{id:9, deck:2, cat:"pos", x:69, y:117.5, z:40, w:63, d:22, h:12, g:8,
 n:{it:"Teensy 4.1", es:"Teensy 4.1", en:"Teensy 4.1"},
 note:{
  it:"Controllore principale, microSD integrata. Clock ridotto a 150 MHz per limitare il consumo e la dissipazione: a bassa pressione il calore fatica a uscire.",
  es:"Controlador principal, microSD integrada. Reloj reducido a 150 MHz para limitar el consumo y la disipación: a baja presión al calor le cuesta salir.",
  en:"Main controller, microSD built in. Clock cut to 150 MHz to limit consumption and dissipation: at low pressure heat struggles to escape."}},
{id:10, deck:2, cat:"pos", x:21, y:61, z:40, w:50, d:28, h:8, g:6,
 n:{it:"Feather M0 Adalogger", es:"Feather M0 Adalogger", en:"Feather M0 Adalogger"},
 note:{
  it:"LIVELLO 2. Pile, microSD e GPS propri. Registra quota e traiettoria anche se il Teensy si blocca del tutto.",
  es:"NIVEL 2. Pilas, microSD y GPS propios. Registra altura y trayectoria incluso si el Teensy se cuelga por completo.",
  en:"LEVEL 2. Its own cells, microSD and GPS. Records altitude and trajectory even if the Teensy locks up completely."}},
{id:11, deck:1, cat:"atmo", x:101, y:32, z:0, w:28, d:25, h:12, g:5,
 n:{it:"MAX31865 — PT1000 esterno", es:"MAX31865 — PT1000 exterior", en:"MAX31865 — outer PT1000"},
 note:{
  it:"Sta fuori dalla catena Qwiic. Legge il PT1000 in cima all'ala +Y: il cavo corre lungo l'aletta ed entra dal foro sotto il coperchio, poi scende nella fascia +Y.",
  es:"Queda fuera de la cadena Qwiic. Lee el PT1000 que va en la punta de la aleta +Y: el cable corre a lo largo de la aleta y entra por el orificio bajo la tapa, y después baja por la franja +Y.",
  en:"It sits outside the Qwiic chain. It reads the PT1000 at the top of fin +Y: the cable runs along the fin and enters through the hole under the lid, then drops down the +Y channel."}},
{id:12, deck:2, cat:"alim", x:77, y:19, z:40, w:82, d:51, h:14, g:16,
 n:{it:"Perfboard", es:"Perfboard", en:"Perfboard"},
 note:{
  it:"Isolamento guasti concentrato su una sola scheda: polyfuse, resistenze e condensatori saldati, il driver MOSFET è collegato qui.",
  es:"Aislamiento de fallas concentrado en una sola placa: polyfuse, resistencias y condensadores soldados, y el driver MOSFET se conecta acá.",
  en:"Fault isolation concentrated on a single board: polyfuse, soldered resistors and capacitors, and the MOSFET driver connects here."}},
{id:13, deck:3, cat:"kit", x:19, y:19, z:80, w:66, d:55, h:29, g:73,
 n:{it:"SPOT Trace", es:"SPOT Trace", en:"SPOT Trace"},
 note:{
  it:"Trasmette verso l'alto: niente sopra di lui. Copre la salita fino al limite COCOM e dà posizione e altitudine ogni due minuti e mezzo.",
  es:"Transmite hacia arriba: nada por encima de él. Cubre el ascenso hasta el límite COCOM y da posición y altitud cada dos minutos y medio.",
  en:"It transmits upwards: nothing above it. It covers the ascent up to the COCOM limit and gives position and altitude every two and a half minutes."}},
{id:14, deck:3, cat:"pos", x:3, y:79, z:80, w:41, d:41, h:6, g:12,
 n:{it:"GPS SAM-M8Q (principale)", es:"GPS SAM-M8Q (principal)", en:"SAM-M8Q GPS (main)"},
 note:{
  it:"Antenna integrata verso il cielo. Modo Airborne <1g salvato in flash.",
  es:"Antena integrada hacia el cielo. Modo Airborne <1g guardado en flash.",
  en:"Antenna built in, facing the sky. Airborne <1g mode saved to flash."}},
{id:15, deck:3, cat:"pos", x:91, y:35, z:80, w:41, d:41, h:6, g:12,
 n:{it:"GPS SAM-M8Q (livello 2)", es:"GPS SAM-M8Q (nivel 2)", en:"SAM-M8Q GPS (level 2)"},
 note:{
  it:"È il GPS dell'Adalogger. Quota e istante di scoppio vengono registrati e inviati grazie al LoRa.",
  es:"Es el GPS del Adalogger. La altura y el instante del estallido quedan registrados y se envían gracias al LoRa.",
  en:"It is the Adalogger's GPS. The burst altitude and time are recorded and sent out over the LoRa."}},
{id:16, deck:3, cat:"atmo", x:107, y:121.5, z:80, w:26, d:18, h:5, g:2,
 n:{it:"MS8607 p/T/RH", es:"MS8607 p/T/HR", en:"MS8607 p/T/RH"},
 note:{
  it:"Fondo scala 10 hPa: dato valido fino a ~31 km. Sopra, l'altimetria è solo GPS.",
  es:"Fondo de escala 10 hPa: dato válido hasta ~31 km. Por encima, la altimetría es solo GPS.",
  en:"Full scale 10 hPa: valid up to about 31 km. Above that, altitude comes from GPS alone."}},
{id:17, deck:3, cat:"rad", x:88, y:13, z:80, w:26, d:18, h:5, g:2,
 n:{it:"LTR390 UV", es:"LTR390 UV", en:"LTR390 UV"},
 note:{
  it:"Sotto la finestra in PTFE sul coperchio: il PTFE diffonde la luce e riduce la dipendenza dall'angolo su una sonda che ruota. Banda singola UVA.",
  es:"Bajo la ventana de PTFE en la tapa: el PTFE difunde la luz y reduce la dependencia del ángulo en una sonda que rota. Banda única UVA.",
  en:"Under the PTFE window in the lid: PTFE diffuses the light and reduces the angle dependence on a probe that spins. Single UVA band."}},
{id:18, deck:3, cat:"pos", x:65, y:121.5, z:80, w:26, d:18, h:5, g:3,
 n:{it:"ICM-20948 IMU", es:"ICM-20948 IMU", en:"ICM-20948 IMU"},
 note:{
  it:"Il ripiano più lontano dai pacchi pile e dai cavi di potenza: il magnetometro va calibrato hard/soft iron a sonda chiusa.",
  es:"El estante más lejano de los paquetes de pilas y de los cables de potencia: el magnetómetro se calibra hard/soft iron con la sonda cerrada.",
  en:"The deck furthest from the battery packs and the power wiring: the magnetometer is hard/soft-iron calibrated with the probe closed."}},
{id:20, deck:3, cat:"alim", x:127, y:103, z:80, w:17, d:7, h:8, g:1,
 n:{it:"MPM3610 buck 5 V", es:"MPM3610 buck 5 V", en:"MPM3610 buck 5 V"},
 note:{
  it:"Da 9-10,8 V a 5 V. Senza questo il Teensy, che accetta al massimo 5,5 V, si distrugge.",
  es:"De 9-10,8 V a 5 V. Sin esto el Teensy, que acepta 5,5 V como máximo, se destruye.",
  en:"From 9-10.8 V down to 5 V. Without it the Teensy, which takes 5.5 V maximum, is destroyed."}},
{id:21, deck:3, cat:"atmo", x:94.5, y:-270, z:148, w:5, d:26, h:18, g:2,
 n:{it:"SHT45 umidità (ala −Y)", es:"SHT45 humedad (aleta −Y)", en:"SHT45 humidity (fin −Y)"},
 note:{
  it:"In cima all'ala −Y, alla stessa quota del PT1000 esterno sull'altra ala. Scheda distanziata 8 mm dalla faccia dell'aletta, chip rivolto in basso o di lato, tettuccio bianco sopra contro sole e pioggia; il filtro in PTFE sul chip non va coperto. Dall'umidità e dalla temperatura del chip si ricava il punto di rugiada; con la temperatura del PT1000 esterno si ricalcola l'umidità relativa dell'aria. Valida fino a circa 11 km.",
  es:"En la punta de la aleta −Y, a la misma altura que el PT1000 exterior de la otra aleta. Placa separada 8 mm de la cara de la aleta, chip mirando hacia abajo o de costado, techito blanco arriba contra el sol y la lluvia; el filtro de PTFE sobre el chip no se tapa. De la humedad y la temperatura del chip sale el punto de rocío; con la temperatura del PT1000 exterior se recalcula la humedad relativa del aire. Válida hasta unos 11 km.",
  en:"At the top of fin −Y, at the same height as the outer PT1000 on the other fin. The board stands 8 mm off the face of the fin, chip facing down or sideways, with a white roof above it against sun and rain; the PTFE filter on the chip must stay uncovered. Dew point comes from the chip's humidity and temperature; with the outer PT1000's temperature the relative humidity of the air is recomputed. Valid up to about 11 km."}},
{id:25, deck:1, cat:"atmo", x:52, y:1, z:5, w:30, d:6, h:6, g:19,
 n:{it:"PT1000 interno (parete −Y)", es:"PT1000 interior (pared −Y)", en:"Inner PT1000 (−Y wall)"},
 note:{
  it:"Sulla faccia interna della parete −Y, in basso, accanto al pacco pile principale: misura la cassa nella zona più fredda della scatola. Coperto dai ciuffi di ovatta, così segue la parete e non l'aria che gli passa davanti. Con il PT1000 esterno dà il salto di temperatura attraverso il polistirolo; con l'MS8607, che sta in alto, la differenza fra alto e basso della scatola.",
  es:"Sobre la cara interna de la pared −Y, abajo, junto al paquete de pilas principal: mide la caja en la zona más fría. Cubierto por los mechones de guata, así sigue a la pared y no al aire que le pasa por delante. Con el PT1000 exterior da el salto de temperatura a través del poliestireno; con el MS8607, que está arriba, la diferencia entre la parte alta y la baja de la caja.",
  en:"On the inner face of the −Y wall, low down, beside the main battery pack: it measures the shell in the coldest part of the box. Covered by the wadding tufts, so it follows the wall and not the air passing in front of it. With the outer PT1000 it gives the temperature drop across the polystyrene; with the MS8607, which sits high up, the difference between the top and the bottom of the box."}},
{id:31, deck:1, cat:"pos", x:8, y:101, z:6, w:21, d:36, h:5, g:8,
 n:{it:"LoRa E220-900T22D", es:"LoRa E220-900T22D", en:"LoRa E220-900T22D"},
 note:{
  it:"Collegato in UART all'Adalogger (livello 2), può trasmettere fra 868 e 928 MHz con 22 dBm.",
  es:"Conectado por UART al Adalogger (nivel 2), puede transmitir entre 868 y 928 MHz con 22 dBm.",
  en:"Connected over UART to the Adalogger (level 2), it can transmit between 868 and 928 MHz at 22 dBm."}},
{id:23, deck:1, cat:"atmo", x:129.5, y:32, z:0, w:28, d:25, h:12, g:5,
 n:{it:"MAX31865 — PT1000 interno", es:"MAX31865 — PT1000 interior", en:"MAX31865 — inner PT1000"},
 note:{
  it:"Legge il PT1000 incollato in basso alla parete −Y.",
  es:"Lee el PT1000 pegado abajo en la pared −Y.",
  en:"It reads the PT1000 glued low on the −Y wall."}},
{id:24, deck:3, cat:"atmo", x:79.5, y:435, z:170, w:6, d:30, h:6, g:19,
 n:{it:"PT1000 esterno (ala +Y)", es:"PT1000 exterior (aleta +Y)", en:"Outer PT1000 (fin +Y)"},
 note:{
  it:"In cima all'ala +Y, all'estremità esterna: appoggiato sul bordo superiore e sporgente di 20 mm oltre la punta, in aria libera. In salita l'aria arriva dall'alto e lo raggiunge prima di aver toccato la scatola. Sonda verniciata di bianco opaco: resta il bias solare, come l'esposizione a goccioline e ghiaccio nelle nubi.",
  es:"En la punta de la aleta +Y, en el extremo exterior: apoyado sobre el borde superior y sobresaliendo 20 mm más allá de la punta, en aire libre. En el ascenso el aire llega desde arriba y lo alcanza antes de haber tocado la caja. Sonda pintada de blanco mate: queda el sesgo solar, igual que la exposición a gotitas y hielo dentro de las nubes.",
  en:"At the top of fin +Y, at its outer end: resting on the upper edge and projecting 20 mm beyond the tip, in free air. On the way up the air comes from above and reaches it before it has touched the box. The probe is painted matt white: the solar bias remains, as does the exposure to droplets and ice inside clouds."}},
{id:32, deck:3, cat:"kit", x:47, y:76, z:80, w:75, d:45, h:21, g:78,
 n:{it:"STRATOfinder (rintracciamento cellulare)", es:"STRATOfinder (rastreo celular)", en:"STRATOfinder (cellular tracking)"},
 note:{
  it:"Terzo canale di rintracciamento, autonomo: batteria propria, nessun collegamento al resto della sonda. Modulo SIMCom SIM7600E. Funziona solo dove arriva la rete cellulare, quindi a terra o quasi.",
  es:"Tercer canal de rastreo, autónomo: batería propia, ninguna conexión con el resto de la sonda. Módulo SIMCom SIM7600E. Funciona solo donde llega la red celular, o sea en tierra o casi.",
  en:"A third, self-contained tracking channel: its own battery, no connection to the rest of the probe. SIMCom SIM7600E module. It only works where there is mobile coverage, so on the ground or nearly."}},
{id:33, deck:1, cat:"pos", x:-6.9, y:140, z:66.1, w:170, d:10, h:10, g:12, tilt:45,
 n:{it:"Antenna del LoRa", es:"Antena del LoRa", en:"LoRa antenna"},
 note:{
  it:"Stilo da 170 mm avvitato direttamente al modulo. Snodo piegato a 90° e ruotato verso +X, sale inclinata di circa 45° per facilitare la ricezione a terra. Verso l'orizzonte la perdita è di 3,0 dB costanti, in qualunque azimut.",
  es:"Látigo de 170 mm atornillado directamente al módulo. Codo doblado a 90° y girado hacia +X, sube inclinada unos 45° para facilitar la recepción en tierra. Hacia el horizonte la pérdida es de 3,0 dB constantes, en cualquier azimut.",
  en:"A 170 mm whip screwed straight onto the module. The joint is bent 90° and turned towards +X, rising at about 45° to help reception on the ground. Towards the horizon the loss is a constant 3.0 dB, at any azimuth."}}
];

const DECKS = [{n:1, key:"deck1", z:0,  plate:null},
               {n:2, key:"deck2", z:40, plate:37},
               {n:3, key:"deck3", z:80, plate:77}];
const CATS  = [["atmo","catAtmo"],["pos","catPos"],["rad","catRad"],["alim","catAlim"],["kit","catKit"]];
const FLOOR = (INT.w * INT.d) / 100;      /* cm² utili di un ripiano */
const EXT_IDS = [21,24];                  /* in cima alle alette, fuori dalla scatola */
/* Pezzi che non occupano superficie di ripiano: incassati nelle pareti,
   nelle intercapedini o appoggiati sopra un altro componente. */
const NOAREA  = [3,8,25,33];
/* Taglio del lato +Y dei ripiani 2 e 3: la fascia dello stilo e dei cavi.
   Lo stilo sale a 45° dalla base (18, 145, 11): attraversa la fascia a
   x = 44 all'altezza del ripiano 2 e a x = 87 a quella del ripiano 3,
   dentro il tratto tagliato (33-133), e arriva in punta a (138, 145, 131). */
const CUT = {y:139.5, x0:33, x1:133};

/* ---------- Stato ---------- */
const S = 0.01;                            /* mm → unità di scena */
const state = {mode:"banco", explode:0, decks:[true,true,true], pins:true, wad:true, sel:null, hover:null};
let lang = "it", ready = false, active = false, failed = false;
let stage, cv, renderer, scene, cam, root, ray, ndc;
let panels = [], plates = [], groups = [], wings, wingEdges, vano, wad, holes, lidKit, extHW, riser = null;
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
  /* A Banco le alette restano solo come contorno: i componenti 21 e 24
     stanno in cima a loro, e senza quel contorno sembrerebbero sospesi. */
  wingEdges = new THREE.Group();
  wings.children.forEach(function(m){
    if(m.geometry.parameters.depth !== 250*S) return;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),
      new THREE.LineBasicMaterial({color:0x8e9aa6, transparent:true, opacity:.5}));
    e.position.copy(m.position); wingEdges.add(e);
  });
  root.add(wingEdges);

  /* Struttura interna, coibentazione, finestra UV, aperture */
  vano = new THREE.Group(); wad = new THREE.Group(); holes = new THREE.Group(); lidKit = new THREE.Group(); extHW = new THREE.Group();
  const part = id => PARTS.find(q => q.id === id);
  (function(){
    const RODS = [[12,12],[153,12],[12,153],[153,153]];
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

    const xps = new THREE.MeshStandardMaterial({color:0xF0D9A8, roughness:.95, transparent:true, opacity:.4, side:THREE.DoubleSide, depthWrite:false});
    const fluff = new THREE.MeshStandardMaterial({color:0xF0D9A8, roughness:1, transparent:true, opacity:.26, side:THREE.DoubleSide, depthWrite:false});
    const wFloor = new THREE.Mesh(new THREE.BoxGeometry(150*S, 10*S, 150*S), xps);
    wFloor.position.copy(V(80, 80, -6)); wad.add(wFloor);
    const wLid = new THREE.Mesh(new THREE.BoxGeometry(150*S, 10*S, 150*S), xps);
    wLid.position.copy(V(80, 80, 136)); lidKit.add(wLid);
    /* Ciuffi nelle intercapedini laterali: interrompono il moto convettivo
       lungo le pareti fredde. Restano scoperti il dorso della Space Cam
       (che deve scaldare la scatola) e la zona del PMS. Il PT1000 interno
       (25) va invece COPERTO: deve seguire la parete, non l'aria. */
    const tuft = function(x0, x1, y0, y1, z0, z1){
      const m = new THREE.Mesh(new THREE.BoxGeometry((x1-x0)*S, (z1-z0)*S, (y1-y0)*S), fluff);
      m.position.copy(V((x0+x1)/2, (y0+y1)/2, (z0+z1)/2)); wad.add(m);
    };
    const ZB = [[2,34],[42,74],[82,128]];
    ZB.forEach(function(b){ tuft(18, 147, 0.5, 6.5, b[0], b[1]); });                       /* parete -Y */
    ZB.forEach(function(b){ tuft(0.5, 6, 18, 48, b[0], b[1]); tuft(0.5, 6, 124, 147, b[0], b[1]); });  /* parete -X */
    tuft(0.5, 6, 48, 124, 42, 74);                     /* fascia centrale, liberata dalla staffa */
    ZB.forEach(function(b){ tuft(160.5, 164.5, 18, 48, b[0], b[1]); });                    /* parete +X */
    tuft(160.5, 164.5, 53, 113, 2, 30); tuft(160.5, 164.5, 53, 113, 82, 128);
    ZB.slice(0,2).forEach(function(b){ tuft(160.5, 164.5, 118, 147, b[0], b[1]); });
    tuft(18, 147, 160.5, 164.5, 2, 8);                                                     /* parete +Y, sotto lo stilo */

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
      const rise = new THREE.Mesh(new THREE.BoxGeometry(uv.w*S, 45*S, uv.d*S), nylon);
      rise.position.copy(V(uv.x + uv.w/2, uv.y + uv.d/2, uv.z + uv.h + 22.5));
      rise.userData.y0 = rise.position.y; riser = rise; vano.add(rise);
    }

    /* Cavi dei due sensori esterni: corrono lungo l'aletta, entrano da un
       foro di 3 mm sotto il coperchio (z = 125) e scendono dentro. */
    const cavo = new THREE.MeshStandardMaterial({color:PAL.alim, roughness:.6});
    const cable = function(pts){
      extHW.add(new THREE.Mesh(new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts.map(function(q){ return V(q[0], q[1], q[2]); })),
        48, 1.1*S, 6, false), cavo));
    };
    cable([[88,436,174],[88,320,168],[88,200,160],[88,200,125],[88,190,125],[88,160,125]]);   /* PT1000, ala +Y */
    cable([[97,-248,156],[92,-200,150],[90,-35,135],[88,-35,125],[70,-25,125],[70,5,125]]);   /* SHT45, ala -Y */
    const passo = new THREE.MeshStandardMaterial({color:0x1a2733, roughness:.8});
    [[88, INT.d + WALL/2], [70, -WALL/2]].forEach(function(q){
      const h = new THREE.Mesh(new THREE.CylinderGeometry(1.6*S, 1.6*S, WALL*S, 10), passo);
      h.rotation.x = Math.PI/2; h.position.copy(V(q[0], q[1], 125)); holes.add(h);
    });
    /* Tettuccio bianco sopra l'SHT45: sole e pioggia, non il filtro in PTFE */
    const hood = new THREE.Mesh(new THREE.BoxGeometry(16*S, 1.5*S, 32*S),
      new THREE.MeshStandardMaterial({color:0xF5F7F8, roughness:.9}));
    hood.position.copy(V(94, -257, 169)); extHW.add(hood);

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
  root.add(vano); root.add(wad); root.add(holes); root.add(lidKit); root.add(extHW);

  /* Ripiani */
  /* I ripiani 2 e 3 sono accorciati sul lato +Y: il bordo passa da y=157,5
     a y=139,5 fra x=33 e x=133, e agli angoli restano due orecchie che
     portano le colonne. La fascia cosi' liberata, 18 x 100 mm, ospita lo
     stilo del LoRa (33) e i cavi che salgono fra i ripiani. */
  DECKS.forEach(d => {
    if(d.plate == null) return;
    const mat = new THREE.MeshStandardMaterial({color:0xb9c2cb, roughness:.75, transparent:true, opacity:.5});
    const g = new THREE.Group(), zc = V(0, 0, d.plate + 1.5).y;
    [[7.5, 157.5, 7.5, CUT.y], [7.5, CUT.x0, CUT.y, 157.5], [CUT.x1, 157.5, CUT.y, 157.5]].forEach(function(r){
      const x0 = r[0], x1 = r[1], y0 = r[2], y1 = r[3];
      const m = new THREE.Mesh(new THREE.BoxGeometry((x1-x0)*S, 3*S, (y1-y0)*S), mat);
      m.position.copy(V((x0+x1)/2, (y0+y1)/2, d.plate + 1.5)); m.position.y = 0; g.add(m);
    });
    g.position.y = zc; g.userData.deck = d.n; g.userData.y0 = zc;
    root.add(g); plates.push(g);
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
    if(p.rot)  g.rotation.y = -p.rot*Math.PI/180;
    if(p.tilt) g.rotation.z =  p.tilt*Math.PI/180;    /* lo stilo del LoRa sale a 41 gradi */
    g.userData = {part:p, side:side, top:top, box:box, y0:g.position.y};
    root.add(g); groups.push(g);
  });

  ray = new THREE.Raycaster(); ndc = new THREE.Vector2();
  place();
}

/* ---------- Camera in orbita ----------
   Le alette sono lunghe un quarto di metro e i due sensori esterni stanno
   in cima a loro, a quasi mezzo metro dal centro della scatola: per
   vederli l'inquadratura deve allargarsi parecchio. A Volo lo fa sempre,
   perche' li' la sonda si guarda tutta intera; a Banco resta stretta sulla
   scatola — dove servono i numeri — e si allarga solo quando si sceglie
   uno dei due pezzi esterni, altrimenti si sceglierebbe qualcosa che
   nemmeno si vede. */
const DIST = {banco:4.6, fuori:9.2, volo:9.2};
function distanza(){
  if(state.mode === "volo") return DIST.volo;
  return (state.sel && EXT_IDS.indexOf(state.sel.id) >= 0) ? DIST.fuori : DIST.banco;
}
/* Unico punto da cui passa la scelta di un componente: tiene insieme la
   scheda, l'elenco e l'inquadratura. */
function seleziona(p){
  state.sel = p;
  const d = distanza();
  if(ready && Math.abs(dist - d) > .01){ dist = d; place(); }
  renderDetail(); renderList();
}
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
  cv.addEventListener("click", e => { if(!moved) seleziona(pick(e)); });
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
    const fuori = EXT_IDS.indexOf(p.id) >= 0;
    g.position.y = g.userData.y0 + (fuori ? 0 : (p.deck - 1)*ex*.9);
    g.visible = banco && (fuori || state.decks[p.deck - 1]);
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
  wingEdges.visible = banco;
  vano.visible  = banco;
  /* L'ovatta sparisce quando si esplode: coprirebbe i ripiani che si alzano. */
  wad.visible   = banco && state.wad && ex < .05;
  lidKit.children.forEach(function(c){
    if(c.geometry && c.geometry.type === "BoxGeometry") c.visible = state.wad;
  });

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
      e.onclick = () => seleziona(p);
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
const totArea = PARTS.filter(p => EXT_IDS.indexOf(p.id) < 0 && NOAREA.indexOf(p.id) < 0)
                     .reduce((s,p) => s + p.w*p.d, 0)/100;

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
  /* La nota sulla massa sta sotto la scena e c'e' sempre; la scheda
     «occupazione dei ripiani» solo dove la pagina la prevede. Prima
     stavano insieme, e senza quella scheda la nota restava vuota. */
  const mn = el("massNote");
  if(mn) mn.textContent = T("massNote").replace("{mass}", totMass);
  const box = el("decks"); if(!box) return;
  box.innerHTML = DECKS.map(d => {
    const ps = PARTS.filter(p => p.deck === d.n && EXT_IDS.indexOf(p.id) < 0);
    const a = ps.filter(p => NOAREA.indexOf(p.id) < 0).reduce((s,p) => s + p.w*p.d, 0)/100;
    const m = ps.reduce((s,p) => s + p.g, 0);
    const f = a/FLOOR;
    return '<div class="row"><span class="nm">' + T(d.key) + '</span><span class="pc">' + Math.round(f*100) + '%</span></div>' +
           '<div class="bar"><i style="width:' + Math.min(100, f*100) + '%"></i></div>' +
           '<div class="meta">' + a.toFixed(1) + ' cm² ' + T("uOn") + ' ' + FLOOR + ' · ' + ps.length + ' ' + T("uParts") + ' · ' + m + ' g</div>';
  }).join("");
  const tot = el("tot");
  if(tot) tot.textContent = T("totLine").replace("{area}", totArea.toFixed(0)).replace("{mass}", totMass);
}

function renderLegend(){
  const l = el("leg"); if(!l) return;
  l.innerHTML = CATS.map(([k,key]) => '<div><i style="background:' + PAL[k] + '"></i>' + T(key) + '</div>').join("") +
    '<div><i style="background:#F0D9A8;opacity:.7"></i>' + T("catWad") + '</div>';
  const ln = el("legNote"); if(ln) ln.textContent = T("legNote");
}

function renderList(){
  const l = el("list"); if(!l) return;
  l.innerHTML = PARTS.map(p =>
    '<button type="button" data-id="' + p.id + '" class="' + (state.sel && state.sel.id === p.id ? "on" : "") + '">' +
    '<span class="i" style="color:' + PAL[p.cat] + '">' + p.id + '</span>' +
    '<span class="n">' + p.n[lang] + '</span><span class="g">' +
    (EXT_IDS.indexOf(p.id) >= 0 ? T("uExt") : p.id === 25 ? T("uWall") : "R" + p.deck) + ' · ' + p.g + ' g</span></button>').join("");
  l.querySelectorAll("button").forEach(b => {
    b.onclick        = () => seleziona(PARTS.find(p => p.id == b.dataset.id));
    b.onmouseenter   = () => { state.hover = PARTS.find(p => p.id == b.dataset.id); renderDetail(); };
    b.onmouseleave   = () => { state.hover = null; renderDetail(); };
  });
}

/* Dove sta il pezzo: fuori, incassato in una parete, a cavallo di tre
   ripiani come lo stilo del LoRa, oppure su un ripiano solo. */
function dove(p){
  if(p.id === 24)                return T("whereWingP");
  if(p.id === 21)                return T("whereWingM");
  if(p.id === 25)                return T("whereWallLow");
  if(p.id === 3 || p.id === 8)   return T("whereWall");
  if(p.id === 33)                return T("whereSpan");
  return T("whereDeck") + " " + p.deck;
}

function renderDetail(){
  const p = state.sel || state.hover, box = el("detail"); if(!box) return;
  box.innerHTML = p
    ? '<div class="hd"><span class="num" style="background:' + PAL[p.cat] + '">' + p.id + '</span>' +
      '<h4 class="ttl">' + p.n[lang] + '</h4></div>' +
      '<div class="dims dove">' + dove(p) + '</div>' +
      '<div class="dims">' + p.w + ' × ' + p.d + ' × ' + p.h + ' mm · ' + p.g + ' g' +
        (p.tilt ? ' · ' + T("uTilt") + ' ' + Math.abs(p.tilt) + '°' : '') + '</div>' +
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
  dist = distanza();                   /* a Volo entra tutta la sonda, alette comprese */
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
  const tw = el("togWad");
  if(tw) tw.onclick = e => {
    state.wad = !state.wad;
    e.currentTarget.classList.toggle("on", state.wad);
    e.currentTarget.setAttribute("aria-pressed", state.wad);
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
