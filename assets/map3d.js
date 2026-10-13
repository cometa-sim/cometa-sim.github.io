/* ============================================================
   COMETA — vista 3D delle mappe (MapLibre GL JS).

   Non calcola niente: riceve da chi la usa — il predittore
   (assets/traiettoria.js) e la Diretta (assets/spot.js) — gli stessi
   dati che disegna in 2D con Leaflet, e li mostra su una mappa
   inclinabile con rilievo. Si carica solo quando si preme "3D": chi
   resta in 2D non scarica MapLibre (1 MB).

   MapLibre non ha linee con una quota: la traiettoria e' un "tubo" di
   tanti cubetti sovrapposti (fill-extrusion), ognuno con base e
   altezza in metri sul livello del mare. La fascia di piu' partenze e'
   fatta allo stesso modo: una «fetta» (prisma) per ogni istante del
   volo, dal punto piu' basso a quello piu' alto raggiunto dai voli in
   quell'istante. Le aree a terra (atterraggio, esclusione) sono
   adagiate sul rilievo.

   Base stradale e satellite sono le stesse mattonelle del 2D
   (OpenStreetMap, Esri); nuvole e pioggia le stesse di mapkit.js
   (Worker Cloudflare/OpenWeatherMap, RainViewer), stese sul terreno:
   sono immagini piane, non stanno alla quota delle nuvole vere. Il
   rilievo viene dalle mattonelle Terrarium di AWS (Mapzen), gratuite
   e senza chiave.

   Le mattonelle OSM sono scurite come in 2D (li' con un filtro CSS,
   qui coi parametri raster di MapLibre: invertire = brightness-min 1,
   brightness-max 0). I pulsanti usano le stesse icone SVG di
   mapkit.js.

   Due entrate:
   - create(o): la mappa 3D vera e propria (vedi build());
   - attach(o): il pulsante 2D/3D su una mappa Leaflet gia' esistente,
     con tutto il resto (creare il contenitore, nascondere l'uno o
     l'altra, ricordare la scelta) — cosi' predittore e Diretta non
     duplicano niente. */
