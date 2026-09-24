/* ============================================================
   COMETA — la previsione del giorno (pagina Studio dei venti)

   Chiede a Tawhiri, il predittore di SondeHub, la traiettoria
   prevista sui venti dell'ultima corsa del modello GFS della NOAA,
   per i due siti di lancio, e la disegna su una mappa Leaflet.
   Tutto avviene nel browser di chi guarda: nessun server nostro,
   nessun dato salvato.

   Tawhiri integra solo i venti. Quota di scoppio e velocita' di
   discesa le decidiamo noi, con il modello del pallone di
   calcolo/cometa_venti.py (che ha la stessa funzione: --tawhiri).
   I valori proposti nel modulo sono quelli di wParP2 in i18n.js.

   Leaflet (assets/vendor/leaflet/) si carica solo quando la mappa
   entra nello schermo: chi non arriva fin qui non lo scarica.
   ============================================================ */

(function(){
"use strict";

const API = "https://api.v2.sondehub.org/tawhiri";
const TZ = "America/Montevideo";
const TZ_OFF = "-03:00";            /* l'Uruguay non ha ora legale dal 2015 */
const GIORNI_MAX = 7;               /* orizzonte della corsa GFS di Tawhiri */
const LEAFLET = "assets/vendor/leaflet/";

/* Gli stessi siti, colori e poligoni di cometa_venti.py e della mappa
   dello studio storico: la previsione si legge sopra quella. */
const SITES = [
  {id:"durazno",  name:"Durazno",  lat:-33.380, lon:-56.520, color:"#5FE3FF"},
  {id:"mercedes", name:"Mercedes", lat:-33.249, lon:-58.030, color:"#4ADE9B"}
];
/* [lon, lat] */
const EXCL = [[-56.78,-34.55],[-56.75,-34.20],[-56.20,-34.12],[-55.74,-34.18],
  [-55.10,-34.15],[-54.60,-34.35],[-54.30,-34.62],[-54.63,-34.84],
  [-54.95,-34.97],[-55.30,-34.90],[-55.85,-34.80],[-56.20,-34.90],[-56.50,-34.78]];
const URU = [[-57.65,-30.20],[-55.55,-30.90],[-53.90,-32.10],[-53.40,-33.70],
  [-54.15,-34.66],[-54.95,-34.97],[-56.20,-34.90],[-57.85,-34.47],
  [-58.40,-34.00],[-58.10,-33.10],[-58.05,-32.10],[-57.90,-31.40]];

const $ = function(s){ return document.querySelector(s); };
const form = $("#twForm");
if(!form) return;
const elDate = $("#twDate"), elTime = $("#twTime"), elAsc = $("#twAsc"),
      elBurst = $("#twBurst"), elDesc = $("#twDesc"), elStatus = $("#twStatus"),
      elRes = $("#twRes"), elMap = $("#twMap"), elWeekBtn = $("#twWeekBtn"),
      elWeekBox = $("#twWeekBox"), elWeekBody = $("#twWeekBody");

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

/* ---------- Date: il calendario e' quello di Montevideo ---------- */
function isoDay(d){   /* YYYY-MM-DD nel fuso di Montevideo */
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
(function defaults(){
  const L = window.COMETA_LAUNCH;
  const ld = L ? isoDay(L) : null;
  if(ld && ld >= today && ld <= lastDay){
    elDate.value = ld;
    elTime.value = fmtTime(L, false).replace(/\D*(\d\d)\D+(\d\d)\D*/, "$1:$2");
  } else {
    elDate.value = addDays(today, 1);
  }
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
function stato(lat, lon){
  if(!inPoly(lon, lat, URU)) return "fuori";
  if(inPoly(lon, lat, EXCL)) return "escl";
  return "ok";
}

/* ---------- Tawhiri ---------- */
function predict(site, whenUTC, p){
  const q = new URLSearchParams({
    profile: "standard_profile",
    launch_latitude: site.lat.toFixed(4),
    launch_longitude: ((site.lon % 360) + 360).toFixed(4),   /* Tawhiri vuole 0-360 */
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
      return parse(site, d);
    });
  }, function(){ throw new Error(t("twNoNet")); });
}
function parse(site, d){
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
    site: site, pts: pts, burst: burst, end: end,
    run: d.request && d.request.dataset ? new Date(d.request.dataset) : null,
    drift: distKm(site.lat, site.lon, end.lat, end.lon),
    bear: bearing(site.lat, site.lon, end.lat, end.lon),
    dur: (end.t - t0)/6e4,
    burstDist: distKm(site.lat, site.lon, burst.lat, burst.lon),
    stato: stato(end.lat, end.lon)
  };
}

/* ---------- Mappa ---------- */
let map = null, layer = null, mapReady = null;
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
function starIcon(color){
  return window.L.divIcon({className:"tw-star", html:'<span style="color:' + color + '">★</span>',
                           iconSize:[22,22], iconAnchor:[11,11]});
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
              {color:"#FF7A5C", weight:1.5, fillColor:"#FF7A5C", fillOpacity:.16}).addTo(map);
    SITES.forEach(function(s){
      L.marker([s.lat, s.lon], {icon:starIcon(s.color), keyboard:false}).bindTooltip(s.name).addTo(map);
    });
    layer = L.layerGroup().addTo(map);
    map.fitBounds([[-35.1,-58.6],[-31.6,-53.3]]);
    /* un clic sulla mappa abilita la rotella: scorrendo la pagina non si zooma per sbaglio */
    map.on("click", function(){ map.scrollWheelZoom.enable(); });
    map.on("mouseout", function(){ map.scrollWheelZoom.disable(); });
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

function draw(results){
  const L = window.L;
  layer.clearLayers();
  const bb = L.latLngBounds(SITES.map(function(s){ return [s.lat, s.lon]; }));
  results.forEach(function(r){
    if(!r.ok) return;
    const c = r.site.color;
    const up = r.pts.filter(function(p){ return p.up; }).map(function(p){ return [p.lat, p.lon]; });
    const down = r.pts.filter(function(p){ return !p.up; }).map(function(p){ return [p.lat, p.lon]; });
    if(down.length) down.unshift([r.burst.lat, r.burst.lon]);
    L.polyline(up, {color:c, weight:3, opacity:.95}).addTo(layer);
    L.polyline(down, {color:c, weight:2.5, opacity:.95, dashArray:"6 7"}).addTo(layer);
    L.circleMarker([r.burst.lat, r.burst.lon], {radius:5, color:c, weight:2, fillColor:"#fff", fillOpacity:1})
      .bindTooltip(t("twBurstDist") + " " + num(r.burst.alt/1000, 1) + " km").addTo(layer);
    L.circleMarker([r.end.lat, r.end.lon], {radius:7, color:"#02060f", weight:2, fillColor:c, fillOpacity:1})
      .bindTooltip(r.site.name + " · " + t("twLand") + " " + fmtTime(r.end.t, false)).addTo(layer);
    up.concat(down).forEach(function(ll){ bb.extend(ll); });
  });
  map.fitBounds(bb, {padding:[30,30], maxZoom:9});
}

/* ---------- Risultati ---------- */
let last = null;          /* ultimo calcolo, per ridisegnare al cambio di lingua */
function el(tag, cls, text){
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(text !== undefined) e.textContent = text;
  return e;
}
function renderCards(results){
  elRes.innerHTML = "";
  results.forEach(function(r){
    const card = el("div", "tw-card");
    card.style.setProperty("--site", r.site.color);
    card.appendChild(el("h4", null, r.site.name));
    if(!r.ok){
      card.appendChild(el("p", "tw-err", t("twErr").replace("{msg}", r.err)));
      elRes.appendChild(card); return;
    }
    const badge = {ok:"twOk", escl:"twEscl", fuori:"twFuori"}[r.stato];
    card.appendChild(el("span", "tw-badge " + r.stato, t(badge)));
    const dl = el("dl");
    [[t("twLand"),     num(r.end.lat, 4) + ", " + num(r.end.lon, 4)],
     [t("twDrift"),    num(r.drift, 0) + " km"],
     [t("twBear"),     num(r.bear, 0) + "°"],
     [t("twDur"),      num(r.dur, 0) + " min"],
     [t("twAt"),       fmtTime(r.end.t, false)],
     [t("twBurstDist"), num(r.burstDist, 0) + " km · " + num(r.burst.alt/1000, 1) + " km"]
    ].forEach(function(row){ dl.appendChild(el("dt", null, row[0])); dl.appendChild(el("dd", null, row[1])); });
    card.appendChild(dl);
    const a = el("a", null, t("twMaps") + " →");
    a.href = "https://www.google.com/maps/search/?api=1&query=" + r.end.lat.toFixed(5) + "," + r.end.lon.toFixed(5);
    a.target = "_blank"; a.rel = "noopener";
    card.appendChild(a);
    elRes.appendChild(card);
  });
}
function setStatus(txt, isErr){
  elStatus.textContent = txt || "";
  elStatus.classList.toggle("err", !!isErr);
}
function statusDone(results){
  const ok = results.filter(function(r){ return r.ok && r.run; });
  if(ok.length) setStatus(t("twDone").replace("{run}", fmtTime(ok[0].run, true)));
  else setStatus("");
}

/* ---------- Modulo ---------- */
function readParams(){
  const p = {asc:parseFloat(elAsc.value), burst:parseFloat(elBurst.value), desc:parseFloat(elDesc.value)};
  if(!(p.asc >= 1 && p.asc <= 10 && p.burst >= 10 && p.burst <= 45 && p.desc >= 1 && p.desc <= 15)) return null;
  return p;
}
function launchAt(iso, hhmm){ return new Date(iso + "T" + hhmm + ":00" + TZ_OFF); }

function runAll(iso){
  const p = readParams();
  if(!p){ setStatus(t("twBad"), true); return Promise.resolve(); }
  if(!elDate.value || !elTime.value) return Promise.resolve();
  const when = launchAt(iso || elDate.value, elTime.value);
  setStatus(t("twLoading"));
  return Promise.all([ensureMap()].concat(SITES.map(function(s){
    return predict(s, when, p).then(function(r){ r.ok = true; return r; },
                                    function(e){ return {ok:false, site:s, err:e.message}; });
  }))).then(function(res){
    const results = res.slice(1);
    last = results;
    renderCards(results); draw(results); statusDone(results);
  }, function(){ setStatus(t("twErr").replace("{msg}", "Leaflet"), true); });
}
form.addEventListener("submit", function(e){ e.preventDefault(); runAll(); });

/* ---------- Confronto fra i prossimi giorni ---------- */
let week = null;          /* {iso: {durazno: r, mercedes: r}} */
function weekCell(r){
  if(!r) return "…";
  if(!r.ok) return "—";
  return num(r.drift, 0) + " km · " + num(r.bear, 0) + "°" + (r.stato === "ok" ? "" : " ⚠");
}
function renderWeek(){
  if(!week) return;
  elWeekBody.innerHTML = "";
  Object.keys(week).sort().forEach(function(iso){
    const tr = el("tr");
    tr.tabIndex = 0;
    tr.appendChild(el("td", null, fmtDay(iso)));
    SITES.forEach(function(s){
      const r = week[iso][s.id];
      const td = el("td", s.id, weekCell(r));
      if(r && r.ok && r.stato !== "ok") td.title = t({escl:"twEscl", fuori:"twFuori"}[r.stato]);
      if(r && !r.ok) td.title = r.err;
      tr.appendChild(td);
    });
    const pick = function(){
      elDate.value = iso;
      const rs = SITES.map(function(s){ return week[iso][s.id]; });
      if(rs.every(function(r){ return r; })){
        last = rs; renderCards(rs); ensureMap().then(function(){ draw(rs); }); statusDone(rs);
        form.scrollIntoView({behavior:"smooth", block:"start"});
      }
    };
    tr.addEventListener("click", pick);
    tr.addEventListener("keydown", function(e){ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); pick(); } });
    elWeekBody.appendChild(tr);
  });
}
elWeekBtn.addEventListener("click", function(){
  const p = readParams();
  if(!p){ setStatus(t("twBad"), true); return; }
  const hhmm = elTime.value || "09:00";
  week = {};
  const jobs = [];
  for(let k = 0; k <= GIORNI_MAX; k++){
    const iso = addDays(today, k);
    if(launchAt(iso, hhmm) < new Date()) continue;          /* gia' passato */
    week[iso] = {};
    SITES.forEach(function(s){ jobs.push({iso:iso, site:s}); });
  }
  elWeekBox.hidden = false; renderWeek();
  elWeekBtn.disabled = true;
  setStatus(t("twLoading"));
  /* due richieste alla volta: il servizio e' gratuito e condiviso */
  let i = 0;
  function next(){
    if(i >= jobs.length) return Promise.resolve();
    const j = jobs[i++];
    return predict(j.site, launchAt(j.iso, hhmm), p)
      .then(function(r){ r.ok = true; return r; }, function(e){ return {ok:false, site:j.site, err:e.message}; })
      .then(function(r){ week[j.iso][j.site.id] = r; renderWeek(); return next(); });
  }
  Promise.all([next(), next()]).then(function(){
    elWeekBtn.disabled = false;
    const all = [];
    Object.keys(week).forEach(function(k){ SITES.forEach(function(s){ all.push(week[k][s.id]); }); });
    statusDone(all);
  });
});

/* ---------- Cambio di lingua: si riscrive quello che e' gia' a schermo ---------- */
new MutationObserver(function(){
  if(last){ renderCards(last); statusDone(last); if(map) draw(last); }
  renderWeek();
}).observe(document.documentElement, {attributes:true, attributeFilter:["lang"]});

})();
