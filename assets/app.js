/* ============================================================
   COMETA — la catena di volo in tre dimensioni

   Pallone, corda, paracadute, corda antitorsione e payload,
   nell'ordine in cui volano. Si gira col dito o col mouse.

   Il modulo si sveglia da solo quando la figura entra nello
   schermo: Three.js viene caricato in quel momento, non prima.
   I nomi delle cinque parti li prende da I18N[…].chain, e si
   riaggiornano quando cambia la lingua della pagina.
   ============================================================ */

window.COMETA_CATENA = (function(){
"use strict";

/* ---------- Materiali di scena ---------- */
const COL = {
  lattice:  0xDCE3EA,   /* lattice del pallone */
  neck:     0x9AA6B2,
  cord:     0xC2CCD6,
  chuteA:   0xE04A3C,   /* teli del paracadute, a spicchi alterni */
  chuteB:   0xC2352A,
  eps:      0xF2F4F6,   /* polistirolo della sonda */
  fin:      0x8FBAD4,   /* alette di stabilizzazione */
  metal:    0x8A97A4,
  glass:    0x0D141B
};

/* Le cinque parti, nell'ordine della chiave «chain» di i18n */
const KEYS = ["pallone", "corda", "paracadute", "antitorsione", "payload"];

const THREE_LOCAL = "assets/vendor/three.min.js";
const THREE_CDN   = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

let host, cv, renderer, scene, cam, root, ray, ndc, tip;
let ready = false, failed = false, started = false;
let parts = {};                       /* chiave -> {group, meshes[], mats[]} */
let az = 0.62, pol = 1.36, dist = 9.4;
let drag = false, moved = false, lx = 0, ly = 0, pinch = 0, lastTouch = 0;
let hover = null, lang = "it";
const TGT = {x:0, y:-1.28, z:0};

/* I colori sono scritti in sRGB, come si leggono in un editor.
   Il renderer però lavora in lineare: senza questa conversione i
   rossi del paracadute sbiadiscono in rosa. */
function C(hex){ return new THREE.Color(hex).convertSRGBToLinear(); }

const $ = function(s, r){ return (r || document).querySelector(s); };
const T = function(k){
  const d = window.I18N && window.I18N[lang];
  return (d && d[k]) || "";
};
const label = function(key){
  const d = window.I18N && window.I18N[lang];
  const c = d && d.chain;
  const i = KEYS.indexOf(key);
  return (c && c[i]) || "";
};

/* ---------- Caricamento differito di Three.js ---------- */
function script(src){
  return new Promise(function(res, rej){
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = function(){ rej(new Error(src)); };
    document.head.appendChild(s);
  });
}
function loadThree(){
  if(window.THREE) return Promise.resolve();
  return script(THREE_LOCAL).catch(function(){ return script(THREE_CDN); });
}

/* ---------- Profili di rivoluzione ----------
   Un pallone di lattice non è una sfera: è una goccia col collo.
   Lo stesso vale per la calotta del paracadute. Con LatheGeometry
   il profilo diventa una superficie liscia, senza sfaccettature. */
/* I profili sono coppie (raggio, quota). Diventano Vector2 solo
   dentro build(), cioè dopo che Three.js è arrivato. */
const BALLOON_XY = [
  [0.000, 1.000], [0.170, 0.986], [0.372, 0.928], [0.575, 0.822],
  [0.752, 0.668], [0.892, 0.472], [0.972, 0.245], [1.000, 0.000],
  [0.976, -0.238], [0.902, -0.452], [0.786, -0.640], [0.632, -0.800],
  [0.452, -0.930], [0.282, -1.032], [0.152, -1.118], [0.086, -1.208],
  [0.064, -1.300], [0.062, -1.382]
];
const CHUTE_XY = [
  [0.060, 0.000], [0.150, -0.020], [0.288, -0.062], [0.412, -0.124],
  [0.516, -0.202], [0.594, -0.290], [0.640, -0.372], [0.660, -0.436]
];
let BALLOON_PROFILE = [], CHUTE_PROFILE = [];
function makeProfiles(){
  BALLOON_PROFILE = BALLOON_XY.map(function(p){ return new THREE.Vector2(p[0], p[1]); });
  CHUTE_PROFILE   = CHUTE_XY.map(function(p){ return new THREE.Vector2(p[0], p[1]); });
}

/* ---------- Costruzione ---------- */
function build(){
  makeProfiles();
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  cv = renderer.domElement;
  cv.setAttribute("aria-hidden", "true");
  cv.style.cursor = "grab";
  /* Il dito sul modello lo gira in tutte le direzioni; per scorrere
     la pagina si trascina fuori dalla figura. */
  cv.style.touchAction = "none";
  host.appendChild(cv);

  root = new THREE.Group();
  scene.add(root);

  /* Luci: una principale calda in alto a destra, una fredda di
     contorno a sinistra, e un cielo diffuso che apre le ombre. */
  const key = new THREE.DirectionalLight(0xfff6ec, 1.05);
  key.position.set(3.0, 4.2, 2.6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9FD4F0, 0.7);
  rim.position.set(-3.4, 1.2, -2.2); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xBFD8EC, 0.35);
  fill.position.set(0.4, -2.6, 3.0); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xDCEBF8, 0x0A1420, 0.55));

  const reg = function(keyName, obj, mats){
    if(!parts[keyName]) parts[keyName] = {meshes:[], mats:[]};
    if(obj) parts[keyName].meshes.push(obj);
    (mats || []).forEach(function(m){ parts[keyName].mats.push(m); });
  };

  /* ---------- 1 · Pallone ---------- */
  const latex = new THREE.MeshPhysicalMaterial({
    color:C(COL.lattice), roughness:0.42, metalness:0.0,
    clearcoat:0.55, clearcoatRoughness:0.38, sheen:0.0
  });
  const env = new THREE.Mesh(new THREE.LatheGeometry(BALLOON_PROFILE, 128), latex);
  root.add(env); reg("pallone", env, [latex]);

  /* Spicchi: meridiani appena sopra la superficie, non incisi */
  const goreMat = new THREE.LineBasicMaterial({color:C(0x8FA2B4), transparent:true, opacity:0.34});
  const goreGeo = new THREE.BufferGeometry();
  const gp = [];
  for(let g = 0; g < 18; g++){
    const a = (g/18)*Math.PI*2;
    for(let i = 0; i < BALLOON_PROFILE.length - 1; i++){
      const p0 = BALLOON_PROFILE[i], p1 = BALLOON_PROFILE[i + 1];
      gp.push(p0.x*1.004*Math.cos(a), p0.y, p0.x*1.004*Math.sin(a));
      gp.push(p1.x*1.004*Math.cos(a), p1.y, p1.x*1.004*Math.sin(a));
    }
  }
  goreGeo.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
  root.add(new THREE.LineSegments(goreGeo, goreMat));

  const neckMat = new THREE.MeshStandardMaterial({color:C(COL.neck), roughness:0.6, metalness:0.1});
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.12, 32), neckMat);
  collar.position.y = -1.42; root.add(collar); reg("pallone", collar, [neckMat]);

  /* ---------- 2 · Corda pallone → paracadute ---------- */
  const cordMat = new THREE.MeshStandardMaterial({color:C(COL.cord), roughness:0.75});
  const cord1 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.30, 12), cordMat);
  cord1.position.y = -1.63; root.add(cord1); reg("corda", cord1, [cordMat]);

  /* ---------- 3 · Paracadute ---------- */
  const chuteMats = [
    new THREE.MeshStandardMaterial({color:C(COL.chuteA), roughness:0.68, metalness:0.0, side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({color:C(COL.chuteB), roughness:0.68, metalness:0.0, side:THREE.DoubleSide})
  ];
  const chute = new THREE.Group();
  chute.position.y = -1.78;
  const WEDGES = 12;
  for(let w = 0; w < WEDGES; w++){
    const geo = new THREE.LatheGeometry(CHUTE_PROFILE, 12, (w/WEDGES)*Math.PI*2, (Math.PI*2)/WEDGES);
    const m = new THREE.Mesh(geo, chuteMats[w % 2]);
    chute.add(m); reg("paracadute", m, []);
  }
  chuteMats.forEach(function(m){ reg("paracadute", null, [m]); });

  /* Bordo inferiore, perché la calotta non finisca di taglio */
  const hemMat = new THREE.MeshStandardMaterial({color:C(0x9E2A20), roughness:0.6});
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.660, 0.011, 8, 64), hemMat);
  hem.rotation.x = Math.PI/2; hem.position.y = -0.436;
  chute.add(hem); reg("paracadute", hem, [hemMat]);
  root.add(chute);

  /* Funi di sospensione: dal bordo al punto di raccolta */
  const shroudMat = new THREE.LineBasicMaterial({color:C(0xB9C6D2), transparent:true, opacity:0.8});
  const sp = [];
  const SKIRT_Y = -1.78 - 0.436, JOIN_Y = -3.02;
  for(let i = 0; i < 12; i++){
    const a = (i/12)*Math.PI*2;
    sp.push(Math.cos(a)*0.655, SKIRT_Y, Math.sin(a)*0.655);
    sp.push(0, JOIN_Y, 0);
  }
  const shroudGeo = new THREE.BufferGeometry();
  shroudGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  const shrouds = new THREE.LineSegments(shroudGeo, shroudMat);
  root.add(shrouds); reg("paracadute", null, [shroudMat]);

  /* ---------- 4 · Corda antitorsione ---------- */
  const antiMat = new THREE.MeshStandardMaterial({color:C(COL.cord), roughness:0.75});
  const cord2 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 12), antiMat);
  cord2.position.y = JOIN_Y - 0.13; root.add(cord2); reg("antitorsione", cord2, [antiMat]);
  /* Lo swivel: il pezzo che lascia girare la sonda senza attorcigliare */
  const swMat = new THREE.MeshStandardMaterial({color:C(COL.metal), roughness:0.35, metalness:0.8});
  const swivel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.07, 16), swMat);
  swivel.position.y = JOIN_Y - 0.055; root.add(swivel); reg("antitorsione", swivel, [swMat]);

  /* ---------- 5 · Payload: la sonda ----------
     Scatola esterna 220 × 220 × 190 mm, con le due alette
     di stabilizzazione e il braccetto dei sensori esterni. */
  const pay = new THREE.Group();
  const BOX_Y = JOIN_Y - 0.26 - 0.182;
  pay.position.y = BOX_Y;

  const epsMat = new THREE.MeshStandardMaterial({color:C(COL.eps), roughness:0.94, metalness:0.0});
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.420, 0.363, 0.420), epsMat);
  pay.add(box); reg("payload", box, [epsMat]);
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(box.geometry),
    new THREE.LineBasicMaterial({color:C(0x9AA8B6), transparent:true, opacity:0.5}));
  pay.add(edge);

  /* Alette: due pannelli radiali, centrati e simmetrici.
     Stesso orientamento del modello della sonda in modalità Volo:
     la lama esce di taglio dai fianchi, non di piatto. */
  const finMat = new THREE.MeshStandardMaterial({
    color:C(COL.fin), roughness:0.72, metalness:0.04,
    transparent:true, opacity:0.94, side:THREE.DoubleSide
  });
  [-1, 1].forEach(function(sg){
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.382, 0.477), finMat);
    fin.position.set(0, 0, sg*(0.210 + 0.239));
    pay.add(fin); reg("payload", fin, []);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.058, 0.038), finMat);
    rib.position.set(0, 0, sg*0.228);
    pay.add(rib); reg("payload", rib, []);
  });
  reg("payload", null, [finMat]);

  /* Braccetto esterno con il sensore in punta */
  const armMat = new THREE.MeshStandardMaterial({color:C(COL.metal), roughness:0.5, metalness:0.55});
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.29, 12), armMat);
  arm.rotation.z = Math.PI/2; arm.position.set(-0.355, 0.028, 0);
  pay.add(arm); reg("payload", arm, [armMat]);
  const tipMat = new THREE.MeshStandardMaterial({color:C(0xF7FAFC), roughness:0.9});
  const tipS = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.022, 0.022), tipMat);
  tipS.position.set(-0.500, 0.028, 0); pay.add(tipS); reg("payload", tipS, [tipMat]);
  const shieldM = new THREE.MeshStandardMaterial({color:C(0xF7FAFC), roughness:0.88, side:THREE.DoubleSide});
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.005, 0.050), shieldM);
  shield.position.set(-0.478, 0.062, 0); pay.add(shield); reg("payload", shield, [shieldM]);

  /* Obiettivo della camera, a filo di parete */
  const lensMat = new THREE.MeshStandardMaterial({color:C(COL.glass), roughness:0.16, metalness:0.65});
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.008, 24), lensMat);
  lens.rotation.z = Math.PI/2; lens.position.set(0.212, 0.040, 0);
  pay.add(lens); reg("payload", lens, [lensMat]);

  root.add(pay);

  ray = new THREE.Raycaster();
  ndc = new THREE.Vector2();
  place();
}

