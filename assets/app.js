/* ============================================================
   COMETA — logica del sito

   · scelta della lingua (automatica, con memoria)
   · navigazione a sezioni senza ricaricare la pagina
   · animazione della salita nella pagina iniziale
   · conto alla rovescia
   · caricamento differito del modello 3D della sonda
   ============================================================ */

(function(){
"use strict";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [].slice.call((r || document).querySelectorAll(s));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lerp  = (a,b,t) => a + (b - a)*t;
const smooth = (x,a,b) => { const t = clamp((x - a)/(b - a), 0, 1); return t*t*(3 - 2*t); };
const I18N = window.I18N;

/* ==========================================================
   Lingua
   ========================================================== */
let LANG = "it";
let bands = I18N.it.bands;

function storedLang(){
  try { return localStorage.getItem("cometa-lang"); } catch(e){ return null; }
}
function storeLang(l){
  try { localStorage.setItem("cometa-lang", l); } catch(e){ /* navigazione privata */ }
}
function detectLang(){
  const saved = storedLang();
  if(saved && I18N[saved]) return saved;
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "it"];
  for(let i = 0; i < list.length; i++){
    const c = String(list[i]).toLowerCase().slice(0,2);
    if(I18N[c]) return c;
  }
  return "it";
}

/* Sostituisce i segnaposto {years} e {date} con un contrassegno visibile:
   finché i valori non ci sono, si vedono e non si dimenticano. */
function expand(str){
  const d = I18N[LANG];
  return String(str)
    .replace("{years}", '<span class="todo">' + d.wYears + '</span>')
    .replace("{date}",  '<span class="todo">' + d.wDate  + '</span>');
}

function buildChain(){
  const list = $("#chainList"); if(!list) return;
  const items = I18N[LANG].chain;
  list.innerHTML = "";
  items.forEach(function(label, i){
    const l = document.createElement("div");
    l.className = "link";
    l.innerHTML = '<div class="node">' + String(i + 1).padStart(2, "0") + '</div>' +
                  '<div class="txt">' + label + '</div>' +
                  '<div class="idx">' + (i === 0 ? "↑" : (i === items.length - 1 ? "↓" : "· · ·")) + '</div>';
    list.appendChild(l);
    if(i < items.length - 1){
      const c = document.createElement("div");
      c.className = "connector";
      c.innerHTML = '<div class="rope"></div>';
      list.appendChild(c);
    }
  });
}

function applyTexts(){
  const d = I18N[LANG];
  $$("[data-i18n]").forEach(function(el){
    const k = el.getAttribute("data-i18n");
    if(d[k] !== undefined) el.textContent = d[k];
  });
  $$("[data-i18n-html]").forEach(function(el){
    const k = el.getAttribute("data-i18n-html");
    if(d[k] !== undefined) el.innerHTML = expand(d[k]);
  });
  $$(".scr").forEach(function(el){ delete el.dataset.final; });
  document.documentElement.lang = d.code;
  document.title = d.title;
  const md = $("#metaDesc"); if(md) md.setAttribute("content", d.metaDesc);
}

function moveThumb(){
  const t = $("#thumb"), b = $('.lang button[data-lang="' + LANG + '"]');
  if(!t || !b) return;
  t.style.width = b.offsetWidth + "px";
  t.style.transform = "translateX(" + (b.offsetLeft - 3) + "px)";
}

function setLang(l, remember){
  if(!I18N[l]) l = "it";
  LANG = l; bands = I18N[l].bands;
  if(remember) storeLang(l);
  const app = $("#app");
  const paint = function(){
    applyTexts();
    buildChain();
    if(window.COMETA_SONDA) window.COMETA_SONDA.setLang(LANG);
    updateFlight(); updateCountdown(); checkReveals();
    app.classList.remove("switching");
  };
  $$(".lang button").forEach(function(b){ b.setAttribute("aria-pressed", String(b.dataset.lang === l)); });
  moveThumb();
  if(reduced || !langPainted){ langPainted = true; paint(); return; }
  app.classList.add("switching");
  setTimeout(paint, 200);
}
let langPainted = false;

$$(".lang button").forEach(function(b){
  b.addEventListener("click", function(){ setLang(b.dataset.lang, true); });
});

/* ==========================================================
   Navigazione a sezioni
   ========================================================== */
const pages = {
  home:     $("#page-home"),
  missione: $("#page-missione"),
  fisica:   $("#page-fisica"),
  sonda:    $("#page-sonda"),
  venti:    $("#page-venti"),
  legale:   $("#page-legale"),
  about:    $("#page-about")
};

function showPage(id){
  if(!pages[id]) id = "home";
  Object.keys(pages).forEach(function(k){ pages[k].classList.remove("active"); });
  pages[id].classList.add("active");
  $$(".nav-links a, .menu-overlay a, .foot-col a[data-page]").forEach(function(a){
    a.classList.toggle("active", a.dataset.page === id);
  });
  closeMenu();
  scrollTo(0, 0);
  $$(".reveal", pages[id]).forEach(function(el){ el.classList.remove("in"); });

  if(window.COMETA_SONDA){
    if(id === "sonda"){ window.COMETA_SONDA.init().then(function(){ window.COMETA_SONDA.setActive(true); }); }
    else { window.COMETA_SONDA.setActive(false); }
  }

  requestAnimationFrame(function(){
    checkReveals();
    if(id === "home") resetFlight();
    if(id === "fisica") resetPhys();
  });
}
function go(id){
  if(location.hash.slice(1) !== id) location.hash = id;
  else showPage(id);
}
addEventListener("hashchange", function(){ showPage(location.hash.slice(1) || "home"); });
$$("[data-page]").forEach(function(el){
  el.addEventListener("click", function(e){ e.preventDefault(); go(el.dataset.page); });
  el.addEventListener("keydown", function(e){
    if(e.key === "Enter" || e.key === " "){ e.preventDefault(); go(el.dataset.page); }
  });
});

/* ---------- Menu per schermi stretti ---------- */
const menu = $("#menu");
function closeMenu(){ menu.classList.remove("open"); document.body.style.overflow = ""; }
$("#menuBtn").addEventListener("click", function(){ menu.classList.add("open"); document.body.style.overflow = "hidden"; });
$("#menuClose").addEventListener("click", closeMenu);
addEventListener("keydown", function(e){ if(e.key === "Escape") closeMenu(); });

/* ==========================================================
   Rivelazione allo scorrimento
   ========================================================== */
function checkReveals(){
  const pg = $(".page.active"); if(!pg) return;
  $$(".reveal:not(.in)", pg).forEach(function(el){
    const r = el.getBoundingClientRect();
    if(r.top < innerHeight*0.9 && r.bottom > 0){
      el.classList.add("in");
      $$(".scr", el).forEach(scramble);
    }
  });
}
const GL = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/#%<>-·+=";
function scramble(el){
  const fin = el.dataset.final !== undefined ? el.dataset.final : el.textContent;
  el.dataset.final = fin;
  if(reduced){ el.textContent = fin; return; }
  const ch = Array.from(fin), st = performance.now(), dur = 520;
  (function f(now){
    const p = Math.min(1, (now - st)/dur), rc = Math.floor(p*ch.length);
    let o = "";
    for(let i = 0; i < ch.length; i++){
      const c = ch[i];
      o += (c === " ") ? " " : (i < rc || p >= 1) ? c : GL[(Math.random()*GL.length)|0];
    }
    el.textContent = o;
    if(p < 1) requestAnimationFrame(f); else el.textContent = fin;
  })(performance.now());
}

/* ==========================================================
   Pallone in SVG: spicchi
   ========================================================== */
function makeGores(g, n){
  if(!g) return;
  const cx = 120, top = 24, neck = 252, maxH = 94;
  let html = "";
  for(let i = 0; i < n; i++){
    const f = (i/(n - 1))*2 - 1, off = Math.sin(f*Math.PI/2)*maxH;
    html += '<path d="M' + cx + ',' + top + ' C ' + (cx + off*.6) + ',' + (top + 50) + ' ' +
            (cx + off) + ',130 ' + (cx + off*.55) + ',' + (neck - 30) + ' C ' +
            (cx + off*.2) + ',' + (neck - 8) + ' ' + cx + ',' + neck + ' ' + cx + ',' + neck + '"/>';
  }
  g.innerHTML = html;
}
makeGores($("#gores"), 13);
makeGores($("#gores2"), 13);

/* ==========================================================
   Campo stellare
   ========================================================== */
const sf = $("#sf"), sx = sf.getContext("2d");
let stars = [], SW, SH, DPR;
function sfResize(){
  DPR = Math.min(2, devicePixelRatio || 1);
  SW = sf.width = innerWidth*DPR; SH = sf.height = innerHeight*DPR;
  sf.style.width = innerWidth + "px"; sf.style.height = innerHeight + "px";
  if(physSf){
    physSf.width = SW; physSf.height = SH;
    physSf.style.width = innerWidth + "px"; physSf.style.height = innerHeight + "px";
  }
  stars = [];
  const n = Math.min(220, Math.floor(innerWidth*innerHeight/8000));
  for(let i = 0; i < n; i++) stars.push({
    x:Math.random()*SW, y:Math.random()*SH, r:(Math.random()*1.1 + .3)*DPR,
    a:Math.random()*.6 + .3, tw:Math.random()*6.3, tws:Math.random()*.02 + .004
  });
}
function sfDraw(){
  const ctxs = physSx ? [sx, physSx] : [sx];
  ctxs.forEach(function(c){ c.clearRect(0, 0, SW, SH); });
  for(let i = 0; i < stars.length; i++){
    const s = stars[i];
    s.tw += s.tws;
    const tw = reduced ? 1 : Math.sin(s.tw)*.35 + .65;
    const col = s.r > DPR ? "#cfe8ff" : "#fff";
    ctxs.forEach(function(c){
      c.globalAlpha = s.a*tw;
      c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.29);
      c.fillStyle = col; c.fill();
    });
  }
  ctxs.forEach(function(c){ c.globalAlpha = 1; });
  if(!reduced) requestAnimationFrame(sfDraw);
}

