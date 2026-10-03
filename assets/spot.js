/* ==========================================================
   Tracciatore GPS — pagina Diretta (bozza)

   L'app di SPOT Trace (maps.findmespot.com/s/...) ha una sua
   interfaccia — barra, filtri temporali, condivisione — pensata
   per una pagina intera: incorporata in un riquadro piccolo
   risultava tagliata, non ridimensionata male. Qui invece
   leggiamo solo i dati dal feed XML/API pubblico del dispositivo
   e disegniamo noi la posizione, su Leaflet, nello stesso stile
   scuro della pagina Traiettoria.
   ========================================================== */
window.COMETA_SPOT = (function(){
  const FEED_ID = "0khMEQthBCgxvZpuibCz2eabjNtFovxKI";
  const FEED_URL = "https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/" + FEED_ID + "/message.json";
  const LEAFLET = "assets/vendor/leaflet/";
  const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const POLL_MS = 60000;
  /* Finche' la sonda non ha ancora mandato nessun punto, la mappa si apre
     centrata sull'Uruguay invece che sull'oceano a (0,0). */
  const FALLBACK = {lat:-33.0, lon:-56.5, zoom:7};

  let map, trail, marker, mapReady, pollId, elMap, elStatus;

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
      marker = L.circleMarker([FALLBACK.lat, FALLBACK.lon], {
        radius:7, color:"#4ADE9B", weight:2, fillColor:"#4ADE9B", fillOpacity:.9, opacity:0
      }).addTo(map);
      if("ResizeObserver" in window) new ResizeObserver(function(){ map.invalidateSize(); }).observe(elMap);
      map.on("click", function(){ map.scrollWheelZoom.enable(); });
      map.on("mouseout", function(){ map.scrollWheelZoom.disable(); });
    });
    return mapReady;
  }

  function setStatus(txt){ if(elStatus) elStatus.textContent = txt; }

  function render(points){
    if(!points.length){ setStatus("in attesa del segnale…"); return; }
    const latlngs = points.map(function(p){ return [p.lat, p.lon]; });
    trail.setLatLngs(latlngs);
    const last = points[points.length - 1];
    marker.setLatLng([last.lat, last.lon]);
    marker.setStyle({opacity:1});
    map.setView([last.lat, last.lon], Math.max(map.getZoom(), 10));
    const when = new Date(last.time);
    const ok = !isNaN(when.getTime());
    setStatus(last.lat.toFixed(4) + ", " + last.lon.toFixed(4) +
      (ok ? " · aggiornato alle " + when.toLocaleTimeString("it-IT", {hour:"2-digit", minute:"2-digit"}) : ""));
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
        setStatus("mappa non disponibile (" + err.message + ")");
      });
  }

  function start(){
    ensureMap().then(function(){
      poll();
      if(!pollId) pollId = setInterval(poll, POLL_MS);
    }).catch(function(){ setStatus("mappa non disponibile"); });
  }
  function stop(){
    if(pollId){ clearInterval(pollId); pollId = null; }
  }

  return { setActive: function(on){ if(on) start(); else stop(); } };
})();
