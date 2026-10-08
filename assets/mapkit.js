/* ============================================================
   COMETA — estensioni condivise per le mappe Leaflet del sito
   (vista satellite, schermo intero, foto satellitare delle nuvole).
   Usato da assets/traiettoria.js (predittore) e assets/spot.js
   (Diretta) — nessuna delle due pagine lo carica da sola: va
   aggiunto dopo leaflet.js, prima di creare i livelli.

   Il satellite e le nuvole vanno in pannelli Leaflet a parte,
   apposta: il resto del sito applica un filtro CSS (invert) alle
   mattonelle stradali per renderle scure (.leaflet-tile-pane) — un
   filtro non si puo' "togliere" di nuovo su un figlio con altro
   CSS, quindi le immagini satellitari e le nuvole, che vanno
   mostrate con i colori veri, stanno in pannelli propri che quella
   regola non tocca (vedi assets/cometa.css, sezione "mapkit").

   Le icone dei pulsanti sono SVG inline, non emoji: un'emoji (es.
   "⛶" o "🌧") dipende dal set di font/emoji installato sul
   sistema, e su alcune combinazioni desktop puo' non avere un
   glifo disponibile — il browser allora prova un font di riserva
   che puo' rendere un carattere completamente diverso (visto in
   produzione: un carattere enorme, ruotato, al posto dell'icona).
   Un SVG con stroke="currentColor" si vede identico ovunque. */
