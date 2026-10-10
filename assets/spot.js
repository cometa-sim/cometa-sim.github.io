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
  const TRAJ_URL = "https://api.v2.sondehub.org/tawhiri";   // lo stesso previsore di assets/traiettoria.js
  const TRAJ_POLL_MS = 20 * 60000;  // il modello GFS si aggiorna ogni poche ore: ogni 20 min basta per non perdere un aggiornamento
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
  const GREEN = "#4ADE9B", ORANGE = "#FFB84D", GREY = "#8FA6BC";   // punto reale, lampeggio, traiettoria prevista
  /* Finche' la sonda non ha ancora mandato nessun punto, la mappa si apre
     centrata sull'Uruguay invece che sull'oceano a (0,0). */
  const FALLBACK = {lat:-33.0, lon:-56.5, zoom:7};

  let map, trail, ptsLayer, marker, markerHit, trajLine, trajRun, mapReady, pollId, tickId, trajId,
      elMap, elStatus, elAltEst, elAltGps, elRecenter,
      lastPoints, lastErr, curLang = "it", lastEstKm = null,
      /* L'ancora: "al tempo reale anchorT (ms) il modello e' al proprio
         tempo interno anchorTau (s dal lancio)". Si riancora a ogni
         punto GPS vero; fra un punto e l'altro avanza 1:1 col tempo
         reale (vedi tauOra). jumpOffsetKm/jumpAtMs sono il salto che un
         riancoraggio produce, da riassorbire con un decadimento breve. */
      anchorT = null, anchorTau = 0, jumpOffsetKm = 0, jumpAtMs = null;

  /* I numeri del volo stanno in assets/app.js — window.COMETA_FLIGHT —
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
      s.src = "assets/mapkit.js?v=160";  // niente cache-bust qui finora: una correzione poteva restare invisibile a chi l'aveva gia' caricato
      s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
    return Promise.all([leaflet, mapkit]);
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
      window.COMETA_MAPKIT && window.COMETA_MAPKIT.enhance(map, L, elMap, street);
      map.setView([FALLBACK.lat, FALLBACK.lon], FALLBACK.zoom);
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
    });
    return mapReady;
  }

  function dict(){ return (window.I18N && (window.I18N[curLang] || window.I18N.it)) || {}; }

  /* "12s", "2min 05s": niente ore, un volo e' questione di minuti non di ore. */
  function formatAgo(ms){
    const s = Math.max(0, Math.round(ms / 1000));
    if(s < 60) return s + "s";
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
    if(lastErr){ elStatus.textContent = (d.dirSpotUnavailable || "map unavailable") + " (" + lastErr + ")"; return; }
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
      map.setView([last.lat, last.lon], Math.max(map.getZoom(), 10));
      /* Il Data Push porta la posizione pochi secondi dopo il messaggio ma
         senza quota; la quota dello stesso messaggio arriva poco dopo, con
         la lettura del feed (vedi worker/README.md). Nel frattempo la quota
         GPS resta l'ultima misurata invece di passare a "—": il puntino si
         sposta e lampeggia subito, la tessera della quota quando arriva
         una quota nuova. */
      let altPt = null;
      for(let i = points.length - 1; i >= 0; i--){ if(points[i].alt != null){ altPt = points[i]; break; } }
      setAltText(elAltGps, altPt ? altPt.alt / 1000 : null);
      if(lastRealTime != null && String(last.time) !== String(lastRealTime)) flashMapMarker();
      const altKey = altPt ? altPt.time + "|" + altPt.alt : null;
      if(lastAltKey != null && altKey !== lastAltKey) flashGps();
      lastRealTime = last.time;
      lastAltKey = altKey;
      if(altPt) onNewRealPoint(altPt);
    }
    renderStatus();
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

  /* La traiettoria grigia: lo stesso previsore (Tawhiri/SondeHub) e i
     parametri di default della pagina Traiettoria (aerodromo di Mercedes,
     quota di scoppio e velocita' del volo vero), girato silenziosamente
     in background, senza toccare la vista della mappa (quella segue solo
     i punti GPS veri). Se la data di lancio e' fuori dall'orizzonte del
     previsore (troppo lontana, o il modello non e' ancora pronto) la
     richiesta fallisce e non si fa nulla: si riprova al giro dopo. */
  function pollTrajectory(){
    const flight = flightCfg(), L0 = window.COMETA_LAUNCH;
    if(!flight.site || !L0) return;
    const q = new URLSearchParams({
      profile: "standard_profile",
      launch_latitude: flight.site.lat.toFixed(5),
      launch_longitude: (((flight.site.lon % 360) + 360) % 360).toFixed(5),
      launch_datetime: L0.toISOString().replace(/\.\d+Z$/, "Z"),
      ascent_rate: flight.ascentMs.toFixed(2),
      burst_altitude: Math.round(flight.burstKm * 1000),
      descent_rate: flight.descentV0Ms.toFixed(2)
    });
    fetch(TRAJ_URL + "?" + q.toString())
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(!d || d.error || !d.prediction) return;      // silenzioso: fuori orizzonte, o previsore non pronto
        const run = d.request && d.request.dataset;
        if(run && run === trajRun) return;               // stessa corsa GFS di prima: niente da ridisegnare
        const pts = [];
        d.prediction.forEach(function(stage){
          stage.trajectory.forEach(function(p){ pts.push([p.latitude, p.longitude >= 180 ? p.longitude - 360 : p.longitude]); });
        });
        if(pts.length < 2) return;
        trajRun = run;
        ensureMap().then(function(){
          const L = window.L;
          if(!trajLine) trajLine = L.polyline(pts, {color:GREY, weight:2, opacity:.85, dashArray:"5 8", interactive:false}).addTo(map);
          else trajLine.setLatLngs(pts);
          trajLine.bringToBack();
        });
      })
      .catch(function(){ /* silenzioso: offline, CORS, o fuori dall'orizzonte del previsore */ });
  }

  /* Le cinque icone del meteo (sole, sole e nuvola, nuvola e goccia, nuvola
     e tre gocce, vento): soglie semplici su nuvolosita', probabilita' di
     pioggia e vento a terra, non un vero simbolo meteorologico. SVG
     inline, stesso motivo delle icone di mapkit.js (un'emoji dipende dal
     font del sistema). Il vento vince su sole/nuvola (ma non su pioggia)
     perche' e' il primo motivo per cui si rimanda un lancio quando non
     piove: 24 km/h e' la soglia citata piu' spesso nelle guide amatoriali
     ai palloni stratosferici, non un limite calcolato da noi. */
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
    if(windKmh >= W_WIND_STRONG_KMH) return W_ICON_WIND;
    if(cloudPct >= 85) return W_ICON_CLOUD;
    if(cloudPct >= 50) return W_ICON_PARTLY;
    return W_ICON_SUN;
  }

  /* Meteo previsto sul punto di lancio al giorno e all'ora del lancio
     (window.COMETA_LAUNCH, assets/app.js) — previsione oraria di
     Open-Meteo, come il riquadro del predittore (assets/traiettoria.js).
     Il punto e' sempre quello fisso del lancio (window.COMETA_FLIGHT.site),
     non scelto da chi guarda. La previsione arriva a 16 giorni: prima di
     allora quell'ora non c'e' e il riquadro resta nascosto. */
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
      hourly: "temperature_2m,cloud_cover,wind_speed_10m,precipitation_probability",
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
        document.getElementById("dirWClouds").textContent = Math.round(h.cloud_cover[i]) + "%";
        document.getElementById("dirWRain").textContent = rain == null ? "—" : Math.round(rain) + "%";
        document.getElementById("dirWIcon").innerHTML = weatherIcon(h.cloud_cover[i], rain || 0, h.wind_speed_10m[i]);
      })
      .catch(function(){ el.hidden = true; });
  }

  function start(){
    renderStatus(); // "in attesa del segnale" subito, non vuoto finche' arriva la prima risposta
    ensureMap().then(function(){
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
  }

  return {
    setActive: function(on){ if(on) start(); else stop(); },
    setLang: function(l){ curLang = l; renderStatus(); }
  };
})();