window.COMETA_MAP3D = (function(){
  "use strict";

  const VENDOR = "assets/vendor/maplibre/";
  const M_LAT = 111320, RAD = Math.PI/180;
  const TILES_OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const ATTR_OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  const DEM = {
    type:"raster-dem", encoding:"terrarium", tileSize:256, maxzoom:14,
    tiles:["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    attribution:'Rilievo: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen / AWS Terrain Tiles</a>'
  };
  const SVG = function(inner){ return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; };
  const ICON_CUBE = SVG('<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>');
  const ICON_TILT_UP = SVG('<path d="m6 15 6-6 6 6"/><path d="M4 20h16"/>');       /* piu' inclinata (verso l'orizzonte) */
  const ICON_TILT_DOWN = SVG('<path d="m6 9 6 6 6-6"/><path d="M4 4h16"/>');       /* piu' dall'alto */

  let loading = null;
  function load(){
    if(window.maplibregl) return Promise.resolve();
    if(loading) return loading;
    loading = new Promise(function(ok, ko){
      const css = document.createElement("link");
      css.rel = "stylesheet"; css.href = VENDOR + "maplibre-gl.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = VENDOR + "maplibre-gl.js";
      s.onload = ok;
      s.onerror = function(){ loading = null; ko(new Error("maplibre")); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function hasWebGL(){
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch(e){ return false; }
  }

  function empty(){ return {type:"FeatureCollection", features:[]}; }
  function dict(){ return (window.I18N && (window.I18N[document.documentElement.lang] || window.I18N.it)) || {}; }
  function bearing(a, b, c, d){
    const y = Math.sin((d - b)*RAD)*Math.cos(c*RAD);
    const x = Math.cos(a*RAD)*Math.sin(c*RAD) - Math.sin(a*RAD)*Math.cos(c*RAD)*Math.cos((d - b)*RAD);
    return (Math.atan2(y, x)/RAD + 360) % 360;
  }

  /* ---------- Geometria 3D ---------- */
  function resample(pts, N){
    const out = [];
    for(let i = 0; i < N; i++){
      const f = i/(N - 1)*(pts.length - 1), k = Math.min(Math.floor(f), pts.length - 2), u = f - k, a = pts[k], b = pts[k + 1];
      out.push({lat:a.lat + (b.lat - a.lat)*u, lon:a.lon + (b.lon - a.lon)*u, alt:a.alt + (b.alt - a.alt)*u,
                up:a.up ? (b.up || u < .5) : false});
    }
    return out;
  }
  function box(lat, lon, hw, base, top, props){
    const dLa = hw/M_LAT, dLo = hw/(M_LAT*Math.cos(lat*RAD));
    props.b = base; props.h = top;      /* base e altezza in metri: li legge fill-extrusion */
    return {type:"Feature", properties:props, geometry:{type:"Polygon", coordinates:[[
      [lon - dLo, lat - dLa], [lon + dLo, lat - dLa], [lon + dLo, lat + dLa], [lon - dLo, lat + dLa], [lon - dLo, lat - dLa]]]}};
  }
  /* diagonale (m) del rettangolo che contiene tutte le liste di punti: da qui lo spessore del tubo */
  function diagonal(lists){
    let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
    lists.forEach(function(L){ L.forEach(function(p){
      la0 = Math.min(la0, p.lat); la1 = Math.max(la1, p.lat); lo0 = Math.min(lo0, p.lon); lo1 = Math.max(lo1, p.lon);
    }); });
    return Math.hypot((la1 - la0)*M_LAT, (lo1 - lo0)*M_LAT*Math.cos(la0*RAD));
  }
  function maxAlt(lists){
    let m = 0;
    lists.forEach(function(L){ L.forEach(function(p){ if(p.alt > m) m = p.alt; }); });
    return m;
  }
  function tubeFeats(pts, hw, m, cUp, cDown){
    if(!pts.length) return [];
    if(pts.length < 2){
      const p = pts[0];
      return [box(p.lat, p.lon, hw*1.6, Math.max(0, p.alt - hw*1.6), p.alt + hw*1.6, {m:m, c:cUp})];
    }
    const N = 700, S = resample(pts, N);
    const top = pts.reduce(function(a, p){ return Math.max(a, p.alt); }, 0);
    const ext = Math.max(hw, top/N*1.2);
    return S.map(function(p){
      return box(p.lat, p.lon, hw, Math.max(0, p.alt - ext), p.alt + ext, {m:m, c:p.up ? cUp : cDown});
    });
  }
  function buildTubes(sc, col){
    const runs = sc.runs || [], live = sc.live && sc.live.pts && sc.live.pts.length ? sc.live.pts : null;
    const lists = runs.map(function(r){ return r.pts; }).concat(live ? [live] : []);
    if(!lists.length) return empty();
    const diag = diagonal(lists);
    const hwMain = Math.max(110, diag/260), hwThin = Math.max(80, diag/480);
    let feats = [];
    runs.forEach(function(r){
      feats = feats.concat(tubeFeats(r.pts, sc.main ? hwMain : hwThin, sc.main ? 0 : 1, col.up, col.down));
    });
    if(live){      /* un cubetto per ogni fix GPS con la quota: nessuna linea fra un fix e l'altro */
      const c = sc.live.color || "#4ADE9B", hp = hwMain*1.3;
      live.forEach(function(p, k){
        if(p.alt == null) return;
        const s = k === live.length - 1 ? hp*1.8 : hp;
        feats.push(box(p.lat, p.lon, s, Math.max(0, p.alt - s), p.alt + s, {m:0, c:c}));
      });
    }
    return {type:"FeatureCollection", features:feats};
  }

  /* ---------- Mappa ---------- */
  function build(o){
    const ml = window.maplibregl;
    const mk = window.COMETA_MAPKIT || {};
    const ICONS = mk.ICONS || {};
    /* Dispositivo touch (telefono, tablet): solo per mostrare i pulsanti di inclinazione */
    const touch = (navigator.maxTouchPoints || 0) > 0 || !!(window.matchMedia && window.matchMedia("(any-pointer: coarse)").matches);
    const fsTarget = o.fsTarget || o.container;
    const col = {up:o.color, down:o.colorDown || "#FFB84D"};
    const PITCH = 70;           /* inclinazione della vista laterale */

    const style = {
      version:8,
      sources:{
        osm:{type:"raster", tileSize:256, maxzoom:19, tiles:[TILES_OSM], attribution:ATTR_OSM},
        sat:{type:"raster", tileSize:256, maxzoom:18, tiles:[mk.ESRI_SAT || ""], attribution:mk.ESRI_ATTR || ""},
        dem:DEM, hill:DEM,
        excl:{type:"geojson", data:o.excl ? {type:"Feature", properties:{}, geometry:{type:"Polygon", coordinates:[o.excl.concat([o.excl[0]])]}} : empty()},
        fills:{type:"geojson", data:empty()}, band:{type:"geojson", data:empty()},
        lines:{type:"geojson", data:empty()}, shadow:{type:"geojson", data:empty()}, tube:{type:"geojson", data:empty()},
        livepts:{type:"geojson", data:empty()}
      },
      layers:[
        {id:"bg", type:"background", paint:{"background-color":"#02060f"}},
        {id:"osm", type:"raster", source:"osm", paint:{   /* scuro come il 2D (filtro CSS invert/hue-rotate/brightness/contrast/saturate) */
          "raster-hue-rotate":180, "raster-brightness-min":.85, "raster-brightness-max":0, "raster-contrast":.06, "raster-saturation":-.45}},
        {id:"sat", type:"raster", source:"sat", layout:{visibility:"none"}},
        {id:"hill", type:"hillshade", source:"hill", paint:{"hillshade-exaggeration":.3, "hillshade-shadow-color":"#000", "hillshade-highlight-color":"#fff"}},
        {id:"excl-fill", type:"fill", source:"excl", paint:{"fill-color":"#FF7A5C", "fill-opacity":.16}},
        {id:"excl-line", type:"line", source:"excl", paint:{"line-color":"#FF7A5C", "line-width":1.5}},
        {id:"fills-fill", type:"fill", source:"fills", paint:{"fill-color":["get","c"], "fill-opacity":["get","o"]}},
        {id:"fills-line", type:"line", source:"fills", paint:{"line-color":["get","c"], "line-width":2.5}},
        {id:"lines", type:"line", source:"lines", layout:{"line-cap":"round", "line-join":"round"}, paint:{"line-color":["get","c"], "line-width":["get","w"]}},
        /* proiezione a terra: piena in salita, tratteggiata in discesa, come nel 2D */
        {id:"shadow", type:"line", source:"shadow", filter:["==",["get","d"],0], paint:{"line-color":"#ffffff", "line-width":1.8, "line-opacity":.85}},
        {id:"shadowd", type:"line", source:"shadow", filter:["==",["get","d"],1], paint:{"line-color":"#ffffff", "line-width":1.8, "line-opacity":.85, "line-dasharray":[3,3]}},
        /* Diretta: proiezione a terra di ogni fix GPS */
        {id:"livepts", type:"circle", source:"livepts", paint:{"circle-radius":3.5, "circle-color":["get","c"],
          "circle-stroke-color":"#02060f", "circle-stroke-width":1, "circle-pitch-alignment":"map"}},
        /* fascia di piu' partenze: prismi alti quanto l'escursione di quota dei voli in quell'istante;
           l'opacita' si applica all'insieme (come il pannello trasparente del 2D), le sovrapposizioni non si sommano */
        {id:"band", type:"fill-extrusion", source:"band", paint:{"fill-extrusion-color":["get","c"], "fill-extrusion-height":["get","h"], "fill-extrusion-base":["get","b"], "fill-extrusion-opacity":.38, "fill-extrusion-vertical-gradient":false}},
        {id:"tube2", type:"fill-extrusion", source:"tube", filter:["==",["get","m"],1],
         paint:{"fill-extrusion-color":["get","c"], "fill-extrusion-height":["get","h"], "fill-extrusion-base":["get","b"], "fill-extrusion-opacity":.5}},
        {id:"tube", type:"fill-extrusion", source:"tube", filter:["==",["get","m"],0],
         paint:{"fill-extrusion-color":["get","c"], "fill-extrusion-height":["get","h"], "fill-extrusion-base":["get","b"], "fill-extrusion-opacity":.96}}
      ],
      terrain:{source:"dem", exaggeration:1.5},
      sky:{"sky-color":"#0e2a4a", "horizon-color":"#6f93b8", "fog-color":"#a9c2dc", "sky-horizon-blend":.5, "horizon-fog-blend":.6, "fog-ground-blend":.8}
    };

    const map = new ml.Map({
      container:o.container, style:style, center:[-56, -33], zoom:5.5, pitch:55, maxPitch:80,
      /* Gesti come nel 2D, su ogni dispositivo: un dito (o il mouse) sposta la
         mappa; due dita avvicinate/allontanate zoomano e ruotano; due dita
         trascinate insieme in alto o in basso cambiano l'inclinazione
         (touchPitch). Niente gesti "cooperativi" (chiederebbero due dita per
         spostare, e allora le due dita non inclinerebbero piu'): la rotella
         del mouse, come nel 2D, si attiva solo dopo un clic sulla mappa. */
      cooperativeGestures:false, touchPitch:true,
      attributionControl:{compact:true}, canvasContextAttributes:{antialias:true}
    });
    map.addControl(new ml.NavigationControl({visualizePitch:true}), "top-right");
    map.addControl(new ml.ScaleControl({unit:"metric"}), "bottom-right");
    /* rotella: spenta finche' non si clicca sulla mappa, e di nuovo quando il mouse esce (come il 2D) */
    map.scrollZoom.disable();
    map.on("click", function(){ map.scrollZoom.enable(); });
    o.container.addEventListener("mouseleave", function(){ map.scrollZoom.disable(); });

    let scene = null, launchLL = null, launchMk = null, landMk = null, burstMk = null, liveMk = null, onSat = false;

    /* ----- pulsanti ----- */
    function button(html, title, onClick, cls){
      const wrap = document.createElement("div");
      wrap.className = "maplibregl-ctrl maplibregl-ctrl-group " + (cls || "");
      const b = document.createElement("button");
      b.type = "button"; b.innerHTML = html; b.title = title; b.setAttribute("aria-label", title);
      b.addEventListener("click", function(e){ e.preventDefault(); onClick(b, wrap); });
      wrap.appendChild(b);
      return {btn:b, wrap:wrap, onAdd:function(){ return wrap; }, onRemove:function(){ wrap.remove(); }};
    }
    const d = dict();
    const viewBtn = button('<span class="tw3-txt">2D</span>', d.mkView2d || "Vista 2D", function(){ if(o.onToggle) o.onToggle(); }, "mk-view");
    map.addControl(viewBtn, "top-left");

    /* schermo intero: stessa Fullscreen API del 2D, sul contenitore della mappa */
    if(fsTarget.requestFullscreen){
      const fs = button(ICONS.maximize || "⛶", d.mkFullscreen || "Schermo intero", function(){
        if(document.fullscreenElement) document.exitFullscreen(); else fsTarget.requestFullscreen();
      }, "mk-fullscreen");
      map.addControl(fs, "top-left");
      document.addEventListener("fullscreenchange", function(){
        const full = document.fullscreenElement === fsTarget;
        fsTarget.classList.toggle("mk-is-fullscreen", full);
        fs.btn.innerHTML = full ? (ICONS.minimize || "×") : (ICONS.maximize || "⛶");
        setTimeout(function(){ map.resize(); }, 60);
      });
    }

    /* Via / satellite */
    const satCtl = button(ICONS.layers || "S", d.mkLayerSat || "Satellite", function(b){
      onSat = !onSat;
      map.setLayoutProperty("osm", "visibility", onSat ? "none" : "visible");
      map.setLayoutProperty("sat", "visibility", onSat ? "visible" : "none");
      b.title = dict()[onSat ? "mkLayerStreet" : "mkLayerSat"] || (onSat ? "Via" : "Satellite");
    }, "mk-layer");
    map.addControl(satCtl, "top-right");

    /* Nuvole / pioggia: gli stessi livelli di mapkit.js (vedi li' i motivi delle due fonti) */
    let modes = null, step = 0, cloudLoading = false, cancelled = false, cloudCtl = null;
    function cloudLayerId(k){ return "mk-" + k; }
    function addCloudLayer(kind, tiles, native, opacity, attr){
      const id = cloudLayerId(kind);
      if(map.getLayer(id)) return;
      map.addSource(id, {type:"raster", tileSize:256, maxzoom:native, tiles:[tiles], attribution:attr});
      map.addLayer({id:id, type:"raster", source:id, layout:{visibility:"none"}, paint:{"raster-opacity":opacity}}, "excl-fill");
    }
    function setCloudButton(kind){
      const dd = dict();
      cloudCtl.btn.innerHTML = kind === "rain" ? (ICONS.rain || "R") : (ICONS.cloud || "C");
      cloudCtl.btn.title = kind === "rain" ? (dd.mkRainOnly || "Pioggia (radar)") : (dd.mkRain || "Nuvole (foto satellitare)");
    }
    function applyClouds(){
      ["rain", "clouds"].forEach(function(k){ if(map.getLayer(cloudLayerId(k))) map.setLayoutProperty(cloudLayerId(k), "visibility", "none"); });
      const kind = step ? modes[step - 1] : null;
      cloudCtl.wrap.classList.toggle("mk-active", !!kind);
      if(kind) map.setLayoutProperty(cloudLayerId(kind), "visibility", "visible");
      setCloudButton(kind || (modes && modes[0]));
    }
    function toggleClouds(){
      if(modes){ step = (step + 1) % (modes.length + 1); applyClouds(); return; }
      if(cloudLoading){ cancelled = true; cloudCtl.wrap.classList.remove("mk-active"); return; }
      const c = map.getCenter();
      function addClouds(){
        addCloudLayer("clouds", mk.OWM_TILES, mk.OWM_NATIVE_ZOOM, .75,
          'Nuvole: <a href="https://openweathermap.org/" target="_blank" rel="noopener">OpenWeatherMap</a>');
      }
      function start(m){
        modes = m; cloudLoading = false;
        step = cancelled ? 0 : 1; cancelled = false;
        applyClouds();
      }
      if(mk.isEurope && mk.isEurope(c.lat, c.lng)){
        cloudLoading = true; cancelled = false;
        cloudCtl.wrap.classList.add("mk-active");
        fetch(mk.RAIN_INDEX).then(function(r){ return r.json(); }).then(function(j){
          const frames = j && j.radar && j.radar.past, last = frames && frames[frames.length - 1];
          addClouds();
          if(last){
            addCloudLayer("rain", j.host + last.path + "/256/{z}/{x}/{y}/2/1_1.png", mk.RAIN_NATIVE_ZOOM, .55,
              'Pioggia: <a href="https://www.rainviewer.com" target="_blank" rel="noopener">RainViewer</a>');
            start(["rain", "clouds"]);
          } else start(["clouds"]);
        }).catch(function(){ addClouds(); start(["clouds"]); });
      } else { addClouds(); start(["clouds"]); }
    }
    if(mk.OWM_TILES){
      cloudCtl = button(ICONS.cloud || "C", d.mkRain || "Nuvole (foto satellitare)", toggleClouds, "mk-rain");
      map.addControl(cloudCtl, "top-right");
    }

    /* Salva l'immagine: lo schermo della mappa cosi' com'e' (vista, inclinazione,
       livelli) con una striscia sotto che dice cos'e' e di chi sono i dati.
       Il canvas WebGL si puo' copiare solo subito dopo un disegno: si chiede
       un ridisegno e si copia nello stesso istante. */
    let saveCtl = null;
    function save(){
      const info = o.onSave ? o.onSave() : {};
      map.once("render", function(){
        const cv = map.getCanvas(), W = cv.width, H = cv.height, u = Math.max(1, W/900);
        const FOOT = Math.round(92*u);
        const out = document.createElement("canvas");
        out.width = W; out.height = H + FOOT;
        const g = out.getContext("2d");
        g.drawImage(cv, 0, 0);
        g.fillStyle = "#02060f"; g.fillRect(0, H, W, FOOT);
        g.fillStyle = "#EAF3FA"; g.textBaseline = "alphabetic";
        g.font = "600 " + 15*u + "px 'Space Grotesk', Inter, system-ui, sans-serif";
        g.fillText(info.title || "COMETA", 16*u, H + 26*u);
        g.fillStyle = "#8FA6BC"; g.font = 11.5*u + "px Inter, system-ui, sans-serif";
        (info.lines || []).slice(0, 2).forEach(function(l, i){ g.fillText(l, 16*u, H + (46 + 16*i)*u); });
        g.fillStyle = "#5F7690"; g.font = 10.5*u + "px Inter, system-ui, sans-serif";
        g.fillText((onSat ? "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community" : "© OpenStreetMap contributors")
          + " · Mapzen/AWS Terrain Tiles · cometa.scuolaitaliana.edu.uy", 16*u, H + FOOT - 10*u);
        out.toBlob(function(blob){
          if(!blob){ if(o.onSaveError) o.onSaveError(); return; }
          const a = document.createElement("a");
          a.download = (info.filename || "cometa-3d") + ".png";
          a.href = URL.createObjectURL(blob);
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
        }, "image/png");
      });
      map.triggerRepaint();
    }
    if(o.onSave){
      saveCtl = button(ICONS.save || "↓", d.mkSave || "Scarica l'immagine della mappa", save, "mk-save");
      map.addControl(saveCtl, "top-right");
    }

    /* Vista laterale: telecamera di fianco alla deriva, la quota si legge e il volo corre da sinistra a destra */
    const sideCtl = button(ICON_CUBE, d.mk3dSide || "Vista laterale", function(){ fit(); }, "mk-side");
    map.addControl(sideCtl, "top-right");

    /* Inclinazione con due pulsanti, solo da telefono/tablet (da computer basta ctrl + trascina) */
    const tiltWrap = document.createElement("div");
    tiltWrap.className = "maplibregl-ctrl maplibregl-ctrl-group mk-tilt";
    const tiltUp = document.createElement("button"), tiltDown = document.createElement("button");
    [[tiltUp, ICON_TILT_UP, "mk3dTiltMore", "Inclina di piu'", 12], [tiltDown, ICON_TILT_DOWN, "mk3dTiltLess", "Inclina meno", -12]].forEach(function(a){
      a[0].type = "button"; a[0].innerHTML = a[1]; a[0].title = d[a[2]] || a[3]; a[0].setAttribute("aria-label", a[0].title);
      a[0].addEventListener("click", function(e){
        e.preventDefault();
        map.easeTo({pitch:Math.max(0, Math.min(80, map.getPitch() + a[4])), duration:300});
      });
      tiltWrap.appendChild(a[0]);
    });
    if(touch) map.addControl({onAdd:function(){ return tiltWrap; }, onRemove:function(){ tiltWrap.remove(); }}, "top-right");

    /* ----- marcatori ----- */
    function dot(color){
      const e = document.createElement("div");
      e.className = "tw3-dot"; e.style.background = color;
      return e;
    }
    function setLaunch(l, pan){
      launchLL = l ? [l.lon, l.lat] : null;
      if(!l){ if(launchMk){ launchMk.remove(); launchMk = null; } return; }
      if(!launchMk){
        const e = document.createElement("div");
        e.className = "tw-star"; e.innerHTML = '<span style="color:' + o.color + '">★</span>';
        e.style.width = e.style.height = "26px";
        launchMk = new ml.Marker({element:e, draggable:true, opacityWhenCovered:"1"}).setLngLat([l.lon, l.lat]).addTo(map);
        launchMk.on("dragend", function(){ const p = launchMk.getLngLat(); if(o.onDrag) o.onDrag(p.lat, p.lng); });
      } else launchMk.setLngLat([l.lon, l.lat]);
      launchMk.getElement().title = l.name || "";
      if(pan && !map.getBounds().contains([l.lon, l.lat])) map.easeTo({center:[l.lon, l.lat], duration:600});
    }
    function pin(m, color, ll, text){
      if(!ll){ if(m){ m.remove(); } return null; }
      if(!m) m = new ml.Marker({element:dot(color), opacityWhenCovered:"1"}).setLngLat(ll).addTo(map);
      else m.setLngLat(ll);
      m.setPopup(text ? new ml.Popup({offset:12, closeButton:false}).setText(text) : null);
      return m;
    }

    /* ----- inquadratura -----
       Telecamera di fianco alla deriva, cosi' il volo corre da sinistra a
       destra. Lo zoom si sceglie perche' ci stiano sia la larghezza della
       traiettoria sia la sua altezza: a quell'inclinazione una quota h si
       vede alta circa h·sin(inclinazione) / (metri per pixel). Si lascia
       sopra la mappa tanto spazio quanto e' alta la traiettoria. */
    function fit(){
      if(!scene) return;
      const lists = (scene.runs || []).map(function(r){ return r.pts; });
      if(scene.live && scene.live.pts && scene.live.pts.length) lists.push(scene.live.pts);
      const b = new ml.LngLatBounds();
      lists.forEach(function(L){ L.forEach(function(p){ b.extend([p.lon, p.lat]); }); });
      (scene.fills || []).forEach(function(f){ f.ring.forEach(function(q){ b.extend(q); }); });
      (scene.extr || []).forEach(function(f){ f.ring.forEach(function(q){ b.extend(q); }); });
      if(launchLL && lists.length && !(scene.live && scene.live.pts && scene.live.pts.length)) b.extend(launchLL);
      if(b.isEmpty()) return;
      const ref = lists[0] || [], a = ref[0], z = ref[ref.length - 1];
      const brg = a && z && (Math.abs(a.lat - z.lat) + Math.abs(a.lon - z.lon) > 1e-3)
        ? (bearing(a.lat, a.lon, z.lat, z.lon) - 90 + 360) % 360 : 0;           /* la deriva va verso destra */
      const w = o.container.clientWidth, h = o.container.clientHeight;
      const padX = {left:Math.min(70, w*.08), right:Math.min(80, w*.1)};
      const cam = map.cameraForBounds(b, {bearing:brg, padding:{top:20, bottom:20, left:padX.left, right:padX.right}});
      if(!cam){ return; }
      const lat = b.getCenter().lat;
      const alt = maxAlt(lists) * Math.sin(PITCH*RAD);
      const room = Math.max(120, h*.66);                     /* quanti pixel d'altezza puo' occupare la quota */
      const zH = alt > 0 ? Math.log2(room*78271.517*Math.cos(lat*RAD)/alt) : 20;
      const zoom = Math.max(1, Math.min(cam.zoom, zH, 12));
      const apex = alt/(78271.517*Math.cos(lat*RAD)/Math.pow(2, zoom));
      map.easeTo({center:cam.center, zoom:zoom, bearing:brg, pitch:PITCH, duration:1200,
        padding:{top:Math.min(h*.7, apex + 24), bottom:34, left:padX.left, right:padX.right}});
    }

    function render(sc, doFit){
      scene = sc;
      const runs = sc && sc.runs || [];
      const poly = function(ring){ return {type:"Polygon", coordinates:[ring.concat([ring[0]])]}; };
      map.getSource("fills").setData({type:"FeatureCollection", features:(sc && sc.fills || []).map(function(f){
        return {type:"Feature", properties:{c:f.color, o:f.opacity}, geometry:poly(f.ring)};
      })});
      map.getSource("band").setData({type:"FeatureCollection", features:(sc && sc.extr || []).map(function(f){
        return {type:"Feature", properties:{c:f.color, b:f.base, h:f.top}, geometry:poly(f.ring)};
      })});
      map.getSource("lines").setData({type:"FeatureCollection", features:(sc && sc.lines || []).map(function(f){
        return {type:"Feature", properties:{c:f.color, w:f.width}, geometry:{type:"LineString", coordinates:f.coords}};
      })});
      const ground = runs.map(function(r){ return r.pts; });     /* solo le traiettorie: i fix GPS restano punti */
      const lc = sc && sc.live && sc.live.color || "#4ADE9B";
      map.getSource("livepts").setData({type:"FeatureCollection", features:(sc && sc.live && sc.live.pts || []).map(function(p){
        return {type:"Feature", properties:{c:lc}, geometry:{type:"Point", coordinates:[p.lon, p.lat]}};
      })});
      const gl = [];
      ground.forEach(function(L){
        const up = L.filter(function(p){ return p.up !== false; }), down = L.filter(function(p){ return p.up === false; });
        if(down.length && up.length) down.unshift(up[up.length - 1]);        /* la discesa parte dallo scoppio */
        [[up, 0], [down, 1]].forEach(function(a){
          if(a[0].length > 1) gl.push({type:"Feature", properties:{d:a[1]}, geometry:{type:"LineString", coordinates:a[0].map(function(p){ return [p.lon, p.lat]; })}});
        });
      });
      map.getSource("shadow").setData({type:"FeatureCollection", features:gl});
      map.getSource("tube").setData(sc ? buildTubes(sc, sc.col || col) : empty());
      const first = runs[0];
      landMk = pin(landMk, "#FFB84D", first && sc.main ? [first.end.lon, first.end.lat] : null, sc && sc.labels && sc.labels.land);
      burstMk = pin(burstMk, "#ffffff", first && sc.main ? [first.burst.lon, first.burst.lat] : null, sc && sc.labels && sc.labels.burst);
      const lp = sc && sc.live && sc.live.pts && sc.live.pts[sc.live.pts.length - 1];
      liveMk = pin(liveMk, (sc && sc.live && sc.live.color) || "#4ADE9B", lp ? [lp.lon, lp.lat] : null, sc && sc.live && sc.live.label);
      if(doFit) fit();
    }

    map.on("click", function(e){
      if(e.originalEvent && e.originalEvent.target.closest && e.originalEvent.target.closest(".maplibregl-marker")) return;
      if(o.onPick) o.onPick(e.lngLat.lat, e.lngLat.lng);
    });

    const ctl = {
      map:map, render:render, setLaunch:setLaunch, fit:fit,
      resize:function(){ map.resize(); },
      jump:function(lat, lon, leafletZoom){ map.jumpTo({center:[lon, lat], zoom:Math.max(1, leafletZoom - 1), pitch:55, bearing:0}); },
      relabel:function(){     /* cambio lingua: titoli dei pulsanti */
        const dd = dict();
        viewBtn.btn.title = dd.mkView2d || "Vista 2D";
        satCtl.btn.title = dd[onSat ? "mkLayerStreet" : "mkLayerSat"] || "";
        sideCtl.btn.title = dd.mk3dSide || "Vista laterale";
        tiltUp.title = dd.mk3dTiltMore || "Inclina di piu'";
        tiltDown.title = dd.mk3dTiltLess || "Inclina meno";
        if(saveCtl) saveCtl.btn.title = dd.mkSave || "";
      }
    };
    return new Promise(function(ok){
      if(map.isStyleLoaded && map.isStyleLoaded()) ok(ctl);
      else map.once("style.load", function(){ ok(ctl); });
    });
  }

  function create(o){
    if(!hasWebGL()) return Promise.reject(new Error("webgl"));
    return load().then(function(){ return build(o); });
  }

  /* ---------- Il pulsante 2D/3D su una mappa Leaflet ----------
     o: L, map (Leaflet), elMap (il suo contenitore),
        el3Class / el3Style (aspetto del contenitore 3D, che nasce accanto a elMap),
        create (le opzioni di create(), senza container/onToggle),
        onEnter(ctl) quando si passa al 3D (contenitore gia' visibile e misurato),
        onLeave() quando si torna al 2D, onFail() se il 3D non parte.
     Ritorna {set(on), isOn(), ctl(), relabel()}. Si parte sempre in 2D. */
  function attach(o){
    const L = o.L;
    let ctl = null, ready = null, el3 = null, on = false, a = null;
    const title = function(){ return dict().mkView3d || "Vista 3D"; };
    const View = L.Control.extend({
      options:{position:"topleft"},
      onAdd:function(){
        const div = L.DomUtil.create("div", "leaflet-bar mk-view");
        a = L.DomUtil.create("a", "", div);
        a.href = "#"; a.textContent = "3D"; a.title = title();
        L.DomEvent.on(a, "click", L.DomEvent.stop).on(a, "click", function(){ set(true); });
        return div;
      }
    });
    new View().addTo(o.map);

    function ensure(){
      if(ready) return ready;
      if(!el3){
        el3 = document.createElement("div");
        if(o.el3Class) el3.className = o.el3Class;
        if(o.el3Style) el3.style.cssText = o.el3Style;
        el3.setAttribute("role", "application");
        o.elMap.parentNode.insertBefore(el3, o.elMap.nextSibling);
      }
      /* schermo intero sul riquadro comune a 2D e 3D: cambiando vista si resta a schermo intero */
      ready = create(Object.assign({}, o.create, {container:el3, fsTarget:o.elMap.parentNode, onToggle:function(){ set(false); }}))
        .then(function(c){ ctl = c; return c; }, function(e){ ready = null; throw e; });
      return ready;
    }
    function set(v){
      if(!!v === on) return;
      if(v){
        on = true;
        o.elMap.hidden = true;
        if(el3) el3.hidden = false;
        ensure().then(function(c){
          c.resize(); c.relabel();       /* il contenitore e' appena diventato visibile: MapLibre va avvisato */
          if(o.onEnter) o.onEnter(c);
        }, function(){
          on = false; o.elMap.hidden = false; if(el3) el3.hidden = true;
          o.map.invalidateSize();
          if(o.onFail) o.onFail();
        });
      } else {
        on = false;
        if(el3) el3.hidden = true;
        o.elMap.hidden = false;
        o.map.invalidateSize();
        if(o.onLeave) o.onLeave();
      }
    }
    return {
      set:set,
      isOn:function(){ return on; },
      ctl:function(){ return ctl; },
      relabel:function(){ if(a) a.title = title(); if(ctl) ctl.relabel(); }
    };
  }

  return {create:create, attach:attach, hasWebGL:hasWebGL};
})();
