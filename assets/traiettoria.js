/* ============================================================
   COMETA — prevedere il volo (pagina La traiettoria)

   1. Il pallone: dallo stesso modello di calcolo/cometa_venti.py
      ricava elio necessario, portanza al collo, quota di scoppio e
      velocita' di discesa al suolo. La quota di scoppio usa
      l'atmosfera prevista per il luogo, il giorno e l'ora: Open-Meteo
      fino a 30 hPa (~24 km), NRLMSIS 2.1 piu' in alto (assets/msis.js).
      Senza quei dati, l'atmosfera standard ISA.
   2. La partenza: una localita' (suggerimenti mentre si scrive),
      le coordinate, un punto toccato sulla mappa o la posizione
      del telefono.
   3. La traiettoria: la chiede a Tawhiri, il predittore di
      SondeHub, sui venti dell'ultima corsa del modello GFS della
      NOAA, e la disegna su una mappa Leaflet.

   Tutto avviene nel browser di chi guarda: nessun server nostro.
   L'unica cosa ricordata e' l'ultimo luogo di partenza scelto,
   nel localStorage di quel dispositivo.

   Leaflet (assets/vendor/leaflet/) si carica solo quando la mappa
   entra nello schermo.
   ============================================================ */

(function(){
"use strict";

const API = "https://api.v2.sondehub.org/tawhiri";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const METEO = "https://api.open-meteo.com/v1/forecast";
/* Giorno e ora di lancio sono quelli del luogo di partenza: le 11 a
   Mercedes sono le 11 di Mercedes, per chiunque guardi e da dovunque.
   Il fuso del luogo lo dice Open-Meteo (timezone=auto, nella stessa
   richiesta dell'atmosfera: vedi fetchHourly e fusoDi); finche' non e'
   arrivato, e per la Diretta (LAUNCH e' l'ora di Montevideo), vale TZ.
   TZ_OFF serve solo per contare i giorni (addDays). */
const TZ = "America/Montevideo";
const TZ_OFF = "-03:00";            /* l'Uruguay non ha ora legale dal 2015 */
/* Fin dove si possono scegliere le date: oggi piu' GIORNI_MAX giorni.
   Il GFS che usa Tawhiri arriva a 192 ore (8 giorni) dall'ultima corsa, e
   la corsa piu' recente ha di solito qualche ora: con 7 il giorno del
   lancio non era ancora selezionabile qui mentre la Diretta, che chiede
   direttamente a Tawhiri, la traiettoria la mostrava gia'. Con 8, l'ultimo
   giorno puo' non essere coperto per intero: nelle ore oltre la fine della
   corsa Tawhiri risponde con un errore, e lo si mostra (twErr). */
const GIORNI_MAX = 8;
const LEAFLET = "assets/vendor/leaflet/";
const COL = "#5FE3FF";              /* --cyan */
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
/* Curva di convergenza delle previsioni, calcolata ogni giorno dal workflow
   .github/workflows/convergenza.yml sul branch `dati` (non pubblicato con
   il sito): per ogni anticipo, di quanto si e' spostato l'atterraggio
   previsto rispetto alla previsione del giorno stesso, a Mercedes. */
const CURVA = "https://raw.githubusercontent.com/cometa-sim/cometa-sim.github.io/dati/convergenza_curva.json";
const CURVA_NMIN = 8;               /* classi con meno campioni non si usano */
/* v2: la prima versione salvava anche la partenza predefinita (Durazno)
   come se l'avesse scelta il visitatore; con una chiave nuova si riparte */
const KEY = "cometa-partenza-v2";

/* La partenza proposta e' La Calera, vicino a Minas, dove la DINACIA ci
   chiede di lanciare (lo stesso FLIGHT_SITE di assets/volo.js). Poi
   l'aerodromo di Mercedes (SUME, Ricardo Detomasi), dove c'e' la stazione
   di INUMET: punto di riferimento dell'aerodromo, 33°14'55"S 58°04'25"W,
   21 m; e i due siti dello studio. */
const SUGGERITI = [
  {name:"La Calera · Minas",    lat:-34.2919, lon:-55.3531, note:"twDinacia"},
  {name:"Mercedes · aeródromo", lat:-33.2486, lon:-58.0736, note:"twInumet"},
  {name:"Mercedes (Soriano)",   lat:-33.249,  lon:-58.030,  studied:true},
  {name:"Durazno",              lat:-33.380,  lon:-56.520,  studied:true}
];
const PREDEFINITO = SUGGERITI[0];
/* [lon, lat], gli stessi poligoni di cometa_venti.py */
/* ---------- Area di esclusione ----------
   Il poligono della DINACIA e il giudizio che ne discende restano scritti
   ma spenti: torneranno come impostazione avanzata. Rimettere a true per
   riaccendere tutto in una volta — disegno sulla mappa 2D, mappa 3D,
   immagine PNG, colonna dello stato ed etichette della legenda. */
const MOSTRA_EXCL = false;
/* Le legende e l'esito "ok" hanno due versioni: con e senza il poligono. */
function kExcl(k){ return MOSTRA_EXCL ? k + "Excl" : k; }
function kOk(){ return MOSTRA_EXCL ? "twOk" : "twInUru"; }

const EXCL = [[-56.78,-34.55],[-56.75,-34.20],[-56.20,-34.12],[-55.74,-34.18],
  [-55.10,-34.15],[-54.60,-34.35],[-54.30,-34.62],[-54.63,-34.84],
  [-54.95,-34.97],[-55.30,-34.90],[-55.85,-34.80],[-56.20,-34.90],[-56.50,-34.78]];
const URU = [[-57.65,-30.20],[-55.55,-30.90],[-53.90,-32.10],[-53.40,-33.70],
  [-54.15,-34.66],[-54.95,-34.97],[-56.20,-34.90],[-57.85,-34.47],
  [-58.40,-34.00],[-58.10,-33.10],[-58.05,-32.10],[-57.90,-31.40]];

const $ = function(s){ return document.querySelector(s); };
const form = $("#twForm");
/* Se la pagina e lo script non sono della stessa versione (una cache
   che ne ha aggiornato uno solo) meglio non fare niente che fare danni. */
if(!form || !$("#twWhere") || !$("#twBal")) return;
const elWhere = $("#twWhere"), elSugg = $("#twSugg"), elGeo = $("#twGeo"),
      elDate = $("#twDate"), elTime = $("#twTime"),
      elBal = $("#twBal"), elDiam = $("#twDiam"), elMass = $("#twMass"), elPay = $("#twPay"),
      elAsc = $("#twAsc"), elChute = $("#twChute"), elCyl = $("#twCyl"), elPCyl = $("#twPCyl"), elTGonf = $("#twTGonf"),
      elBurst = $("#twBurst"), elDesc = $("#twDesc"), elWarn = $("#twWarn"),
      elStatus = $("#twStatus"), elRes = $("#twRes"), elMap = $("#twMap"),
      elWeekBtn = $("#twWeekBtn"), elWeekBox = $("#twWeekBox"), elWeekBody = $("#twWeekBody"),
      elToDay = $("#twToDay"), elToTime = $("#twToTime"), elEvery = $("#twEvery"), elLegend = $("#twLegendTxt"),
      elErrOn = $("#twErrOn"), elErrSig = $("#twErrSig"), elErrAsc = $("#twErrAsc"), elErrDesc = $("#twErrDesc"),
      elFcOn = $("#twFcOn"),
      elMultiBar = $("#twMultiBar"), elMultiInfo = $("#twMultiInfo"), elMultiOff = $("#twMultiOff");

/* ---------- Testi: seguono la lingua scelta nel sito ---------- */
function lang(){ return document.documentElement.lang || "it"; }
function t(k){
  const d = window.I18N[lang()] || window.I18N.it;
  return d[k] !== undefined ? d[k] : window.I18N.it[k];
}
/* z: il fuso (IANA); se manca, quello della partenza scelta */
function fmtTime(d, withDay, z){
  const o = {timeZone:z || fuso(), hour:"2-digit", minute:"2-digit", hour12:false};
  if(withDay){ o.weekday = "short"; o.day = "numeric"; o.month = "short"; }
  return new Intl.DateTimeFormat(lang(), o).format(d);
}
function fmtDay(iso){
  const z = fuso();
  return new Intl.DateTimeFormat(lang(), {timeZone:z, weekday:"short", day:"numeric", month:"short"})
    .format(inFuso(iso, "12:00", z));
}
function num(x, dec){
  return new Intl.NumberFormat(lang(), {minimumFractionDigits:dec, maximumFractionDigits:dec}).format(x);
}
function el(tag, cls, text){
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(text !== undefined) e.textContent = text;
  return e;
}

/* ==========================================================
   1. Il pallone — porting di cometa_venti.py (ISA)
   ========================================================== */
const G = 9.80665, CD_ASC = 0.25, R_ARIA = 287.05, R_ELIO = 2077.1, P_STD = 101325, T_RIF = 288.15;
const DRATIO = P_STD/(R_ARIA*T_RIF) - P_STD/(R_ELIO*T_RIF);   /* aria - elio a 15 °C, kg/m³ */
const PRESET = {   /* StratoFlights; paracadute del kit: 1,2 m, Cd 1,0, 80 g */
  "1600": {diam:11.1, mass:1.6, pmax:1.6},
  "2000": {diam:12.5, mass:2.0, pmax:2.0}
};
const PARA_CD = 1.0, PARA_M = 0.08, PARA_D = 1.2;   /* paracadute del kit */
/* Bombola: 200 bar a 15 °C. A quella pressione l'elio non e' ideale:
   con il secondo coefficiente del viriale, P (V - n B) = n R T, cioe'
   Z = 1 + B P/(R T) ~ 1,10. Una 50 L contiene ~9,0 m³ a 1 atm, non 9,9. */
const R_GAS = 8.314462, B_ELIO = 11.8e-6, P_BOMB = 200e5;   /* J/(mol K), m³/mol, Pa; 200 bar se non si imposta a mano */
function moliBombola(Vb, P, T){ return P*Vb/(R_GAS*T + B_ELIO*P); }
function pressioneBombola(Vb, n, T){ return n*R_GAS*T/(Vb - n*B_ELIO); }
/* Soglie degli avvisi. Discesa: oltre 6 m/s al suolo l'urto rischia di
   rompere la sonda; il paracadute consigliato e' quello che da' 5 m/s. */
const DESC_MAX = 6, DESC_OBJ = 5, ASC_MIN = 3, BURST_MIN = 30000;

function densitaISA(h){
  let T, p;
  if(h < 11000){ T = 288.15 - 0.0065*h; p = 101325*Math.pow(T/288.15, 5.2559); }
  else if(h < 20000){ T = 216.65; p = 22632*Math.exp(-9.80665*(h - 11000)/(287.05*T)); }
  else if(h < 32000){ T = 216.65 + 0.001*(h - 20000); p = 5474.9*Math.pow(T/216.65, -34.1632); }
  else { T = 228.65 + 0.0028*(h - 32000); p = 868.02*Math.pow(T/228.65, -12.2011); }
  return p/(287.05*T);
}
const RHO0 = densitaISA(0);
function bisez(f, a, b){
  let fa = f(a);
  for(let i = 0; i < 300; i++){
    const m = (a + b)/2, fm = f(m);
    if(Math.abs(fm) < 1e-7 || (b - a)/2 < 1e-7) return m;
    if((fa < 0) === (fm < 0)){ a = m; fa = fm; } else b = m;
  }
  return (a + b)/2;
}
function ascRate(V, mb, mp){
  const free = V*DRATIO - mb - mp;
  if(free <= 0) return -1;
  const r = Math.cbrt(3*V/(4*Math.PI));
  return Math.sqrt(free*G/(0.5*RHO0*CD_ASC*Math.PI*r*r));
}
function volumePerSalita(mb, mp, v){
  if(ascRate(60, mb, mp) < v) return null;               /* troppo pesante */
  return bisez(function(V){ return ascRate(V, mb, mp) - v; }, 0.3, 60);
}
function quotaScoppio(V, d){
  const rb = RHO0*V/((Math.PI/6)*d*d*d);
  if(RHO0 < rb) return 0;
  return bisez(function(h){ return densitaISA(h) - rb; }, 0, 50000);
}
function vAtterraggio(m, d){
  return Math.sqrt(2*m*G/(RHO0*PARA_CD*Math.PI*(d/2)*(d/2)));
}
function diamPerDiscesa(m, v){      /* l'inversa: il paracadute che da' v al suolo */
  return Math.sqrt(8*m*G/(RHO0*PARA_CD*Math.PI*v*v));
}

/* ---------- L'atmosfera del giorno ----------
   Come Colonna in cometa_venti.py: fra i livelli di pressione la densita'
   e' quella osservata, rho = p/(R T); sopra l'ultimo livello si prende
   da NRLMSIS solo la forma, ancorata al valore osservato in cima,
   cosi' la colonna sottostante resta quella vera. */
const LIVELLI = [1000,925,850,700,500,400,300,250,200,150,100,70,50,30];
const RE_GEO = 6356766;
function zGeom(hgp){ return RE_GEO*hgp/(RE_GEO - hgp); }
function msisLn(z, lat, doy){
  const M = window.COMETA_MSIS;
  if(!M) return Math.log(densitaISA(z));
  const cl = function(x, a, b){ return Math.max(a, Math.min(b, x)); };
  const L0 = M.lat[0], L1 = M.lat[M.lat.length - 1], dL = M.lat[1] - M.lat[0];   /* dalla tabella */
  const fi = (cl(lat, L0, L1) - L0)/dL, i0 = Math.min(Math.floor(fi), M.lat.length - 2), fl = fi - i0;
  let fm = (doy - 15)/30.44; fm = ((fm % 12) + 12) % 12;
  const j0 = Math.floor(fm) % 12, j1 = (j0 + 1) % 12, fj = fm - Math.floor(fm);
  const fk = (cl(z/1000, 10, 50) - 10)/2, k0 = Math.min(Math.floor(fk), M.alt_km.length - 2), fz = fk - k0;
  const v = function(i, j){ const r = M.lnrho[i][j]; return r[k0] + fz*(r[k0 + 1] - r[k0]); };
  const a = v(i0, j0) + fj*(v(i0, j1) - v(i0, j0));
  const b = v(i0 + 1, j0) + fj*(v(i0 + 1, j1) - v(i0 + 1, j0));
  return a + fl*(b - a);
}
function dayOfYear(iso){
  const d = new Date(iso + "T12:00:00Z");
  return Math.round((d - Date.UTC(d.getUTCFullYear(), 0, 1))/864e5) + 1;
}
/* Colonna di densita' del giorno, o null se i dati non bastano */
function dayColumn(h, iso, hhmm, lat){
  if(!h || !h.time) return null;
  const hh = Math.min(23, Math.round(parseInt(hhmm.slice(0, 2), 10) + parseInt(hhmm.slice(3, 5), 10)/60));
  const idx = h.time.indexOf(iso + "T" + String(hh).padStart(2, "0") + ":00");
  if(idx < 0) return null;
  const pts = [];
  LIVELLI.forEach(function(l){
    const T = h["temperature_" + l + "hPa"], Z = h["geopotential_height_" + l + "hPa"];
    if(!T || !Z || T[idx] == null || Z[idx] == null) return;
    const TK = T[idx] + 273.15;
    if(TK <= 150 || TK >= 350) return;                  /* valori assurdi */
    pts.push([zGeom(Z[idx]), Math.log(l*100/(R_ARIA*TK))]);
  });
  if(pts.length < 4) return null;
  pts.sort(function(a, b){ return a[0] - b[0]; });
  const zs = pts.map(function(p){ return p[0]; }), ln = pts.map(function(p){ return p[1]; });
  const doy = dayOfYear(iso), top = zs[zs.length - 1], bot = zs[0];
  const kTop = ln[ln.length - 1] - msisLn(top, lat, doy);
  const kBot = ln[0] - Math.log(densitaISA(bot));
  return function(z){
    if(z > top) return Math.exp(msisLn(z, lat, doy) + kTop);
    if(z < bot) return Math.exp(Math.log(densitaISA(z)) + kBot);
    for(let i = 0; i < zs.length - 1; i++){
      if(z <= zs[i + 1]) return Math.exp(ln[i] + (z - zs[i])/(zs[i + 1] - zs[i])*(ln[i + 1] - ln[i]));
    }
    return Math.exp(ln[ln.length - 1]);
  };
}
function quotaScoppioCol(V, d, rho){
  const rb = RHO0*V/((Math.PI/6)*d*d*d);          /* l'invariante e' rho*V, come in quotaScoppio */
  if(rho(0) < rb) return 0;
  return bisez(function(h){ return rho(h) - rb; }, 0, 50000);
}
/* Una richiesta per luogo copre tutta la settimana della previsione */
let atmo = {key:null, promise:null, h:null};
function atmoKey(pl){ return pl.lat.toFixed(2) + "," + pl.lon.toFixed(2); }
/* L'atmosfera prevista per un luogo, ora per ora per tutta la settimana della
   previsione (null se non arriva). La usa il modulo (loadAtmo, con la cache
   del luogo scelto) e il volo della Diretta (voloDiretta, piu' sotto).
   z: il fuso delle ore della risposta; "auto" (il modulo) e' quello del
   luogo, e Open-Meteo lo restituisce in h.fuso. */
function fetchHourly(pl, z){
  const hourly = [];
  LIVELLI.forEach(function(l){ hourly.push("temperature_" + l + "hPa", "geopotential_height_" + l + "hPa"); });
  hourly.push("temperature_2m", "surface_pressure");        /* per il gonfiaggio */
  const q = new URLSearchParams({latitude:pl.lat.toFixed(4), longitude:pl.lon.toFixed(4),
    hourly:hourly.join(","), timezone:z || "auto", start_date:today, end_date:lastDay});
  return fetch(METEO + "?" + q.toString())
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){
      if(!d || !d.hourly) return null;
      d.hourly.fuso = d.timezone && fusoValido(d.timezone) ? d.timezone : null;
      return d.hourly;
    }, function(){ return null; });
}
function fusoValido(z){
  try { new Intl.DateTimeFormat("en", {timeZone:z}); return true; } catch(e){ return false; }
}
/* Il fuso di un luogo di partenza: quello che ha detto Open-Meteo con
   l'atmosfera, se e' arrivata, altrimenti Montevideo. fuso(): quello della
   partenza scelta. */
