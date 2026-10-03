/* ==========================================================
   Tracciatore GPS — pagina Diretta (bozza)

   L'app di SPOT Trace (maps.findmespot.com/s/...) ha una sua
   interfaccia — barra, filtri temporali, condivisione — pensata
   per una pagina intera: incorporata in un riquadro piccolo
   risultava tagliata, non ridimensionata male. Qui invece
   leggiamo solo i dati dal feed XML/API pubblico del dispositivo
   e disegniamo noi la posizione, su Leaflet, nello stesso stile
   scuro della pagina Traiettoria.

   La quota ha due numeri distinti, apposta:
   - "GPS" e' l'ultimo punto vero ricevuto, fermo fra un
     aggiornamento e l'altro (SPOT manda un punto ogni ~2,5 minuti).
   - "stimata" e' una curva continua, calcolata dalla fisica del volo
     (salita costante, poi discesa che rallenta scendendo, perche'
     l'aria si fa piu' densa — stessa formula di assets/traiettoria.js),
     corretta via via con uno scarto che insegue senza salti la
     differenza con l'ultimo punto vero. Non sa quando scoppia
     davvero: in giro per quel momento puo' benissimo mostrarsi gia'
     in discesa mentre il GPS manda ancora un punto di salita — il
     punto vero arriva con qualche minuto di ritardo per natura sua,
     e quando arriva la riallinea con dolcezza, non di scatto.
   ========================================================== */