/* ==========================================================
   Meccanica della salita
   ========================================================== */
const flight = $("#flight"), stage = $("#stage"), sky = $("#sky"), arc = $("#arc"),
      balloon = $("#balloon"), env = $("#env"), chainSvg = $("#chain"),
      intro = $("#intro"), cue = $("#cue"), homeBurst = $("#homeBurst"), hChute = $("#hChute"), hCord = $("#hCord"),
      altSide = $("#altSide"), altN = $("#altN"), altLay = $("#altLay"),
      altFill = $("#altFill"), altMark = $("#altMark");

const layers = [
  {el:$("#cloudsHigh"), C:9,   span:4,   max:.9},
  {el:$("#planes"),     C:11,  span:3,   max:1},
  {el:$("#cloudsLow"),  C:2.5, span:3,   max:.95},
  {el:$("#birds"),      C:1.2, span:2.2, max:.9}
];

function cloud(w){ return '<svg width="' + w + '" height="' + (w*0.5) + '" viewBox="0 0 200 100"><g fill="rgba(255,255,255,.9)"><ellipse cx="60" cy="65" rx="55" ry="30"/><ellipse cx="110" cy="55" rx="50" ry="34"/><ellipse cx="150" cy="68" rx="42" ry="26"/><ellipse cx="95" cy="72" rx="60" ry="24"/></g></svg>'; }
function cirrus(w){ return '<svg width="' + w + '" height="24" viewBox="0 0 300 24"><g stroke="rgba(255,255,255,.7)" stroke-width="3" stroke-linecap="round" fill="none"><path d="M10 12 Q80 4 150 12 T290 10"/><path d="M30 18 Q110 12 200 18"/></g></svg>'; }
function bird(){ return '<svg width="34" height="16" viewBox="0 0 34 16"><path d="M2 12 Q9 3 17 11 Q25 3 32 12" stroke="rgba(30,45,60,.75)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'; }
function plane(){ return '<svg width="80" height="30" viewBox="0 0 120 44"><g fill="rgba(235,242,250,.95)"><path d="M6 22 L92 18 L104 22 L92 26 Z"/><path d="M52 20 L70 4 L76 6 L64 22 Z"/><path d="M52 24 L70 40 L76 38 L64 24 Z"/><rect x="86" y="14" width="6" height="16" rx="2"/></g><line x1="6" y1="22" x2="-140" y2="22" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-linecap="round"/></svg>'; }

