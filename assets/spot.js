/* ==========================================================
   Tracciatore GPS — pagina Diretta (bozza)

   L'app di SPOT Trace (maps.findmespot.com/s/...) ha una sua
   interfaccia — barra, filtri temporali, condivisione — pensata
   per una pagina intera: incorporata in un riquadro piccolo
   risultava tagliata, non ridimensionata male. Qui invece
   disegniamo noi la posizione, su Leaflet, nello stesso stile
   scuro della pagina Traiettoria.

   Il browser non chiama MAI SPOT direttamente: con tanti
   spettatori durante la diretta, ogni browser che interrogasse
   SPOT per conto suo rischierebbe di far bloccare il feed (SPOT
   chiede non piu' di una richiesta ogni 2,5 minuti). A interrogare
   SPOT ci pensa un solo backend (worker/, un Cloudflare Worker —
   vedi worker/README.md), che salva la traccia e la espone in
   GET /track.json; qui si legge solo quello, all'indirizzo in
   window.COMETA_TRACK_URL (assets/app.js).

   La quota ha due numeri distinti, apposta:
   - "GPS" e' l'ultimo punto vero ricevuto, fermo fra un
     aggiornamento e l'altro (SPOT manda un punto ogni ~2,5 minuti).
   - "stimata" e' una curva continua, calcolata dalla fisica del volo
     (salita costante, poi discesa che rallenta scendendo, perche'
     l'aria si fa piu' densa — stessa formula di assets/traiettoria.js),
     seguita lungo un proprio orologio interno (tau, in secondi dal
     lancio) invece che lungo il tempo reale: ogni punto GPS vero
     riancora quell'orologio al punto della curva compatibile con la
     quota misurata (trovato per bisezione, sul ramo di salita o di
     discesa a seconda di dove ci si aspettava di essere), cosi' la
     stima segue anche una deriva nel RITMO del volo — non solo uno
     scarto verticale — se quello vero differisce dal modello. Il
     salto che un riancoraggio puo' produrre si assorbe con un breve
     decadimento (pochi secondi), non di scatto. Non sa quando scoppia
     davvero: in giro per quel momento puo' benissimo mostrarsi gia'
     in discesa mentre il GPS manda ancora un punto di salita — il
     punto vero arriva con qualche minuto di ritardo per natura sua,
     e quando arriva la riallinea con dolcezza.
   ========================================================== */