function fusoDi(pl){
  return pl && atmo.key === atmoKey(pl) && atmo.h && atmo.h.fuso || TZ;
}
function fuso(){ return fusoDi(launch); }
/* Quanti ms il fuso z e' avanti rispetto a UTC all'istante t */
function scartoFuso(t, z){
  const p = {};
  new Intl.DateTimeFormat("en-US", {timeZone:z, hourCycle:"h23", year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit"}).formatToParts(t).forEach(function(x){ p[x.type] = x.value; });
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - (t - t % 1000);
}
/* L'istante in cui nel fuso z sono le hhmm del giorno iso (con l'ora legale,
   dove c'e': lo scarto si ricalcola sull'istante trovato) */
function inFuso(iso, hhmm, z){
  const w = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), +hhmm.slice(0, 2), +hhmm.slice(3, 5));
  let t = w - scartoFuso(w, z);
  t = w - scartoFuso(t, z);
  return new Date(t);
}
/* "UTC−3", "UTC+5:30", "UTC" */
function etichettaUtc(t, z){
  const m = Math.round(scartoFuso(t.getTime(), z)/60000);
  if(!m) return "UTC";
  const a = Math.abs(m);
  return "UTC" + (m < 0 ? "−" : "+") + Math.floor(a/60) + (a % 60 ? ":" + String(a % 60).padStart(2, "0") : "");
}
/* L'etichetta dell'ora: dice in che fuso si sta scrivendo */
function etichettaOra(){
  const e = $("#twTimeL");
  if(!e) return;
  const z = fuso(), quando = launchAt(elDate.value || today, elTime.value || "11:00");
  e.textContent = t("twTime").replace("{utc}", etichettaUtc(quando, z));
}
function loadAtmo(pl){
  if(!pl) return Promise.resolve(null);
  const k = atmoKey(pl);
  if(atmo.key === k && atmo.promise) return atmo.promise;
  const cur = {key:k, h:null, promise:null};
  atmo = cur;
  cur.promise = fetchHourly(pl)
    .then(function(h){ cur.h = h; return h; })
    .then(function(h){
      /* una risposta fallita (429, rete) non si ricorda: la prossima richiesta per questo luogo riprova */
      if(!h && atmo === cur) atmo = {key:null, promise:null, h:null};
      return h;
    });
  return cur.promise;
}
/* Scarti della quota di scoppio se il lattice cede a d(1-s) o d(1+s):
   {lo, hi} in metri rispetto al valore nominale, con la stessa atmosfera.
   Si applicano anche a una quota imposta a mano. */
function burstSpread(b, iso, hhmm, s){
  const col = launch && atmo.key === atmoKey(launch) ? dayColumn(atmo.h, iso, hhmm, launch.lat) : null;
  const q = function(d){ return col ? quotaScoppioCol(b.V, d, col) : quotaScoppio(b.V, d); };
  const h0 = q(b.diam);
  return {lo:q(b.diam*(1 - s)) - h0, hi:q(b.diam*(1 + s)) - h0};
}
/* Temperatura [°C] e pressione [Pa] al suolo previste per il luogo, il
   giorno e l'ora del lancio (come --temp-gonfiaggio auto dello script) */
function groundAt(iso, hhmm){
  const h = launch && atmo.key === atmoKey(launch) ? atmo.h : null;
  if(!h || !h.time || !h.temperature_2m) return null;
  const hh = Math.min(23, Math.round(parseInt(hhmm.slice(0, 2), 10) + parseInt(hhmm.slice(3, 5), 10)/60));
  const i = h.time.indexOf(iso + "T" + String(hh).padStart(2, "0") + ":00");
  if(i < 0 || h.temperature_2m[i] == null) return null;
  return {T:h.temperature_2m[i], p:h.surface_pressure && h.surface_pressure[i] != null ? h.surface_pressure[i]*100 : P_STD};
}
/* Quota di scoppio per un giorno e un'ora: {m, day, isa} con day=false se tutta ISA;
   isa=true se il giorno e' reale ma sopra l'ultimo livello manca NRLMSIS (ripiego su ISA) */
function burstFor(b, iso, hhmm){
  const col = launch && atmo.key === atmoKey(launch) ? dayColumn(atmo.h, iso, hhmm, launch.lat) : null;
  return col ? {m:quotaScoppioCol(b.V, b.diam, col), day:true, isa:!window.COMETA_MSIS} : {m:b.burst, day:false, isa:true};
}

function readBalloon(){
  const pr = PRESET[elBal.value];
  const b = {
    diam: elDiam.value !== "" ? parseFloat(elDiam.value) : pr.diam,     /* a mano, o del modello */
    mass: elMass.value !== "" ? parseFloat(elMass.value) : pr.mass,
    pay: parseFloat(elPay.value), asc: parseFloat(elAsc.value),
    chute: elChute.value !== "" ? parseFloat(elChute.value) : PARA_D,   /* a mano, o quello del kit */
    cyl: parseFloat(elCyl.value)/1000,
    pCyl: elPCyl.value !== "" ? parseFloat(elPCyl.value)*1e5 : P_BOMB, pr: pr, warn: []
  };
  /* gonfiaggio: temperatura a mano, o quella prevista al suolo, o 15 °C; pressione prevista o 1 atm */
  const gr = groundAt(elDate.value, elTime.value || "11:00");
  b.tGonfAuto = gr ? gr.T : null;
  b.tGonf = elTGonf.value !== "" ? parseFloat(elTGonf.value) : (gr ? gr.T : T_RIF - 273.15);
  b.pGonf = gr ? gr.p : P_STD;
  /* Avvisi solo per cio' che compromette il volo: parametri mancanti o
     incompatibili, peso eccessivo, salita troppo lenta, discesa troppo veloce. */
  if(!(b.diam > 0 && b.mass > 0 && b.pay > 0 && b.asc >= 1 && b.asc <= 10 && b.chute > 0 && b.pCyl >= 20e5 && b.pCyl <= 300e5
       && b.tGonf > -40 && b.tGonf < 60)){
    b.warn.push(t("twWBad")); return b;
  }
  b.V = volumePerSalita(b.mass, b.pay, b.asc);
  if(!b.V){ b.warn.push(t("twWHeavy")); return b; }
  b.burst = quotaScoppio(b.V, b.diam);
  b.neck = (b.V*DRATIO - b.mass)*1000;
  b.desc = vAtterraggio(b.pay + PARA_M, b.chute);
  /* Elio: le moli necessarie non dipendono dalla temperatura (V e' a 15 °C
     e 1 atm; a parita' di portanza al collo la massa d'elio e' la stessa,
     come in volume_a_T dello script). Cambia il volume da caricare, e la
     bombola, che sta alla temperatura del gonfiaggio, dove si legge il manometro. */
  const TK = b.tGonf + 273.15;
  const nNec = P_STD*b.V/(R_GAS*T_RIF), nTot = moliBombola(b.cyl, b.pCyl, TK);
  b.Vg = nNec*R_GAS*TK/b.pGonf;                                 /* m³ nel pallone al gonfiaggio */
  b.pRest = nNec < nTot ? pressioneBombola(b.cyl, nTot - nNec, TK) : null;
  b.cylM3 = nTot*R_GAS*TK/b.pGonf;
  if(b.pRest === null) b.warn.push(t("twWCyl").replace("{v}", num(b.Vg, 2)).replace("{c}", num(b.cylM3, 2)));
  if(pr && b.pay > pr.pmax + 1e-9) b.warn.push(t("twWPay").replace("{max}", Math.round(pr.pmax*1000)));
  if(b.burst < BURST_MIN) b.warn.push(t("twWBurst"));
  if(b.asc < ASC_MIN) b.warn.push(t("twWSlow"));
  const md = parseFloat(elDesc.value), desc = elDesc.value !== "" && md > 0 ? md : b.desc;
  if(desc > DESC_MAX) b.warn.push(t("twWDesc").replace("{v}", num(desc, 1))
    .replace("{d}", num(diamPerDiscesa(b.pay + PARA_M, DESC_OBJ), 1)));
  return b;
}
function renderBalloon(){
  const pr = PRESET[elBal.value];
  elDiam.placeholder = pr.diam; elMass.placeholder = pr.mass; elChute.placeholder = PARA_D;
  elPCyl.placeholder = P_BOMB/1e5;
  const b = readBalloon();
  const set = function(id, v){ $(id).textContent = v; };
  elWarn.innerHTML = "";
  if(!b.V){
    ["#twCHe","#twCNeck","#twCBurst","#twCDesc","#twCBurstSrc","#twCDescSrc","#twCHeSrc"].forEach(function(id){ set(id, /Src$/.test(id) ? "" : "—"); });
    b.warn.forEach(function(w){ elWarn.appendChild(el("li", null, w)); });
    return b;
  }
  elTGonf.placeholder = (b.tGonfAuto !== null ? b.tGonfAuto : T_RIF - 273.15).toFixed(0);
  set("#twCHe", num(b.Vg, 2) + " m³" + (b.pRest !== null ? " · " + num((b.pCyl - b.pRest)/1e5, 0) + " bar" : ""));
  set("#twCHeSrc", t("twGonfAt").replace("{t}", num(b.tGonf, 0)).replace("{p}", String(Math.round(b.pGonf/100))));
  set("#twCNeck", num(b.neck, 0) + " g");
  /* le tessere mostrano i valori che userà il calcolo: quelli a mano, se ci sono */
  const mb = parseFloat(elBurst.value), md = parseFloat(elDesc.value);
  const hand = " · " + t("twHand");
  const bd = burstFor(b, elDate.value, elTime.value || "11:00");
  set("#twCBurst", elBurst.value !== "" && mb > 0 ? num(mb, 1) + " km" + hand : num(bd.m/1000, 1) + " km");
  set("#twCBurstSrc", elBurst.value !== "" && mb > 0 ? "" : t(!bd.day ? "twAtmoStd" : bd.isa ? "twAtmoDayIsa" : "twAtmoDay"));
  set("#twCDesc", elDesc.value !== "" && md > 0 ? num(md, 1) + " m/s" + hand : num(b.desc, 1) + " m/s");
  set("#twCDescSrc", elDesc.value !== "" && md > 0 ? "" : t("twDescSrc"));
  elBurst.placeholder = (bd.m/1000).toFixed(1); elDesc.placeholder = b.desc.toFixed(1);
  b.warn.forEach(function(w){ elWarn.appendChild(el("li", null, w)); });
  fcWarn(null);
  return b;
}
/* Avviso dell'errore di previsione, fra quelli del pallone: per un lancio
   oggi e' zero per definizione (si vede subito, prima del calcolo); dopo
   il calcolo puo' dire che la curva non e' disponibile. */