$("#cloudsLow").innerHTML  = '<div style="left:8%;top:44%">' + cloud(300) + '</div><div style="left:60%;top:56%">' + cloud(360) + '</div><div style="left:36%;top:66%">' + cloud(240) + '</div>';
$("#cloudsHigh").innerHTML = '<div style="left:10%;top:40%">' + cirrus(340) + '</div><div style="left:55%;top:52%">' + cirrus(300) + '</div><div style="left:30%;top:60%">' + cirrus(260) + '</div>';
$("#birds").innerHTML      = '<div style="left:24%;top:48%">' + bird() + '</div><div style="left:30%;top:44%">' + bird() + '</div><div style="left:36%;top:50%">' + bird() + '</div><div style="left:66%;top:46%">' + bird() + '</div><div style="left:72%;top:52%">' + bird() + '</div>';
$("#planes").innerHTML     = '<div style="left:20%;top:46%">' + plane() + '</div><div style="left:64%;top:56%">' + plane() + '</div>';

/* Colore del cielo in funzione della quota (km).
   Tre tavole: giorno, tramonto, notte. Quella usata è la media pesata
   delle tre secondo l'ora vera di Montevideo — il visitatore vede il
   cielo che c'è adesso sopra il luogo del lancio. */
const SKY_DAY = [
 [0,[125,180,224],[207,230,245]], [3,[95,159,214],[185,219,239]], [8,[63,127,192],[143,192,230]],
 [12,[42,95,158],[95,151,200]],   [18,[22,63,114],[47,95,148]],   [25,[11,31,63],[22,63,102]],
 [31,[5,18,42],[10,36,68]],       [38,[2,6,15],[4,18,38]]
];
const SKY_DUSK = [
 [0,[64,74,132],[255,168,96]],    [3,[46,60,114],[224,116,88]],   [8,[30,44,92],[132,80,112]],
 [12,[24,38,80],[70,64,104]],     [18,[15,27,57],[34,42,74]],     [25,[8,17,37],[17,27,49]],
 [31,[4,11,25],[9,17,33]],        [38,[2,6,15],[4,18,38]]
];
const SKY_NIGHT = [
 [0,[6,12,27],[19,30,52]],        [3,[5,11,25],[15,25,45]],       [8,[4,9,21],[11,21,39]],
 [12,[4,8,19],[9,17,33]],         [18,[3,7,16],[7,13,27]],        [25,[2,6,13],[5,11,21]],
 [31,[2,5,11],[4,9,17]],          [38,[2,6,15],[4,18,38]]
];
let SKYC = SKY_DAY.map(function(r){ return [r[0], r[1].slice(), r[2].slice()]; });
let nightMix = 0;

