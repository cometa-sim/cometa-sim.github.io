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
  /* Nuvole: foto satellitare vera (colori reali), non una stima di
     pioggia. RainViewer (primo tentativo) si appoggia a radar da terra
     che in Sud America hanno buchi di copertura. Ora due fonti diverse
     a seconda di dove si lancia, scelte dal centro mappa al momento
     del clic (vedi isAmericas sotto):

     - Americhe: CPTEC/INPE (agenzia spaziale brasiliana), mattonelle
       dello stesso satellite GOES-16 che usano loro per il sito
       pubblico dsat.cptec.inpe.br — URL e ID prodotto trovati leggendo
       il loro codice sorgente pubblico (non documentato altrove),
       verificati scaricando davvero una mattonella. Satellite
       geostazionario: aggiornato ogni ~10 minuti (non una volta al
       giorno come sotto), e il prodotto "true_color_ch13_dsa" unisce
       visibile e infrarosso quindi si vede qualcosa anche di notte
       (verificato: di notte il prodotto "solo visibile" natural_color
       e' bianco vuoto, questo no). L'indice {CPTEC_INDEX} da' sempre
       l'orario dell'ultima mattonella pronta, cosi' non si indovina.
     - Resto del mondo: MODIS Terra via NASA GIBS, lo stesso layer "di
       bandiera" di Worldview — ma Terra e' in orbita polare (un solo
       passaggio al giorno), quindi qui si chiede sempre la mattonella
       di ieri (funzione cloudTime sotto): quella di oggi puo' restare
       nera per buona parte della giornata, prima che il passaggio
       sulla zona sia avvenuto o elaborato. Anche qui, estensione
       .jpeg non .jpg (trovato scaricando davvero le mattonelle, dopo
       aver sbloccato gibs.earthdata.nasa.gov in questa sandbox: l'URL
       copiato dall'esempio ufficiale NASA usava .jpg ed era nero). */
  const CLOUD_TILES = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg";
  const CLOUD_NATIVE_ZOOM = 9;
  function cloudTime(){ return new Date(Date.now() - 86400000).toISOString().slice(0, 10); }

  const CPTEC_TILES = "https://{s}.cptec.inpe.br/goes/goes16/web_tiles/{d}/true_color_ch13_dsa/{t}/{z}/{x}/{y}.png";
  const CPTEC_SUBDOMAINS = ["s0", "s1", "s2", "s3"];
  const CPTEC_INDEX = "https://s0.cptec.inpe.br/goes/goes16/web_tiles/json/true_color_ch13_dsa/lastest.json";
  const CPTEC_NATIVE_ZOOM = 6;
  /* Riquadro approssimato dove il satellite GOES-16 (fermo sopra
     l'equatore, circa 75°O) vede bene: oltre questi margini l'angolo
     di vista diventa troppo obliquo (immagine distorta o scura ai
     bordi del disco). Generoso per coprire tutte le Americhe con
     margine, non tarato al pixel. */
  function isAmericas(lat, lon){
    return lat >= -55 && lat <= 55 && lon >= -130 && lon <= -30;
  }

  const ICON_LAYERS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>';
  const ICON_MAXIMIZE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/></svg>';
  const ICON_MINIMIZE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';
  const ICON_CLOUD = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H8a4 4 0 1 1 1.3-7.8 5 5 0 0 1 9.6 2A3.5 3.5 0 0 1 17.5 19Z"/></svg>';
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

  /* Nuvole (vedi CLOUD_TILES/CPTEC_TILES sopra): pannello a parte,
     sopra le mattonelle di base (z-index piu' alto), sotto a
     marker/tracce. Interruttore separato dal cambio Via/Satellite: si
     sovrappone a entrambi. Il livello si crea una sola volta, al primo
     clic, in base al centro della mappa in quel momento (lancio nelle
     Americhe o no) — per le Americhe serve anche interrogare l'indice
     CPTEC per sapere l'ultima mattonella pronta, quindi quel primo
     clic e' asincrono; un secondo clic rapido prima che risponda
     spegne solo l'interruttore, il livello (quando arriva) resta
     pronto per il prossimo. Nomi interni (pane "mkRain", classe
     .mk-rain) rimasti da quando qui c'era un livello di pioggia:
     cambiarli vorrebbe dire toccare anche il CSS in piu' file, per un
     dettaglio che chi usa il sito non vede mai — l'icona e il testo
     del pulsante sono gia' giusti. */
  function addRainLayer(map, L){
    map.createPane("mkRain");
    map.getPane("mkRain").style.zIndex = 350;
    map.getPane("mkRain").style.pointerEvents = "none";
    let layer = null, wrap = null, on = false, loading = false;
    function modisLayer(){
      return L.tileLayer(CLOUD_TILES, {
        pane: "mkRain", time: cloudTime(), opacity: .9, maxZoom: 18, maxNativeZoom: CLOUD_NATIVE_ZOOM,
        attribution: 'Nuvole: <a href="https://worldview.earthdata.nasa.gov/" target="_blank" rel="noopener">NASA MODIS/Worldview</a>'
      });
    }
    function cptecLayer(frame){
      return L.tileLayer(CPTEC_TILES, {
        pane: "mkRain", subdomains: CPTEC_SUBDOMAINS, d: frame.slice(0, 8), t: frame.slice(8, 12),
        opacity: .9, maxZoom: 18, maxNativeZoom: CPTEC_NATIVE_ZOOM, noWrap: true,
        attribution: 'Nuvole: <a href="https://www.cptec.inpe.br/dsat/" target="_blank" rel="noopener">CPTEC/INPE GOES-16</a>'
      });
    }
    function ready(l){
      layer = l;
      loading = false;
      if(on) layer.addTo(map);
    }
    function toggle(){
      on = !on;
      if(wrap) wrap.classList.toggle("mk-active", on);
      if(layer){ if(on) layer.addTo(map); else map.removeLayer(layer); return; }
      if(loading) return;
      const c = map.getCenter();
      if(isAmericas(c.lat, c.lng)){
        loading = true;
        fetch(CPTEC_INDEX).then(function(r){ return r.json(); })
          .then(function(j){ ready(cptecLayer(j.date)); })
          .catch(function(){ ready(modisLayer()); }); // indice CPTEC irraggiungibile: foto di ieri meglio di niente
      } else {
        ready(modisLayer());
      }
    }
    const Rain = L.Control.extend({
      options: {position: "topright"},
      onAdd: function(){
        wrap = L.DomUtil.create("div", "leaflet-bar mk-rain");
        const btn = L.DomUtil.create("a", "", wrap);
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