function fcWarn(r){
  const old = elWarn.querySelector(".tw-fc");
  if(old) old.remove();
  if(!elFcOn || !elFcOn.checked) return;
  const zero = r && r.fc ? r.fc.zero : elDate.value && elDate.value <= today;
  const na = r && r.fc && r.fc.na;
  if(zero || na) elWarn.appendChild(el("li", "tw-fc", t(zero ? "twFcZero" : "twFcNa")));
}
/* lo scarto da UTC puo' cambiare col giorno, dove c'e' l'ora legale */
[elDate, elTime].forEach(function(e){ e.addEventListener("input", etichettaOra); });
[elBal, elDiam, elMass, elPay, elAsc, elCyl, elPCyl, elTGonf, elChute, elBurst, elDesc, elDate, elTime, elFcOn].forEach(function(e){
  if(e) e.addEventListener("input", renderBalloon);
});

/* Parametri del volo: quelli del pallone, salvo quelli imposti a mano */
function flightParams(iso, hhmm){
  const b = readBalloon();
  if(!b.V) return null;
  const mb = parseFloat(elBurst.value), md = parseFloat(elDesc.value);
  const bd = burstFor(b, iso || elDate.value, hhmm || elTime.value || "11:00");
  const p = {asc:b.asc, burst:bd.m/1000, desc:b.desc, atmo:!bd.day ? "std" : bd.isa ? "dayIsa" : "day"};
  if(elBurst.value !== ""){ if(!(mb >= 10 && mb <= 45)) return null; p.burst = mb; p.atmo = "hand"; }
  if(elDesc.value !== ""){ if(!(md >= 1 && md <= 15)) return null; p.desc = md; }
  return p;
}

/* ==========================================================
   2. La partenza
   ========================================================== */
let launch = null;            /* {name, lat, lon} */
let map = null, layer = null, launchMk = null, mapReady = null, mapkit = null;   /* la mappa nasce dopo */
let last = null;          /* ultimo calcolo, per ridisegnare al cambio di lingua */
let view = null, shown = null;   /* vista 3D (assets/map3d.js): il pulsante 2D/3D; shown = cio' che e' a schermo */
function c3(){ return view && view.isOn() ? view.ctl() : null; }   /* la mappa 3D, se e' quella a vista */
let week = null;          /* confronto dei prossimi giorni: {iso: risultato} */
/* Risultati di un altro luogo non devono restare a schermo */
function clearResults(){
  last = null; week = null;
  elRes.innerHTML = ""; elWeekBody.innerHTML = ""; elWeekBox.hidden = true;
  if(layer) layer.clearLayers();
  shown = null;
  if(c3()) c3().render(null, false);
  if(elLegend){ elLegend.setAttribute("data-i18n", kExcl("twLegend")); elLegend.textContent = t(kExcl("twLegend")); }
}
function saveLaunch(){
  try { localStorage.setItem(KEY, JSON.stringify(launch)); } catch(e){ /* navigazione privata */ }
}
function loadLaunch(){
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if(v && isFinite(v.lat) && isFinite(v.lon)) return v;
  } catch(e){ /* niente di salvato */ }
  return null;
}
/* Le coordinate sempre col punto, in ogni lingua: con la virgola decimale
   "-33,2906, -56,1416" si legge male, e cosi' si incollano in una mappa o in un GPS */
function coordLabel(lat, lon){ return lat.toFixed(4) + ", " + lon.toFixed(4); }
function setLaunch(pl, keepText, noSave){
  if(last && (last.from.lat !== pl.lat || last.from.lon !== pl.lon)) clearResults();
  launch = {name:pl.name || coordLabel(pl.lat, pl.lon), lat:pl.lat, lon:pl.lon};
  if(!keepText) elWhere.value = launch.name;
  if(!noSave) saveLaunch();            /* si ricorda solo cio' che ha scelto il visitatore */
  closeSugg();
  if(map) placeLaunchMarker(true);
  etichettaOra();
  loadAtmo(launch).then(function(){ etichettaOra(); renderBalloon(); });
  loadWeather(launch);
}

/* Le cinque icone del meteo (sole, sole e nuvola, nuvola e goccia, nuvola
   e tre gocce, vento): soglie semplici su nuvolosita', probabilita' di
   pioggia e vento a terra, non un vero simbolo meteorologico — bastano a
   dare un'idea d'insieme accanto ai numeri. SVG inline per lo stesso
   motivo delle icone di mapkit.js: un'emoji dipende dal font del
   sistema. Ordine di priorita': pioggia (debole o forte), cielo coperto,
   vento, parzialmente nuvoloso, sole. Il vento vince su sole e su
   parzialmente nuvoloso, ma non su pioggia e cielo coperto: la copertura
   conta di piu' per decidere se partire. 24 km/h e' la soglia citata piu'
   spesso nelle guide amatoriali ai palloni stratosferici, non un limite
   calcolato da noi — da adattare se la scuola ne segue uno diverso. */
const W_ICON_SUN = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12h2.5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/></svg>';
const W_ICON_PARTLY = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5.5a4 4 0 0 1 7.4 2.1"/><path d="M17.5 20H8a4 4 0 1 1 1.3-7.8 5 5 0 0 1 9.6 2A3.5 3.5 0 0 1 17.5 20Z"/></svg>';
const W_ICON_CLOUD = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H8a4 4 0 1 1 1.3-7.8 5 5 0 0 1 9.6 2A3.5 3.5 0 0 1 17.5 19Z"/></svg>';
const W_ICON_DRIZZLE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 15H8a4 4 0 1 1 1.3-7.8 5 5 0 0 1 9.6 2A3.5 3.5 0 0 1 17.5 15Z"/><path d="M12 18.5v2.5"/></svg>';
const W_ICON_RAIN = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 13H8a4 4 0 1 1 1.3-7.8 5 5 0 0 1 9.6 2A3.5 3.5 0 0 1 17.5 13Z"/><path d="M8 17v2.5M12 17v2.5M16 17v2.5"/></svg>';
const W_ICON_WIND = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9a2 2 0 1 0-2-2.8"/><path d="M3 12h13a2.2 2.2 0 1 1-2.2 3.1"/><path d="M3 16h7a1.8 1.8 0 1 1-1.8 2.5"/></svg>';
const W_WIND_STRONG_KMH = 24;   // soglia "vento forte": vedi commento sopra
function weatherIcon(cloudPct, rainPct, windKmh){
  if(rainPct >= 60) return W_ICON_RAIN;
  if(rainPct >= 25) return W_ICON_DRIZZLE;
  if(cloudPct >= 85) return W_ICON_CLOUD;
  if(windKmh >= W_WIND_STRONG_KMH) return W_ICON_WIND;
  if(cloudPct >= 50) return W_ICON_PARTLY;
  return W_ICON_SUN;
}

/* Meteo previsto nel punto di partenza, al giorno e all'ora della
   partenza scelti — gli stessi passati a Tawhiri — solo per dare
   un'idea di cosa si troverebbe al lancio, non per decidere la
   traiettoria. Previsione ora per ora di Open-Meteo (la stessa fonte di
   loadAtmo), che arriva a 16 giorni, piu' dei GIORNI_MAX selezionabili.
   Si aggiorna quando cambiano luogo, data o ora; weatherSeq scarta una
   risposta arrivata dopo quella di una richiesta piu' recente (cambi
   rapidi di data o di ora). */
let weatherSeq = 0;
/* Title del riquadro nuvole: i tre strati, sempre in inglese (low/mid/high)
   in tutte le lingue; il numero e l'icona restano la copertura totale. */
function cloudsTip(h, i){
  const g = function(k){ return h[k] && h[k][i] != null ? Math.round(h[k][i]) + " %" : "—"; };
  return h.cloud_cover_low ? "low " + g("cloud_cover_low") + " · mid " + g("cloud_cover_mid") + " · high " + g("cloud_cover_high") : "";
}
function loadWeather(pl){
  const el = document.getElementById("twWeather");
  if(!el || !pl || !elDate.value) return;
  const iso = elDate.value, hhmm = elTime.value || "11:00";
  const hh = Math.min(23, Math.round(parseInt(hhmm.slice(0, 2), 10) + parseInt(hhmm.slice(3, 5), 10)/60));
  const key = iso + "T" + String(hh).padStart(2, "0") + ":00";
  const seq = ++weatherSeq;
  const q = new URLSearchParams({
    latitude: pl.lat.toFixed(4), longitude: pl.lon.toFixed(4),
    hourly: "temperature_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_gusts_10m,precipitation_probability",
    start_date: iso, end_date: iso, timezone: "auto"      /* ore del luogo, come giorno e ora scelti */
  });
  fetch(METEO + "?" + q.toString())
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){
      if(seq !== weatherSeq) return;
      const h = d && d.hourly, i = h && h.time ? h.time.indexOf(key) : -1;
      if(i < 0 || h.temperature_2m[i] == null){ el.hidden = true; return; }
      el.hidden = false;
      const rain = h.precipitation_probability ? h.precipitation_probability[i] : null;
      document.getElementById("twWTemp").textContent = Math.round(h.temperature_2m[i]) + "°C";
      document.getElementById("twWWind").innerHTML = Math.round(h.wind_speed_10m[i]) + "<small>km/h</small>";
      const wtile = document.getElementById("twWWind").parentNode, gust = h.wind_gusts_10m && h.wind_gusts_10m[i];
      if(gust != null) wtile.title = "gusts " + Math.round(gust) + " km/h"; else wtile.removeAttribute("title");
      const tile = document.getElementById("twWClouds"), tip = cloudsTip(h, i);
      tile.textContent = Math.round(h.cloud_cover[i]) + "%";
      if(tip) tile.parentNode.title = tip; else tile.parentNode.removeAttribute("title");
      document.getElementById("twWRain").textContent = rain == null ? "—" : Math.round(rain) + "%";
      document.getElementById("twWIcon").innerHTML = weatherIcon(h.cloud_cover[i], rain || 0, h.wind_speed_10m[i]);
    })
    .catch(function(){ if(seq === weatherSeq) el.hidden = true; });
}
[elDate, elTime].forEach(function(e){
  e.addEventListener("change", function(){ if(launch) loadWeather(launch); });
});

/* Coordinate scritte a mano: "-33.38, -56.52", "-33.38 -56.52",
   "-33,38; -56,52". La virgola decimale vale solo con ; o spazio. */