function mvdHour(){
  try{
    const parts = new Intl.DateTimeFormat("en-GB", {timeZone:"America/Montevideo", hour:"2-digit", minute:"2-digit", hour12:false})
      .formatToParts(new Date());
    const h = +parts.find(function(x){ return x.type === "hour"; }).value;
    const m = +parts.find(function(x){ return x.type === "minute"; }).value;
    return (h % 24) + m/60;
  } catch(e){
    const d = new Date(); return d.getHours() + d.getMinutes()/60;
  }
}
/* [giorno, tramonto, notte] — le transizioni sono morbide */
function phaseWeights(h){
  const seg = function(a,b,from,to){
    const t = clamp((h - a)/(b - a), 0, 1);
    return [lerp(from[0],to[0],t), lerp(from[1],to[1],t), lerp(from[2],to[2],t)];
  };
  const D=[1,0,0], T=[0,1,0], N=[0,0,1];
  if(h < 5.6)  return N;
  if(h < 7.2)  return seg(5.6, 7.2, N, T);     /* alba */
  if(h < 8.8)  return seg(7.2, 8.8, T, D);
  if(h < 17.6) return D;
  if(h < 19.4) return seg(17.6, 19.4, D, T);   /* tramonto */
  if(h < 21.0) return seg(19.4, 21.0, T, N);
  return N;
}
function applyDaylight(){
  const w = phaseWeights(mvdHour());
  nightMix = w[2];
  SKYC = SKY_DAY.map(function(r, i){
    const mix = function(k){
      return [0,1,2].map(function(c){
        return Math.round(SKY_DAY[i][k][c]*w[0] + SKY_DUSK[i][k][c]*w[1] + SKY_NIGHT[i][k][c]*w[2]);
      });
    };
    return [r[0], mix(1), mix(2)];
  });
  /* il testo dell'intro segue il cielo */
  const bot = SKYC[0][2];
  const light = (bot[0]*0.299 + bot[1]*0.587 + bot[2]*0.114) < 122;
  const st = document.documentElement.style;
  st.setProperty("--intro-ink",        light ? "#EAF3FA" : "#0e2a40");
  st.setProperty("--intro-dim",        light ? "rgba(234,243,250,.74)" : "rgba(15,45,65,.75)");
  st.setProperty("--intro-plate",      light ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.55)");
  st.setProperty("--intro-plate-line", light ? "rgba(255,255,255,.20)" : "rgba(255,255,255,.62)");
  const day = 0.26 + 0.74*w[0] + 0.34*w[1];
  const b = "brightness(" + day.toFixed(3) + ")";
  const soft = "brightness(" + (0.42 + 0.58*w[0] + 0.42*w[1]).toFixed(3) + ")";
  ["#ground", "#physGround"].forEach(function(k){ const e = $(k); if(e) e.style.filter = b; });
  ["#cloudsLow", "#cloudsHigh", "#birds", "#planes"].forEach(function(k){ const e = $(k); if(e) e.style.filter = b; });
  ["#balloon", "#physCraft"].forEach(function(k){ const e = $(k); if(e) e.style.filter = soft; });
  updateFlight(); updatePhys();
}
function skyAt(a){
  let i = 0; while(i < SKYC.length - 1 && a > SKYC[i + 1][0]) i++;
  const A = SKYC[i], B = SKYC[Math.min(i + 1, SKYC.length - 1)];
  const t = B[0] === A[0] ? 0 : clamp((a - A[0])/(B[0] - A[0]), 0, 1);
  const mix = (x,y) => Math.round(lerp(x, y, t));
  const top = A[1].map((v,k) => mix(v, B[1][k])), bot = A[2].map((v,k) => mix(v, B[2][k]));
  return ["rgb(" + top.join(",") + ")", "rgb(" + bot.join(",") + ")"];
}
/* Quota (km) in funzione dell'avanzamento dello scorrimento */
const ALT = [[0,0],[0.10,2],[0.22,5],[0.36,11],[0.55,20],[0.75,28],[1,38]];
function altFromP(p){
  let i = 0; while(i < ALT.length - 1 && p > ALT[i + 1][0]) i++;
  const A = ALT[i], B = ALT[Math.min(i + 1, ALT.length - 1)];
  const t = B[0] === A[0] ? 0 : (p - A[0])/(B[0] - A[0]);
  return lerp(A[1], B[1], clamp(t, 0, 1));
}

