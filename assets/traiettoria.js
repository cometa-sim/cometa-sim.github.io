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
const TZ = "America/Montevideo";
const TZ_OFF = "-03:00";            /* l'Uruguay non ha ora legale dal 2015 */
const GIORNI_MAX = 7;               /* orizzonte della corsa GFS di Tawhiri */
const LEAFLET = "assets/vendor/leaflet/";
const COL = "#5FE3FF";              /* --cyan */
/* v2: la prima versione salvava anche la partenza predefinita (Durazno)
   come se l'avesse scelta il visitatore; con una chiave nuova si riparte */
const KEY = "cometa-partenza-v2";

/* I due siti dello studio: proposti per primi fra i suggerimenti */
const SUGGERITI = [
  {name:"Mercedes (Soriano)", lat:-33.249, lon:-58.030, studied:true},
  {name:"Durazno",            lat:-33.380, lon:-56.520, studied:true}
];
const PREDEFINITO = SUGGERITI[0];   /* Mercedes: la partenza proposta a chi arriva */
/* [lon, lat], gli stessi poligoni di cometa_venti.py */
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
      elAsc = $("#twAsc"), elChute = $("#twChute"), elCyl = $("#twCyl"), elPCyl = $("#twPCyl"),
      elBurst = $("#twBurst"), elDesc = $("#twDesc"), elWarn = $("#twWarn"),
      elStatus = $("#twStatus"), elRes = $("#twRes"), elMap = $("#twMap"),
      elWeekBtn = $("#twWeekBtn"), elWeekBox = $("#twWeekBox"), elWeekBody = $("#twWeekBody"),
      elToDay = $("#twToDay"), elToTime = $("#twToTime"), elEvery = $("#twEvery"), elLegend = $("#twLegendTxt");

