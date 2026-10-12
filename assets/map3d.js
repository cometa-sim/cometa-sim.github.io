/* ============================================================
   COMETA — vista 3D del predittore (MapLibre GL JS).

   Non calcola niente: riceve dal predittore (assets/traiettoria.js)
   gli stessi risultati che disegna in 2D con Leaflet — traiettorie,
   area di atterraggio, fascia di piu' partenze, zona di esclusione —
   e li mostra su una mappa inclinabile con rilievo. Si carica solo
   quando si preme "3D": chi resta in 2D non scarica MapLibre (1 MB).

   MapLibre non ha linee con una quota: la traiettoria e' un "tubo" di
   tanti cubetti sovrapposti (fill-extrusion), ognuno con base e
   altezza in metri sul livello del mare. Le aree (atterraggio, fascia,
   esclusione) stanno a terra, adagiate sul rilievo.

   Base stradale e satellite sono le stesse mattonelle del 2D
   (OpenStreetMap, Esri); nuvole e pioggia le stesse di mapkit.js
   (Worker Cloudflare/OpenWeatherMap, RainViewer), stese sul terreno:
   sono immagini piane, non stanno alla quota delle nuvole vere. Il
   rilievo viene dalle mattonelle Terrarium di AWS (Mapzen), gratuite
   e senza chiave.

   Le mattonelle OSM sono scurite come in 2D (li' con un filtro CSS,
   qui coi parametri raster di MapLibre: invertire = brightness-min 1,
   brightness-max 0). I pulsanti usano le stesse icone SVG di
   mapkit.js. */
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
  const ICON_CUBE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>';

  /* Testi del gesto "ctrl + rotella" (cooperativeGestures), nelle tre lingue */
  const GESTURES = {
    it:{"CooperativeGesturesHandler.WindowsHelpText":"Ctrl + rotella per ingrandire la mappa",
        "CooperativeGesturesHandler.MacHelpText":"⌘ + rotella per ingrandire la mappa",
        "CooperativeGesturesHandler.MobileHelpText":"Usa due dita per spostare la mappa"},
    es:{"CooperativeGesturesHandler.WindowsHelpText":"Ctrl + rueda para hacer zoom en el mapa",
        "CooperativeGesturesHandler.MacHelpText":"⌘ + rueda para hacer zoom en el mapa",
        "CooperativeGesturesHandler.MobileHelpText":"Usa dos dedos para mover el mapa"},
    en:{"CooperativeGesturesHandler.WindowsHelpText":"Use Ctrl + scroll to zoom the map",
        "CooperativeGesturesHandler.MacHelpText":"Use ⌘ + scroll to zoom the map",
        "CooperativeGesturesHandler.MobileHelpText":"Use two fingers to move the map"}
  };

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
  function distKm(a, b, c, d){
    const dp = (c - a)*RAD, dl = (d - b)*RAD;
    const x = Math.sin(dp/2)*Math.sin(dp/2) + Math.cos(a*RAD)*Math.cos(c*RAD)*Math.sin(dl/2)*Math.sin(dl/2);
    return 12742*Math.asin(Math.sqrt(x));
  }
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
  /* diagonale (m) del rettangolo che contiene tutte le traiettorie: da qui lo spessore del tubo */
  function diagonal(runs){
    let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
    runs.forEach(function(r){ r.pts.forEach(function(p){
      la0 = Math.min(la0, p.lat); la1 = Math.max(la1, p.lat); lo0 = Math.min(lo0, p.lon); lo1 = Math.max(lo1, p.lon);
    }); });
    return Math.hypot((la1 - la0)*M_LAT, (lo1 - lo0)*M_LAT*Math.cos(la0*RAD));
  }
  function tubes(runs, main, col){
    const feats = [], diag = diagonal(runs);
    const hw = Math.max(110, diag/(main ? 260 : 480));
    runs.forEach(function(r){
      const N = 700, S = resample(r.pts, N);
      const maxAlt = r.pts.reduce(function(m, p){ return Math.max(m, p.alt); }, 0);
      const ext = Math.max(hw, maxAlt/N*1.2);
      S.forEach(function(p){
        feats.push(box(p.lat, p.lon, hw, Math.max(0, p.alt - ext), p.alt + ext, {m:main ? 0 : 1, c:p.up ? col.up : col.down}));
      });
      if(main){      /* scoppio: cubo bianco + colonna sottile fino a terra */
        const b = r.burst, big = hw*2.6;
        feats.push(box(b.lat, b.lon, big, Math.max(0, b.alt - big), b.alt + big, {m:0, c:"#ffffff"}));
        feats.push(box(b.lat, b.lon, hw*.35, 0, Math.max(0, b.alt - big), {m:0, c:"#9fb4c8"}));
      }
    });
    return {type:"FeatureCollection", features:feats};
  }

  /* ---------- Mappa ---------- */
  function build(o){
    const ml = window.maplibregl;
    const mk = window.COMETA_MAPKIT || {};
    const ICONS = mk.ICONS || {};
    const lang = document.documentElement.lang;
    const col = {up:o.color, down:o.colorDown || "#FFB84D"};

    const style = {
      version:8,
      sources:{
        osm:{type:"raster", tileSize:256, maxzoom:19, tiles:[TILES_OSM], attribution:ATTR_OSM},
        sat:{type:"raster", tileSize:256, maxzoom:18, tiles:[mk.ESRI_SAT || ""], attribution:mk.ESRI_ATTR || ""},
        dem:DEM, hill:DEM,
        excl:{type:"geojson", data:o.excl ? {type:"Feature", properties:{}, geometry:{type:"Polygon", coordinates:[o.excl.concat([o.excl[0]])]}} : empty()},
        fills:{type:"geojson", data:empty()}, band:{type:"geojson", data:empty()},
        lines:{type:"geojson", data:empty()}, shadow:{type:"geojson", data:empty()}, tube:{type:"geojson", data:empty()}
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
        {id:"shadow", type:"line", source:"shadow", paint:{"line-color":"#ffffff", "line-width":1.5, "line-opacity":.7, "line-dasharray":[2,2]}},
        /* fascia di piu' partenze: in rilievo piatto, cosi' l'opacita' si applica all'insieme e le sovrapposizioni non si sommano (come il pannello trasparente del 2D) */
        {id:"band", type:"fill-extrusion", source:"band", paint:{"fill-extrusion-color":o.color, "fill-extrusion-height":30, "fill-extrusion-base":0, "fill-extrusion-opacity":.3, "fill-extrusion-vertical-gradient":false}},
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
      cooperativeGestures:true, locale:GESTURES[lang] || GESTURES.it,
      attributionControl:{compact:true}, canvasContextAttributes:{antialias:true}
    });
    map.addControl(new ml.NavigationControl({visualizePitch:true}), "top-right");
    map.addControl(new ml.ScaleControl({unit:"metric"}), "bottom-right");

    let scene = null, launchMk = null, landMk = null, burstMk = null, onSat = false;

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
    if(o.container.requestFullscreen){
      let fsBtn;
      const fs = button(ICONS.maximize || "⛶", d.mkFullscreen || "Schermo intero", function(){
        if(document.fullscreenElement) document.exitFullscreen(); else o.container.requestFullscreen();
      }, "mk-fullscreen");
      fsBtn = fs.btn;
      map.addControl(fs, "top-left");
      document.addEventListener("fullscreenchange", function(){
        const full = document.fullscreenElement === o.container;
        o.container.classList.toggle("mk-is-fullscreen", full);
        fsBtn.innerHTML = full ? (ICONS.minimize || "×") : (ICONS.maximize || "⛶");
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

    /* Vista laterale: telecamera di fianco alla deriva, cosi' la quota si legge */
    const sideCtl = button(ICON_CUBE, d.mk3dSide || "Vista laterale", function(){ fit(); }, "mk-side");
    map.addControl(sideCtl, "top-right");

    /* ----- marcatori ----- */
    function dot(color){
      const e = document.createElement("div");
      e.className = "tw3-dot"; e.style.background = color;
      return e;
    }
    function setLaunch(l, pan){
      if(!l){ if(launchMk){ launchMk.remove(); launchMk = null; } return; }
      if(!launchMk){
        const e = document.createElement("div");
        e.className = "tw-star"; e.innerHTML = '<span style="color:' + o.color + '">★</span>';
        e.style.width = e.style.height = "26px";
        launchMk = new ml.Marker({element:e, draggable:true}).setLngLat([l.lon, l.lat]).addTo(map);
        launchMk.on("dragend", function(){ const p = launchMk.getLngLat(); if(o.onDrag) o.onDrag(p.lat, p.lng); });
      } else launchMk.setLngLat([l.lon, l.lat]);
      launchMk.getElement().title = l.name || "";
      if(pan && !map.getBounds().contains([l.lon, l.lat])) map.easeTo({center:[l.lon, l.lat], duration:600});
    }
    function pin(m, color, ll, text){
      if(!ll){ if(m){ m.remove(); } return null; }
      if(!m) m = new ml.Marker({element:dot(color)}).setLngLat(ll).addTo(map);
      else m.setLngLat(ll);
      m.setPopup(new ml.Popup({offset:12, closeButton:false}).setText(text || ""));
      return m;
    }

    /* ----- disegno ----- */
    function fit(){
      if(!scene || !scene.runs || !scene.runs.length) return;
      const b = new ml.LngLatBounds();
      let sLa = 0, sLo = 0, n = 0;
      scene.runs.forEach(function(r){
        r.pts.forEach(function(p){ b.extend([p.lon, p.lat]); });
        sLa += r.end.lat; sLo += r.end.lon; n++;
      });
      (scene.fills || []).forEach(function(f){ f.ring.forEach(function(q){ b.extend(q); }); });
      const from = scene.runs[0].from || scene.runs[0].pts[0];
      b.extend([from.lon, from.lat]);
      const brg = (bearing(from.lat, from.lon, sLa/n, sLo/n) + 90) % 360;    /* di fianco alla deriva */
      const w = o.container.clientWidth;
      map.fitBounds(b, {pitch:62, bearing:brg, maxZoom:11, duration:1200,
        padding:{top:130, bottom:40, left:50, right:70}});
      if(w < 560) map.once("moveend", function(){ map.easeTo({zoom:map.getZoom() - .3, duration:400}); });
    }
    function render(sc, doFit){
      scene = sc;
      const runs = sc && sc.runs || [];
      const poly = function(ring){ return {type:"Polygon", coordinates:[ring.concat([ring[0]])]}; };
      map.getSource("fills").setData({type:"FeatureCollection", features:(sc && sc.fills || []).map(function(f){
        return {type:"Feature", properties:{c:f.color, o:f.opacity}, geometry:poly(f.ring)};
      })});
      map.getSource("band").setData({type:"FeatureCollection", features:(sc && sc.extr || []).map(function(f){
        return {type:"Feature", properties:{}, geometry:poly(f.ring)};
      })});
      map.getSource("lines").setData({type:"FeatureCollection", features:(sc && sc.lines || []).map(function(f){
        return {type:"Feature", properties:{c:f.color, w:f.width}, geometry:{type:"LineString", coordinates:f.coords}};
      })});
      map.getSource("shadow").setData({type:"FeatureCollection", features:runs.map(function(r){
        return {type:"Feature", properties:{}, geometry:{type:"LineString", coordinates:r.pts.map(function(p){ return [p.lon, p.lat]; })}};
      })});
      map.getSource("tube").setData(runs.length ? tubes(runs, !!sc.main, col) : empty());
      const first = runs[0];
      landMk = pin(landMk, "#FFB84D", first && sc.main ? [first.end.lon, first.end.lat] : null, sc && sc.labels && sc.labels.land);
      burstMk = pin(burstMk, "#ffffff", first && sc.main ? [first.burst.lon, first.burst.lat] : null, sc && sc.labels && sc.labels.burst);
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

  return {create:create, hasWebGL:hasWebGL, distKm:distKm};
})();