let inflateT = 0, inflateStarted = false, burstDone = false;

function progress(){
  const top = flight.offsetTop, h = flight.offsetHeight - innerHeight;
  return clamp((scrollY - top)/(h || 1), 0, 1);
}

function updateFlight(){
  if(!pages.home.classList.contains("active")) return;
  const p = progress(), alt = altFromP(p);
  const c = skyAt(alt);
  sky.style.background = "linear-gradient(180deg," + c[0] + " 0%," + c[0] + " 6%," + c[1] + " 68%," + c[1] + " 100%)";
  sf.style.opacity  = Math.max(nightMix*0.85, smooth(alt, 20, 32));
  arc.style.opacity = smooth(alt, 26, 37)*0.9;

  const k = 0.2*innerHeight;
  layers.forEach(function(L){
    L.el.style.transform = "translateY(" + ((alt - L.C)*k) + "px)";
    L.el.style.opacity = clamp(1 - Math.abs(alt - L.C)/L.span, 0, 1)*L.max;
  });
  const ground = $("#ground");
  ground.style.transform = "translateY(" + (alt*k*0.9) + "px)";
  ground.style.opacity = clamp(1 - alt/3.2, 0, 1);

  /* Come nella sezione della fisica: il riempimento iniziale porta il
     pallone a dimensione di partenza, poi cresce salendo. */
  const grow = 1 + 1.18*Math.pow(clamp(alt/BURST_KM, 0, 1), 1.35);
  env.style.transform = "scale(" + (lerp(0.16, 1, inflateT)*grow).toFixed(3) + ")";
  chainSvg.style.opacity = inflateT;
  const lift = smooth(p, 0.03, 0.16), groundY = innerHeight*0.30;
  const sway = reduced ? 0 : Math.sin(performance.now()/1400)*8*inflateT*(1 - lift*0.4);
  const bob  = reduced ? 0 : Math.sin(performance.now()/1600)*4;
  balloon.style.transform = "translate(-50%,-50%) translate(" + sway + "px," + (lerp(groundY, 0, lift) + bob) + "px)";

  altN.textContent = alt.toFixed(1);
  altLay.textContent = bands[alt < 0.6 ? 0 : alt < 11 ? 1 : alt < 18 ? 2 : 3];
  altFill.style.height = (p*100) + "%";
  altMark.style.bottom = (p*100) + "%";
  altSide.classList.toggle("show", inflateStarted && p < 0.999);

  const iv = 1 - smooth(p, 0.0, 0.05);
  intro.style.opacity = iv;
  intro.style.pointerEvents = iv < 0.1 ? "none" : "auto";
  cue.classList.toggle("show", inflateStarted && p < 0.05);

  /* Lo scoppio: il pallone si ferma, esplode, e la pagina continua.
     Nessun cartello — l'evento si racconta da solo, come nella
     sezione della fisica. */
  const scoppiato = alt >= BURST_KM;
  if(scoppiato && !burstDone){ burstDone = true; homeFlash(); }
  if(!scoppiato) burstDone = false;
  /* Sparisce l'involucro, non la sonda: quella scende col paracadute. */
  env.style.opacity   = scoppiato ? "0" : "1";
  if(hChute) hChute.style.opacity = scoppiato ? "1" : "0";
  if(hCord)  hCord.style.opacity  = scoppiato ? "0" : "1";
}

