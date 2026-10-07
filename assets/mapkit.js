/* ============================================================
   COMETA — estensioni condivise per le mappe Leaflet del sito
   (vista satellite, schermo intero, radar pioggia RainViewer).
   Usato da assets/traiettoria.js (predittore) e assets/spot.js
   (Diretta) — nessuna delle due pagine lo carica da sola: va
   aggiunto dopo leaflet.js, prima di creare i livelli.

   Il satellite e il radar vanno in pannelli Leaflet a parte,
   apposta: il resto del sito applica un filtro CSS (invert) alle
   mattonelle stradali per renderle scure (.leaflet-tile-pane) — un
   filtro non si puo' "togliere" di nuovo su un figlio con altro
   CSS, quindi le immagini satellitari e il radar, che vanno
   mostrati con i colori veri, stanno in pannelli propri che quella
   regola non tocca (vedi assets/cometa.css, sezione "mapkit").
   ============================================================ */
window.COMETA_MAPKIT = (function(){
  "use strict";

  const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const ESRI_ATTR = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, GIS User Community';
  const RAIN_INDEX = "https://api.rainviewer.com/public/weather-maps.json";

  function dict(){ return (window.I18N && (window.I18N[document.documentElement.lang] || window.I18N.it)) || {}; }

  /* Interruttore Via/Satellite: entrambi livelli di base (uno solo
     visibile alla volta), quindi lo z-index fra i due non conta —
     conta solo che il satellite stia FUORI dal pane filtrato. */
  function addBaseLayers(map, L, streetLayer){
    map.createPane("mkSat");
    map.getPane("mkSat").style.zIndex = 200;
    const satLayer = L.tileLayer(ESRI_SAT, {
      maxZoom: 18, pane: "mkSat", attribution: ESRI_ATTR
    });
    const d = dict();
    const base = {};
    base[d.mkLayerStreet || "Via"] = streetLayer;
    base[d.mkLayerSat || "Satellite"] = satLayer;
    L.control.layers(base, null, {position: "topright", collapsed: true}).addTo(map);
    return satLayer;
  }

  /* Schermo intero: la vera Fullscreen API del browser sul
     contenitore della mappa (Leaflet non la offre di suo, e qui non
     si usa nessun plugin esterno). invalidateSize() al cambio, o
     Leaflet lascia le mattonelle alla misura di prima. */
  function addFullscreenControl(map, L, container){
    if(!container.requestFullscreen && !document.exitFullscreen) return; // Safari < 16.4 ecc: nessun pulsante, niente di rotto
    const Fs = L.Control.extend({
      options: {position: "topleft"},
      onAdd: function(){
        const div = L.DomUtil.create("div", "leaflet-bar mk-fullscreen");
        const a = L.DomUtil.create("a", "", div);
        a.href = "#"; a.innerHTML = "⛶";
        a.title = dict().mkFullscreen || "Schermo intero";
        L.DomEvent.on(a, "click", L.DomEvent.stop).on(a, "click", function(){
          if(document.fullscreenElement) document.exitFullscreen();
          else if(container.requestFullscreen) container.requestFullscreen();
        });
        return div;
      }
    });
    new Fs().addTo(map);
    document.addEventListener("fullscreenchange", function(){
      const full = document.fullscreenElement === container;
      container.classList.toggle("mk-is-fullscreen", full);
      setTimeout(function(){ map.invalidateSize(); }, 60);
    });
  }

  /* Radar pioggia RainViewer, nessuna chiave richiesta: un indice
     JSON elenca i fotogrammi recenti, si usa sempre l'ultimo
     osservato ("past", non le previsioni). Pannello a parte (vedi
     sopra) e sopra le mattonelle di base (z-index piu' alto), sotto
     a marker/tracce. Interruttore separato dal cambio Via/Satellite:
     si sovrappone a entrambi. */
  function addRainLayer(map, L){
    map.createPane("mkRain");
    map.getPane("mkRain").style.zIndex = 350;
    map.getPane("mkRain").style.pointerEvents = "none";
    let layer = null, wrap = null, on = false, loading = false;
    function ensureLayer(){
      if(layer || loading) return;
      loading = true;
      fetch(RAIN_INDEX).then(function(r){ return r.json(); }).then(function(d){
        loading = false;
        const frames = d && d.radar && d.radar.past;
        const last = frames && frames[frames.length - 1];
        if(!last) return;
        layer = L.tileLayer(d.host + last.path + "/256/{z}/{x}/{y}/2/1_1.png", {
          pane: "mkRain", opacity: .55, maxZoom: 18,
          attribution: 'Radar: <a href="https://www.rainviewer.com" target="_blank" rel="noopener">RainViewer</a>'
        });
        if(on) layer.addTo(map);
      }).catch(function(){ loading = false; });
    }
    function toggle(){
      on = !on;
      if(wrap) wrap.classList.toggle("mk-active", on);
      if(!on){ if(layer) map.removeLayer(layer); return; }
      if(layer) layer.addTo(map); else ensureLayer();
    }
    const Rain = L.Control.extend({
      options: {position: "topright"},
      onAdd: function(){
        wrap = L.DomUtil.create("div", "leaflet-bar mk-rain");
        const btn = L.DomUtil.create("a", "", wrap);
        btn.href = "#"; btn.innerHTML = "🌧";
        btn.title = dict().mkRain || "Radar pioggia (RainViewer)";
        L.DomEvent.on(btn, "click", L.DomEvent.stop).on(btn, "click", toggle);
        return wrap;
      }
    });
    new Rain().addTo(map);
  }

  /* Tutto insieme, nell'ordine giusto per i controlli (satellite in
     alto a destra, poi radar sotto, schermo intero in alto a
     sinistra accanto allo zoom). */
  function enhance(map, L, container, streetLayer){
    addBaseLayers(map, L, streetLayer);
    addRainLayer(map, L);
    addFullscreenControl(map, L, container);
  }

  return {addBaseLayers: addBaseLayers, addFullscreenControl: addFullscreenControl, addRainLayer: addRainLayer, enhance: enhance};
})();