window.COMETA_SPOT = (function(){
  const TRAJ_POLL_MS = 20 * 60000;
  /* Curva di convergenza delle previsioni (la stessa dell'opzione «Errore
     di previsione» di assets/traiettoria.js): di quanto si sposta ancora
     l'atterraggio previsto fino al giorno del lancio. */
  const CURVA = "https://raw.githubusercontent.com/cometa-sim/cometa-sim.github.io/dati/convergenza_curva.json";
  const CURVA_NMIN = 8;  // il modello GFS si aggiorna ogni poche ore: ogni 20 min basta per non perdere un aggiornamento
  const LEAFLET = "assets/vendor/leaflet/";
  const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const METEO = "https://api.open-meteo.com/v1/forecast";  // stesso servizio usato dal previsore, assets/traiettoria.js
  const TZ = "America/Montevideo";
  const POLL_MS = 30000;      // il feed si aggiorna ogni ~2,5 min: basta chiedere piu' spesso per non perdere tempo ad accorgersene
  const TICK_MS = 1000;
  const T_SMOOTH_S = 5;       // decadimento del salto da riancoraggio: pochi secondi, non un intervallo SPOT intero
  const LOST_MS = 3 * 60000;  // SPOT manda un punto ogni ~2,5 min: 3 min e' un margine ragionevole
  const HIGH_KM = 18;         // sopra qui il GPS smette di trasmettere per natura sua, non per un guasto
  const LANDED_TOL_DEG = 0.0003;  // ~30 m: fix fermi allo stesso punto, segno che la sonda e' a terra
  const GREEN = "#4ADE9B", ORANGE = "#FFB84D", GREY = "#8FA6BC";   // punto reale, lampeggio e atterraggio previsto, traiettoria prevista il giorno del lancio
  /* La telemetria LoRa (assets/lora.js): viola, ben distinto dal verde
     dello SPOT anche per chi non distingue i colori (controllato con il
     validatore di palette: ΔE 27 sul fondo scuro, la soglia e' 8). */
  const VIOLET = "#9B72F5";
  /* La traiettoria prevista cambia aspetto il giorno del lancio (vedi
     stileTraj): prima e' una previsione, azzurra come nel predittore,
     con l'atterraggio arancione; dal giorno del lancio e' grigia, per non
     confondersi con le tracce vere. */
  const CYAN = "#5FE3FF", GREY_CHIARO = "#D3DDE6";
  const SEGUI_ZOOM = 10;
  /* Finche' la sonda non ha ancora mandato nessun punto, la mappa si apre
     centrata sull'Uruguay invece che sull'oceano a (0,0). */
  const FALLBACK = {lat:-33.0, lon:-56.5, zoom:7};

  /* view: la vista 3D (assets/map3d.js), il pulsante 2D/3D. trajPr: l'ultima
     traiettoria prevista (window.COMETA_PREVISIONE), con le quote; trajGroup:
     come e' disegnata in 2D; trajModo: per quale giorno (vedi stileTraj).
     fcLast: l'errore di previsione, {km, age} o null. */
  let view = null, trajPr = null, trajGroup = null, trajModo = null, fcLast = null;
  /* LoRa: la traccia viola, l'ultimo punto, la legenda, il profilo di quota.
     trajOn: la traiettoria prevista si accende e si spegne (pulsante sulla
     mappa); la scelta resta nel browser di chi guarda. */
  let loraTrail = null, loraMarker = null, loraHit = null, loraUltimaT = null, legenda = null, profilo = null,
      trajBtn = null, trajOn = true, spotAltPt = null;
  try { trajOn = localStorage.getItem("cometa-traiettoria") !== "off"; } catch(e){}
  let map, trail, ptsLayer, marker, markerHit, trajRun, mapReady, pollId, tickId, trajId,
      elMap, elStatus, elAltEst, elAltGps, elRecenter,
      lastPoints, lastErr, curLang = "it", lastEstKm = null,
      /* L'ancora: "al tempo reale anchorT (ms) il modello e' al proprio
         tempo interno anchorTau (s dal lancio)". Si riancora a ogni
         punto GPS vero; fra un punto e l'altro avanza 1:1 col tempo
         reale (vedi tauOra). jumpOffsetKm/jumpAtMs sono il salto che un
         riancoraggio produce, da riassorbire con un decadimento breve. */
      anchorT = null, anchorTau = 0, jumpOffsetKm = 0, jumpAtMs = null;

  /* I numeri del volo stanno in assets/volo.js — window.COMETA_FLIGHT —
     cosi' c'e' un solo posto dove aggiornarli il giorno del lancio.
     descentV0Ms e' la velocita' del paracadute AL SUOLO: piu' in alto
     scende molto piu' veloce (vedi densityISA sotto). site e' il punto di
     partenza previsto per la traiettoria grigia: lo stesso di default
     della pagina Traiettoria (aerodromo di Mercedes), non quello che un
     visitatore potrebbe aver cambiato giocando col modulo di quella pagina. */
  function flightCfg(){
    return window.COMETA_FLIGHT || {burstKm:37.9, ascentMs:5, descentV0Ms:4.6, site:{lat:-33.2486, lon:-58.0736}};
  }

  /* Atmosfera standard (ISA) — stessa formula di densitaISA() in
     assets/traiettoria.js, copiata qui (e' autosufficiente, niente
     dati del giorno: per la FORMA della discesa basta il modello
     standard, non il meteo di oggi). */
  function densityISA(h){
    let T, p;
    if(h < 11000){ T = 288.15 - 0.0065 * h; p = 101325 * Math.pow(T / 288.15, 5.2559); }
    else if(h < 20000){ T = 216.65; p = 22632 * Math.exp(-9.80665 * (h - 11000) / (287.05 * T)); }
    else if(h < 32000){ T = 216.65 + 0.001 * (h - 20000); p = 5474.9 * Math.pow(T / 216.65, -34.1632); }
    else { T = 228.65 + 0.0028 * (h - 32000); p = 868.02 * Math.pow(T / 228.65, -12.2011); }
    return p / (287.05 * T);
  }
  const RHO0 = densityISA(0);

  /* tau = secondi dal lancio sull'asse del MODELLO (non per forza uguale
     al tempo reale trascorso: vedi anchorTau/tauOra piu' sotto). */
  function tauBurst(flight){ return flight.burstKm * 1000 / flight.ascentMs; }

  /* Quota (km) attesa in volo, solo dalla fisica, a tau secondi dal
     lancio — salita lineare fino allo scoppio, poi discesa integrata
     passo-passo: la velocita' del paracadute scala con 1/sqrt(densita'),
     quindi e' alta appena scoppiato (aria rada) e rallenta scendendo
     (aria piu' densa). */
  function altPhysicsKm(tau, flight){
    if(tau <= 0) return 0;
    const tb = tauBurst(flight);
    if(tau <= tb) return tau * flight.ascentMs / 1000;
    let z = flight.burstKm * 1000, t = tb;
    const dt = 2;
    while(t < tau && z > 0){
      const v = flight.descentV0Ms * Math.sqrt(RHO0 / densityISA(Math.max(z, 0)));
      z -= v * dt;
      t += dt;
    }
    return Math.max(z, 0) / 1000;
  }

  /* tau dell'atterraggio: stessa integrazione di altPhysicsKm, fino a
     quota zero — serve solo da estremo superiore alla bisezione sul
     ramo di discesa, cosi' non cerca su un intervallo senza fine. */
  function tauLand(flight){
    const tb = tauBurst(flight);
    let z = flight.burstKm * 1000, t = tb;
    const dt = 2;
    while(t < 1e6 && z > 0){
      const v = flight.descentV0Ms * Math.sqrt(RHO0 / densityISA(Math.max(z, 0)));
      z -= v * dt;
      t += dt;
    }
    return t;
  }

  /* Bisezione generica (stessa di bisez() in assets/traiettoria.js):
     serve f(a) e f(b) di segno opposto, 0,5s di tau bastano come
     precisione (altPhysicsKm stessa discretizza a passi di 2s). */
  function bisez(f, a, b){
    let fa = f(a);
    for(let i = 0; i < 60; i++){
      const m = (a + b) / 2, fm = f(m);
      if(Math.abs(fm) < 1e-4 || (b - a) / 2 < 0.5) return m;
      if((fa < 0) === (fm < 0)){ a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  }

  /* L'inversa di altPhysicsKm: a quale tau, sul ramo scelto (salita o
     discesa), il modello passa per la quota hKm? E' il cuore del
     riancoraggio — dice "dove siamo sulla curva", non solo "quanto
     siamo scostati in verticale a questo istante". Fuori dal range del
     ramo (rumore GPS) si aggancia all'estremo piu' vicino. */
  function tauFromAlt(hKm, descending, flight){
    const tb = tauBurst(flight);
    if(!descending){
      if(hKm <= 0) return 0;
      if(hKm >= flight.burstKm) return tb;
      return bisez(function(tau){ return altPhysicsKm(tau, flight) - hKm; }, 0, tb);
    }
    const tl = tauLand(flight);
    if(hKm >= flight.burstKm) return tb;
    if(hKm <= 0) return tl;
    return bisez(function(tau){ return altPhysicsKm(tau, flight) - hKm; }, tb, tl);
  }

  function secSinceLaunch(ms){
    const L = window.COMETA_LAUNCH;
    return L ? (ms - L.getTime()) / 1000 : -1e9;
  }

  /* L'ancora nasce al lancio (tau=0 al tempo reale del lancio) finche'
     non arriva il primo punto vero a riancorarla. */
  function ensureAnchor(){
    if(anchorT != null) return;
    const L = window.COMETA_LAUNCH;
    anchorT = L ? L.getTime() : Date.now();
    anchorTau = 0;
  }

  /* Tau del modello al tempo reale nowMs, proiettando in avanti
     dall'ultima ancora (avanza 1:1 col tempo reale fra un punto vero e
     l'altro). */
  function tauOra(nowMs){
    ensureAnchor();
    return anchorTau + (nowMs - anchorT) / 1000;
  }

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
    const mapkit = window.COMETA_MAPKIT ? Promise.resolve() : new Promise(function(ok, ko){
      const s = document.createElement("script");
      s.src = "assets/mapkit.js?v=200";  // niente cache-bust qui finora: una correzione poteva restare invisibile a chi l'aveva gia' caricato
      s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
    const map3d = window.COMETA_MAP3D ? Promise.resolve() : new Promise(function(ok){
      const s = document.createElement("script");
      s.src = "assets/map3d.js?v=200";
      s.onload = ok; s.onerror = ok;     // senza, resta il 2D e basta
      document.head.appendChild(s);
    });
    return Promise.all([leaflet, mapkit, map3d]);
  }

  function ensureMap(){
    if(mapReady) return mapReady;
    elMap = document.getElementById("spotMap");
    elStatus = document.getElementById("spotStatus");
    elAltEst = document.getElementById("altEst");
    elAltGps = document.getElementById("altGps");
    if(!elMap) return Promise.reject(new Error("manca #spotMap"));
    mapReady = loadLeaflet().then(function(){
      const L = window.L;
      map = L.map(elMap, {scrollWheelZoom:false, zoomControl:true});
      const street = L.tileLayer(TILES, {
        maxZoom:18,
        attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      }).addTo(map);
      L.control.scale({imperial:false, position:"bottomright"}).addTo(map);  // sopra l'attribuzione, non accanto: da telefono l'attribuzione (lunga col satellite Esri) va su piu' righe e copriva la scala in basso a sinistra
      /* schermo intero sul riquadro che contiene sia il 2D sia il 3D: cambiando vista si resta a schermo intero */
      window.COMETA_MAPKIT && window.COMETA_MAPKIT.enhance(map, L, elMap.parentNode, street);
      map.setView([FALLBACK.lat, FALLBACK.lon], FALLBACK.zoom);
      /* La traiettoria prevista sta sotto le tracce vere, in un piano suo:
         area di atterraggio, linee e punti restano nell'ordine in cui si
         aggiungono (vedi disegnaTraiettoria). */
      map.createPane("previsione").style.zIndex = 350;
      trail = L.polyline([], {color:GREEN, weight:2, opacity:.75}).addTo(map);
      ptsLayer = L.layerGroup().addTo(map);     // i punti precedenti, puntini piccoli
      /* Nascosto del tutto finche' non arriva un punto vero: opacity e
         fillOpacity vanno azzerati entrambi, o il pallino pieno resta
         visibile sul punto di fallback (e' il "punto a Mercedes" che si
         vedeva anche senza nessun dato). className serve solo per
         l'animazione del lampeggio (vedi flashMapMarker). interactive:false
         perche' al tocco risponde markerHit, sotto: un cerchio piu' grande
         (invisibile) fa lo stesso per il dito su telefono, dove il pallino
         vero e proprio e' troppo piccolo da toccare con precisione. */
      marker = L.circleMarker([FALLBACK.lat, FALLBACK.lon], {
        radius:7, color:GREEN, weight:2, fillColor:GREEN, fillOpacity:0, opacity:0, className:"spot-marker", interactive:false
      }).addTo(map);
      markerHit = L.circleMarker([FALLBACK.lat, FALLBACK.lon], {radius:16, weight:0, fillOpacity:0, opacity:0}).addTo(map);
      if("ResizeObserver" in window) new ResizeObserver(function(){ map.invalidateSize(); }).observe(elMap);
      map.on("click", function(){ map.scrollWheelZoom.enable(); });
      map.on("mouseout", function(){ map.scrollWheelZoom.disable(); });
      /* Un pulsante per tornare sull'ultima posizione, se chi guarda ha
         spostato o zoomato la mappa da solo: stesso stile dei controlli
         di zoom di Leaflet (.leaflet-bar), niente CSS nuovo da scrivere. */
      const Recenter = L.Control.extend({
        options:{position:"topright"},
        onAdd:function(){
          const div = L.DomUtil.create("div", "leaflet-bar spot-recenter");
          const a = elRecenter = L.DomUtil.create("a", "", div);
          a.href = "#";
          a.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
          a.title = dict().dirSpotRecenter || "recenter";
          L.DomEvent.on(a, "click", L.DomEvent.stop).on(a, "click", function(){
            if(lastPoints && lastPoints.length){
              const last = lastPoints[lastPoints.length - 1];
              map.setView([last.lat, last.lon], Math.max(map.getZoom(), 10));
            }
          });
          return div;
        }
      });
      new Recenter().addTo(map);

      /* La traccia LoRa, sopra quella dello SPOT: e' piu' fitta e arriva
         ogni 5 s. Come per lo SPOT, il pallino visibile non risponde al
         tocco: lo fa un cerchio piu' grande e invisibile. */
      loraTrail = L.polyline([], {color:VIOLET, weight:2.5, opacity:.9, interactive:false}).addTo(map);
      loraMarker = L.circleMarker([FALLBACK.lat, FALLBACK.lon], {
        radius:7, color:VIOLET, weight:2, fillColor:VIOLET, fillOpacity:0, opacity:0, interactive:false
      }).addTo(map);
      loraHit = L.circleMarker([FALLBACK.lat, FALLBACK.lon], {radius:16, weight:0, fillOpacity:0, opacity:0}).addTo(map);

      /* Il pulsante per accendere e spegnere la traiettoria prevista,
         nello stesso stile degli altri (mapkit.js). */
      const Traj = L.Control.extend({
        options:{position:"topright"},
        onAdd:function(){
          const div = trajBtn = L.DomUtil.create("div", "leaflet-bar spot-traj");
          const a = L.DomUtil.create("a", "", div);
          a.href = "#";
          a.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3"><path d="M3 20c4-1 6-6 9-9s6-5 9-7"/></svg>';
          L.DomEvent.on(a, "click", L.DomEvent.stop).on(a, "click", function(){
            trajOn = !trajOn;
            try { localStorage.setItem("cometa-traiettoria", trajOn ? "on" : "off"); } catch(e){}
            mostraTraiettoria();
          });
          return div;
        }
      });
      new Traj().addTo(map);

      /* La legenda, sotto la mappa e non sopra (da telefono copriva i
         pulsanti): le due fonti, ognuna con l'eta' del suo ultimo dato
         (una posizione vecchia non deve sembrare attuale), e la
         traiettoria prevista. Il testo e' nei colori del testo, il
         colore lo porta solo il segno accanto. */
      legenda = document.getElementById("spotLegenda");
      if(legenda) legenda.innerHTML =
        '<span class="leg-row"><i class="leg-dot" style="background:' + VIOLET + '"></i><b>LoRa</b> <span class="leg-lora"></span></span>' +
        '<span class="leg-row"><i class="leg-dot" style="background:' + GREEN + '"></i><b>SPOT</b> <span class="leg-spot"></span></span>' +
        '<span class="leg-row leg-traj"><i class="leg-dash"></i><span class="leg-traj-t"></span></span>';
      mostraTraiettoria();
      /* 2D / 3D: nel 3D si segue il volo con la quota vera. La traiettoria
         prevista ha i colori del 2D (stileTraj). */
      if(window.COMETA_MAP3D) view = window.COMETA_MAP3D.attach({
        L:L, map:map, elMap:elMap, el3Style:"position:absolute;inset:0",
        create:{color:GREEN, colorDown:GREEN},
        onEnter:function(c){ c.render(scene3d(), true); },
        onLeave:function(){
          if(lastPoints && lastPoints.length){
            const last = lastPoints[lastPoints.length - 1];
            map.setView([last.lat, last.lon], Math.max(map.getZoom(), 10));
          }
        },
        onFail:function(){ lastErr = "3d"; renderStatus(); }
      });
    });
    return mapReady;
  }

  /* Cio' che il 3D deve mostrare: i fix GPS veri (uno per uno, alla loro
     quota; un fix arrivato senza quota resta solo come punto a terra) e la
     traiettoria prevista (sottile e trasparente), con i colori del 2D:
     tubo, proiezione a terra, scoppio, atterraggio e, prima del giorno del
     lancio, l'area di atterraggio. */
  function scene3d(){
    const live = (lastPoints || []).map(function(p){
      return {lat:p.lat, lon:p.lon, alt:p.alt != null ? Math.max(0, p.alt) : null};
    });
    /* map3d.js disegna una sola traccia "live": quella LoRa quando c'e',
       perche' ha la quota a ogni punto ed e' molto piu' fitta; quella
       dello SPOT altrimenti. */
    const lora = window.COMETA_LORA ? window.COMETA_LORA.punti() : [];
    const vivo = lora.length ? {pts:lora.map(function(p){ return {lat:p.lat, lon:p.lon, alt:p.alt != null ? Math.max(0, p.alt) : null}; }), color:VIOLET}
      : {pts:live, color:GREEN};
    const sc = {runs:[], main:false, live:vivo};
    if(trajPr && trajOn){
      const st = stileTraj(), d = dict();
      sc.runs = [{pts:trajPr.full, burst:trajPr.burst, end:trajPr.end}];
      sc.col = {up:st.linea, down:st.linea};
      sc.ombra = st.ombra;
      sc.pin = {land:st.arrivo, burst:st.scoppioFill};
      sc.labels = {burst:testoScoppio(d), land:testoArrivo(d)};
      if(fcLast && !st.giorno) sc.fills = [{ring:cerchio(trajPr.end, fcLast.km), color:ORANGE, opacity:.35}];
    }
    return sc;
  }
  /* Un cerchio di raggio km intorno a p, come anello [lon, lat] per map3d.js. */
  function cerchio(p, km){
    const k = Math.cos(p.lat * Math.PI / 180), out = [];
    for(let i = 0; i < 96; i++){
      const u = 2 * Math.PI * i / 96;
      out.push([p.lon + km * Math.cos(u) / (111.32 * k), p.lat + km * Math.sin(u) / 110.57]);
    }
    return out;
  }
  function redraw3d(fit){
    if(view && view.isOn() && view.ctl()) view.ctl().render(scene3d(), !!fit);
  }

  function dict(){ return (window.I18N && (window.I18N[curLang] || window.I18N.it)) || {}; }

  /* "12s", "2min 05s": niente ore, un volo e' questione di minuti non di ore. */
  function formatAgo(ms){
    const s = Math.max(0, Math.round(ms / 1000));
    if(s < 60) return s + "s";
    if(s >= 3600) return Math.floor(s / 3600) + "h " + String(Math.floor(s / 60) % 60).padStart(2, "0") + "min";
    const m = Math.floor(s / 60), r = s % 60;
    return m + "min " + String(r).padStart(2, "0") + "s";
  }

  /* Due fix di seguito fermi quasi allo stesso punto, DOPO il lancio
     vero: a terra, non in volo (in aria la deriva del vento sposta
     sempre qualcosa). Senza il "dopo il lancio" la sonda ferma al suolo
     prima del via sembrerebbe gia' atterrata. */
  function isLanded(points){
    if(secSinceLaunch(Date.now()) <= 0 || points.length < 2) return false;
    const a = points[points.length - 1], b = points[points.length - 2];
    return Math.abs(a.lat - b.lat) < LANDED_TOL_DEG && Math.abs(a.lon - b.lon) < LANDED_TOL_DEG;
  }

  function renderStatus(){
    if(elRecenter) elRecenter.title = dict().dirSpotRecenter || "recenter";
    if(!elStatus) return;
    const d = dict();
    /* dati non arrivati (rete, CORS, risposta del backend): "Network error", uguale in ogni lingua */
    if(lastErr === "3d"){ elStatus.textContent = d.mk3dFail || "3D"; return; }
    /* Se il LoRa ha un punto buono piu' recente dello SPOT, la riga parla
       di quello (la posizione piu' fresca); se lo SPOT tace sopra i 18 km
       ma il LoRa trasmette, non c'e' nessun "segnale perso" da dire. */
    const lora = window.COMETA_LORA ? window.COMETA_LORA.punti() : [];
    const lp = lora[lora.length - 1];
    const spotT = lastPoints && lastPoints.length ? new Date(lastPoints[lastPoints.length - 1].time).getTime() : -Infinity;
    if(lp && lp.t >= spotT){
      const sl = window.COMETA_LORA.stato(Date.now());
      const ago = (d.dirSpotAgo || "{t} ago").replace("{t}", formatAgo(Date.now() - lp.t));
      if(sl.fase === "atterrata"){ elStatus.textContent = (d.dirSpotLanded || "probe landed") + " · " + lp.lat.toFixed(4) + ", " + lp.lon.toFixed(4); return; }
      elStatus.textContent = sl.stato === "perso" ? (d.dirLegLost || "signal lost") + " · " + ago
        : lp.lat.toFixed(4) + ", " + lp.lon.toFixed(4) + " · " + ago;
      return;
    }
    /* L'errore di rete dello SPOT conta solo se il LoRa non ha niente da dire. */
    if(lastErr){ elStatus.textContent = "Network error"; return; }
    if(!lastPoints || !lastPoints.length){ elStatus.textContent = d.dirSpotWaiting || "waiting…"; return; }
    if(isLanded(lastPoints)){ elStatus.textContent = d.dirSpotLanded || "probe landed"; return; }
    const last = lastPoints[lastPoints.length - 1];
    const whenMs = new Date(last.time).getTime();
    const elapsed = isNaN(whenMs) ? null : Date.now() - whenMs;
    if(elapsed != null && elapsed > LOST_MS){
      /* La quota STIMATA (non l'ultimo fix, ormai vecchio) dice se il
         silenzio e' quello normale sopra i 18 km o no. */
      const high = lastEstKm != null && lastEstKm > HIGH_KM;
      elStatus.textContent = high ? (d.dirSpotLostHigh || "GPS signal lost • > 18 km") : (d.dirSpotLost || "GPS signal lost");
      return;
    }
    elStatus.textContent = last.lat.toFixed(4) + ", " + last.lon.toFixed(4) +
      (elapsed != null ? " · " + (d.dirSpotAgo || "{t} ago").replace("{t}", formatAgo(elapsed)) : "");
  }

  function setAltText(el, km){
    if(!el) return;
    if(km == null){ el.textContent = "—"; return; }
    /* toFixed arrotonda anche il segno: -0,04 diventa "-0.0", che sembra
       un errore. Il meno resta solo se il valore arrotondato e' davvero
       sotto zero (es. "-0.1"), non quando arrotonda a zero. */
    let txt = km.toFixed(1);
    if(txt === "-0.0") txt = "0.0";
    el.textContent = txt;
  }

  /* La quota mostrata ora: il modello alla sua tau proiettata, piu' il
     residuo del salto dell'ultimo riancoraggio, che decade in fretta
     (T_SMOOTH_S) invece di sparire di scatto. */
  function quotaMostrata(nowMs, flight){
    const base = altPhysicsKm(tauOra(nowMs), flight);
    if(jumpAtMs == null) return base;
    const dtS = Math.max((nowMs - jumpAtMs) / 1000, 0);
    return base + jumpOffsetKm * Math.exp(-dtS / T_SMOOTH_S);
  }

  /* Ogni punto vero riancora l'orologio interno del modello (tau) al
     punto della curva compatibile con la quota misurata — non solo
     uno scarto verticale: se il ritmo vero del volo si discosta da
     quello nominale (salita piu' lenta/veloce, scoppio prima/dopo),
     da qui in poi il modello riparte dalla pendenza giusta per quel
     punto della curva, non da quella nominale. Il salto che questo
     puo' produrre nel valore mostrato si registra qui (jumpOffsetKm) e
     tick() lo riassorbe con un decadimento breve, non di scatto. */
  function onNewRealPoint(point){
    if(point.alt == null) return;
    const flight = flightCfg();
    const nowMs = Date.now(), tgMs = new Date(point.time).getTime();
    if(isNaN(tgMs)) return;
    const prima = quotaMostrata(nowMs, flight);
    const descending = tauOra(tgMs) > tauBurst(flight);   // con l'ancora vecchia
    anchorTau = tauFromAlt(point.alt / 1000, descending, flight);
    anchorT = tgMs;
    jumpOffsetKm = prima - altPhysicsKm(tauOra(nowMs), flight);
    jumpAtMs = nowMs;
  }

  function tick(){
    const flight = flightCfg();
    const estKm = quotaMostrata(Date.now(), flight);
    /* Una quota "stimata" negativa non ha senso per chi guarda, anche se
       il dato grezzo del GPS (sotto, onesto) puo' esserlo per via del
       rumore a terra: qui mostriamo 0 invece di un numero sottoterra. */
    lastEstKm = Math.max(estKm, 0);
    setAltText(elAltEst, lastEstKm);
    /* Il contatore "da quanto" e gli stati segnale perso/atterrata si
       aggiornano ogni secondo, anche senza una risposta nuova dal feed:
       cosi' si vede che la pagina non e' bloccata, non solo quando
       arriva un dato. */
    renderStatus();
    renderLegenda();
    aggiornaGiorno();
  }

  let lastRealTime = null, lastAltKey = null;

  function flashGps(){
    const el = document.getElementById("altGpsRow");
    if(!el) return;
    el.classList.remove("flash");
    void el.offsetWidth; // forza il reflow, cosi' l'animazione riparte anche se era appena finita
    el.classList.add("flash");
  }

  /* Lo stesso lampeggio arancione della tessera, sul puntino della mappa:
     scatto immediato all'arancione (senza transizione, o si vedrebbe
     sfumare anche l'entrata), poi — con la classe "spot-marker-fade", che
     ha la transizione CSS — una dissolvenza morbida di ritorno al verde. */
  function flashMapMarker(){
    if(!marker) return;
    const path = marker.getElement && marker.getElement();
    if(path) path.classList.remove("spot-marker-fade");
    marker.setStyle({color:ORANGE, fillColor:ORANGE});
    setTimeout(function(){
      if(path) path.classList.add("spot-marker-fade");
      marker.setStyle({color:GREEN, fillColor:GREEN});
    }, 780);   // tiene l'arancione pieno circa il primo terzo, come altFlash in cometa.css
  }

  function popupHtml(p){
    const d = dict();
    const when = new Date(p.time);
    const ok = !isNaN(when.getTime());
    const timeTxt = ok ? when.toLocaleString(d.code || "it", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"}) : "—";
    const altTxt = p.alt != null ? (p.alt / 1000).toFixed(1) + " km" : "—";
    return "<b>" + timeTxt + "</b><br>" + p.lat.toFixed(4) + ", " + p.lon.toFixed(4) + "<br>" + altTxt;
  }

  function render(points){
    lastPoints = points; lastErr = null;
    if(points.length){
      const L = window.L;
      const latlngs = points.map(function(p){ return [p.lat, p.lon]; });
      trail.setLatLngs(latlngs);
      /* I punti precedenti restano sulla mappa, piu' piccoli dell'ultimo,
         uniti dalla stessa spezzata verde: si ridisegnano tutti a ogni
         risposta, sono al massimo poche decine. Ogni punto e' in realta'
         due cerchi sovrapposti: quello visibile (piccolo) e uno invisibile
         piu' grande (interattivo lui, non l'altro) solo per rendere il
         tocco piu' facile su telefono — il pallino vero da solo e' troppo
         piccolo da centrare con un dito. */
      ptsLayer.clearLayers();
      points.slice(0, -1).forEach(function(p){
        L.circleMarker([p.lat, p.lon], {radius:14, weight:0, fillOpacity:0, opacity:0})
          .bindPopup(popupHtml(p)).addTo(ptsLayer);
        L.circleMarker([p.lat, p.lon], {radius:4, color:GREEN, weight:1.5, fillColor:GREEN, fillOpacity:.85, interactive:false})
          .addTo(ptsLayer);
      });
      const last = points[points.length - 1];
      marker.setLatLng([last.lat, last.lon]);
      marker.setStyle({opacity:1, fillOpacity:.9});
      markerHit.setLatLng([last.lat, last.lon]);
      if(markerHit.getPopup()) markerHit.setPopupContent(popupHtml(last)); else markerHit.bindPopup(popupHtml(last));
      if(lastRealTime == null || String(last.time) !== String(lastRealTime)) segui(last.lat, last.lon, last.time);
      /* Il Data Push porta la posizione pochi secondi dopo il messaggio ma
         senza quota; la quota dello stesso messaggio arriva poco dopo, con
         la lettura del feed (vedi worker/README.md). Nel frattempo la quota
         GPS resta l'ultima misurata invece di passare a "—": il puntino si
         sposta e lampeggia subito, la tessera della quota quando arriva
         una quota nuova. */
      spotAltPt = null;
      for(let i = points.length - 1; i >= 0; i--){ if(points[i].alt != null){ spotAltPt = points[i]; break; } }
      if(lastRealTime != null && String(last.time) !== String(lastRealTime)) flashMapMarker();
      lastRealTime = last.time;
      aggiornaQuotaGps();
    }
    redraw3d(false);
    renderStatus();
  }

  /* La mappa segue l'ultimo dato, ma solo se e' davvero il piu' recente
     fra SPOT e LoRa: altrimenti ogni 30 s lo SPOT, con un punto di due
     minuti prima, la riporterebbe indietro. E solo quando arriva un dato
     nuovo, non a ogni lettura: chi ha spostato la mappa da solo non
     viene riportato al centro di continuo. */
  let seguiT = -Infinity;
  function segui(lat, lon, t){
    if(t < seguiT) return;
    seguiT = t;
    if(!(view && view.isOn())) map.setView([lat, lon], Math.max(map.getZoom(), SEGUI_ZOOM));   // il 2D nascosto non ha misura
  }

  /* "Ultimo punto GPS": la quota piu' recente fra le due fonti (sono
     due GPS, quello dello SPOT e quello della sonda). La stessa ancora
     la quota stimata (onNewRealPoint). */
  function aggiornaQuotaGps(){
    const lora = window.COMETA_LORA ? window.COMETA_LORA.punti() : [];
    let lp = null;
    for(let i = lora.length - 1; i >= 0; i--){ if(lora[i].alt != null){ lp = lora[i]; break; } }
    let pt = spotAltPt, daLora = false;
    if(lp && (!pt || lp.t > pt.time)){ pt = {lat:lp.lat, lon:lp.lon, alt:lp.alt, time:lp.t}; daLora = true; }
    setAltText(elAltGps, pt ? pt.alt / 1000 : null);
    /* il colore del numero dice da quale fonte viene, come sulla mappa */
    const row = document.getElementById("altGpsRow");
    if(row) row.classList.toggle("da-lora", daLora);
    const altKey = pt ? pt.time + "|" + pt.alt : null;
    if(lastAltKey != null && altKey !== lastAltKey) flashGps();
    lastAltKey = altKey;
    if(pt) onNewRealPoint(pt);
  }

  /* I punti LoRa buoni (assets/lora.js li ha gia' filtrati). */
  function renderLora(){
    if(!loraTrail) return;
    const pts = window.COMETA_LORA.punti();
    loraTrail.setLatLngs(pts.map(function(p){ return [p.lat, p.lon]; }));
    const last = pts[pts.length - 1];
    if(last){
      loraMarker.setLatLng([last.lat, last.lon]).setStyle({opacity:1, fillOpacity:.9});
      loraHit.setLatLng([last.lat, last.lon]);
      const html = popupHtml({lat:last.lat, lon:last.lon, alt:last.alt, time:last.t});
      if(loraHit.getPopup()) loraHit.setPopupContent(html); else loraHit.bindPopup(html);
      if(last.t !== loraUltimaT){ loraUltimaT = last.t; segui(last.lat, last.lon, last.t); }
    }
    aggiornaQuotaGps();
    if(profilo) profilo.aggiorna(pts, testiProfilo());
    redraw3d(false);
    renderLegenda();
  }

  function testiProfilo(){
    const d = dict();
    return {vuoto:d.dirProfEmpty || "Waiting for LoRa data", km:"km"};
  }

  /* La legenda: LoRa con la fase del volo e l'eta' dell'ultimo dato
     buono, o "segnale perso"; SPOT con l'eta' del suo ultimo punto. */
  function renderLegenda(){
    if(!legenda || !legenda.querySelector(".leg-lora")) return;    // la pagina non ha la legenda (o la mappa non e' ancora pronta)
    const d = dict(), now = Date.now();
    const sl = window.COMETA_LORA ? window.COMETA_LORA.stato(now) : {stato:"attesa"};
    const lp = window.COMETA_LORA ? window.COMETA_LORA.punti() : [];
    let tl;
    if(sl.stato === "attesa") tl = d.dirLegWait || "waiting";
    else {
      const ago = (d.dirSpotAgo || "{t} ago").replace("{t}", formatAgo(now - lp[lp.length - 1].t));
      tl = sl.stato === "perso" ? (d.dirLegLost || "signal lost") + " · " + ago
        : ((sl.fase && d["dirFase_" + sl.fase]) ? d["dirFase_" + sl.fase] + " · " : "") + ago;
    }
    legenda.querySelector(".leg-lora").textContent = "· " + tl;
    legenda.querySelector(".leg-lora").classList.toggle("leg-perso", sl.stato === "perso");
    let ts = d.dirLegWait || "waiting";
    if(lastPoints && lastPoints.length){
      const t = new Date(lastPoints[lastPoints.length - 1].time).getTime();
      if(!isNaN(t)) ts = (d.dirSpotAgo || "{t} ago").replace("{t}", formatAgo(now - t));
    }
    legenda.querySelector(".leg-spot").textContent = "· " + ts;
    legenda.querySelector(".leg-traj-t").textContent = d.dirLegTraj || "Predicted trajectory";
  }

  /* La risposta del backend (worker/, GET /track.json) e' gia' pulita e
     deduplicata — qui si normalizza solo la forma che il resto del file
     si aspetta: alt in metri, time in ms (il Worker lo da' in secondi
     unix). publicFrom non impostato sul Worker = points vuoto: la mappa
     resta su "in attesa del segnale", niente di rotto. */
  function parse(data){
    if(!data || !Array.isArray(data.points)) throw new Error("risposta del backend non valida");
    return data.points
      .filter(function(p){ return p.lat != null && p.lon != null && p.time != null; })
      .map(function(p){
        return {
          lat: +p.lat,
          lon: +p.lon,
          /* Metri, quota ellissoidica GPS: vicino al suolo puo' essere
             negativa di suo (rumore tipico del GPS li', non un errore). */
          alt: p.altitude != null ? +p.altitude : null,
          time: p.time * 1000
        };
      })
      .sort(function(a, b){ return a.time - b.time; });
  }

  function poll(){
    const url = window.COMETA_TRACK_URL;
    /* Finche' il backend non e' stato ancora distribuito (TRACK_URL
       vuota in assets/app.js) niente chiamate a vuoto: solo lo stato
       "in attesa del segnale", come se la sonda non avesse ancora
       trasmesso. */
    if(!url){ lastErr = null; renderStatus(); return; }
    fetch(url, {cache:"no-store"})
      .then(function(res){ if(!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then(function(data){ render(parse(data)); })
      .catch(function(err){ lastErr = err.message; renderStatus(); });
  }

  /* La traiettoria prevista: lo stesso previsore (Tawhiri/SondeHub) e i
     dati del volo di assets/volo.js (partenza, quota di scoppio e velocita'
     del volo vero), girato silenziosamente in background, senza toccare la
     vista della mappa (quella segue solo i punti GPS veri). Se la data di
     lancio e' fuori dall'orizzonte del previsore (troppo lontana, o il
     modello non e' ancora pronto) la richiesta fallisce e non si fa nulla:
     si riprova al giro dopo. */
  function pollTrajectory(){
    const L0 = window.COMETA_LAUNCH;
    if(!window.COMETA_PREVISIONE) return;
    /* La richiesta e' in assets/volo.js, la stessa della pagina della
       stazione LoRa, cosi' le due pagine disegnano la stessa linea. */
    window.COMETA_PREVISIONE().then(function(pr){
      if(!pr) return;                                  // silenzioso: fuori orizzonte, previsore non pronto, offline
      if(pr.run && pr.key === trajRun) return;         // stessa corsa, stessi dati: niente da ridisegnare
      trajRun = pr.key;
      Promise.all([ensureMap(), loadCurva()]).then(function(res){
        trajPr = pr;
        fcLast = fcRadiusKm(res[1], pr.run, L0, pr.durMin);
        disegnaTraiettoria();
        renderScheda();
      });
    });
  }

  /* Il giorno del lancio (ora di Montevideo) e dopo: la traiettoria e'
     grigia, piena fino allo scoppio e tratteggiata dopo, con scoppio e
     atterraggio grigi, e senza l'area dell'errore di previsione (il
     giorno del lancio l'anticipo e' zero). Prima: azzurra come nel
     predittore (assets/traiettoria.js, draw), atterraggio arancione e
     intorno l'area di atterraggio, arancione. */
  const FMT_GIORNO = new Intl.DateTimeFormat("en-CA", {timeZone:TZ, year:"numeric", month:"2-digit", day:"2-digit"});
  function dayUy(dt){ return FMT_GIORNO.format(dt); }
  function giornoLancio(){
    const L0 = window.COMETA_LAUNCH;
    return !!L0 && dayUy(L0) <= dayUy(new Date());
  }
  function stileTraj(){
    return giornoLancio()
      ? {giorno:true, linea:GREY, scoppio:GREY, scoppioFill:GREY_CHIARO, arrivo:GREY, ombra:GREY}
      : {giorno:false, linea:CYAN, scoppio:CYAN, scoppioFill:"#fff", arrivo:ORANGE, ombra:"#ffffff"};
  }
  function numero(x, dec){
    return new Intl.NumberFormat(dict().code || "it", {minimumFractionDigits:dec, maximumFractionDigits:dec}).format(x);
  }
  function testoScoppio(d){ return (d.twBurstC || "Burst altitude") + " " + numero(trajPr.burst.alt / 1000, 1) + " km"; }
  function testoArrivo(d){
    return (d.twLand || "Landing") + " " + new Intl.DateTimeFormat("en-GB", {timeZone:TZ, hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).format(trajPr.end.t);
  }

  /* Ridisegna da capo la traiettoria in 2D (succede solo con una corsa
     GFS nuova, al cambio di lingua e a mezzanotte del giorno del lancio):
     prima l'area di atterraggio, sopra le linee, sopra ancora i punti. */
  function disegnaTraiettoria(){
    const L = window.L, pr = trajPr;
    if(!pr || !map) return;
    const st = stileTraj(), d = dict(), P = "previsione";
    trajModo = st.giorno;
    if(trajGroup) map.removeLayer(trajGroup);
    trajGroup = L.featureGroup();
    const ll = function(p){ return [p.lat, p.lon]; };
    const su = pr.full.filter(function(p){ return p.up; }).map(ll);
    const giu = pr.full.filter(function(p){ return !p.up; }).map(ll);
    if(giu.length) giu.unshift(ll(pr.burst));
    if(fcLast && !st.giorno){
      /* L.circle: un arco SVG vero, liscio a ogni zoom */
      L.circle(ll(pr.end), {pane:P, radius:fcLast.km * 1000, color:ORANGE, weight:3, opacity:1,
        fillColor:ORANGE, fillOpacity:.35, bubblingMouseEvents:true}).bindTooltip(fcTip(), {sticky:true}).addTo(trajGroup);
    }
    L.polyline(su, {pane:P, color:st.linea, weight:3, opacity:.95, interactive:false}).addTo(trajGroup);
    L.polyline(giu, {pane:P, color:st.linea, weight:2.5, opacity:.95, dashArray:"6 7", interactive:false}).addTo(trajGroup);
    L.circleMarker(ll(pr.burst), {pane:P, radius:5, color:st.scoppio, weight:2, fillColor:st.scoppioFill, fillOpacity:1, bubblingMouseEvents:false})
      .bindTooltip(testoScoppio(d)).addTo(trajGroup);
    L.circleMarker(ll(pr.end), {pane:P, radius:8, color:"#02060f", weight:2, fillColor:st.arrivo, fillOpacity:1, bubblingMouseEvents:false})
      .bindTooltip(testoArrivo(d)).addTo(trajGroup);
    mostraTraiettoria();
  }

  /* Accende o spegne la traiettoria prevista (con scoppio, atterraggio e
     area di atterraggio) sulla mappa 2D e nel 3D. */
  function mostraTraiettoria(){
    if(trajGroup){
      if(trajOn && !map.hasLayer(trajGroup)) trajGroup.addTo(map);
      else if(!trajOn && map.hasLayer(trajGroup)) map.removeLayer(trajGroup);
    }
    if(trajBtn){
      trajBtn.classList.toggle("mk-active", trajOn);
      trajBtn.firstChild.title = dict().dirTrajToggle || "Predicted trajectory";
    }
    const lt = legenda && legenda.querySelector(".leg-traj");
    if(lt){
      lt.style.opacity = trajOn ? 1 : .45;
      lt.querySelector(".leg-dash").style.borderTopColor = stileTraj().linea;
    }
    redraw3d(false);
  }

  /* La scheda della previsione sotto il meteo, uguale a quella del
     predittore (assets/traiettoria.js la disegna): partenza, atterraggio,
     deriva, tempi e quote del volo previsto. */
  function renderScheda(){
    const el = document.getElementById("dirScheda");
    if(!el || !window.COMETA_TRAIETTORIA) return;
    el.hidden = !trajPr;
    if(trajPr) window.COMETA_TRAIETTORIA.scheda(el, trajPr.raw, {atmo:flightCfg().atmo, fc:fcLast});
  }

  /* Quota e quota nel tempo compaiono solo dal giorno del lancio; e a
     mezzanotte di quel giorno la traiettoria cambia colori. */
  function aggiornaGiorno(){
    const g = giornoLancio(), q = document.getElementById("dirQuote");
    if(q && q.hidden === g) q.hidden = !g;
    if(trajPr && trajModo !== g){
      if(g) fcLast = null;
      disegnaTraiettoria(); renderScheda();
    }
  }

  /* Errore di previsione intorno all'atterraggio previsto: un cerchio
     di raggio pari al terzo quartile della curva, interpolato
     sull'eta' della corsa GFS usata (lancio - corsa) e scalato con la
     durata del volo; stessa logica di fcRadius() in assets/traiettoria.js.
     Si restringe giorno per giorno; il giorno del lancio e' zero per
     definizione e il cerchio sparisce. */
  let curva = null;
  function loadCurva(){
    if(curva) return curva;
    curva = fetch(CURVA, {cache:"no-cache"}).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ return d && d.classi ? d : null; }, function(){ return null; })
      .then(function(d){ if(!d) curva = null; return d; });       // un fallimento non si ricorda
    return curva;
  }
  function fcRadiusKm(d, run, L0, durMin){
    if(!d || !run || dayUy(L0) <= dayUy(new Date())) return null;   // giorno del lancio: zero
    const age = (L0 - run) / 36e5;
    const C = d.classi.filter(function(c){ return c.n >= CURVA_NMIN; })
      .sort(function(a, b){ return a.eta_h - b.eta_h; });
    if(C.length < 2 || age > C[C.length - 1].eta_h + 12) return null;
    let q = 0;
    if(age >= C[C.length - 1].eta_h) q = C[C.length - 1].q3_km;
    else if(age > C[0].eta_h){
      for(let i = 0; i < C.length - 1; i++){
        const a = C[i], b = C[i + 1];
        if(age <= b.eta_h){ q = a.q3_km + (age - a.eta_h) / (b.eta_h - a.eta_h) * (b.q3_km - a.q3_km); break; }
      }
    }
    const km = q * (d.durata_ref_min > 0 ? durMin / d.durata_ref_min : 1);
    return km > 0 ? {km:km, age:age} : null;
  }
  function fcTip(){
    return (dict().dirFcTip || "R = {r} km").replace("{r}", Math.round(fcLast.km)).replace("{h}", Math.round(fcLast.age));
  }

  /* Le cinque icone del meteo (sole, sole e nuvola, nuvola e goccia, nuvola
     e tre gocce, vento): soglie semplici su nuvolosita', probabilita' di
     pioggia e vento a terra, non un vero simbolo meteorologico. SVG
     inline, stesso motivo delle icone di mapkit.js (un'emoji dipende dal
     font del sistema). Ordine di priorita': pioggia (debole o forte),
     cielo coperto, vento, parzialmente nuvoloso, sole. 24 km/h e' la
     soglia citata piu' spesso nelle guide amatoriali ai palloni
     stratosferici, non un limite calcolato da noi. */
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

  /* Meteo previsto sul punto di lancio al giorno e all'ora del lancio
     (window.COMETA_LAUNCH, assets/volo.js) — previsione oraria di
     Open-Meteo, come il riquadro del predittore (assets/traiettoria.js).
     Il punto e' sempre quello fisso del lancio (window.COMETA_FLIGHT.site),
     non scelto da chi guarda. La previsione arriva a 16 giorni: prima di
     allora quell'ora non c'e' e il riquadro resta nascosto. */
  /* Come cloudsTip in assets/traiettoria.js: i tre strati nel title, in inglese. */
  function cloudsTip(h, i){
    const g = function(k){ return h[k] && h[k][i] != null ? Math.round(h[k][i]) + " %" : "—"; };
    return h.cloud_cover_low ? "low " + g("cloud_cover_low") + " · mid " + g("cloud_cover_mid") + " · high " + g("cloud_cover_high") : "";
  }
  function loadWeather(){
    const el = document.getElementById("dirWeather"), L0 = window.COMETA_LAUNCH;
    if(!el || !L0) return;
    const site = (window.COMETA_FLIGHT && window.COMETA_FLIGHT.site) || FALLBACK;
    const p = {};
    new Intl.DateTimeFormat("en-CA", {timeZone:TZ, year:"numeric", month:"2-digit", day:"2-digit",
      hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).formatToParts(L0).forEach(function(x){ p[x.type] = x.value; });
    const iso = p.year + "-" + p.month + "-" + p.day;
    const hh = Math.min(23, Math.round(parseInt(p.hour, 10) + parseInt(p.minute, 10)/60));
    const key = iso + "T" + String(hh).padStart(2, "0") + ":00";
    const q = new URLSearchParams({
      latitude: site.lat.toFixed(4), longitude: site.lon.toFixed(4),
      hourly: "temperature_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_gusts_10m,precipitation_probability",
      start_date: iso, end_date: iso, timezone: TZ
    });
    fetch(METEO + "?" + q.toString())
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        const h = d && d.hourly, i = h && h.time ? h.time.indexOf(key) : -1;
        if(i < 0 || h.temperature_2m[i] == null){ el.hidden = true; return; }
        el.hidden = false;
        const rain = h.precipitation_probability ? h.precipitation_probability[i] : null;
        document.getElementById("dirWTemp").textContent = Math.round(h.temperature_2m[i]) + "°C";
        document.getElementById("dirWWind").innerHTML = Math.round(h.wind_speed_10m[i]) + "<small>km/h</small>";
        const wtile = document.getElementById("dirWWind").parentNode, gust = h.wind_gusts_10m && h.wind_gusts_10m[i];
        if(gust != null) wtile.title = "gusts " + Math.round(gust) + " km/h"; else wtile.removeAttribute("title");
        const tile = document.getElementById("dirWClouds"), tip = cloudsTip(h, i);
        tile.textContent = Math.round(h.cloud_cover[i]) + "%";
        if(tip) tile.parentNode.title = tip; else tile.parentNode.removeAttribute("title");
        document.getElementById("dirWRain").textContent = rain == null ? "—" : Math.round(rain) + "%";
        document.getElementById("dirWIcon").innerHTML = weatherIcon(h.cloud_cover[i], rain || 0, h.wind_speed_10m[i]);
      })
      .catch(function(){ el.hidden = true; });
  }

  let loraIscritto = false;
  function start(){
    renderStatus(); // "in attesa del segnale" subito, non vuoto finche' arriva la prima risposta
    aggiornaGiorno();
    ensureMap().then(function(){
      if(window.COMETA_LORA){
        if(!loraIscritto){ window.COMETA_LORA.onUpdate(renderLora); loraIscritto = true; }
        const el = document.getElementById("loraProfilo");
        if(el && !profilo && window.COMETA_PROFILO){ profilo = window.COMETA_PROFILO.crea(el, VIOLET); profilo.aggiorna([], testiProfilo()); }
        window.COMETA_LORA.start();
      }
      poll();
      pollTrajectory();
      loadWeather();
      if(!pollId) pollId = setInterval(poll, POLL_MS);
      if(!tickId) tickId = setInterval(tick, TICK_MS);
      if(!trajId) trajId = setInterval(pollTrajectory, TRAJ_POLL_MS);
    }).catch(function(){ lastErr = "leaflet"; renderStatus(); });
  }
  function stop(){
    if(pollId){ clearInterval(pollId); pollId = null; }
    if(tickId){ clearInterval(tickId); tickId = null; }
    if(trajId){ clearInterval(trajId); trajId = null; }
    if(window.COMETA_LORA) window.COMETA_LORA.stop();
  }

  return {
    setActive: function(on){ if(on) start(); else stop(); },
    /* i dati del volo sono cambiati (assets/traiettoria.js, voloDiretta) */
    refreshTrajectory: function(){ if(trajId) pollTrajectory(); },
    setLang: function(l){
      curLang = l; renderStatus(); renderLegenda();
      if(trajPr) disegnaTraiettoria(); else mostraTraiettoria();
      renderScheda();
      if(profilo) profilo.aggiorna(window.COMETA_LORA ? window.COMETA_LORA.punti() : [], testiProfilo());
    }
  };
})();