const BURST_KM = 37.8;
function homeFlash(){
  if(!homeBurst || reduced) return;
  homeBurst.style.transition = "none";
  homeBurst.style.opacity = "1";
  homeBurst.style.transform = "translate(-50%,-50%) scale(.22)";
  requestAnimationFrame(function(){
    homeBurst.style.transition = "opacity .95s ease-out, transform .95s cubic-bezier(.2,.7,.3,1)";
    homeBurst.style.opacity = "0";
    homeBurst.style.transform = "translate(-50%,-50%) scale(1.8)";
  });
}
function resetFlight(){ inflateStarted = false; inflateT = 0; burstDone = false; updateFlight(); }

function startInflate(dur){
  if(inflateStarted) return;
  inflateStarted = true;
  if(reduced){ inflateT = 1; updateFlight(); return; }
  const st = performance.now();
  (function f(now){
    const p = Math.min(1, (now - st)/dur);
    inflateT = 1 - Math.pow(1 - p, 2);
    updateFlight();
    if(p < 1) requestAnimationFrame(f);
  })(performance.now());
}

(function(){
  const tr = $("#altTrack");
  [0,25,50,75,100].forEach(function(p){
    const i = document.createElement("span");
    i.className = "alt-tk"; i.style.bottom = p + "%"; tr.appendChild(i);
  });
})();

function smoothScrollTo(to, dur){
  const from = scrollY, st = performance.now();
  let cancel = false;
  const stop = function(){
    cancel = true;
    removeEventListener("wheel", stop); removeEventListener("touchstart", stop); removeEventListener("keydown", stop);
  };
  addEventListener("wheel", stop, {passive:true});
  addEventListener("touchstart", stop, {passive:true});
  addEventListener("keydown", stop);
  (function f(now){
    if(cancel || !pages.home.classList.contains("active")){ stop(); return; }
    const p = Math.min(1, (now - st)/dur);
    const e = p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3)/2;
    scrollTo(0, lerp(from, to, e));
    if(p < 1) requestAnimationFrame(f); else stop();
  })(performance.now());
}


/* ==========================================================
   Conto alla rovescia — data provvisoria, da confermare
   ========================================================== */
/* Ora locale di Montevideo (UTC-3). Scritta cosi', il conto alla rovescia
   e' identico per un visitatore di Montevideo, di Roma o di Malargue. */
const LAUNCH = new Date("2026-09-30T10:00:00-03:00");
function updateCountdown(){
  const diff = LAUNCH - Date.now();
  const d = $("#cd"), h = $("#ch"), m = $("#cm"), s = $("#cs"), cb = $("#cbadge");
  if(diff <= 0){
    if(d) d.textContent = "0";
    [h,m,s].forEach(function(e){ if(e) e.textContent = "00"; });
    if(cb) cb.textContent = "● LIVE";
    return;
  }
  const dd = Math.floor(diff/864e5), hh = Math.floor(diff/36e5) % 24,
        mm = Math.floor(diff/6e4) % 60, ss = Math.floor(diff/1e3) % 60;
  if(d) d.textContent = dd;
  if(h) h.textContent = String(hh).padStart(2, "0");
  if(m) m.textContent = String(mm).padStart(2, "0");
  if(s) s.textContent = String(ss).padStart(2, "0");
  if(cb) cb.textContent = "T– " + dd + I18N[LANG].cUnit;
}

/* ==========================================================
   Mappa: la sfondiamo di scuro dall'esterno, senza toccare
   il file generato da cometa_venti.py
   ========================================================== */