/* ---------- Testi: seguono la lingua scelta nel sito ---------- */
function lang(){ return document.documentElement.lang || "it"; }
function t(k){
  const d = window.I18N[lang()] || window.I18N.it;
  return d[k] !== undefined ? d[k] : window.I18N.it[k];
}
function fmtTime(d, withDay){
  const o = {timeZone:TZ, hour:"2-digit", minute:"2-digit", hour12:false};
  if(withDay){ o.weekday = "short"; o.day = "numeric"; o.month = "short"; }
  return new Intl.DateTimeFormat(lang(), o).format(d);
}
function fmtDay(iso){
  return new Intl.DateTimeFormat(lang(), {timeZone:TZ, weekday:"short", day:"numeric", month:"short"})
    .format(new Date(iso + "T12:00:00" + TZ_OFF));
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
function moliBombola(Vb, P){ return P*Vb/(R_GAS*T_RIF + B_ELIO*P); }
function pressioneBombola(Vb, n){ return n*R_GAS*T_RIF/(Vb - n*B_ELIO); }
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
function loadAtmo(pl){
  if(!pl) return Promise.resolve(null);
  const k = atmoKey(pl);
  if(atmo.key === k && atmo.promise) return atmo.promise;
  const hourly = [];
  LIVELLI.forEach(function(l){ hourly.push("temperature_" + l + "hPa", "geopotential_height_" + l + "hPa"); });
  const q = new URLSearchParams({latitude:pl.lat.toFixed(4), longitude:pl.lon.toFixed(4),
    hourly:hourly.join(","), timezone:TZ, start_date:today, end_date:lastDay});
  const cur = {key:k, h:null, promise:null};
  atmo = cur;
  cur.promise = fetch(METEO + "?" + q.toString())
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ cur.h = d && d.hourly ? d.hourly : null; return cur.h; }, function(){ return null; });
  return cur.promise;
}
/* Quota di scoppio per un giorno e un'ora: {m, day} con day=false se ISA */
function burstFor(b, iso, hhmm){
  const col = launch && atmo.key === atmoKey(launch) ? dayColumn(atmo.h, iso, hhmm, launch.lat) : null;
  return col ? {m:quotaScoppioCol(b.V, b.diam, col), day:true} : {m:b.burst, day:false};
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
  /* Avvisi solo per cio' che compromette il volo: parametri mancanti o
     incompatibili, peso eccessivo, salita troppo lenta, discesa troppo veloce. */
  if(!(b.diam > 0 && b.mass > 0 && b.pay > 0 && b.asc >= 1 && b.asc <= 10 && b.chute > 0 && b.pCyl >= 20e5 && b.pCyl <= 300e5)){
    b.warn.push(t("twWBad")); return b;
  }
  b.V = volumePerSalita(b.mass, b.pay, b.asc);
  if(!b.V){ b.warn.push(t("twWHeavy")); return b; }
  b.burst = quotaScoppio(b.V, b.diam);
  b.neck = (b.V*DRATIO - b.mass)*1000;
  b.desc = vAtterraggio(b.pay + PARA_M, b.chute);
  /* elio in bombola: moli necessarie (V e' a 15 °C e 1 atm, gas ideale) e pressione che resta */
  const nNec = P_STD*b.V/(R_GAS*T_RIF), nTot = moliBombola(b.cyl, b.pCyl);
  b.pRest = nNec < nTot ? pressioneBombola(b.cyl, nTot - nNec) : null;
  b.cylM3 = nTot*R_GAS*T_RIF/P_STD;
  if(b.pRest === null) b.warn.push(t("twWCyl").replace("{v}", num(b.V, 2)).replace("{c}", num(b.cylM3, 2)));
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
    ["#twCHe","#twCNeck","#twCBurst","#twCDesc","#twCBurstSrc","#twCHeSrc"].forEach(function(id){ set(id, /Src$/.test(id) ? "" : "—"); });
    b.warn.forEach(function(w){ elWarn.appendChild(el("li", null, w)); });
    return b;
  }
  if(b.pRest !== null){
    set("#twCHe", num(b.V, 2) + " m³ · " + num((b.pCyl - b.pRest)/1e5, 0) + " bar");
    set("#twCHeSrc", t("twCylLeft"));
  } else {
    set("#twCHe", num(b.V, 2) + " m³"); set("#twCHeSrc", "");
  }
  set("#twCNeck", num(b.neck, 0) + " g");
  /* le tessere mostrano i valori che userà il calcolo: quelli a mano, se ci sono */
  const mb = parseFloat(elBurst.value), md = parseFloat(elDesc.value);
  const hand = " · " + t("twHand");
  const bd = burstFor(b, elDate.value, elTime.value || "11:00");
  set("#twCBurst", elBurst.value !== "" && mb > 0 ? num(mb, 1) + " km" + hand : num(bd.m/1000, 1) + " km");
  set("#twCBurstSrc", elBurst.value !== "" && mb > 0 ? "" : t(bd.day ? "twAtmoDay" : "twAtmoStd"));
  set("#twCDesc", elDesc.value !== "" && md > 0 ? num(md, 1) + " m/s" + hand : num(b.desc, 1) + " m/s");
  elBurst.placeholder = (bd.m/1000).toFixed(1); elDesc.placeholder = b.desc.toFixed(1);
  b.warn.forEach(function(w){ elWarn.appendChild(el("li", null, w)); });
  return b;
}
[elBal, elDiam, elMass, elPay, elAsc, elCyl, elPCyl, elChute, elBurst, elDesc, elDate, elTime].forEach(function(e){
  e.addEventListener("input", renderBalloon);
});

/* Parametri del volo: quelli del pallone, salvo quelli imposti a mano */
function flightParams(iso, hhmm){
  const b = readBalloon();
  if(!b.V) return null;
  const mb = parseFloat(elBurst.value), md = parseFloat(elDesc.value);
  const bd = burstFor(b, iso || elDate.value, hhmm || elTime.value || "11:00");
  const p = {asc:b.asc, burst:bd.m/1000, desc:b.desc, atmo:bd.day ? "day" : "std"};
  if(elBurst.value !== ""){ if(!(mb >= 10 && mb <= 45)) return null; p.burst = mb; p.atmo = "hand"; }
  if(elDesc.value !== ""){ if(!(md >= 1 && md <= 15)) return null; p.desc = md; }
  return p;
}

/* ==========================================================
   2. La partenza
   ========================================================== */
