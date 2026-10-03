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
   - "stimata" conta in continuo, un secondo alla volta, estrapolando
     dall'ultimo punto vero con una velocita' ricalcolata sui punti
     recenti — non sull'ultimo intervallo da solo, che da solo e'
     troppo vicino al rumore della quota GPS per essere credibile.
   ========================================================== */
window.COMETA_SPOT = (function(){
  const FEED_ID = "0khMEQthBCgxvZpuibCz2eabjNtFovxKI";
  const FEED_URL = "https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/" + FEED_ID + "/message.json";
  const LEAFLET = "assets/vendor/leaflet/";
  const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const POLL_MS = 30000;      // il feed si aggiorna ogni ~2,5 min: basta chiedere piu' spesso per non perdere tempo ad accorgersene
  const TICK_MS = 1000;
  const WINDOW_MS = 12 * 60 * 1000;   // finestra per ricalcolare la velocita': ~5 punti veri, il rumore si media via
  const RATE_THRESH_KMS = 0.001;      // 1 m/s: sopra conta come salita/discesa vera, sotto e' rumore
  /* Finche' la sonda non ha ancora mandato nessun punto, la mappa si apre
     centrata sull'Uruguay invece che sull'oceano a (0,0). */
  const FALLBACK = {lat:-33.0, lon:-56.5, zoom:7};

  let map, trail, marker, mapReady, pollId, tickId,
      elMap, elStatus, elAltEst, elAltGps,
      lastPoints, lastErr, curLang = "it",
      phase = "ground", rateKmS = 0, anchorAltKm = null, anchorTime = null;

  /* I tre numeri del volo (quota di scoppio attesa, salita, discesa)
     stanno in assets/app.js — window.COMETA_FLIGHT — cosi' c'e' un
     solo posto dove aggiornarli il giorno del lancio. */
  function flightCfg(){
    return window.COMETA_FLIGHT || {burstKm:37.9, ascentMs:5, descentMs:5.5};
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
    el.textContent = km == null ? "—" : km.toFixed(1);
  }

  /* Velocita' ricalcolata sugli estremi della finestra recente, non
     sull'ultimo intervallo da solo: a 5 m/s la sonda sale ~750 m fra due
     punti SPOT (ogni 2,5 min), ma la quota GPS da sola rumoreggia di un
     centinaio di metri — su un solo intervallo il rumore e' lo stesso
     ordine di grandezza del segnale. Su ~5 punti si media via. */
  function observedRateKmS(points){
    if(points.length < 2) return null;
    const latest = points[points.length - 1];
    const windowPts = points.filter(function(p){ return latest.time - p.time <= WINDOW_MS && p.alt != null; });
    if(windowPts.length < 2) return null;
    const first = windowPts[0];
    const dtS = (new Date(latest.time) - new Date(first.time)) / 1000;
    if(dtS <= 0) return null;
    return (latest.alt - first.alt) / 1000 / dtS; // km/s
  }

  /* Decide la fase e la velocita' da usare per estrapolare, a partire
     dall'ultimo punto vero. I dati reali vincono sempre quando ci sono:
     la quota di scoppio prevista serve solo come ipotesi migliore nei
     minuti fra un punto e l'altro, non quando i dati dicono altro. */
  function updateRate(points){
    if(!points.length) return;
    const last = points[points.length - 1];
    if(last.alt == null) return;
    const flight = flightCfg();
    const obs = observedRateKmS(points);
    const launched = window.COMETA_LAUNCH ? Date.now() >= window.COMETA_LAUNCH.getTime() : true;

    if(phase === "ground"){
      if(obs != null && obs > RATE_THRESH_KMS){ phase = "ascent"; rateKmS = obs; }
      else if(launched){ phase = "ascent"; rateKmS = (obs != null ? obs : flight.ascentMs / 1000); }
      else { rateKmS = 0; }
    } else {
      if(obs != null && obs < -RATE_THRESH_KMS) phase = "descent";
      else if(obs != null && obs > RATE_THRESH_KMS) phase = "ascent";
      if(obs != null) rateKmS = obs;
      else rateKmS = phase === "ascent" ? flight.ascentMs / 1000 : -flight.descentMs / 1000;
    }
    anchorAltKm = last.alt / 1000;
    anchorTime = last.time;
  }

  function tick(){
    if(anchorAltKm == null){ setAltText(elAltEst, null); return; }
    const flight = flightCfg();
    const elapsedS = (Date.now() - new Date(anchorTime).getTime()) / 1000;
    let estKm = anchorAltKm + rateKmS * elapsedS;
    /* Fra due punti veri non abbiamo modo di sapere quando scoppia per
       davvero: la stima comincia a scendere quando arriva alla quota di
       scoppio prevista, alla velocita' di discesa nominale, finche' un
       punto vero non la corregge con quella osservata. */
    if(phase === "ascent" && estKm >= flight.burstKm){
      phase = "descent";
      anchorAltKm = flight.burstKm; anchorTime = Date.now(); rateKmS = -flight.descentMs / 1000;
      estKm = flight.burstKm;
    }
    if(phase === "descent") estKm = Math.max(estKm, 0);
    setAltText(elAltEst, estKm);
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
      updateRate(points);
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
  }

  return {
    setActive: function(on){ if(on) start(); else stop(); },
    setLang: function(l){ curLang = l; renderStatus(); }
  };
})();