function darkenMap(){
  const f = $("#mapFrame"); if(!f) return;
  const paint = function(){
    try{
      const doc = f.contentDocument;
      if(!doc || !doc.head || doc.getElementById("cometa-dark")) return;
      const s = doc.createElement("style");
      s.id = "cometa-dark";
      s.textContent =
        ".leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.85) contrast(1.06) saturate(.55)}" +
        ".leaflet-container{background:#02060f}" +
        ".leaflet-control-attribution{background:rgba(2,6,15,.72)!important;color:#8FA6BC!important;font-size:10px}" +
        ".leaflet-control-attribution a{color:#5FE3FF!important}" +
        ".leaflet-bar a{background:#0b1726!important;color:#EAF3FA!important;border-color:rgba(255,255,255,.12)!important}" +
        ".leaflet-bar a:hover{background:#132234!important}" +
        ".leaflet-control-scale-line{background:rgba(2,6,15,.72)!important;color:#EAF3FA!important;" +
          "border-color:rgba(255,255,255,.25)!important;font-family:ui-monospace,monospace;font-size:10px}" +
        ".leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#0b1726;color:#EAF3FA;box-shadow:0 12px 40px rgba(0,0,0,.5)}" +
        /* I punti restano quelli generati da cometa_venti.py: qui cambiamo
           solo la tinta, perché su fondo scuro il blu e il verde pieni
           sparirebbero. Durazno → ciano, Mercedes → verde, esclusione → rosso. */
        '.leaflet-overlay-pane path[stroke="blue"]{stroke:#5FE3FF!important}' +
        '.leaflet-overlay-pane path[fill="blue"]{fill:#5FE3FF!important}' +
        '.leaflet-overlay-pane path[stroke="green"]{stroke:#4ADE9B!important}' +
        '.leaflet-overlay-pane path[fill="green"]{fill:#4ADE9B!important}' +
        '.leaflet-overlay-pane path[stroke="red"]{stroke:#FF7A5C!important}' +
        '.leaflet-overlay-pane path[fill="red"]{fill:#FF7A5C!important}';
      doc.head.appendChild(s);
      /* Inquadratura: tutto quello che la mappa disegna — i due siti di
         partenza, i 240 atterraggi, le ellissi e l'area di esclusione. */
      const w = f.contentWindow;
      if(w && w.L && !f.dataset.framed){
        const k = Object.keys(w).filter(function(n){ return n.indexOf("map_") === 0 && w[n] && w[n].eachLayer; })[0];
        if(k){
          const map = w[k], bb = w.L.latLngBounds([]);
          map.eachLayer(function(l){
            if(l.getBounds) { try{ bb.extend(l.getBounds()); }catch(e2){} }
            else if(l.getLatLng) { try{ bb.extend(l.getLatLng()); }catch(e2){} }
          });
          if(bb.isValid()){ map.fitBounds(bb, {padding:[26,26]}); f.dataset.framed = "1"; }
        }
      }
    } catch(e){ /* origine diversa: la mappa resta chiara, e va bene lo stesso */ }
  };
  f.addEventListener("load", paint);
  paint();
}

/* ==========================================================
   La fisica del volo — la stessa salita, ma a tappe
   ========================================================== */
const phys      = $("#phys"),      physStage = $("#physStage"),
      physCraft = $("#physCraft"), physBurst = $("#physBurst"), physWrap = $("#phys"),
      physRail  = $("#physRail"),  physCue   = $("#physCue"),
      pAltN = $("#pAltN"), pAltL = $("#pAltL"),
      pEnv = $("#pEnv"), pChute = $("#pChute"), pRig = $("#pRig"), pCord = $("#pCord"),
      physSf = $("#physSf"), physSx = physSf ? physSf.getContext("2d") : null;

const PH_TOP = 37.8;              /* quota di scoppio, dal calcolo del progetto */
const PH_BURST = 0.80;            /* dove cade lo scoppio lungo lo scorrimento */
/* Confini delle sette tappe lungo lo scorrimento */
/* Otto tappe. La sesta parte esattamente a PH_BURST, cosi' il testo
   dello scoppio compare nell'istante in cui il lampo si vede. */
const PH_BANDS = [0, 0.085, 0.255, 0.415, 0.575, PH_BURST, 0.87, 0.94, 1.0001];
let physStep = -1, physFlashed = false;

makeGores($("#pGores"), 13);

