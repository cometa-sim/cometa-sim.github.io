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
      maxZoom: 20, maxNativeZoom: 18, pane: "mkSat", attribution: ESRI_ATTR   // come le mappe stradali, fino a 20: oltre il 18 si ingrandisce
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
     rapido prima che risponda spegne solo l'interruttore. Dove
     RainViewer funziona, clic ripetuti scorrono pioggia -> nuvole ->
     spento; altrove nuvole -> spento. L'icona segue il livello
     mostrato (la pioggia mostra solo precipitazione: con cielo coperto
     ma senza pioggia un livello vuoto sembrerebbe un errore). Nomi interni (pane "mkRain", classe
     .mk-rain) rimasti da quando qui c'era solo un livello di pioggia:
     cambiarli vorrebbe dire toccare anche il CSS in piu' file, per un
     dettaglio che chi usa il sito non vede mai. */
  function addRainLayer(map, L){
    map.createPane("mkRain");
    map.getPane("mkRain").style.zIndex = 350;
    map.getPane("mkRain").style.pointerEvents = "none";
    /* modes: elenco dei livelli disponibili (si scopre al primo clic);
       step: 0 = spento, 1..modes.length = livello mostrato. Ogni clic
       avanza di uno e dopo l'ultimo livello spegne. In Europa i livelli
       sono pioggia (RainViewer) e nuvole (OpenWeatherMap); altrove
       solo nuvole. */
    /* urls/specs: come ridisegnare lo stesso livello fuori da Leaflet
       (l'esportazione in PNG del predittore ridisegna tutto a mano) */
    let modes = null, layers = {}, specs = {}, step = 0, wrap = null, btn = null, loading = false, cancelled = false;
    function setButton(kind){
      if(!btn) return;
      const d = dict();
      btn.innerHTML = kind === "rain" ? ICON_RAIN : ICON_CLOUD;
      btn.title = kind === "rain" ? (d.mkRainOnly || "Pioggia (radar)") : (d.mkRain || "Nuvole (foto satellitare)");
    }
    function owmLayer(){
      /* mask: la mattonella e' bianca su trasparente, e' la trasparenza a
         portare il dato (piu' nuvole = piu' opaca). Chi la ridisegna su
         uno sfondo chiaro deve ricolorarla, o sparisce. Il radar invece
         ha colori propri, che sono una scala di intensita'. */
      specs.clouds = {kind:"clouds", url:OWM_TILES, opacity:.75, maxNativeZoom:OWM_NATIVE_ZOOM, credit:"OpenWeatherMap", mask:true};
      return L.tileLayer(OWM_TILES, {
        pane: "mkRain", opacity: .75, maxZoom: 20, maxNativeZoom: OWM_NATIVE_ZOOM,
        /* come le mattonelle stradali del predittore: servono anche
           all'esportazione in PNG, che le ridisegna su un canvas. Senza
           crossOrigin il browser potrebbe riusare per il canvas una copia
           presa dalla cache senza permesso CORS, e il canvas diventerebbe
           "sporco" — l'immagine non si salverebbe piu'. */
        crossOrigin: true,
        attribution: 'Nuvole: <a href="https://openweathermap.org/" target="_blank" rel="noopener">OpenWeatherMap</a>'
      });
    }
    function rainViewerLayer(host, path){
      specs.rain = {kind:"rain", url:host + path + "/256/{z}/{x}/{y}/2/1_1.png", opacity:.55, maxNativeZoom:RAIN_NATIVE_ZOOM, credit:"RainViewer"};
      return L.tileLayer(host + path + "/256/{z}/{x}/{y}/2/1_1.png", {
        pane: "mkRain", opacity: .55, maxZoom: 20, maxNativeZoom: RAIN_NATIVE_ZOOM, crossOrigin: true,
        attribution: 'Pioggia: <a href="https://www.rainviewer.com" target="_blank" rel="noopener">RainViewer</a>'
      });
    }
    function apply(){
      Object.keys(layers).forEach(function(k){ if(map.hasLayer(layers[k])) map.removeLayer(layers[k]); });
      const kind = step ? modes[step - 1] : null;
      if(wrap) wrap.classList.toggle("mk-active", !!kind);
      if(kind){ layers[kind].addTo(map); setButton(kind); }
      else setButton(modes && modes[0]);
    }
    function toggle(){
      if(modes){ step = (step + 1) % (modes.length + 1); apply(); return; }
      if(loading){ cancelled = true; if(wrap) wrap.classList.remove("mk-active"); return; } // secondo clic prima della risposta: spegne, i livelli restano pronti
      const c = map.getCenter();
      function start(m, ls){
        modes = m; layers = ls; loading = false;
        step = cancelled ? 0 : 1;
        cancelled = false;
        apply();
      }
      if(isEurope(c.lat, c.lng)){
        loading = true; cancelled = false;
        if(wrap) wrap.classList.add("mk-active");
        fetch(RAIN_INDEX).then(function(r){ return r.json(); })
          .then(function(j){
            const frames = j && j.radar && j.radar.past;
            const last = frames && frames[frames.length - 1];
            if(last) start(["rain", "clouds"], {rain: rainViewerLayer(j.host, last.path), clouds: owmLayer()});
            else start(["clouds"], {clouds: owmLayer()});
          })
          .catch(function(){ start(["clouds"], {clouds: owmLayer()}); }); // indice RainViewer irraggiungibile: nuvole meglio di niente
      } else {
        start(["clouds"], {clouds: owmLayer()});
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
    /* Che livello c'e' sopra la mappa in questo momento, e come
       ridisegnarlo: null se e' spento. */
    return {overlay: function(){ return step ? specs[modes[step - 1]] || null : null; }};
  }

  /* ---------- Lo specchietto del meteo dentro un'immagine salvata ----------
     Le stesse celle del riquadro .mk-weather che si vede sotto la mappa,
     ridisegnate su un canvas. I valori si LEGGONO dal riquadro, non si
     ricalcolano: l'immagine salvata dice esattamente quello che diceva la
     pagina, senza una seconda chiamata al servizio meteo che potrebbe
     rispondere altro.

     Torna una promessa perche' l'icona e' un SVG, che va prima
     rasterizzato: si passa per un data: URL (niente rete, e un data: URL
     non rende il canvas "sporco", quindi toBlob continua a funzionare).
     Se l'icona non si carica si salta la sua cella e il resto si disegna
     comunque.

     o: {x, y, u, head, align, paper, ink, muted, accent, warn}. x,y e'
     l'angolo in alto a sinistra, o in alto a destra con align:"right".
     Risolve con {w, h} del riquadro disegnato, o null se non c'era
     niente da disegnare. */
  /* La freccia del vento (lo stesso disegno di freccia() in
     assets/traiettoria.js: M12 20V4 M6 10l6-6 6 6, su 24) centrata in
     x,y, lato a, ruotata di deg come nella pagina. */
  function freccia(g, x, y, deg, a, color){
    const k = a/24;
    g.save();
    g.translate(x, y); g.rotate(deg*Math.PI/180); g.scale(k, k); g.translate(-12, -12);
    g.strokeStyle = color; g.lineWidth = 2.4; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(12, 20); g.lineTo(12, 4); g.moveTo(6, 10); g.lineTo(12, 4); g.lineTo(18, 10); g.stroke();
    g.restore();
  }
  function drawWeather(g, box, o){
    if(!box || box.hidden) return Promise.resolve(null);
    const u = o.u || 1;
    const paper = o.paper || "rgba(255,255,255,.93)", ink = o.ink || "#0E1620";
    const muted = o.muted || "#4A5B6C", accent = o.accent || "#0B6FA4", warn = o.warn || "#C26A00";
    const AR = 13*u;   /* lato della freccia del vento */
    const FV = "600 " + 17*u + "px 'Space Grotesk', Inter, system-ui, sans-serif";
    const FU = 9*u + "px Inter, system-ui, sans-serif";
    const FL = 8.5*u + "px 'JetBrains Mono', ui-monospace, monospace";
    const FH = 10*u + "px Inter, system-ui, sans-serif";
    /* Celle lette dal riquadro: quella dell'icona (.mk-wicon) ha un <svg>
       e sotto, se c'e', la scritta «incerta»/«temporali» (.mk-wunc); le
       altre un valore (col pezzetto di unita' in <small>) e un'etichetta.
       Il vento ha anche un <svg>, la freccia: e' un valore, non l'icona,
       e la freccia si ridisegna col suo angolo. */
    const cells = [];
    Array.prototype.forEach.call(box.querySelectorAll(".mk-wtile"), function(tile){
      const v = tile.querySelector(".mk-wv"), l = tile.querySelector(".mk-wl");
      if(!v) return;
      const svg = v.querySelector("svg");
      if(tile.classList.contains("mk-wicon")){
        if(!svg) return;
        const n = tile.querySelector(".mk-wunc:not([hidden])");
        cells.push({svg: svg, note: n ? n.textContent.trim().toUpperCase() : ""});
        return;
      }
      const small = v.querySelector("small");
      const rot = svg && /rotate\((-?[\d.]+)deg\)/.exec(svg.style.transform || "");
      cells.push({v: (small ? v.textContent.replace(small.textContent, "") : v.textContent).trim(),
                  unit: small ? small.textContent : "", l: l ? l.textContent.trim() : "",
                  arrow: rot ? parseFloat(rot[1]) : null});
    });
    if(!cells.length) return Promise.resolve(null);
    /* misure: ogni cella larga quanto il suo contenuto, con un minimo */
    g.save();
    const widths = cells.map(function(c){
      if(c.svg){ g.font = FL; return Math.max(34*u, c.note ? g.measureText(c.note).width + c.note.length*u + 16*u : 0); }
      g.font = FV; let w = g.measureText(c.v).width + (c.arrow != null ? AR + 3*u : 0);
      if(c.unit){ g.font = FU; w += g.measureText(c.unit).width + 2*u; }
      g.font = FL; w = Math.max(w, g.measureText(c.l).width);
      return Math.max(46*u, w + 16*u);
    });
    const PAD = 11*u, HEAD = o.head ? 15*u : 0;
    let W = widths.reduce(function(a, b){ return a + b; }, 0) + 2*PAD;
    if(o.head){ g.font = FH; W = Math.max(W, g.measureText(o.head).width + 2*PAD); }
    const H = PAD + HEAD + 20*u + 13*u + PAD;
    const x0 = o.align === "right" ? o.x - W : o.x, y0 = o.y;
    /* sfondo chiaro con un filo di bordo: lo stesso trattamento della scala */
    g.fillStyle = paper; g.fillRect(x0, y0, W, H);
    g.globalAlpha = .18; g.strokeStyle = ink; g.lineWidth = 1*u;
    g.strokeRect(x0 + .5*u, y0 + .5*u, W - u, H - u); g.globalAlpha = 1;
    if(o.head){
      g.font = FH; g.fillStyle = muted; g.textAlign = "left"; g.textBaseline = "alphabetic";
      g.fillText(o.head, x0 + PAD, y0 + PAD + 10*u);
    }
    const yV = y0 + PAD + HEAD + 17*u, yL = yV + 13*u;
    let cx = x0 + PAD, icon = null;
    g.textBaseline = "alphabetic";
    cells.forEach(function(c, i){
      const w = widths[i], mid = cx + w/2;
      if(i){   /* filo di separazione fra una cella e l'altra */
        g.globalAlpha = .12; g.strokeStyle = ink; g.lineWidth = 1*u;
        g.beginPath(); g.moveTo(cx, y0 + PAD + HEAD); g.lineTo(cx, y0 + H - PAD*.6); g.stroke(); g.globalAlpha = 1;
      }
      if(c.svg){
        icon = {svg: c.svg, x: mid, y: c.note ? yV - 19*u : (yV + yL)/2 - 11*u};
        if(c.note){   /* «incerta» / «temporali», come sotto l'icona nella pagina */
          g.textAlign = "center"; g.fillStyle = warn; g.font = FL; g.letterSpacing = "1px";
          g.fillText(c.note, mid, yL); g.letterSpacing = "0px";
        }
        cx += w; return;
      }
      g.textAlign = "center"; g.fillStyle = ink; g.font = FV;
      if(c.unit || c.arrow != null){
        /* freccia, valore e unita' affiancati, come nella pagina */
        const wa = c.arrow != null ? AR + 3*u : 0, wv = g.measureText(c.v).width;
        g.font = FU; const wu = c.unit ? g.measureText(c.unit).width + 2*u : 0;
        const left = mid - (wa + wv + wu)/2;
        if(c.arrow != null) freccia(g, left + AR/2, yV - 6*u, c.arrow, AR, accent);
        g.textAlign = "left"; g.font = FV; g.fillStyle = ink; g.fillText(c.v, left + wa, yV);
        if(c.unit){ g.font = FU; g.globalAlpha = .7; g.fillText(c.unit, left + wa + wv + 2*u, yV); g.globalAlpha = 1; }
        g.textAlign = "center";
      } else g.fillText(c.v, mid, yV);
      g.fillStyle = muted; g.font = FL; g.letterSpacing = "1px";
      g.fillText(c.l.toUpperCase(), mid, yL);
      g.letterSpacing = "0px";
      cx += w;
    });
    g.restore();
    if(!icon) return Promise.resolve({w: W, h: H});
    return new Promise(function(ok){
      const im = new Image();
      im.onload = function(){ try { g.drawImage(im, icon.x - 11*u, icon.y, 22*u, 22*u); } catch(e){} ok({w: W, h: H}); };
      im.onerror = function(){ ok({w: W, h: H}); };
      /* rasterizzato gia' alla misura finale (22*u), non a 22 px e poi ingrandito */
      const px = Math.round(22*u);
      im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        icon.svg.outerHTML.replace(/currentColor/g, accent)
          .replace(/ width="[\d.]+" height="[\d.]+"/, ' width="' + px + '" height="' + px + '"')
          .replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'));
    });
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
    const rain = addRainLayer(map, L);
    addFullscreenControl(map, L, container);
    if(opts.onSave) addSaveControl(map, L, opts.onSave);
    return {isSatellite: base.isSatellite, overlay: rain.overlay};
  }

  return {
    addBaseToggle: addBaseToggle, addFullscreenControl: addFullscreenControl, addRainLayer: addRainLayer,
    addSaveControl: addSaveControl, enhance: enhance, drawWeather: drawWeather, ESRI_SAT: ESRI_SAT, ESRI_ATTR: ESRI_ATTR,
    /* per la vista 3D (assets/map3d.js): stesse fonti e stesse icone */
    OWM_TILES: OWM_TILES, OWM_NATIVE_ZOOM: OWM_NATIVE_ZOOM, RAIN_INDEX: RAIN_INDEX, RAIN_NATIVE_ZOOM: RAIN_NATIVE_ZOOM,
    isEurope: isEurope,
    ICONS: {layers: ICON_LAYERS, maximize: ICON_MAXIMIZE, minimize: ICON_MINIMIZE, cloud: ICON_CLOUD, rain: ICON_RAIN, save: ICON_SAVE}
  };
})();