function parseCoords(s){
  let m = s.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if(!m) m = s.match(/^\s*(-?\d{1,2}(?:,\d+)?)\s*[;\s]\s*(-?\d{1,3}(?:,\d+)?)\s*$/);
  if(!m) return null;
  const lat = parseFloat(m[1].replace(",", ".")), lon = parseFloat(m[2].replace(",", "."));
  if(Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {lat:lat, lon:lon};
}

/* Suggerimenti mentre si scrive: i siti dello studio, poi le localita'
   del geocoder di Open-Meteo (GeoNames), l'Uruguay per primo. */
let sugg = [], active = -1, geoTimer = 0, geoSeq = 0;
function norm(x){ return x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function closeSugg(){
  elSugg.hidden = true; elWhere.setAttribute("aria-expanded", "false"); active = -1;
}
function showSugg(list, msg){
  sugg = list; active = -1; elSugg.innerHTML = "";
  list.forEach(function(s, i){
    const li = el("li", "tw-sg");
    li.id = "twSg" + i; li.setAttribute("role", "option");
    li.appendChild(el("span", "tw-sg-n", s.name));
    const extra = s.studied ? t("twStudied") : s.note ? t(s.note) : (s.coords ? "" : [s.admin, s.country].filter(Boolean).join(", "));
    if(extra) li.appendChild(el("span", "tw-sg-x", extra));
    li.addEventListener("mousedown", function(e){ e.preventDefault(); setLaunch(s); });
    elSugg.appendChild(li);
  });
  if(msg) elSugg.appendChild(el("li", "tw-sg tw-sg-msg", msg));
  const open = list.length > 0 || !!msg;
  elSugg.hidden = !open; elWhere.setAttribute("aria-expanded", String(open));
}
function suggest(all){
  const q = all ? "" : elWhere.value.trim();
  const c = parseCoords(q);
  if(c){ showSugg([{name:coordLabel(c.lat, c.lon), lat:c.lat, lon:c.lon, coords:true}]); return; }
  const local = SUGGERITI.filter(function(s){ return !q || norm(s.name).indexOf(norm(q)) >= 0; });
  showSugg(local);
  clearTimeout(geoTimer);
  if(q.length < 2) return;
  const seq = ++geoSeq;
  geoTimer = setTimeout(function(){
    fetch(GEO + "?" + new URLSearchParams({name:q, count:"8", language:lang(), format:"json"}))
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(seq !== geoSeq) return;                         /* nel frattempo si e' scritto altro */
        const found = (d.results || []).map(function(r){
          return {name:r.name, lat:r.latitude, lon:r.longitude, admin:r.admin1,
                  country:r.country_code === "UY" ? "" : r.country, uy:r.country_code === "UY"};
        }).sort(function(a, b){ return (b.uy ? 1 : 0) - (a.uy ? 1 : 0); });
        const all = local.concat(found);
        showSugg(all, all.length ? "" : t("twNoRes"));
      }, function(){ /* senza rete restano i suggerimenti locali */ });
  }, 280);
}
elWhere.addEventListener("input", function(){ launch = null; clearResults(); suggest(); });
/* Toccando il campo con un luogo gia' scelto si vedono tutti i suggerimenti,
   e il testo e' selezionato: scrivendo lo si sostituisce. */
elWhere.addEventListener("focus", function(){
  const chosen = launch && elWhere.value === launch.name;
  if(chosen) elWhere.select();
  suggest(chosen);
});
elWhere.addEventListener("blur", function(){ setTimeout(closeSugg, 120); });
elWhere.addEventListener("keydown", function(e){
  const n = sugg.length;
  if(e.key === "ArrowDown" && n){ e.preventDefault(); active = (active + 1) % n; }
  else if(e.key === "ArrowUp" && n){ e.preventDefault(); active = (active - 1 + n) % n; }
  else if(e.key === "Enter"){
    if(!elSugg.hidden && n){ e.preventDefault(); setLaunch(sugg[active >= 0 ? active : 0]); }
    return;
  }
  else if(e.key === "Escape"){ closeSugg(); return; }
  else return;
  [].forEach.call(elSugg.children, function(li, i){ li.classList.toggle("on", i === active); });
  elWhere.setAttribute("aria-activedescendant", active >= 0 ? "twSg" + active : "");
});
elGeo.addEventListener("click", function(){
  if(!navigator.geolocation || !window.isSecureContext){ setStatus(t("twGeoErr"), true); return; }
  setStatus(t("twGeoWait"));
  navigator.geolocation.getCurrentPosition(function(pos){
    setLaunch({lat:pos.coords.latitude, lon:pos.coords.longitude}); setStatus("");
    ensureMap().then(function(){ map.setView([launch.lat, launch.lon], 9); });
  }, function(err){
    setStatus(t(err && err.code === 1 ? "twGeoDenied" : "twGeoErr"), true);
  }, {enableHighAccuracy:false, maximumAge:60000, timeout:20000});
});

/* ---------- Date: il calendario e' quello di Montevideo ---------- */
function isoDay(d, z){
  return new Intl.DateTimeFormat("en-CA", {timeZone:z || TZ, year:"numeric", month:"2-digit", day:"2-digit"}).format(d);
}
function addDays(iso, n){
  const d = new Date(iso + "T12:00:00" + TZ_OFF);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}
const today = isoDay(new Date());
const lastDay = addDays(today, GIORNI_MAX);
elDate.min = today; elDate.max = lastDay;
if(elToDay){ elToDay.min = today; elToDay.max = lastDay; }
(function defaults(){
  const L = window.COMETA_LAUNCH;
  const ld = L ? isoDay(L) : null;
  if(ld && ld >= today && ld <= lastDay){
    elDate.value = ld;
    elTime.value = new Intl.DateTimeFormat("en-GB", {timeZone:TZ, hour:"2-digit", minute:"2-digit", hour12:false}).format(L);
  } else {
    elDate.value = addDays(today, 1);
  }
  /* Si parte dall'ultimo luogo scelto su questo dispositivo, altrimenti
     da La Calera (Minas): con i valori proposti il calcolo
     funziona subito, e il luogo si cambia scrivendo sopra. */
  const saved = loadLaunch();
  if(saved) setLaunch(saved); else setLaunch(PREDEFINITO, false, true);
})();