let launch = null;            /* {name, lat, lon} */
let map = null, layer = null, launchMk = null, mapReady = null;   /* la mappa nasce dopo */
let last = null;          /* ultimo calcolo, per ridisegnare al cambio di lingua */
let week = null;          /* confronto dei prossimi giorni: {iso: risultato} */
/* Risultati di un altro luogo non devono restare a schermo */
function clearResults(){
  last = null; week = null;
  elRes.innerHTML = ""; elWeekBody.innerHTML = ""; elWeekBox.hidden = true;
  if(layer) layer.clearLayers();
  if(elLegend){ elLegend.setAttribute("data-i18n", "twLegend"); elLegend.textContent = t("twLegend"); }
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
function coordLabel(lat, lon){ return lat.toFixed(4) + ", " + lon.toFixed(4); }
function setLaunch(pl, keepText, noSave){
  if(last && (last.from.lat !== pl.lat || last.from.lon !== pl.lon)) clearResults();
  launch = {name:pl.name || coordLabel(pl.lat, pl.lon), lat:pl.lat, lon:pl.lon};
  if(!keepText) elWhere.value = launch.name;
  if(!noSave) saveLaunch();            /* si ricorda solo cio' che ha scelto il visitatore */
  closeSugg();
  if(map) placeLaunchMarker(true);
  loadAtmo(launch).then(renderBalloon);
}

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
    const extra = s.studied ? t("twStudied") : (s.coords ? "" : [s.admin, s.country].filter(Boolean).join(", "));
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
function isoDay(d){
  return new Intl.DateTimeFormat("en-CA", {timeZone:TZ, year:"numeric", month:"2-digit", day:"2-digit"}).format(d);
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
     da Mercedes, uno dei due siti dello studio: con i valori proposti il calcolo
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
  if(inPoly(lon, lat, EXCL)) return "escl";
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
      return parse(pl, d);
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
  if(window.L) return Promise.resolve();
  return new Promise(function(ok, ko){
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = LEAFLET + "leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = LEAFLET + "leaflet.js";
    s.onload = ok; s.onerror = ko;
    document.head.appendChild(s);
  });
}
function placeLaunchMarker(pan){
  const L = window.L;
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
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom:18, attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(map);
    L.control.scale({imperial:false}).addTo(map);
    L.polygon(EXCL.map(function(p){ return [p[1], p[0]]; }),
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
  });
  return mapReady;
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
    .bindTooltip(t("twBurstDist") + " " + num(r.burst.alt/1000, 1) + " km").addTo(layer);
  L.circleMarker([r.end.lat, r.end.lon], {radius:8, color:"#02060f", weight:2, fillColor:"#FFB84D", fillOpacity:1, bubblingMouseEvents:false})
    .bindTooltip(t("twLand") + " " + fmtTime(r.end.t, false)).addTo(layer);
  const bb = L.latLngBounds(up.concat(down));
  bb.extend([r.from.lat, r.from.lon]);
  if(!noFit){ map.invalidateSize(); map.fitBounds(bb, {padding:[30,30], maxZoom:10}); }
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
    out.push([a.lon + f*(b.lon - a.lon), a.lat + f*(b.lat - a.lat)]);
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
function drawBand(x, noFit){
  const L = window.L, ok = x.list.filter(function(r){ return r.ok; });
  layer.clearLayers();
  if(ok.length < 2){ if(ok.length) draw(ok[0], noFit); return; }
  const R = ok.map(function(r){ return resample(r, FETTE); });
  const bb = L.latLngBounds([[x.from.lat, x.from.lon]]);
  const ll = function(p){ return [p[1], p[0]]; };
  for(let k = 0; k < FETTE; k++){
    const h = hull(R.map(function(r){ return r[k]; }).concat(R.map(function(r){ return r[k + 1]; })));
    if(h.length < 3) continue;
    L.polygon(h.map(ll), {pane:"twBand", color:COL, weight:2, opacity:1, fillColor:COL, fillOpacity:1, interactive:false}).addTo(layer);
    h.forEach(function(p){ bb.extend(ll(p)); });
  }
  const land = hull(ok.map(function(r){ return [r.end.lon, r.end.lat]; }));
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
  if(ok[0].stato) card.appendChild(el("span", "tw-badge " + worst, worst === "ok" ? t("twOk") :
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
    t({day:"twCardDay", std:"twCardStd", hand:"twCardHand"}[ok[0].atmo])));
  const a = el("a", null, t("twMapsMid") + " →");
  a.href = "https://www.google.com/maps/search/?api=1&query=" + mLat.toFixed(5) + "," + mLon.toFixed(5);
  a.target = "_blank"; a.rel = "noopener";
  card.appendChild(a);
  elRes.appendChild(card);
}
/* Mostra un risultato, singolo o fascia; noFit: non cambiare l'inquadratura */
function show(x, noFit){
  const band = !!(x && x.band);
  if(elLegend){ elLegend.setAttribute("data-i18n", band ? "twLegendBand" : "twLegend"); elLegend.textContent = t(band ? "twLegendBand" : "twLegend"); }
  if(band){ renderBand(x); statusDone(x.list); if(map) drawBand(x, noFit); }
  else { renderCard(x); statusDone([x]); if(map) draw(x, noFit); }
}

/* ---------- Risultati ---------- */
function renderCard(r){
  elRes.innerHTML = "";
  if(!r) return;
  const card = el("div", "tw-card");
  card.appendChild(el("h4", null, r.from.name));
  if(!r.ok){
    card.appendChild(el("p", "tw-err", t("twErr").replace("{msg}", r.err)));
    elRes.appendChild(card); return;
  }
  if(r.stato) card.appendChild(el("span", "tw-badge " + r.stato,
    t({ok:"twOk", escl:"twEscl", fuori:"twFuori"}[r.stato])));
  const dl = el("dl");
  [[t("twStart"),     t("twGround").replace("{m}", num(r.ground, 0))],
   [t("twLand"),      num(r.end.lat, 4) + ", " + num(r.end.lon, 4)],
   [t("twDrift"),     num(r.drift, 0) + " km"],
   [t("twBear"),      num(r.bear, 0) + "°"],
   [t("twTBurst"),    num(r.tBurst, 0) + " min"],
   [t("twDur"),       num(r.dur, 0) + " min"],
   [t("twAt"),        fmtTime(r.end.t, false)],
   [t("twBurstDist"), num(r.burstDist, 0) + " km · " + num(r.burst.alt/1000, 1) + " km"]
  ].forEach(function(row){ dl.appendChild(el("dt", null, row[0])); dl.appendChild(el("dd", null, row[1])); });
  card.appendChild(dl);
  if(r.atmo) card.appendChild(el("p", "tw-hint tw-card-note",
    t({day:"twCardDay", std:"twCardStd", hand:"twCardHand"}[r.atmo])));
  const a = el("a", null, t("twMaps") + " →");
  a.href = "https://www.google.com/maps/search/?api=1&query=" + r.end.lat.toFixed(5) + "," + r.end.lon.toFixed(5);
  a.target = "_blank"; a.rel = "noopener";
  card.appendChild(a);
  elRes.appendChild(card);
}
function setStatus(txt, isErr){
  elStatus.textContent = txt || "";
  elStatus.classList.toggle("err", !!isErr);
}
function statusDone(results){
  const ok = results.filter(function(r){ return r && r.ok && r.run; });
  setStatus(ok.length ? t("twDone").replace("{run}", fmtTime(ok[0].run, true)) : "");
}
function launchAt(iso, hhmm){ return new Date(iso + "T" + hhmm + ":00" + TZ_OFF); }
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
  const pl = launch, iso = elDate.value, hhmm = elTime.value, when = launchAt(iso, hhmm);
  setStatus(t("twLoading"));
  Promise.all([ensureMap(), loadAtmo(pl).then(function(){
    const p = flightParams(iso, hhmm);
    return predict(pl, when, p).then(function(r){ r.atmo = p.atmo; return r; });
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
    return predict(pl, launchAt(j.iso, j.hhmm), p)
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
      tr.appendChild(r.stato ? el("td", "tw-w-" + r.stato, t({ok:"twOk", escl:"twEscl", fuori:"twFuori"}[r.stato])) : el("td", null, "—"));
    }
    const pick = function(){
      if(!r || !r.ok) return;
      elDate.value = iso; last = r;
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
    if(launchAt(iso, hhmm) < new Date()) continue;          /* gia' passato */
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
    return predict(pl, launchAt(iso, hhmm), p)
      .then(function(r){ r.atmo = p.atmo; return r; })
      .catch(function(e){ return {ok:false, from:pl, err:e.message}; })
      .then(function(r){ week[iso] = r; renderWeek(); return next(); });
  }
  loadAtmo(pl).then(function(){ return Promise.all([next(), next()]); }).then(function(){
    elWeekBtn.disabled = false;
    statusDone(Object.keys(week).map(function(k){ return week[k]; }));
  });
});

/* ---------- Cambio di lingua: si riscrive quello che e' gia' a schermo ---------- */
function relabel(){
  elWhere.placeholder = t("twWherePh");
  renderBalloon();
  if(last) show(last, true);
  renderWeek();
}
new MutationObserver(relabel).observe(document.documentElement, {attributes:true, attributeFilter:["lang"]});
relabel();

})();