function physAlt(p){
  if(p <= PH_BURST) return PH_TOP * (p/PH_BURST);                 /* salita a 5 m/s: lineare */
  const t = (p - PH_BURST)/(1 - PH_BURST);
  return PH_TOP * Math.pow(1 - t, 1.6);                            /* discesa: frena scendendo */
}
function physSetStep(i){
  if(i === physStep) return;
  physStep = i;
  $$(".pstep", $("#physPanel")).forEach(function(el, k){ el.classList.toggle("on", k === i); });
  $$("button", physRail).forEach(function(b, k){
    b.classList.toggle("on", k === i);
    b.setAttribute("aria-current", k === i ? "true" : "false");
  });
}
function physFlash(){
  if(!physBurst) return;
  physBurst.style.transition = "none";
  physBurst.style.opacity = "1";
  physBurst.style.transform = "translate(-50%,-50%) scale(.25)";
  requestAnimationFrame(function(){
    physBurst.style.transition = "opacity .9s ease-out, transform .9s cubic-bezier(.2,.7,.3,1)";
    physBurst.style.opacity = "0";
    physBurst.style.transform = "translate(-50%,-50%) scale(1.7)";
  });
}
function updatePhys(){
  if(!phys || !pages.fisica || !pages.fisica.classList.contains("active")) return;
  const h = phys.offsetHeight - innerHeight;
  const p = clamp((scrollY - phys.offsetTop)/(h || 1), 0, 1);
  const alt = physAlt(p), rising = p <= PH_BURST;

  const c = skyAt(alt);
  physStage.style.background = "linear-gradient(180deg," + c[0] + " 0%," + c[0] + " 6%," + c[1] + " 74%," + c[1] + " 100%)";
  /* stesso colore al contenitore: il bordo della scena sparisce */
  if(physWrap) physWrap.style.setProperty("--sky-top", c[0]);
  if(physSf) physSf.style.opacity = Math.max(nightMix*0.85, smooth(alt, 18, 30));

  const g = $("#physGround");
  if(g){
    g.style.transform = "translateY(" + (alt*0.22*innerHeight) + "px)";
    g.style.opacity = clamp(1 - alt/2.6, 0, 1);
  }

  /* il pallone si gonfia salendo, e sparisce allo scoppio */
  const grow = 1 + 1.18*Math.pow(clamp(alt/PH_TOP, 0, 1), 1.35);
  if(pEnv){
    pEnv.style.transform = "scale(" + grow.toFixed(3) + ")";
    pEnv.style.opacity = rising ? 1 : 0;
  }
  if(pChute) pChute.style.opacity = rising ? 0 : 1;
  if(pCord)  pCord.style.opacity = rising ? 1 : 0;
  if(pRig)   pRig.style.opacity = 1;

  /* crescendo verso l'alto, il pallone va accompagnato in basso
     o esce dall'inquadratura */
  const bob = reduced ? 0 : Math.sin(performance.now()/1700)*0.5;
  const up  = lerp(16, 0, smooth(p, 0, 0.12));
  const swell = (grow - 1)*15;
  const down = rising ? 0 : 8*(1 - alt/PH_TOP);
  physCraft.style.transform = "translate(-50%,-50%) translateY(" + (up + swell + down + bob) + "vh)";

  if(pAltN) pAltN.textContent = alt.toFixed(1);
  if(pAltL) pAltL.textContent = bands[alt < 0.6 ? 0 : alt < 11 ? 1 : alt < 18 ? 2 : 3];

  if(!physFlashed && p >= PH_BURST){ physFlashed = true; physFlash(); }
  if(p < PH_BURST - 0.02) physFlashed = false;

  let i = 0;
  while(i < PH_BANDS.length - 2 && p >= PH_BANDS[i + 1]) i++;
  physSetStep(i);
  if(physCue) physCue.classList.toggle("hide", p > 0.03);
}
function resetPhys(){ physStep = -1; physFlashed = false; updatePhys(); }

/* Rotaia laterale: un punto per tappa, quante che siano */
if(physRail){
  for(let i = 0; i < PH_BANDS.length - 1; i++){
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", String(i + 1));
    b.addEventListener("click", function(){
      const mid = (PH_BANDS[i] + Math.min(PH_BANDS[i + 1], 1))/2;
      const to = phys.offsetTop + (phys.offsetHeight - innerHeight)*mid;
      if(reduced) scrollTo(0, to); else smoothScrollTo(to, 900);
    });
    physRail.appendChild(b);
  }
}

/* ==========================================================
   Scorrimento e avvio
   ========================================================== */
let ticking = false;
function onScroll(){
  $("#nav").classList.toggle("scrolled", scrollY > 40);
  if(!inflateStarted && pages.home.classList.contains("active") && scrollY > 4) startInflate(1200);
  if(!ticking){
    ticking = true;
    requestAnimationFrame(function(){ updateFlight(); updatePhys(); checkReveals(); ticking = false; });
  }
}
addEventListener("scroll", onScroll, {passive:true});
addEventListener("resize", function(){ sfResize(); moveThumb(); updateFlight(); updatePhys(); });

sfResize(); sfDraw();
applyDaylight();
setInterval(applyDaylight, 300000);      /* il cielo segue l'ora, anche a pagina aperta */
setLang(detectLang(), false);
showPage(location.hash.slice(1) || "home");
darkenMap();
updateCountdown();
setInterval(updateCountdown, 1000);
requestAnimationFrame(function(){ moveThumb(); onScroll(); updateFlight(); });
if(!reduced) (function raf(){ updateFlight(); updatePhys(); requestAnimationFrame(raf); })();
addEventListener("load", function(){ moveThumb(); sfResize(); updateFlight(); });

})();