/* ---------- Geometria ---------- */
function inPoly(lon, lat, poly){
  let inside = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if(((yi > lat) !== (yj > lat)) && (lon < (xj - xi)*(lat - yi)/(yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
const RAD = Math.PI/180;
function distKm(la1, lo1, la2, lo2){
  const a = Math.pow(Math.sin((la2 - la1)*RAD/2), 2) +
            Math.cos(la1*RAD)*Math.cos(la2*RAD)*Math.pow(Math.sin((lo2 - lo1)*RAD/2), 2);
  return 2*6371.0*Math.asin(Math.sqrt(a));
}
function bearing(la1, lo1, la2, lo2){
  const y = Math.sin((lo2 - lo1)*RAD)*Math.cos(la2*RAD);
  const x = Math.cos(la1*RAD)*Math.sin(la2*RAD) - Math.sin(la1*RAD)*Math.cos(la2*RAD)*Math.cos((lo2 - lo1)*RAD);
  return (Math.atan2(y, x)/RAD + 360) % 360;
}
/* Territorio e area di esclusione (DINACIA) valgono solo se si parte
   dall'Uruguay, come in cometa_venti.py: altrimenti nessun giudizio (null) */
function stato(lat, lon, from){
  if(!from || !inPoly(from.lon, from.lat, URU)) return null;
  if(!inPoly(lon, lat, URU)) return "fuori";
  if(MOSTRA_EXCL && inPoly(lon, lat, EXCL)) return "escl";
  return "ok";
}

/* ==========================================================
   3. La traiettoria — Tawhiri
   ========================================================== */
/* La quota di partenza non si passa: Tawhiri usa quella del terreno
   nel punto scelto (il suo modello digitale di elevazione), e la
   restituisce come primo punto della traiettoria. */
function predict(pl, whenUTC, p){
  const q = new URLSearchParams({
    profile: "standard_profile",
    launch_latitude: pl.lat.toFixed(5),
    launch_longitude: (((pl.lon % 360) + 360) % 360).toFixed(5),   /* Tawhiri vuole 0-360 */
    launch_datetime: whenUTC.toISOString().replace(/\.\d+Z$/, "Z"),
    ascent_rate: p.asc.toFixed(2),
    burst_altitude: Math.round(p.burst*1000),
    descent_rate: p.desc.toFixed(2)
  });
  return fetch(API + "?" + q.toString()).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(d){
      if(!r.ok || d.error){
        throw new Error((d.error && d.error.description) || ("HTTP " + r.status));
      }
      const res = parse(pl, d);
      res.tz = fusoDi(pl);
      return res;
    });
  }, function(){ throw new Error(t("twNoNet")); });
}
function parse(pl, d){
  const pts = [];
  (d.prediction || []).forEach(function(stage){
    stage.trajectory.forEach(function(p){
      pts.push({t:new Date(p.datetime), lat:p.latitude,
                lon:p.longitude >= 180 ? p.longitude - 360 : p.longitude,
                alt:p.altitude, up:stage.stage === "ascent"});
    });
  });
  if(pts.length < 2) throw new Error("traiettoria vuota");
  const asc = pts.filter(function(p){ return p.up; });
  const burst = asc.length ? asc[asc.length - 1] : pts[0];
  const end = pts[pts.length - 1], t0 = pts[0].t;
  return {
    ok: true, from: pl, pts: pts, burst: burst, end: end, ground: pts[0].alt,
    run: d.request && d.request.dataset ? new Date(d.request.dataset) : null,
    drift: distKm(pl.lat, pl.lon, end.lat, end.lon),
    bear: bearing(pl.lat, pl.lon, end.lat, end.lon),
    dur: (end.t - t0)/6e4,
    tBurst: (burst.t - t0)/6e4,
    burstDist: distKm(pl.lat, pl.lon, burst.lat, burst.lon),
    stato: stato(end.lat, end.lon, pl)
  };
}

/* ---------- Mappa ---------- */
function loadLeaflet(){
  const leaflet = window.L ? Promise.resolve() : new Promise(function(ok, ko){
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = LEAFLET + "leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = LEAFLET + "leaflet.js";
    s.onload = ok; s.onerror = ko;
    document.head.appendChild(s);
  });
  /* mapkit.js (satellite/schermo intero/radar pioggia): condiviso
     con assets/spot.js, non tocca window.L al caricamento, solo
     quando i suoi metodi vengono chiamati — puo' caricare in
     parallelo con leaflet.js. */
  const mapkit = window.COMETA_MAPKIT ? Promise.resolve() : new Promise(function(ok, ko){
    const s = document.createElement("script");
    s.src = "assets/mapkit.js?v=212";  // niente cache-bust qui finora: una correzione poteva restare invisibile a chi l'aveva gia' caricato
    s.onload = ok; s.onerror = ko;
    document.head.appendChild(s);
  });
  const map3d = window.COMETA_MAP3D ? Promise.resolve() : new Promise(function(ok){
    const s = document.createElement("script");
    s.src = "assets/map3d.js?v=212";
    s.onload = ok; s.onerror = ok;       /* senza, resta il 2D e basta */
    document.head.appendChild(s);
  });
  return Promise.all([leaflet, mapkit, map3d]);
}
function placeLaunchMarker(pan){
  const L = window.L;
  if(view && view.ctl()) view.ctl().setLaunch(launch, pan && view.isOn());
  if(!launch){ if(launchMk){ launchMk.remove(); launchMk = null; } return; }
  if(!launchMk){
    launchMk = L.marker([launch.lat, launch.lon], {
      draggable:true, keyboard:false,
      icon:L.divIcon({className:"tw-star", html:'<span style="color:' + COL + '">★</span>', iconSize:[26,26], iconAnchor:[13,13]})
    }).addTo(map);
    launchMk.on("dragend", function(){
      const ll = launchMk.getLatLng();
      setLaunch({lat:ll.lat, lon:ll.lng});
    });
  } else {
    launchMk.setLatLng([launch.lat, launch.lon]);
  }
  launchMk.unbindTooltip().bindTooltip(launch.name);
  if(pan && !map.getBounds().pad(-0.1).contains(launchMk.getLatLng())) map.panTo(launchMk.getLatLng());
}
function ensureMap(){
  if(mapReady) return mapReady;
  mapReady = loadLeaflet().then(function(){
    const L = window.L;
    map = L.map(elMap, {scrollWheelZoom:false, zoomControl:true});
    const street = L.tileLayer(TILES, {
      maxZoom:18, crossOrigin:true,      /* le stesse mattonelle servono all'esportazione */
      attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(map);
    L.control.scale({imperial:false, position:"bottomright"}).addTo(map);  // sopra l'attribuzione, non accanto: da telefono l'attribuzione (lunga col satellite Esri) va su piu' righe e copriva la scala in basso a sinistra
    /* schermo intero sul riquadro che contiene sia il 2D sia il 3D (elMap.parentNode):
       cambiando vista si resta a schermo intero */
    mapkit = window.COMETA_MAPKIT && window.COMETA_MAPKIT.enhance(map, L, elMap.parentNode, street, {onSave: exportPng});
    if(MOSTRA_EXCL) L.polygon(EXCL.map(function(p){ return [p[1], p[0]]; }),
              {color:"#FF7A5C", weight:1.5, fillColor:"#FF7A5C", fillOpacity:.16, interactive:false}).addTo(map);
    /* Fascia di piu' partenze: i poligoni si disegnano opachi in un pannello
       reso trasparente per intero, cosi' le sovrapposizioni non si sommano. */
    map.createPane("twBand").style.cssText = "z-index:395;opacity:.3";
    map.createPane("twLandZ").style.cssText = "z-index:396;opacity:.7";
    layer = L.layerGroup().addTo(map);
    /* il contenitore cambia misura (rotazione del telefono, pagina che
       si riassesta): Leaflet va avvisato, o centra su misure vecchie */
    if("ResizeObserver" in window) new ResizeObserver(function(){ map.invalidateSize(); }).observe(elMap);
    /* toccare la mappa sceglie il punto di partenza, e abilita la rotella */
    map.on("click", function(e){
      map.scrollWheelZoom.enable();
      setLaunch({lat:e.latlng.lat, lon:e.latlng.lng});
    });
    map.on("mouseout", function(){ map.scrollWheelZoom.disable(); });
    placeLaunchMarker(false);
    /* una sola vista iniziale: due spostamenti di fila avviano
       un'animazione che, finendo dopo, annullerebbe il primo disegno */
    if(launch) map.setView([launch.lat, launch.lon], 8);
    else map.fitBounds([[-35.1,-58.6],[-30.1,-53.1]]);
    /* 2D / 3D: pulsante accanto allo schermo intero; la scelta si ricorda */
    if(window.COMETA_MAP3D) view = window.COMETA_MAP3D.attach({
      L:L, map:map, elMap:elMap, el3Class:"tw-canvas",
      create:{
        color:COL, colorDown:COL, excl:MOSTRA_EXCL ? EXCL : null,     /* tutta la traiettoria azzurra, anche la discesa */
        onPick:function(lat, lon){ setLaunch({lat:lat, lon:lon}); },
        onDrag:function(lat, lon){ setLaunch({lat:lat, lon:lon}); },
        onSave:info3d, onSaveError:function(){ setStatus(t("twPngErr"), true); },
        weather:"#twWeather"      /* lo specchietto del meteo da copiare nell'immagine salvata */
      },
      onEnter:function(c){
        c.setLaunch(launch, false);
        if(shown) c.render(scene3d(shown), true);
        else { c.render(null, false); const ctr = map.getCenter(); c.jump(ctr.lat, ctr.lng, map.getZoom()); }
      },
      onLeave:function(){      /* il 2D non si e' inquadrato mentre era nascosto */
        if(shown){ if(shown.band) drawBand(shown, false); else draw(shown, false); }
      },
      onFail:function(){ setStatus(t("mk3dFail"), true); }
    });
  });
  return mapReady;
}
/* ---------- Vista 3D ----------
   Stesso calcolo, stessi risultati: cambia solo chi li disegna. Il 2D
   (Leaflet) resta sempre aggiornato; il 3D (MapLibre, assets/map3d.js)
   si crea alla prima richiesta e da li' segue show(). Il pulsante 2D/3D
   e la scelta ricordata stanno in COMETA_MAP3D.attach(). */
/* Titolo e righe della striscia sotto l'immagine 3D salvata */
function info3d(){
  const x = shown, name = launch ? launch.name : "";
  let title = "COMETA · " + name, lines = [], day = elDate.value;
  if(x && x.band){
    const ok = x.list.filter(function(r){ return r.ok; });
    title += " · " + t("twNFlights").toLowerCase() + " " + ok.length;
  } else if(x && x.ok){
    title += " · " + fmtTime(x.pts[0].t, true, x.tz) + (x.run ? " · GFS " + fmtTime(x.run, true, x.tz) : "");
    day = isoDay(x.pts[0].t, x.tz);
    lines.push(t("twDrift") + " " + num(x.drift, 0) + " km · " + t("twBear") + " " + num(x.bear, 0) + "° · " +
      t("twBurstC") + " " + num(x.burst.alt/1000, 1) + " km · " + t("twDur") + " " + num(x.dur, 0) + " min");
    lines.push(t("twLand") + " " + coordLabel(x.end.lat, x.end.lon) + " · Tawhiri (SondeHub) · NOAA GFS");
  }
  return {title:title, lines:lines,
    weatherHead:fmtTime(launchAt(elDate.value, elTime.value || "11:00"), true),
    filename:"cometa-traiettoria-3d-" + (name || "mappa").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + day};
}
/* I risultati di show() come li vuole map3d.js: [lon, lat] ovunque */
function scene3d(x){
  if(!x) return null;
  const ll = function(p){ return [p[1], p[0]]; };
  if(x.band){
    const ok = x.list.filter(function(r){ return r.ok; });
    if(!ok.length) return null;
    if(ok.length < 2) return scene3d(ok[0]);
    const g = bandGeom(ok, 120), AMB = "#FFB84D";      /* piu' fette del 2D: in 3D i gradini della quota si vedono */
    return {
      runs:ok, main:false,
      extr:g.slices.map(function(s){
        return {ring:s.ring.map(function(p){ return [p[0], p[1]]; }), base:Math.max(0, s.lo - 60), top:s.hi + 60, color:COL};
      }),
      fills:g.land.length >= 3 ? [{ring:g.land.map(function(p){ return [p[0], p[1]]; }), color:AMB, opacity:.55}] : [],
      lines:g.land.length < 3 ? [{coords:g.land.map(function(p){ return [p[0], p[1]]; }), color:AMB, width:8}] : []
    };
  }
  if(!x.ok) return null;
  const sc = {
    runs:[x], main:true, fills:[], lines:[],
    labels:{burst:t("twBurstC") + " " + num(x.burst.alt/1000, 1) + " km", land:t("twLand") + " " + fmtTime(x.end.t, false, x.tz)}
  };
  if(x.spread){
    const g = x.spread, VI = "#A98CFF";
    if(g.poly) sc.fills.push({ring:g.poly.map(ll), color:VI, opacity:.35});
    else sc.lines.push({coords:g.line.map(ll), color:VI, width:6});
  }
  return sc;
}

/* Leaflet misura il contenitore quando nasce: se la pagina era nascosta
   va rimisurato quando torna visibile. */
addEventListener("hashchange", function(){
  if(map) setTimeout(function(){ map.invalidateSize(); }, 60);
});
if("IntersectionObserver" in window){
  const io = new IntersectionObserver(function(en){
    if(en.some(function(e){ return e.isIntersecting; })){ io.disconnect(); ensureMap(); }
  }, {rootMargin:"300px"});
  io.observe(elMap);
} else {
  ensureMap();
}

function draw(r, noFit){
  const L = window.L;
  layer.clearLayers();
  if(!r || !r.ok) return;
  const up = r.pts.filter(function(p){ return p.up; }).map(function(p){ return [p.lat, p.lon]; });
  const down = r.pts.filter(function(p){ return !p.up; }).map(function(p){ return [p.lat, p.lon]; });
  if(down.length) down.unshift([r.burst.lat, r.burst.lon]);
  L.polyline(up, {color:COL, weight:3, opacity:.95, interactive:false}).addTo(layer);
  L.polyline(down, {color:COL, weight:2.5, opacity:.95, dashArray:"6 7", interactive:false}).addTo(layer);
  L.circleMarker([r.burst.lat, r.burst.lon], {radius:5, color:COL, weight:2, fillColor:"#fff", fillOpacity:1, bubblingMouseEvents:false})
    .bindTooltip(t("twBurstC") + " " + num(r.burst.alt/1000, 1) + " km").addTo(layer);
  L.circleMarker([r.end.lat, r.end.lon], {radius:8, color:"#02060f", weight:2, fillColor:"#FFB84D", fillOpacity:1, bubblingMouseEvents:false})
    .bindTooltip(t("twLand") + " " + fmtTime(r.end.t, false, r.tz)).addTo(layer);
  const bb = L.latLngBounds(up.concat(down));
  bb.extend([r.from.lat, r.from.lon]);
  if(r.spread){       /* area (o linea) di atterraggio: un solo colore */
    const g = r.spread, VI = "#A98CFF";
    /* smoothFactor 0: Leaflet non semplifica il contorno; smoothPolygon:
       non arrotonda i vertici al pixel. Cosi' gli archi della somma con il
       cerchio dell'errore di previsione restano lisci. */
    if(g.poly) new (smoothPolygon())(g.poly, {pane:"twLandZ", color:VI, weight:3, opacity:1, fillColor:VI, fillOpacity:.35,
      lineJoin:"round", smoothFactor:0, interactive:false}).addTo(layer);
    else L.polyline(g.line, {pane:"twLandZ", color:VI, weight:6, opacity:1, lineCap:"round", interactive:false}).addTo(layer);
    (g.poly || g.line).forEach(function(ll){ bb.extend(ll); });
  }
  if(!noFit){ map.invalidateSize(); map.fitBounds(bb, {padding:[30,30], maxZoom:10}); }
}

/* ---------- Area di atterraggio ----------
   Ogni parametro con incertezza attivo (diametro di scoppio, salita,
   discesa) ha un estremo basso e uno alto. Con un solo parametro si
   ricalcola il volo ai due estremi e si traccia la linea
   basso-nominale-alto (3 voli). Con due o tre si ricalcola ogni
   combinazione degli estremi (4 o 8 voli, piu' il nominale: 5 o 9) e
   l'area e' l'involucro convesso di tutti gli atterraggi, senza
   ipotesi di linearita' o di effetti che si sommano. */
function spreadGeom(r, specs, cs){
  const g = {n:specs.length, specs:specs}, nom = [r.end.lat, r.end.lon];
  const pts = cs.map(function(c){ return [c.end.lat, c.end.lon]; });
  if(g.n === 1) g.line = [pts[0], nom, pts[1]];
  else g.poly = hull(pts.concat([nom]).map(function(q){ return [q[1], q[0]]; })).map(function(q){ return [q[1], q[0]]; });
  const all = pts.concat([nom]);
  g.extent = 0;
  for(let i = 0; i < all.length; i++) for(let j = i + 1; j < all.length; j++)
    g.extent = Math.max(g.extent, distKm(all[i][0], all[i][1], all[j][0], all[j][1]));
  return g;
}
/* Didascalia dell'area: parametri attivi con la loro percentuale */
function legendLand(g){
  const names = g.specs.map(function(x){
    return t({B:"twLegPB", A:"twLegPA", D:"twLegPD"}[x.k]) + " (±" + num(x.s*100, (x.s*1000) % 10 ? 1 : 0) + " %)";
  });
  if(g.fc) names.push(t("twLegFc").replace("{t}", fcTempo(g.fc.toLaunch)));
  const list = names.length < 2 ? names[0] : names.slice(0, -1).join(", ") + " " + t("twAnd") + " " + names[names.length - 1];
  return t("twLegend") + " " + t(g.n > 1 || g.fc ? "twLegLand" : "twLegLine") + " " + list + ". " + t("twLegWind");
}

/* Leaflet arrotonda ogni vertice al pixel intero: su un arco con i punti a
   meno di un pixel l'uno dall'altro il contorno diventa a scalini. Questo
   poligono proietta i vertici senza arrotondare, e l'SVG li disegna con i
   decimali. */
let SmoothPolygon = null;
function smoothPolygon(){
  if(SmoothPolygon) return SmoothPolygon;
  const L = window.L;
  SmoothPolygon = L.Polygon.extend({
    _projectLatlngs: function(latlngs, result, projectedBounds){
      if(latlngs[0] instanceof L.LatLng){
        const origin = this._map.getPixelOrigin(), ring = [];
        for(let i = 0; i < latlngs.length; i++){
          const p = this._map.project(latlngs[i])._subtract(origin);
          ring.push(p); projectedBounds.extend(p);
        }
        result.push(ring);
      } else {
        for(let i = 0; i < latlngs.length; i++) this._projectLatlngs(latlngs[i], result, projectedBounds);
      }
    }
  });
  return SmoothPolygon;
}

/* ---------- Errore di previsione ----------
   La curva dice di quanto si e' spostato, in media su molti giorni,
   l'atterraggio previsto fra una corsa GFS di una certa eta' e la
   previsione del giorno stesso (terzo quartile, Q3). Il raggio si
   interpola sull'eta' della corsa usata (lancio - corsa) e si scala con
   la durata del volo: r = Q3(eta) * T / T_rif. Il giorno stesso del
   lancio e' zero per definizione: la curva misura la convergenza della
   previsione meteorologica, non l'errore del predittore. */
let curva = null;
function loadCurva(){
  if(curva) return curva;
  curva = fetch(CURVA, {cache:"no-cache"}).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ return d && d.classi ? d : null; }, function(){ return null; })
    .then(function(d){ if(!d) curva = null; return d; });       /* un fallimento non si ricorda */
  return curva;
}
function fcRadius(d, r, iso){
  if(iso <= today) return {km:0, zero:true};
  if(!d || !r.run) return {km:0, na:true};
  const age = (r.pts[0].t - r.run)/36e5;                       /* eta' della corsa al lancio, h */
  const C = d.classi.filter(function(c){ return c.n >= CURVA_NMIN; })
    .sort(function(a, b){ return a.eta_h - b.eta_h; });
  if(C.length < 2 || age > C[C.length - 1].eta_h + 12) return {km:0, na:true, age:age};
  let q = 0;
  if(age >= C[C.length - 1].eta_h) q = C[C.length - 1].q3_km;
  else if(age > C[0].eta_h){
    for(let i = 0; i < C.length - 1; i++){
      const a = C[i], b = C[i + 1];
      if(age <= b.eta_h){ q = a.q3_km + (age - a.eta_h)/(b.eta_h - a.eta_h)*(b.q3_km - a.q3_km); break; }
    }
  }
  const k = d.durata_ref_min > 0 ? r.dur/d.durata_ref_min : 1;
  return {km:q*k, age:age, q:q, k:k, toLaunch:(r.pts[0].t - Date.now())/36e5};
}
/* Un intervallo in ore (eta' della corsa, tempo al lancio): in giorni, sotto le 72 h in ore */
function fcTempo(h){
  if(h < 72){ const n = Math.max(1, Math.round(h)); return t(n === 1 ? "twFcHour" : "twFcHours").replace("{n}", n); }
  const n = Math.round(h/24); return t(n === 1 ? "twFcDay" : "twFcDays").replace("{n}", n);
}
/* Somma di Minkowski: ogni punto dell'area (o della linea, o il solo
   atterraggio nominale) si sposta di un vettore qualunque lungo al piu'
   r. Lo stesso errore di vento trasla tutti i voli dell'area, che
   attraversano gli stessi venti: la somma e' lineare, non in quadratura. */
function addForecast(r, g, fc){
  const base = g ? (g.poly || g.line) : [[r.end.lat, r.end.lon]];
  const N = 180, k = Math.cos(r.end.lat*RAD), pts = [];
  base.forEach(function(q){
    for(let i = 0; i < N; i++){
      const u = 2*Math.PI*i/N;
      pts.push([q[1] + fc.km*Math.cos(u)/(111.32*k), q[0] + fc.km*Math.sin(u)/110.57]);
    }
  });
  const out = g ? Object.assign({}, g) : {n:0, specs:[]};
  out.poly = hull(pts).map(function(q){ return [q[1], q[0]]; });
  delete out.line;
  out.fc = fc;
  out.extent = 0;
  for(let i = 0; i < out.poly.length; i++) for(let j = i + 1; j < out.poly.length; j++)
    out.extent = Math.max(out.extent, distKm(out.poly[i][0], out.poly[i][1], out.poly[j][0], out.poly[j][1]));
  return out;
}

/* ---------- Piu' partenze: una fascia sola ----------
   Ogni traiettoria si ricampiona in N+1 punti a frazioni uguali della
   sua durata; la fascia e' l'unione degli involucri convessi di due
   «fette» consecutive: segue le curve, non riempie a ventaglio. */
const FETTE = 48;
function resample(r, N){
  const P = r.pts, t0 = P[0].t.getTime(), t1 = P[P.length - 1].t.getTime(), out = [];
  let j = 0;
  for(let k = 0; k <= N; k++){
    const tt = t0 + (t1 - t0)*k/N;
    while(j < P.length - 2 && P[j + 1].t.getTime() < tt) j++;
    const a = P[j], b = P[j + 1], span = b.t - a.t;
    const f = span > 0 ? Math.min(1, Math.max(0, (tt - a.t)/span)) : 0;
    out.push([a.lon + f*(b.lon - a.lon), a.lat + f*(b.lat - a.lat), a.alt + f*(b.alt - a.alt)]);
  }
  return out;
}
function hull(P){      /* catena monotona di Andrew, punti [x, y] */
  const pts = P.slice().sort(function(a, b){ return a[0] - b[0] || a[1] - b[1]; });
  if(pts.length < 3) return pts;
  const cross = function(o, a, b){ return (a[0] - o[0])*(b[1] - o[1]) - (a[1] - o[1])*(b[0] - o[0]); };
  const lo = [], hi = [];
  pts.forEach(function(p){ while(lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
  for(let i = pts.length - 1; i >= 0; i--){
    const p = pts[i];
    while(hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop();
    hi.push(p);
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
/* Geometria della fascia, comune a 2D e 3D: le «fette» e l'area di
   atterraggio, come liste di [lon, lat] */
function bandGeom(ok, N){
  N = N || FETTE;
  const R = ok.map(function(r){ return resample(r, N); }), slices = [];
  /* quanta parte del volo e' salita, in media: serve per colorare le fette in 3D */
  const fb = ok.reduce(function(a, r){ return a + (r.dur > 0 ? r.tBurst/r.dur : .5); }, 0)/ok.length;
  for(let k = 0; k < N; k++){
    const P = R.map(function(r){ return r[k]; }).concat(R.map(function(r){ return r[k + 1]; }));
    const h = hull(P);
    if(h.length < 3) continue;
    let lo = Infinity, hi = -Infinity;
    P.forEach(function(p){ lo = Math.min(lo, p[2]); hi = Math.max(hi, p[2]); });
    slices.push({ring:h, lo:lo, hi:hi, up:(k + .5)/N < fb});
  }
  return {slices:slices, land:hull(ok.map(function(r){ return [r.end.lon, r.end.lat]; }))};
}
function drawBand(x, noFit){
  const L = window.L, ok = x.list.filter(function(r){ return r.ok; });
  layer.clearLayers();
  if(ok.length < 2){ if(ok.length) draw(ok[0], noFit); return; }
  const g = bandGeom(ok);
  const bb = L.latLngBounds([[x.from.lat, x.from.lon]]);
  const ll = function(p){ return [p[1], p[0]]; };
  g.slices.forEach(function(sl){
    const h = sl.ring;
    L.polygon(h.map(ll), {pane:"twBand", color:COL, weight:2, opacity:1, fillColor:COL, fillOpacity:1, interactive:false}).addTo(layer);
    h.forEach(function(p){ bb.extend(ll(p)); });
  });
  const land = g.land;
  const st = {pane:"twLandZ", color:"#FFB84D", weight:land.length < 3 ? 8 : 2, opacity:1, fillColor:"#FFB84D", fillOpacity:1, interactive:false};
  (land.length < 3 ? L.polyline(land.map(ll), st) : L.polygon(land.map(ll), st)).addTo(layer);
  if(!noFit){ map.invalidateSize(); map.fitBounds(bb, {padding:[30,30], maxZoom:10}); }
}
function rng(v, dec, unit){
  const a = Math.min.apply(null, v), b = Math.max.apply(null, v);
  return (b - a < Math.pow(10, -dec)/2 ? num(a, dec) : num(a, dec) + "–" + num(b, dec)) + unit;
}
function renderBand(x){
  elRes.innerHTML = "";
  const ok = x.list.filter(function(r){ return r.ok; });
  const card = el("div", "tw-card");
  card.appendChild(el("h4", null, x.from.name));
  if(!ok.length){
    const e = x.list.filter(function(r){ return !r.ok; })[0];
    card.appendChild(el("p", "tw-err", t("twErr").replace("{msg}", e ? e.err : "—")));
    elRes.appendChild(card); return;
  }
  const n = ok.length, cnt = {ok:0, escl:0, fuori:0};
  ok.forEach(function(r){ if(r.stato) cnt[r.stato]++; });
  const worst = cnt.fuori ? "fuori" : (cnt.escl ? "escl" : "ok");
  const ofN = function(k){ return t("twOfN").replace("{k}", k).replace("{n}", n); };
  if(ok[0].stato) card.appendChild(el("span", "tw-badge " + worst, worst === "ok" ? t(kOk()) :
    t(worst === "escl" ? "twEscl" : "twFuori") + " · " + ofN(cnt[worst])));
  const mLat = ok.reduce(function(s, r){ return s + r.end.lat; }, 0)/n;
  const mLon = ok.reduce(function(s, r){ return s + r.end.lon; }, 0)/n;
  const spread = Math.max.apply(null, ok.map(function(r){ return distKm(mLat, mLon, r.end.lat, r.end.lon); }));
  const rows = [
    [t("twNFlights"),  n === x.n ? String(n) : t("twOfN").replace("{k}", n).replace("{n}", x.n)],
    [t("twLandMid"),   num(mLat, 4) + ", " + num(mLon, 4)],
    [t("twSpread"),    t("twSpreadV").replace("{d}", num(spread, 0))],
    [t("twDrift"),     rng(ok.map(function(r){ return r.drift; }), 0, " km")],
    [t("twBear"),      rng(ok.map(function(r){ return r.bear; }), 0, "°")],
    [t("twTBurst"),    rng(ok.map(function(r){ return r.tBurst; }), 0, " min")],
    [t("twDur"),       rng(ok.map(function(r){ return r.dur; }), 0, " min")],
    [t("twBurstC"),    rng(ok.map(function(r){ return r.burst.alt/1000; }), 1, " km")]
  ];
  if(cnt.escl && worst !== "escl") rows.push([t("twEscl"), ofN(cnt.escl)]);
  const dl = el("dl");
  rows.forEach(function(row){ dl.appendChild(el("dt", null, row[0])); dl.appendChild(el("dd", null, row[1])); });
  card.appendChild(dl);
  if(ok[0].atmo) card.appendChild(el("p", "tw-hint tw-card-note",
    t({day:"twCardDay", dayIsa:"twCardDayIsa", std:"twCardStd", hand:"twCardHand"}[ok[0].atmo])));
  const a = el("a", null, t("twMapsMid") + " →");
  a.href = "https://www.google.com/maps/search/?api=1&query=" + mLat.toFixed(5) + "," + mLon.toFixed(5);
  a.target = "_blank"; a.rel = "noopener";
  card.appendChild(a);
  elRes.appendChild(card);
}
/* Mostra un risultato, singolo o fascia; noFit: non cambiare l'inquadratura */
function show(x, noFit){
  const band = !!(x && x.band);
  if(elLegend){ const k = kExcl(band ? "twLegendBand" : "twLegend"); elLegend.setAttribute("data-i18n", k); elLegend.textContent = t(k); }
  shown = x || null;
  if(band){ renderBand(x); statusDone(x.list); if(map) drawBand(x, noFit || !!(view && view.isOn())); }
  else {
    renderCard(x); statusDone([x]); if(map) draw(x, noFit || !!(view && view.isOn()));
    if(x && x.ok) fcWarn(x);
    if(elLegend && x && x.spread) elLegend.textContent = legendLand(x.spread);
  }
  if(c3()) c3().render(scene3d(x), !noFit);
}

/* ---------- Risultati ---------- */
/* dest: dove disegnarla (di solito elRes; la Diretta ne ha una sua, vedi
   COMETA_TRAIETTORIA in fondo) */
function renderCard(r, dest){
  dest = dest || elRes;
  dest.innerHTML = "";
  if(!r) return;
  const card = el("div", "tw-card");
  card.appendChild(el("h4", null, r.from.name));
  if(!r.ok){
    card.appendChild(el("p", "tw-err", t("twErr").replace("{msg}", r.err)));
    dest.appendChild(card); return;
  }
  if(r.stato) card.appendChild(el("span", "tw-badge " + r.stato,
    t({ok:kOk(), escl:"twEscl", fuori:"twFuori"}[r.stato])));
  const dl = el("dl");
  [[t("twStart"),     t("twGround").replace("{m}", num(r.ground, 0))],
   [t("twLand"),      coordLabel(r.end.lat, r.end.lon)],
   [t("twDrift"),     num(r.drift, 0) + " km"],
   [t("twBear"),      num(r.bear, 0) + "°"],
   [t("twTBurst"),    num(r.tBurst, 0) + " min"],
   [t("twDur"),       num(r.dur, 0) + " min"],
   [t("twAt"),        fmtTime(r.end.t, false, r.tz)],
   [t("twBurstDist"), num(r.burstDist, 0) + " km"],
   [t("twBurstC"),    num(r.burst.alt/1000, 1) + " km"]
  /* con il solo errore di previsione l'estensione e' il diametro del
     cerchio: non aggiunge niente al raggio */
  ].concat(r.spread && r.spread.n ? [[t("twErrLand"), num(r.spread.extent, 1) + " km"]] : [])
   .concat(r.spread ? r.spread.specs.map(function(x){
     const k = {B:"twBurstRange", A:"twAscRange", D:"twDescRange"}[x.k], u = x.k === "B" ? " km" : " m/s", d = x.k === "B" ? 1 : 2;
     return [t(k), num(x.lov, d) + "–" + num(x.hiv, d) + u];
   }) : [])
   .concat(r.fc && r.fc.km > 0 ? [[t("twFcRow"), "R = " + num(r.fc.km, 0) + " km"], [t("twFcTime"), fcTempo(r.fc.age)]] : [])
   .forEach(function(row){ dl.appendChild(el("dt", null, row[0])); dl.appendChild(el("dd", null, row[1])); });
  card.appendChild(dl);
  if(r.atmo) card.appendChild(el("p", "tw-hint tw-card-note",
    t({day:"twCardDay", dayIsa:"twCardDayIsa", std:"twCardStd", hand:"twCardHand"}[r.atmo])));
  const a = el("a", null, t("twMaps") + " →");
  a.href = "https://www.google.com/maps/search/?api=1&query=" + r.end.lat.toFixed(5) + "," + r.end.lon.toFixed(5);
  a.target = "_blank"; a.rel = "noopener";
  card.appendChild(a);
  dest.appendChild(card);
}
function setStatus(txt, isErr){
  elStatus.textContent = txt || "";
  elStatus.classList.toggle("err", !!isErr);
}
function statusDone(results){
  const ok = results.filter(function(r){ return r && r.ok && r.run; });
  setStatus(ok.length ? t("twDone").replace("{run}", fmtTime(ok[0].run, true, ok[0].tz)) : "");
}
/* pl: il luogo di partenza (di solito quello scelto), per il suo fuso */
function launchAt(iso, hhmm, pl){ return inFuso(iso, hhmm, fusoDi(pl || launch)); }
const MAX_VOLI = 48;
function aMin(s){ return parseInt(s.slice(0, 2), 10)*60 + parseInt(s.slice(3, 5), 10); }
function aHhmm(m){ return String(Math.floor(m/60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
function launchList(){
  const d0 = elDate.value, d1 = (elToDay && elToDay.value) || d0;
  const m0 = aMin(elTime.value), m1 = elToTime && elToTime.value ? aMin(elToTime.value) : m0;
  if(d1 < d0 || m1 < m0) return {err:"twBadRange"};
  const step = parseInt(elEvery ? elEvery.value : "60", 10), list = [];
  for(let iso = d0; iso <= d1; iso = addDays(iso, 1)){
    for(let m = m0; m <= m1; m += step) list.push({iso:iso, hhmm:aHhmm(m)});
  }
  if(list.length > MAX_VOLI) return {err:"twTooMany", n:list.length};
  return {list:list};
}

/* Più partenze: si attivano da sole quando si sceglie un «fino a» (giorno o
   ora); finche' sono attive compare una riga sopra il pulsante di calcolo
   che dice quante sono e permette di tornare a una sola con un tocco. */
function updateMulti(){
  if(!elMultiBar) return;
  const active = !!((elToDay && elToDay.value) || (elToTime && elToTime.value));
  if(!active || !elDate.value || !elTime.value){ elMultiBar.hidden = true; return; }
  const LL = launchList();
  elMultiInfo.textContent = LL.err ? t(LL.err).replace("{n}", LL.n).replace("{m}", MAX_VOLI)
    : t("twMultiN").replace("{n}", LL.list.length);
  elMultiBar.hidden = !LL.err && LL.list.length < 2;
}
[elDate, elTime, elToDay, elToTime, elEvery].forEach(function(e){
  if(e){ e.addEventListener("input", updateMulti); e.addEventListener("change", updateMulti); }
});
if(elMultiOff) elMultiOff.addEventListener("click", function(){
  elToDay.value = ""; elToTime.value = "";
  updateMulti();
});

/* Prima di calcolare: un luogo scelto (o coordinate appena scritte) e parametri validi */
function ready(){
  if(!launch){
    const c = parseCoords(elWhere.value);
    if(c) setLaunch(c);
    else if(elWhere.value.trim() && sugg.length && !sugg[0].coords) setLaunch(sugg[0]);
    else { clearResults(); setStatus(t("twNoPlace"), true); elWhere.focus(); return null; }
  }
  const p = flightParams();
  if(!p){ setStatus(t("twBad"), true); return null; }
  return p;
}

form.addEventListener("submit", function(e){
  e.preventDefault();
  if(!ready()) return;
  if(!elDate.value || !elTime.value) return;
  const LL = launchList();
  if(LL.err){ setStatus(t(LL.err).replace("{n}", LL.n).replace("{m}", MAX_VOLI), true); return; }
  if(LL.list.length > 1){ runBand(launch, LL.list); return; }
  const pl = launch, iso = elDate.value, hhmm = elTime.value;
  setStatus(t("twLoading"));
  Promise.all([ensureMap(), loadAtmo(pl).then(function(){
    const p = flightParams(iso, hhmm), when = launchAt(iso, hhmm, pl);     /* il fuso del luogo arriva con l'atmosfera */
    /* Area di atterraggio: la stessa partenza con il diametro di scoppio a
       d(1±sB), la velocita' di salita a v(1±sA) e quella di discesa a
       v(1±sD), tutte le combinazioni degli estremi; fino a nove voli. */
    const on = elErrOn && elErrOn.checked, valid = function(x){ return x > 0 && x < 0.5; };
    const sB = on ? parseFloat(elErrSig.value)/100 : 0, sA = on ? parseFloat(elErrAsc.value)/100 : 0,
          sD = on && elErrDesc ? parseFloat(elErrDesc.value)/100 : 0;
    const soft = function(q){ return predict(pl, when, q).catch(function(){ return null; }); };
    const specs = [];
    if(valid(sB)){
      const d = burstSpread(readBalloon(), iso, hhmm, sB), lo = p.burst + d.lo/1000, hi = p.burst + d.hi/1000;
      specs.push({k:"B", s:sB, lov:lo, hiv:hi, lo:{burst:lo}, hi:{burst:hi}});
    }
    if(valid(sA)) specs.push({k:"A", s:sA, lov:p.asc*(1 - sA), hiv:p.asc*(1 + sA), lo:{asc:p.asc*(1 - sA)}, hi:{asc:p.asc*(1 + sA)}});
    if(valid(sD)) specs.push({k:"D", s:sD, lov:p.desc*(1 - sD), hiv:p.desc*(1 + sD), lo:{desc:p.desc*(1 - sD)}, hi:{desc:p.desc*(1 + sD)}});
    const runs = [];
    for(let m = 0; m < (specs.length ? 1 << specs.length : 0); m++)
      runs.push(Object.assign.apply(null, [{}, p].concat(specs.map(function(x, i){ return (m >> i) & 1 ? x.hi : x.lo; }))));
    const fcOn = !!(elFcOn && elFcOn.checked);
    return Promise.all([predict(pl, when, p), fcOn ? loadCurva() : null].concat(runs.map(soft))).then(function(rr){
      const r = rr[0]; r.atmo = p.atmo;
      const cs = rr.slice(2);
      if(specs.length && cs.every(function(c){ return c && c.ok; })) r.spread = spreadGeom(r, specs, cs);
      if(fcOn){
        r.fc = fcRadius(rr[1], r, iso);
        if(r.fc.km > 0) r.spread = addForecast(r, r.spread, r.fc);
      }
      return r;
    });
  }).catch(function(e){ return {ok:false, from:pl, err:e.message}; })])
    .then(function(res){
      last = res[1];
      show(last);
    }, function(){ setStatus(t("twErr").replace("{msg}", "Leaflet"), true); });
});

function runBand(pl, list){
  const out = [];
  let i = 0;
  const prog = function(){ setStatus(t("twProgress").replace("{i}", out.length).replace("{n}", list.length)); };
  prog();
  function next(){
    if(i >= list.length) return Promise.resolve();
    const j = list[i++], p = flightParams(j.iso, j.hhmm);
    return predict(pl, launchAt(j.iso, j.hhmm, pl), p)
      .then(function(r){ r.atmo = p.atmo; return r; }, function(e){ return {ok:false, from:pl, err:e.message}; })
      .then(function(r){ out.push(r); prog(); return next(); });
  }
  /* tre richieste alla volta: il servizio e' gratuito e condiviso */
  Promise.all([ensureMap(), loadAtmo(pl).then(function(){ return Promise.all([next(), next(), next()]); })])
    .then(function(){
      last = {band:true, from:pl, list:out, n:list.length};
      show(last);
    }, function(){ setStatus(t("twErr").replace("{msg}", "Leaflet"), true); });
}

/* ---------- Confronto fra i prossimi giorni ---------- */
function renderWeek(){
  if(!week) return;
  elWeekBody.innerHTML = "";
  Object.keys(week).sort().forEach(function(iso){
    const r = week[iso], tr = el("tr");
    tr.tabIndex = 0;
    tr.appendChild(el("td", null, fmtDay(iso)));
    if(!r){ for(let i = 0; i < 5; i++) tr.appendChild(el("td", null, "…")); }
    else if(!r.ok){
      for(let i = 0; i < 4; i++) tr.appendChild(el("td", null, "—"));
      const td = el("td", "tw-w-err", "—"); td.title = r.err; tr.appendChild(td);
    } else {
      tr.appendChild(el("td", null, num(r.drift, 0) + " km"));
      tr.appendChild(el("td", null, num(r.bear, 0) + "°"));
      tr.appendChild(el("td", null, num(r.dur, 0) + " min"));
      tr.appendChild(el("td", null, num(r.burst.alt/1000, 1) + " km"));
      tr.appendChild(r.stato ? el("td", "tw-w-" + r.stato, t({ok:kOk(), escl:"twEscl", fuori:"twFuori"}[r.stato])) : el("td", null, "—"));
    }
    const pick = function(){
      if(!r || !r.ok) return;
      elDate.value = iso; last = r;
      loadWeather(launch);              /* cambiare elDate da codice non fa scattare "change" */
      ensureMap().then(function(){ show(r); });
      form.scrollIntoView({behavior:"smooth", block:"end"});
    };
    tr.addEventListener("click", pick);
    tr.addEventListener("keydown", function(e){ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); pick(); } });
    elWeekBody.appendChild(tr);
  });
}
elWeekBtn.addEventListener("click", function(){
  if(!ready()) return;
  const pl = launch, hhmm = elTime.value || "11:00";
  week = {};
  const days = [];
  for(let k = 0; k <= GIORNI_MAX; k++){
    const iso = addDays(today, k);
    if(launchAt(iso, hhmm, pl) < new Date()) continue;      /* gia' passato */
    week[iso] = null; days.push(iso);
  }
  elWeekBox.hidden = false; renderWeek();
  elWeekBtn.disabled = true;
  setStatus(t("twLoading"));
  /* due richieste alla volta: il servizio e' gratuito e condiviso */
  let i = 0;
  function next(){
    if(i >= days.length) return Promise.resolve();
    const iso = days[i++];
    const p = flightParams(iso, hhmm);                     /* ogni giorno la sua atmosfera */
    return predict(pl, launchAt(iso, hhmm, pl), p)
      .then(function(r){ r.atmo = p.atmo; return r; })
      .catch(function(e){ return {ok:false, from:pl, err:e.message}; })
      .then(function(r){ week[iso] = r; renderWeek(); return next(); });
  }
  loadAtmo(pl).then(function(){ return Promise.all([next(), next()]); }).then(function(){
    elWeekBtn.disabled = false;
    statusDone(Object.keys(week).map(function(k){ return week[k]; }));
  });
});

/* ==========================================================
   Esportazione: la mappa in PNG ad alta risoluzione, tema chiaro
   ==========================================================
   Non e' una fotografia dello schermo: si ridisegna la stessa vista su un
   canvas con le mattonelle OSM a uno o due livelli di zoom in piu' (piu'
   dettaglio, nessun filtro scuro) e i tracciati con colori da fondo
   chiaro, piu' una riga con luogo, data, legenda, scala e attribuzione.
   Le mattonelle sono al massimo MAX_TILES, per rispetto del server OSM.

   Con il livello nuvole/radar accesso finisce nell'immagine anche il
   meteo (vedi ov/ovTiles dentro exportPng). */
const MAX_TILES = 200, OUT_W = 3200;
const LIGHT = {track:"#0B6FA4", band:"#0B6FA4", land:"#E08E0B", asc:"#6C4FD1",
               excl:"#C0392B", ink:"#0E1620", muted:"#4A5B6C", paper:"#FFFFFF",
               cloud:"#41505E"};   /* nuvole: ardesia, vedi tinta() */
function loadTile(url){
  return new Promise(function(ok){
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = function(){ ok(im); }; im.onerror = function(){ ok(null); };
    im.src = url;
  });
}
function exportPng(){
  if(!map) return;
  const L = window.L;
  setStatus(t("twPngWait"));
  /* Le stesse mattonelle che si vedono in quel momento: via (OSM, ordine
     {z}/{x}/{y}) o satellite (Esri, ordine {z}/{y}/{x} — diverso!). */
  const sat = !!(mapkit && mapkit.isSatellite && mapkit.isSatellite());
  const tileUrl = sat ? window.COMETA_MAPKIT.ESRI_SAT : TILES;
  /* Livello nuvole/radar: se e' accesso l'immagine porta via anche il
     meteo. Le sue mattonelle sono pero' la situazione di ADESSO, non una
     previsione, quindi si disegnano solo salvando il giorno stesso della
     partenza — su una mappa intitolata a un giorno futuro sarebbero una
     bugia. Lo specchietto del meteo e' invece una previsione per il
     giorno e l'ora scelti, e vale sempre. */
  const ov = mapkit && mapkit.overlay ? mapkit.overlay() : null;
  const ovTiles = !!(ov && elDate.value === isoDay(new Date(), fuso()));
  const size = map.getSize(), z0 = map.getZoom();
  /* Immagine sempre larga almeno OUT_W pixel (fattore S rispetto allo
     schermo). Le mattonelle salgono di zoom quanto basta, ma senza
     superare MAX_TILES: oltre, si ingrandiscono (k > 1). */
  const S = Math.max(2, OUT_W/size.x);
  let dz = Math.max(0, Math.min(3, Math.floor(Math.log2(S) + 1e-9)));
  const tilesFor = function(d){ const f = Math.pow(2, d); return (Math.ceil(size.x*f/256) + 1)*(Math.ceil(size.y*f/256) + 1); };
  while(dz > 0 && tilesFor(dz) > MAX_TILES) dz--;
  const z = Math.min(18, z0 + dz), k = S/Math.pow(2, z - z0);
  const W = Math.round(size.x*S), H = Math.round(size.y*S);
  const origin = map.project(map.containerPointToLatLng([0, 0]), z);          /* pixel alla zoom delle mattonelle */
  const P = function(lat, lon){ const p = map.project([lat, lon], z); return [(p.x - origin.x)*k, (p.y - origin.y)*k]; };
  const u = W/1100;                                   /* unita' grafica: spessori e testi */
  /* piede: titolo, legenda (a capo se serve), attribuzione */
  const meas = document.createElement("canvas").getContext("2d");
  meas.font = 12.5*u + "px Inter, system-ui, sans-serif";
  const words = (elLegend ? elLegend.textContent : "").split(" "), lines = [];
  let line = "";
  words.forEach(function(wd){
    const tryL = line ? line + " " + wd : wd;
    if(line && meas.measureText(tryL).width > W - 36*u){ lines.push(line); line = wd; } else line = tryL;
  });
  if(line) lines.push(line);
  const FOOT = Math.round((44 + 19*lines.length + 26)*u);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H + FOOT;
  const g = cv.getContext("2d");
  g.fillStyle = "#E8EEF2"; g.fillRect(0, 0, W, H);
  g.imageSmoothingQuality = "high";
  /* Mattonelle, uno strato per volta: si caricano in parallelo ma si
     disegnano tutte insieme alla fine, altrimenti una mattonella delle
     nuvole arrivata in fretta finirebbe SOTTO una mattonella di sfondo
     arrivata dopo. zt puo' essere piu' basso di z: le nuvole e il radar
     non servono mattonelle oltre un certo zoom (maxNativeZoom), e da li'
     in su si ingrandiscono, come fa Leaflet a schermo. */
  const n = Math.pow(2, z);
  /* Ricolora una mattonella tenendone la trasparenza: "source-in" riempie
     solo dove c'e' gia' qualcosa e conserva l'alfa del disegno sotto. */
  let tintCv = null;
  function tinta(im, colore){
    if(!tintCv) tintCv = document.createElement("canvas");
    tintCv.width = im.width; tintCv.height = im.height;      /* azzera anche il contenuto */
    const x = tintCv.getContext("2d");
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = colore; x.fillRect(0, 0, im.width, im.height);
    return tintCv;
  }
  function tileLayer(url, yxOrder, zt, alpha, tint){
    const f = Math.pow(2, z - zt), ox = origin.x/f, oy = origin.y/f, kk = k*f, nn = Math.pow(2, zt);
    const jobs = [];
    for(let ty = Math.floor(oy/256); ty <= Math.floor((oy + H/kk)/256); ty++){
      if(ty < 0 || ty >= nn) continue;
      for(let tx = Math.floor(ox/256); tx <= Math.floor((ox + W/kk)/256); tx++){
        const wx = ((tx % nn) + nn) % nn;
        const u2 = yxOrder ? url.replace("{z}", zt).replace("{y}", ty).replace("{x}", wx)
                           : url.replace("{z}", zt).replace("{x}", wx).replace("{y}", ty);
        const dx = (tx*256 - ox)*kk, dy = (ty*256 - oy)*kk;
        jobs.push(loadTile(u2).then(function(im){ return im ? {im:im, x:dx, y:dy} : null; }));
      }
    }
    return Promise.all(jobs).then(function(got){
      g.globalAlpha = alpha;
      /* +0,5 px per non lasciare fessure fra una mattonella e l'altra quando kk non e' intero */
      got.forEach(function(q){ if(q) g.drawImage(tint ? tinta(q.im, tint) : q.im, q.x, q.y, 256*kk + .5, 256*kk + .5); });
      g.globalAlpha = 1;
      return got.filter(function(q){ return !q; }).length;
    });
  }
  tileLayer(tileUrl, sat, z, 1).then(function(missing){
    /* Nuvole/radar sopra lo sfondo; quelle che non arrivano non rendono
       l'immagine incompleta. Le nuvole sono bianche su trasparente (vedi
       "mask" in mapkit.js): qui lo sfondo e' chiaro, quindi si
       ricolorano di ardesia tenendo la trasparenza — piu' nuvole, piu'
       scuro. L'opacita' sale perche' la mattonella non supera meta'
       opacita' nemmeno a cielo coperto. Il radar invece passa com'e': i
       suoi colori sono la scala dell'intensita' di pioggia. */
    if(!ovTiles) return missing;
    return tileLayer(ov.url, false, Math.min(z, ov.maxNativeZoom),
                     ov.mask ? .95 : ov.opacity, ov.mask ? LIGHT.cloud : null).then(function(){ return missing; });
  }).then(function(missing){
    const path = function(pts, close){
      g.beginPath();
      pts.forEach(function(q, i){ const p = P(q[0], q[1]); if(i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
      if(close) g.closePath();
    };
    const dot = function(lat, lon, r, fill, stroke, w){
      const p = P(lat, lon); g.beginPath(); g.arc(p[0], p[1], r*u, 0, 2*Math.PI);
      g.fillStyle = fill; g.fill(); if(stroke){ g.lineWidth = w*u; g.strokeStyle = stroke; g.stroke(); }
    };
    g.lineJoin = "round"; g.lineCap = "round";
    /* area di esclusione */
    if(MOSTRA_EXCL){
      path(EXCL.map(function(q){ return [q[1], q[0]]; }), true);
      g.globalAlpha = .12; g.fillStyle = LIGHT.excl; g.fill(); g.globalAlpha = .8;
      g.lineWidth = 1.5*u; g.strokeStyle = LIGHT.excl; g.stroke(); g.globalAlpha = 1;
    }
    const x = last;
    if(x && x.band){
      /* fascia: disegnata opaca su un foglio a parte e posata trasparente, come a schermo */
      const ok = x.list.filter(function(r){ return r.ok; });
      if(ok.length > 1){
        const off = document.createElement("canvas"); off.width = W; off.height = H;
        const o = off.getContext("2d"), R = ok.map(function(r){ return resample(r, FETTE); });
        o.fillStyle = o.strokeStyle = LIGHT.band; o.lineWidth = 2*u; o.lineJoin = "round";
        for(let k = 0; k < FETTE; k++){
          const h = hull(R.map(function(r){ return r[k]; }).concat(R.map(function(r){ return r[k + 1]; })));
          if(h.length < 3) continue;
          o.beginPath(); h.forEach(function(q, i){ const p = P(q[1], q[0]); if(i) o.lineTo(p[0], p[1]); else o.moveTo(p[0], p[1]); });
          o.closePath(); o.fill(); o.stroke();
        }
        g.globalAlpha = .3; g.drawImage(off, 0, 0); g.globalAlpha = .75;
        const land = hull(ok.map(function(r){ return [r.end.lon, r.end.lat]; })).map(function(q){ return [q[1], q[0]]; });
        path(land, land.length > 2); g.fillStyle = g.strokeStyle = LIGHT.land; g.lineWidth = (land.length > 2 ? 2 : 8)*u;
        if(land.length > 2) g.fill(); g.stroke(); g.globalAlpha = 1;
      }
    } else if(x && x.ok){
      const r = x, up = r.pts.filter(function(p){ return p.up; }).map(function(p){ return [p.lat, p.lon]; });
      const down = [[r.burst.lat, r.burst.lon]].concat(r.pts.filter(function(p){ return !p.up; }).map(function(p){ return [p.lat, p.lon]; }));
      g.strokeStyle = LIGHT.track;
      path(up); g.lineWidth = 3*u; g.stroke();
      g.setLineDash([6*u, 7*u]); path(down); g.lineWidth = 2.5*u; g.stroke(); g.setLineDash([]);
      if(r.spread){
        const s = r.spread;
        if(s.poly){ path(s.poly, true); g.globalAlpha = .3; g.fillStyle = LIGHT.asc; g.fill();
                    g.globalAlpha = .85; g.lineWidth = 3*u; g.strokeStyle = LIGHT.asc; g.stroke(); g.globalAlpha = 1; }
        else { path(s.line); g.lineWidth = 6*u; g.strokeStyle = LIGHT.asc; g.globalAlpha = .85; g.stroke(); g.globalAlpha = 1; }
      }
      dot(r.burst.lat, r.burst.lon, 5, "#FFFFFF", LIGHT.track, 2);
      dot(r.end.lat, r.end.lon, 8, LIGHT.land, LIGHT.ink, 2);
    }
    /* partenza: stella */
    if(launch){
      const p = P(launch.lat, launch.lon), R1 = 11*u, R2 = 4.6*u;
      g.beginPath();
      for(let i = 0; i < 10; i++){
        const a = -Math.PI/2 + i*Math.PI/5, rr = i % 2 ? R2 : R1;
        g[i ? "lineTo" : "moveTo"](p[0] + rr*Math.cos(a), p[1] + rr*Math.sin(a));
      }
      g.closePath(); g.fillStyle = LIGHT.track; g.fill(); g.lineWidth = 1.5*u; g.strokeStyle = "#FFFFFF"; g.stroke();
    }
    /* scala */
    const c = map.getCenter(), mpp = 40075016.686*Math.cos(c.lat*RAD)/(256*n)/k;
    const target = 160*u*mpp, pow = Math.pow(10, Math.floor(Math.log10(target)));
    const nice = [1, 2, 5, 10].map(function(k){ return k*pow; }).filter(function(v){ return v <= target; }).pop() || pow;
    const len = nice/mpp, sx = 18*u, sy = H - 18*u;
    g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(sx - 8*u, sy - 22*u, len + 16*u, 30*u);
    g.strokeStyle = LIGHT.ink; g.lineWidth = 2*u; g.lineCap = "butt";
    g.beginPath(); g.moveTo(sx, sy - 6*u); g.lineTo(sx, sy); g.lineTo(sx + len, sy); g.lineTo(sx + len, sy - 6*u); g.stroke();
    g.fillStyle = LIGHT.ink; g.font = "600 " + 12*u + "px Inter, system-ui, sans-serif"; g.textBaseline = "bottom";
    g.fillText(nice >= 1000 ? num(nice/1000, 0) + " km" : num(nice, 0) + " m", sx, sy - 8*u);
    /* piede: titolo, legenda, attribuzione */
    g.fillStyle = LIGHT.paper; g.fillRect(0, H, W, FOOT);
    g.fillStyle = LIGHT.ink; g.textBaseline = "alphabetic"; g.font = "600 " + 17*u + "px 'Space Grotesk', Inter, system-ui, sans-serif";
    let title = "COMETA · " + (launch ? launch.name : "");
    if(x && x.band) title += " · " + t("twNFlights").toLowerCase() + " " + x.list.filter(function(r){ return r.ok; }).length;
    else if(x && x.ok) title += " · " + fmtTime(x.pts[0].t, true, x.tz) + (x.run ? " · GFS " + fmtTime(x.run, true, x.tz) : "");
    g.fillText(title, 18*u, H + 30*u);
    g.fillStyle = LIGHT.muted; g.font = 12.5*u + "px Inter, system-ui, sans-serif";
    lines.forEach(function(l, i){ g.fillText(l, 18*u, H + (53 + 19*i)*u); });
    g.font = 11*u + "px Inter, system-ui, sans-serif"; g.fillStyle = "#7A8A99";
    const cred = [sat ? "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community" : "© OpenStreetMap contributors"];
    if(ovTiles) cred.push(ov.credit);
    cred.push("Tawhiri (SondeHub)", "NOAA GFS");
    if(ov) cred.push("Open-Meteo");
    cred.push("cometa.scuolaitaliana.edu.uy");
    g.fillText(cred.join(" · "), 18*u, H + FOOT - 14*u);
    /* specchietto del meteo, in alto a destra: le stesse celle che si
       vedono sotto la mappa, con sopra il giorno e l'ora a cui si
       riferiscono. I valori si leggono dal riquadro della pagina. */
    const wbox = ov && window.COMETA_MAPKIT ? window.COMETA_MAPKIT.drawWeather(g, document.getElementById("twWeather"), {
      x: W - 18*u, y: 18*u, u: u, align: "right",
      head: fmtTime(launchAt(elDate.value, elTime.value || "11:00"), true),
      ink: LIGHT.ink, muted: LIGHT.muted, accent: LIGHT.track
    }) : Promise.resolve(null);
    wbox.then(function(){
      try {
        cv.toBlob(function(blob){
          if(!blob){ setStatus(t("twPngErr"), true); return; }
          const a = document.createElement("a"), day = x && x.ok ? isoDay(x.pts[0].t, x.tz) : elDate.value;
          a.download = "cometa-traiettoria-" + (launch ? launch.name : "mappa").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + day + ".png";
          a.href = URL.createObjectURL(blob);
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
          setStatus(missing ? t("twPngPart") : "");
        }, "image/png");
      } catch(e){ setStatus(t("twPngErr"), true); }
    });
  });
}

/* ---------- Cambio di lingua: si riscrive quello che e' gia' a schermo ---------- */
function relabel(){
  elWhere.placeholder = t("twWherePh");
  etichettaOra();
  renderBalloon();
  if(view) view.relabel();
  updateMulti();
  if(last) show(last, true);
  renderWeek();
}
new MutationObserver(relabel).observe(document.documentElement, {attributes:true, attributeFilter:["lang"]});
relabel();

/* ==========================================================
   Il volo della pagina Diretta
   ========================================================== */
/* I dati del volo vero stanno in assets/volo.js (window.COMETA_FLIGHT.cfg:
   pallone, payload pesato, salita prevista o portanza al collo misurata,
   partenza; ora di window.COMETA_LAUNCH). Qui si calcolano con lo stesso
   codice del modulo: volume d'elio, salita, discesa al suolo con il
   paracadute del kit e quota di scoppio con l'atmosfera prevista per quel
   luogo, quel giorno e quell'ora (ISA se il giorno e' fuori dalla
   settimana della previsione). Il risultato sostituisce i valori di
   riserva di window.COMETA_FLIGHT, e assets/spot.js richiede di nuovo la
   traiettoria grigia con questi numeri. */
function voloDiretta(){
  const F = window.COMETA_FLIGHT, L0 = window.COMETA_LAUNCH;
  if(!F || !F.cfg || !F.site || !L0) return;
  const c = F.cfg, pr = PRESET[c.bal] || PRESET["2000"];
  let V, asc;
  if(c.neckG > 0){                                   /* portanza misurata: fissa l'elio */
    V = (c.neckG/1000 + pr.mass)/DRATIO;
    asc = ascRate(V, pr.mass, c.pay);
  } else {
    V = volumePerSalita(pr.mass, c.pay, c.asc);
    asc = c.asc;
  }
  if(!V || !(asc > 0)) return;                       /* dati impossibili: restano quelli di riserva */
  const iso = isoDay(L0);
  const hhmm = new Intl.DateTimeFormat("en-GB", {timeZone:TZ, hour:"2-digit", minute:"2-digit", hour12:false}).format(L0);
  fetchHourly(F.site, TZ).then(function(h){
    const col = dayColumn(h, iso, hhmm, F.site.lat);
    F.ascentMs = asc;
    F.burstKm = (col ? quotaScoppioCol(V, pr.diam, col) : quotaScoppio(V, pr.diam))/1000;
    F.descentV0Ms = vAtterraggio(c.pay + PARA_M, PARA_D);
    F.atmo = col ? "day" : "std";
    if(window.COMETA_SPOT && window.COMETA_SPOT.refreshTrajectory) window.COMETA_SPOT.refreshTrajectory();
    /* lo stesso avviso per chi non e' la Diretta: la pagina della stazione
       LoRa (lora/stazione/) ridisegna la sua traiettoria prevista */
    window.dispatchEvent(new Event("cometa-volo"));
  });
}
voloDiretta();

/* La scheda della previsione nella Diretta (assets/spot.js), uguale a
   quella di questa pagina: dalla risposta di Tawhiri che chiede
   window.COMETA_PREVISIONE (assets/volo.js), con la partenza e i dati del
   volo di assets/volo.js. o: {atmo, fc: {km, age} o null}. */
window.COMETA_TRAIETTORIA = {
  scheda:function(dest, raw, o){
    const F = window.COMETA_FLIGHT;
    if(!dest || !raw || !F || !F.site) return;
    let r;
    try { r = parse(F.site, raw); } catch(e){ dest.innerHTML = ""; return; }
    r.atmo = o && o.atmo;
    r.fc = o && o.fc;
    r.tz = TZ;                          /* LAUNCH e' l'ora di Montevideo */
    renderCard(r, dest);
  }
};

})();