window.COMETA_SPOT = (function(){
  const FEED_ID = "0khMEQthBCgxvZpuibCz2eabjNtFovxKI";
  const FEED_URL = "https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/" + FEED_ID + "/message.json";
  const LEAFLET = "assets/vendor/leaflet/";
  const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const POLL_MS = 30000;      // il feed si aggiorna ogni ~2,5 min: basta chiedere piu' spesso per non perdere tempo ad accorgersene
  const TICK_MS = 1000;
  const REALIGN_TAU_S = 150;  // costante di tempo del riallineamento: circa un intervallo SPOT
  /* Finche' la sonda non ha ancora mandato nessun punto, la mappa si apre
     centrata sull'Uruguay invece che sull'oceano a (0,0). */
  const FALLBACK = {lat:-33.0, lon:-56.5, zoom:7};

  let map, trail, marker, mapReady, pollId, tickId,
      elMap, elStatus, elAltEst, elAltGps,
      lastPoints, lastErr, curLang = "it",
      correctionKm = 0, correctionTargetKm = 0, lastTickMs = null;

  /* I tre numeri del volo stanno in assets/app.js — window.COMETA_FLIGHT
     — cosi' c'e' un solo posto dove aggiornarli il giorno del lancio.
     descentV0Ms e' la velocita' del paracadute AL SUOLO: piu' in alto
     scende molto piu' veloce (vedi densityISA sotto). */
  function flightCfg(){
    return window.COMETA_FLIGHT || {burstKm:37.9, ascentMs:5, descentV0Ms:4.6};
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

  /* Quota (km) attesa in volo, solo dalla fisica, a s secondi dal
     lancio — salita lineare fino allo scoppio, poi discesa integrata
     passo-passo: la velocita' del paracadute scala con 1/sqrt(densita'),
     quindi e' alta appena scoppiato (aria rada) e rallenta scendendo
     (aria piu' densa). */
  function altPhysicsKm(s, flight){
    if(s <= 0) return 0;
    const ascentSec = flight.burstKm * 1000 / flight.ascentMs;
    if(s <= ascentSec) return s * flight.ascentMs / 1000;
    let z = flight.burstKm * 1000, t = ascentSec;
    const dt = 2;
    while(t < s && z > 0){
      const v = flight.descentV0Ms * Math.sqrt(RHO0 / densityISA(Math.max(z, 0)));
      z -= v * dt;
      t += dt;
    }
    return Math.max(z, 0) / 1000;
  }

  function secSinceLaunch(ms){
    const L = window.COMETA_LAUNCH;
    return L ? (ms - L.getTime()) / 1000 : -1e9;
  }

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
      L.tileLayer(TILES, {
        maxZoom:18,
        attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      }).addTo(map);
      L.control.scale({imperial:false}).addTo(map);
      map.setView([FALLBACK.lat, FALLBACK.lon], FALLBACK.zoom);
      trail = L.polyline([], {color:"#4ADE9B", weight:2, opacity:.75}).addTo(map);
      /* Nascosto del tutto finche' non arriva un punto vero: opacity e
         fillOpacity vanno azzerati entrambi, o il pallino pieno resta
         visibile sul punto di fallback (e' il "punto a Mercedes" che si
         vedeva anche senza nessun dato). */
      marker = L.circleMarker([FALLBACK.lat, FALLBACK.lon], {
        radius:7, color:"#4ADE9B", weight:2, fillColor:"#4ADE9B", fillOpacity:0, opacity:0
      }).addTo(map);
      if("ResizeObserver" in window) new ResizeObserver(function(){ map.invalidateSize(); }).observe(elMap);
      map.on("click", function(){ map.scrollWheelZoom.enable(); });
      map.on("mouseout", function(){ map.scrollWheelZoom.disable(); });
    });
    return mapReady;
  }

  function dict(){ return (window.I18N && (window.I18N[curLang] || window.I18N.it)) || {}; }

  function renderStatus(){
    if(!elStatus) return;
    const d = dict();
    if(lastErr){ elStatus.textContent = (d.dirSpotUnavailable || "map unavailable") + " (" + lastErr + ")"; return; }
    if(!lastPoints || !lastPoints.length){ elStatus.textContent = d.dirSpotWaiting || "waiting…"; return; }
    const last = lastPoints[lastPoints.length - 1];
    const when = new Date(last.time);
    const ok = !isNaN(when.getTime());
    elStatus.textContent = last.lat.toFixed(4) + ", " + last.lon.toFixed(4) +
      (ok ? " · " + (d.dirSpotUpdated || "updated at") + " " + when.toLocaleTimeString(d.code || "it", {hour:"2-digit", minute:"2-digit"}) : "");
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

  /* Ogni punto vero sposta il bersaglio del riallineamento: quanto la
     fisica pura sbaglia, in quel momento. tick() lo insegue con
     un'esponenziale, non un salto — vedi REALIGN_TAU_S. */
  function updateRealignTarget(points){
    if(!points.length) return;
    const last = points[points.length - 1];
    if(last.alt == null) return;
    const flight = flightCfg();
    const s = secSinceLaunch(new Date(last.time).getTime());
    correctionTargetKm = last.alt / 1000 - altPhysicsKm(s, flight);
  }

  function tick(){
    const flight = flightCfg();
    const now = Date.now();
    const dtS = lastTickMs == null ? 1 : Math.max((now - lastTickMs) / 1000, 0);
    lastTickMs = now;
    const alpha = 1 - Math.exp(-dtS / REALIGN_TAU_S);
    correctionKm += (correctionTargetKm - correctionKm) * alpha;
    const estKm = altPhysicsKm(secSinceLaunch(now), flight) + correctionKm;
    /* Una quota "stimata" negativa non ha senso per chi guarda, anche se
       il dato grezzo del GPS (sotto, onesto) puo' esserlo per via del
       rumore a terra: qui mostriamo 0 invece di un numero sottoterra. */
    setAltText(elAltEst, Math.max(estKm, 0));
  }

  let lastRealTime = null;

  function flashGps(){
    const el = document.getElementById("altGpsRow");
    if(!el) return;
    el.classList.remove("flash");
    void el.offsetWidth; // forza il reflow, cosi' l'animazione riparte anche se era appena finita
    el.classList.add("flash");
  }

  function render(points){
    lastPoints = points; lastErr = null;
    if(points.length){
      const latlngs = points.map(function(p){ return [p.lat, p.lon]; });
      trail.setLatLngs(latlngs);
      const last = points[points.length - 1];
      marker.setLatLng([last.lat, last.lon]);
      marker.setStyle({opacity:1, fillOpacity:.9});
      map.setView([last.lat, last.lon], Math.max(map.getZoom(), 10));
      setAltText(elAltGps, last.alt != null ? last.alt / 1000 : null);
      if(lastRealTime != null && String(last.time) !== String(lastRealTime)) flashGps();
      lastRealTime = last.time;
      updateRealignTarget(points);
    }
    renderStatus();
  }

  /* L'API di SPOT restituisce "message" come oggetto singolo (non dentro
     un array) quando c'e' un solo punto: va normalizzato, o il .map()
     sotto fallisce silenziosamente su un oggetto che non e' una lista. */
  function parse(data){
    const r = data && data.response;
    if(!r) throw new Error("risposta vuota");
    if(r.errors){
      const e = r.errors.error || {};
      if(e.code === "E-0195") return []; // nessun messaggio ancora: non e' un guasto
      throw new Error(e.description || e.text || "errore sconosciuto");
    }
    const fr = r.feedMessageResponse;
    if(!fr || !fr.messages) return [];
    let msgs = fr.messages.message || [];
    if(!Array.isArray(msgs)) msgs = [msgs];
    return msgs
      .filter(function(m){ return m.latitude != null && m.longitude != null; })
      .map(function(m){
        return {
          lat: +m.latitude,
          lon: +m.longitude,
          /* Metri, quota ellissoidica GPS: vicino al suolo puo' essere
             negativa di suo (rumore tipico del GPS li', non un errore). */
          alt: m.altitude != null ? +m.altitude : null,
          time: m.unixTime ? m.unixTime * 1000 : m.dateTime
        };
      })
      .sort(function(a, b){ return new Date(a.time) - new Date(b.time); });
  }

  function poll(){
    fetch(FEED_URL, {cache:"no-store"})
      .then(function(res){ return res.json(); })
      .then(function(data){ render(parse(data)); })
      .catch(function(err){
        /* Capita anche se l'API non permette richieste dal browser (CORS):
           in quel caso ogni richiesta fallisce cosi', senza dettagli. */
        lastErr = err.message; renderStatus();
      });
  }

  function start(){
    renderStatus(); // "in attesa del segnale" subito, non vuoto finche' arriva la prima risposta
    ensureMap().then(function(){
      poll();
      if(!pollId) pollId = setInterval(poll, POLL_MS);
      if(!tickId) tickId = setInterval(tick, TICK_MS);
    }).catch(function(){ lastErr = "leaflet"; renderStatus(); });
  }
  function stop(){
    if(pollId){ clearInterval(pollId); pollId = null; }
    if(tickId){ clearInterval(tickId); tickId = null; }
    lastTickMs = null;
  }

  return {
    setActive: function(on){ if(on) start(); else stop(); },
    setLang: function(l){ curLang = l; renderStatus(); }
  };
})();