/* ---------- Camera ---------- */
function place(){
  /* L'inclinazione si ferma ben prima dei poli: a picco da sopra
     il pallone copre tutto il resto, e la catena non si legge più. */
  pol = Math.max(0.78, Math.min(2.42, pol));
  cam.position.set(
    TGT.x + dist*Math.sin(pol)*Math.sin(az),
    TGT.y + dist*Math.cos(pol),
    TGT.z + dist*Math.sin(pol)*Math.cos(az)
  );
  cam.lookAt(new THREE.Vector3(TGT.x, TGT.y, TGT.z));
}

let lastW = 0, lastH = 0;
function resize(){
  const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
  if(w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  cam.aspect = w/h; cam.updateProjectionMatrix();
}

/* ---------- Puntatore ---------- */
function bind(){
  cv.addEventListener("pointerdown", function(e){
    drag = true; moved = false; lastTouch = performance.now();
    lx = e.clientX; ly = e.clientY;
    if(cv.setPointerCapture) { try{ cv.setPointerCapture(e.pointerId); }catch(err){} }
  });
  addEventListener("pointermove", function(e){
    if(!drag) return;
    moved = true; lastTouch = performance.now();
    /* Gira in tutte e due le direzioni: di lato e dall'alto in basso */
    az  -= (e.clientX - lx)*0.008;
    pol -= (e.clientY - ly)*0.005;   /* più docile in verticale */
    lx = e.clientX; ly = e.clientY;
    place();
  });
  addEventListener("pointerup", function(){ drag = false; });
  /* Niente zoom: la distanza resta quella scelta, e la rotella
     serve a scorrere la pagina come su qualunque altra figura. */
  cv.addEventListener("touchstart", function(){ lastTouch = performance.now(); }, {passive:true});
  cv.addEventListener("pointermove", function(e){ if(!drag) pick(e); });
  cv.addEventListener("pointerleave", function(){ setHover(null); });
}

function pick(e){
  const r = cv.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left)/r.width)*2 - 1;
  ndc.y = -((e.clientY - r.top)/r.height)*2 + 1;
  ray.setFromCamera(ndc, cam);
  const list = [];
  Object.keys(parts).forEach(function(k){
    parts[k].meshes.forEach(function(m){ list.push(m); });
  });
  const hits = ray.intersectObjects(list, false);
  let found = null;
  if(hits.length){
    const obj = hits[0].object;
    Object.keys(parts).forEach(function(k){
      if(parts[k].meshes.indexOf(obj) >= 0) found = k;
    });
  }
  setHover(found);
  if(found && tip){
    tip.style.left = (e.clientX - r.left) + "px";
    tip.style.top  = (e.clientY - r.top) + "px";
  }
}