window.COMETA_MAPKIT = (function(){
  "use strict";

  const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const ESRI_ATTR = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, GIS User Community';
  /* Nuvole/pioggia: due fonti a seconda di dove si lancia, scelte dal
     centro mappa al momento del clic (vedi isEurope sotto).

     Qui c'erano prima CPTEC/INPE (Americhe) e MODIS/NASA GIBS (resto
     del mondo), tolti entrambi: le loro mattonelle sono vere foto
     satellitari, ma CPTEC si e' rivelato un problema serio, non
     cosmetico. Il loro {z}/{x}/{y} non e' affatto Mercatore come le
     mattonelle stradali sotto (OSM/Esri): leggendo il codice sorgente
     del loro visualizzatore pubblico (dsat.cptec.inpe.br/dsat/) si
     vede che usano L.RasterCoords — un plugin per trattare
     un'immagine come una semplice griglia di pixel SENZA alcun
     riferimento geografico — piu' una proiezione geostazionaria fatta
     in casa (seni/coseni, correzioni dell'ellissoide) per convertire
     lat/lon in pixel del disco satellitare grezzo. Il loro {z}/{x}/{y}
     indicizza quei pixel grezzi, non gradi Mercatore: ogni mattonella
     finiva sistematicamente spostata rispetto alla mappa sotto, non
     per un offset semplice ma per un'intera proiezione diversa —
     servirebbe rifare da zero la loro proiezione in JS per
     riallinearle, lavoro sproporzionato per un livello decorativo.
     MODIS invece era davvero in Mercatore (GoogleMapsCompatible_Level9
     e' un TileMatrixSet Mercatore per definizione), ma restava una
     foto di un giorno prima (orbita polare, un solo passaggio al
     giorno) e nera di notte.

     Ora, ovunque tranne l'Europa: OpenWeatherMap, mattonelle vere in
     Mercatore (stesso schema di OSM/Esri, nessun problema di
     proiezione), copertura mondiale, aggiornamento non documentato ma
     legato ai loro modelli meteo (non una volta al giorno come MODIS).
     La chiave vera non sta qui: OpenWeatherMap non supporta
     restrizioni per dominio/referrer sulle chiavi (verificato), quindi
     una chiave nel JS pubblico potrebbe essere letta e riusata da
     chiunque. Le mattonelle passano invece dal Worker Cloudflare gia'
     in produzione per lo SPOT tracker (vedi worker/src/cloud-proxy.ts
     e worker/README.md, sezione "Proxy mattonelle nuvole"): la chiave
     resta li' come secret, il Worker controlla lui stesso il Referer
     e mette le mattonelle in cache. */
  const OWM_TILES = "https://cometa-sim-github-io.de-toni-carlo.workers.dev/clouds/{z}/{x}/{y}.png";
  const OWM_NATIVE_ZOOM = 10;   // non documentato un limite preciso da OpenWeatherMap: valore prudente, da aggiustare a vista se le mattonelle sfocano prima o reggono oltre

  const RAIN_INDEX = "https://api.rainviewer.com/public/weather-maps.json";
  const RAIN_NATIVE_ZOOM = 7;   // RainViewer non serve mattonelle oltre questo livello (altrimenti risponde "zoom level not supported"): maxNativeZoom fa ingrandire Leaflet da qui in su invece di richiederle davvero
  /* Riquadro approssimato dell'Europa continentale, UK e Scandinavia
     comprese: non tarato al pixel, solo per smistare fra radar
     europeo e foto satellitare globale. */
  function isEurope(lat, lon){
    return lat >= 34 && lat <= 72 && lon >= -11 && lon <= 32;
  }

  const ICON_LAYERS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>';
  const ICON_MAXIMIZE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/></svg>';
  const ICON_MINIMIZE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';
  const ICON_CLOUD = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H8a4 4 0 1 1 1.3-7.8 5 5 0 0 1 9.6 2A3.5 3.5 0 0 1 17.5 19Z"/></svg>';
  const ICON_RAIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 15.6A4.5 4.5 0 0 0 17.5 7h-1.8a7 7 0 1 0-11.5 7"/><path d="M8 19v2"/><path d="M12 19v2"/><path d="M16 19v2"/></svg>';
  const ICON_SAVE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>';

  function dict(){ return (window.I18N && (window.I18N[document.documentElement.lang] || window.I18N.it)) || {}; }

  /* Interruttore Via/Satellite: un solo pulsante (non il controllo
     Leaflet nativo coi due nomi in un menu a tendina, poco leggibile
     sia da telefono che da computer) — un clic cambia vista subito.
     Entrambi restano livelli di base (uno solo visibile alla volta),
     quindi lo z-index fra i due non conta — conta solo che il
     satellite stia FUORI dal pane filtrato. */
  function addBaseToggle(map, L, streetLayer){
    map.createPane("mkSat");
    map.getPane("mkSat").style.zIndex = 200;
    const satLayer = L.tileLayer(ESRI_SAT, {
      maxZoom: 18, pane: "mkSat", attribution: ESRI_ATTR
    });
    let onSat = false, a;
    function updateTitle(){
      const d = dict();
      a.title = onSat ? (d.mkLayerStreet || "Via") : (d.mkLayerSat || "Satellite");
    }
    const Toggle = L.Control.extend({
      options: {position: "topright"},
      onAdd: function(){
        const div = L.DomUtil.create("div", "leaflet-bar mk-layer");
        a = L.DomUtil.create("a", "", div);
        a.href = "#"; a.innerHTML = ICON_LAYERS;
        updateTitle();
        L.DomEvent.on(a, "click", L.DomEvent.stop).on(a, "click", function(){
          onSat = !onSat;
          if(onSat){ map.removeLayer(streetLayer); satLayer.addTo(map); }
          else { map.removeLayer(satLayer); streetLayer.addTo(map); }
          updateTitle();
        });
        return div;
      }
    });
    new Toggle().addTo(map);
    return {satLayer: satLayer, isSatellite: function(){ return onSat; }};
  }

  /* Schermo intero: la vera Fullscreen API del browser sul
     contenitore della mappa (Leaflet non la offre di suo, e qui non
     si usa nessun plugin esterno). invalidateSize() al cambio, o
     Leaflet lascia le mattonelle alla misura di prima. */
  function addFullscreenControl(map, L, container){
    if(!container.requestFullscreen && !document.exitFullscreen) return; // Safari < 16.4 ecc: nessun pulsante, niente di rotto
    let a;
    const Fs = L.Control.extend({
      options: {position: "topleft"},
      onAdd: function(){
        const div = L.DomUtil.create("div", "leaflet-bar mk-fullscreen");
        a = L.DomUtil.create("a", "", div);
        a.href = "#"; a.innerHTML = ICON_MAXIMIZE;
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
      if(a) a.innerHTML = full ? ICON_MINIMIZE : ICON_MAXIMIZE;
      setTimeout(function(){ map.invalidateSize(); }, 60);
    });
  }

  /* Nuvole/pioggia (vedi OWM_TILES/RAIN_INDEX sopra): pannello a
     parte, sopra le mattonelle di base (z-index piu' alto), sotto a
     marker/tracce. Interruttore separato dal cambio Via/Satellite: si
     sovrappone a entrambi. Il livello si crea una sola volta, al primo
     clic, in base al centro della mappa in quel momento (vedi
     isEurope sopra) — per l'Europa serve interrogare l'indice
     RainViewer, quindi quel primo clic e' asincrono; un secondo clic
     rapido prima che risponda spegne solo l'interruttore, il livello
     (quando arriva) resta pronto per il prossimo. L'icona cambia da
     nuvola a pioggia quando la fonte e' RainViewer (mostra solo
     precipitazione, non nuvole in generale): altrimenti, con cielo
     coperto ma senza pioggia, un livello vuoto sembrerebbe un errore
     invece che "non piove". Nomi interni (pane "mkRain", classe
     .mk-rain) rimasti da quando qui c'era solo un livello di pioggia:
     cambiarli vorrebbe dire toccare anche il CSS in piu' file, per un
     dettaglio che chi usa il sito non vede mai. */
  function addRainLayer(map, L){
    map.createPane("mkRain");
    map.getPane("mkRain").style.zIndex = 350;
    map.getPane("mkRain").style.pointerEvents = "none";
    let layer = null, wrap = null, btn = null, on = false, loading = false;
    function owmLayer(){
      return L.tileLayer(OWM_TILES, {
        pane: "mkRain", opacity: .75, maxZoom: 18, maxNativeZoom: OWM_NATIVE_ZOOM,
        attribution: 'Nuvole: <a href="https://openweathermap.org/" target="_blank" rel="noopener">OpenWeatherMap</a>'
      });
    }
    function rainViewerLayer(host, path){
      return L.tileLayer(host + path + "/256/{z}/{x}/{y}/2/1_1.png", {
        pane: "mkRain", opacity: .55, maxZoom: 18, maxNativeZoom: RAIN_NATIVE_ZOOM,
        attribution: 'Pioggia: <a href="https://www.rainviewer.com" target="_blank" rel="noopener">RainViewer</a>'
      });
    }
    function setButton(rainOnly){
      if(!btn) return;
      const d = dict();
      btn.innerHTML = rainOnly ? ICON_RAIN : ICON_CLOUD;
      btn.title = rainOnly ? (d.mkRainOnly || "Pioggia (radar)") : (d.mkRain || "Nuvole (foto satellitare)");
    }
    function ready(l, rainOnly){
      layer = l;
      loading = false;
      setButton(!!rainOnly);
      if(on) layer.addTo(map);
    }
    function toggle(){
      on = !on;
      if(wrap) wrap.classList.toggle("mk-active", on);
      if(layer){ if(on) layer.addTo(map); else map.removeLayer(layer); return; }
      if(loading) return;
      const c = map.getCenter();
      if(isEurope(c.lat, c.lng)){
        loading = true;
        fetch(RAIN_INDEX).then(function(r){ return r.json(); })
          .then(function(j){
            const frames = j && j.radar && j.radar.past;
            const last = frames && frames[frames.length - 1];
            if(last) ready(rainViewerLayer(j.host, last.path), true); else ready(owmLayer());
          })
          .catch(function(){ ready(owmLayer()); }); // indice RainViewer irraggiungibile: nuvole meglio di niente
      } else {
        ready(owmLayer());
      }
    }
    const Rain = L.Control.extend({
      options: {position: "topright"},
      onAdd: function(){
        wrap = L.DomUtil.create("div", "leaflet-bar mk-rain");
        btn = L.DomUtil.create("a", "", wrap);
        btn.href = "#"; btn.innerHTML = ICON_CLOUD;
        btn.title = dict().mkRain || "Nuvole (foto satellitare)";
        L.DomEvent.on(btn, "click", L.DomEvent.stop).on(btn, "click", toggle);
        return wrap;
      }
    });
    new Rain().addTo(map);
  }

  /* Salva l'immagine: solo dove chi chiama passa onSave (solo il
     predittore, che sa generare un PNG della sua mappa — la Diretta
     non ha questo pulsante). */
  function addSaveControl(map, L, onSave){
    const Save = L.Control.extend({
      options: {position: "topright"},
      onAdd: function(){
        const div = L.DomUtil.create("div", "leaflet-bar mk-save");
        const a = L.DomUtil.create("a", "", div);
        a.href = "#"; a.innerHTML = ICON_SAVE;
        a.title = dict().mkSave || "Scarica l'immagine della mappa";
        L.DomEvent.on(a, "click", L.DomEvent.stop).on(a, "click", onSave);
        return div;
      }
    });
    new Save().addTo(map);
  }

  /* Tutto insieme, nell'ordine giusto per i controlli (satellite in
     alto a destra, poi nuvole, poi salva; schermo intero in alto a
     sinistra accanto allo zoom). opts.onSave, se c'e', aggiunge il
     pulsante di salvataggio. Il risultato espone isSatellite(), cosi'
     chi genera un'immagine della mappa sa quali mattonelle usare. */
  function enhance(map, L, container, streetLayer, opts){
    opts = opts || {};
    const base = addBaseToggle(map, L, streetLayer);
    addRainLayer(map, L);
    addFullscreenControl(map, L, container);
    if(opts.onSave) addSaveControl(map, L, opts.onSave);
    return {isSatellite: base.isSatellite};
  }

  return {
    addBaseToggle: addBaseToggle, addFullscreenControl: addFullscreenControl, addRainLayer: addRainLayer,
    addSaveControl: addSaveControl, enhance: enhance, ESRI_SAT: ESRI_SAT, ESRI_ATTR: ESRI_ATTR
  };
})();