function setHover(k){
  if(k === hover) return;
  hover = k;
  Object.keys(parts).forEach(function(name){
    const on = (name === k);
    parts[name].mats.forEach(function(m){
      if(!m.emissive) return;
      if(on) m.emissive.copy(C(0x5FE3FF)); else m.emissive.setRGB(0, 0, 0);
      m.emissiveIntensity = on ? 0.17 : 0;
    });
  });
  if(tip){
    tip.textContent = k ? label(k) : "";
    tip.classList.toggle("on", !!k && !!label(k));
  }
  cv.style.cursor = "grab";
}

/* ---------- Ciclo ---------- */
function loop(){
  if(!ready) return;
  requestAnimationFrame(loop);
  if(!visible) return;
  resize();
  const idle = performance.now() - lastTouch > 2600;
  if(idle && !drag && !reducedMotion){ az += 0.0016; place(); }
  renderer.render(scene, cam);
}

let visible = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Avvio ---------- */
function start(){
  if(started) return Promise.resolve(ready);
  started = true;
  host = $("#catena3d");
  if(!host) return Promise.resolve(false);
  tip = $("#catenaTip");
  return loadThree().then(function(){
    build();
    bind();
    ready = true;
    const ld = $("#catenaLoad"); if(ld) ld.remove();
    host.classList.add("on");
    new ResizeObserver(function(){ requestAnimationFrame(resize); }).observe(host);
    addEventListener("resize", resize);
    lastTouch = performance.now();
    requestAnimationFrame(loop);
    return true;
  }).catch(function(){
    failed = true;
    /* Senza WebGL resta il disegno: la figura non sparisce mai */
    const ld = $("#catenaLoad"); if(ld) ld.remove();
    const fb = $("#catenaFallback"); if(fb) fb.hidden = false;
    return false;
  });
}

/* Si sveglia quando la figura entra nello schermo */
function watch(){
  const el = $("#catena3d");
  if(!el) return;
  const io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      visible = en.isIntersecting;
      if(en.isIntersecting && !started) start();
    });
  }, {rootMargin:"200px"});
  io.observe(el);
}

/* La lingua: la legge dall'attributo lang della pagina, così non
   serve che app.js sappia di questo modulo. */
function syncLang(){
  const l = document.documentElement.lang || "it";
  if(l === lang) return;
  lang = l;
  const h = $("#catenaHint");
  if(h) h.textContent = T("benchNote");
  if(tip && hover){ tip.textContent = label(hover); }
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", function(){ watch(); syncLang(); });
} else { watch(); syncLang(); }

new MutationObserver(syncLang).observe(document.documentElement, {attributes:true, attributeFilter:["lang"]});

return {start:start, syncLang:syncLang};
})();
