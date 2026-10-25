/* ==========================================================
   Meteo: temporali e quanto e' incerta la previsione
   ==========================================================
   Riquadri meteo della Diretta (assets/spot.js) e del predittore
   (assets/traiettoria.js). I valori mostrati sono quelli di Open-Meteo
   (best_match, che in Uruguay e' ECMWF IFS a 9 km); la stessa ora si
   chiede anche a ECMWF e a tre modelli di altri centri (GFS, ICON, UKMO).

   Sotto l'icona, in arancione, al piu' una scritta:
   - «temporali» (con l'icona del fulmine) se best_match prevede un
     temporale (weather_code 95-99) oppure CAPE >= CAPE_MIN J/kg con
     pioggia (>= DRY_MM mm) nella stessa ora, dove la sonda attraversa la
     troposfera:
     - alla partenza, dal lancio a UP_H ore dopo;
     - all'atterraggio previsto (o.land, se la traiettoria c'e'), da
       LAND_H ore prima a LAND_H ore dopo l'ora prevista.
     Lo scoppio no: e' nella stratosfera. Senza traiettoria si guarda solo
     la partenza, dal lancio a STORM_H ore dopo (tutto il volo);
   - altrimenti «incerta» se i modelli non sono d'accordo:
     - nuvole: fra il valore piu' basso e il piu' alto (quello mostrato
       compreso) ci sono SPREAD_MIN punti o piu';
     - pioggia: un modello da' almeno RAIN_MM mm all'ora del lancio e un
       altro meno di DRY_MM;
     - temporali: un altro modello prevede un temporale nelle stesse
       finestre.
   La probabilita' di pioggia non entra nel confronto: viene dagli
   ensemble ed e' gia' lei una misura dell'incertezza. Il vento nemmeno:
   a pochi giorni i modelli lo prevedono molto meglio. Nuvole, pioggia e
   vento sono calcolati sul punto di lancio.

   Title, in inglese come gli altri: nuvole «models: ...» e sotto
   «layers: ...»; pioggia i mm dei modelli e il CAPE massimo nelle
   finestre; icona il motivo della scritta. Se la richiesta fallisce
   restano gli strati e nessuna scritta. */
window.COMETA_NUVOLE = (function(){
  const METEO = "https://api.open-meteo.com/v1/forecast";
  const MODELS = [["ecmwf_ifs", "ECMWF"], ["gfs_seamless", "GFS"], ["icon_seamless", "ICON"], ["ukmo_seamless", "UKMO"]];
  const SPREAD_MIN = 30;
  const RAIN_MM = 0.5, DRY_MM = 0.1;
  const STORM_H = 3;            /* il volo: ~2 h di salita e ~40 min di discesa */
  const UP_H = 1;               /* in un'ora a 5 m/s la sonda e' gia' sopra la troposfera */
  const LAND_H = 1;             /* margine sull'ora prevista di atterraggio */
  const CAPE_MIN = 1000;
  const ICON_STORM = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 14H8a4 4 0 1 1 1.3-7.8 5 5 0 0 1 9.6 2A3.5 3.5 0 0 1 17.5 14Z"/><path d="M13 14.5l-2.5 3.5h3.5l-2.5 3.5"/></svg>';

  function layersTip(h, i){
    const g = function(k){ return h[k] && h[k][i] != null ? Math.round(h[k][i]) + "%" : "—"; };
    return h.cloud_cover_low ? "layers: low " + g("cloud_cover_low") + " · mid " + g("cloud_cover_mid") + " · high " + g("cloud_cover_high") : "";
  }
  function setTip(tile, lines){
    const t = lines.filter(Boolean).join("\n");
    if(t) tile.title = t; else tile.removeAttribute("title");
  }
  function nextDay(iso){ return new Date(Date.parse(iso + "T12:00:00Z") + 864e5).toISOString().slice(0, 10); }
  function col(h, v, m){ return h[v + "_" + m] || []; }
  /* Primo temporale (codici WMO 95-99) di un modello nella finestra: {code, at} o null */
  function storm(h, m, i0, i1){
    const wc = col(h, "weather_code", m);
    for(let j = i0; j <= i1; j++) if(wc[j] != null && wc[j] >= 95) return {code: wc[j], at: h.time[j].slice(11)};
    return null;
  }

  function ask(lat, lon, iso, tz){
    const q = new URLSearchParams({
      latitude: lat.toFixed(4), longitude: lon.toFixed(4), hourly: "cloud_cover,precipitation,weather_code,cape",
      models: ["best_match"].concat(MODELS.map(function(m){ return m[0]; })).join(","),
      start_date: iso, end_date: nextDay(iso), timezone: tz     /* le finestre possono passare la mezzanotte */
    });
    return fetch(METEO + "?" + q.toString())
      .then(function(r){ return r.ok ? r.json() : null; })
      .catch(function(){ return null; });
  }
  /* Temporali in una finestra [i0, i1] di un punto: cosa dice best_match
     (testi per il title), quali altri modelli ne prevedono uno, CAPE massimo. */
  function temporali(h, i0, i1, dove){
    i0 = Math.max(0, i0); i1 = Math.min(h.time.length - 1, i1);
    const out = {tip: [], altri: [], cape: null};
    const s = storm(h, "best_match", i0, i1), cape = col(h, "cape", "best_match"), bp = col(h, "precipitation", "best_match");
    let wet = null;
    for(let j = i0; j <= i1; j++){
      if(cape[j] == null) continue;
      if(out.cape == null || cape[j] > out.cape) out.cape = cape[j];
      if(!wet && cape[j] >= CAPE_MIN && bp[j] != null && bp[j] >= DRY_MM) wet = {cape: cape[j], at: h.time[j].slice(11)};
    }
    if(s) out.tip.push((s.code > 95 ? "thunderstorm with hail" : "thunderstorm") + " at " + s.at + dove);
    if(wet) out.tip.push("CAPE " + Math.round(wet.cape) + " J/kg with rain at " + wet.at + dove);
    out.altri = MODELS.filter(function(m){ return storm(h, m[0], i0, i1); }).map(function(m){ return m[1]; });
    return out;
  }
  /* Indice dell'ora piu' vicina a t (ms) nella risposta, che e' in ora locale */
  function oraDi(d, t){
    const off = (d.utc_offset_seconds || 0) * 1000;
    const k = new Date(Math.round((t + off) / 36e5) * 36e5).toISOString().slice(0, 13) + ":00";
    return d.hourly.time.indexOf(k);
  }

  /* o: {lat, lon, iso, key, tz, h, i, clouds, rain, icon, unc, storm, land}
     h, i: la risposta oraria gia' arrivata e l'indice dell'ora;
     clouds, rain, icon: gli elementi .mk-wv dei tre riquadri;
     unc, storm: le scritte «incerta» e «temporali» sotto l'icona;
     land: {lat, lon, t} atterraggio previsto (t in ms o Date), se c'e'.
     Una chiamata piu' recente sugli stessi elementi annulla le precedenti. */
  function aggiorna(o){
    const best = Math.round(o.h.cloud_cover[o.i]), layers = layersTip(o.h, o.i);
    const cTile = o.clouds.parentNode, rTile = o.rain.parentNode, iTile = o.icon.parentNode;
    const seq = o.unc._seq = (o.unc._seq || 0) + 1;
    o.clouds.textContent = best + "%";
    o.unc.hidden = true; if(o.storm) o.storm.hidden = true;
    setTip(cTile, [layers]); setTip(rTile, []); setTip(iTile, []);
    const land = o.land && o.land.t != null ? {lat: o.land.lat, lon: o.land.lon, t: +o.land.t} : null;
    Promise.all([ask(o.lat, o.lon, o.iso, o.tz), land ? ask(land.lat, land.lon, o.iso, o.tz) : null])
      .then(function(rr){
        if(seq !== o.unc._seq) return;
        const d = rr[0], h = d && d.hourly, i = h && h.time ? h.time.indexOf(o.key) : -1;
        if(i < 0) return;
        const cl = [], pr = [];
        MODELS.forEach(function(m){
          const c = col(h, "cloud_cover", m[0])[i], p = col(h, "precipitation", m[0])[i];
          if(c != null) cl.push([m[1], Math.round(c)]);
          if(p != null) pr.push([m[1], p]);
        });

        /* temporali: partenza, e atterraggio se c'e' la traiettoria */
        const dl = rr[1], il = dl && dl.hourly && dl.hourly.time ? oraDi(dl, land.t) : -1;
        const tLaunch = temporali(h, i, i + (il >= 0 ? UP_H : STORM_H), il >= 0 ? " (launch)" : "");
        const tLand = il >= 0 ? temporali(dl.hourly, il - LAND_H, il + LAND_H, " (landing)") : null;
        const sTip = tLaunch.tip.concat(tLand ? tLand.tip : []);
        const altri = tLaunch.altri.concat(tLand ? tLand.altri : []).filter(function(x, k, a){ return a.indexOf(x) === k; });

        const why = [];
        if(cl.length >= 2){
          const n = cl.map(function(v){ return v[1]; }).concat(best);
          if(Math.max.apply(null, n) - Math.min.apply(null, n) >= SPREAD_MIN) why.push("clouds");
          setTip(cTile, ["models: " + cl.map(function(v){ return v[0] + " " + v[1] + "%"; }).join(" · "), layers]);
        }
        if(pr.length >= 2){
          const n = pr.map(function(v){ return v[1]; });
          if(Math.max.apply(null, n) >= RAIN_MM && Math.min.apply(null, n) < DRY_MM) why.push("rain");
        }
        const capeTip = tLand
          ? "CAPE max: launch " + (tLaunch.cape != null ? Math.round(tLaunch.cape) : "—") + " · landing " + (tLand.cape != null ? Math.round(tLand.cape) : "—") + " J/kg"
          : (tLaunch.cape != null ? "CAPE " + Math.round(tLaunch.cape) + " J/kg (max in " + STORM_H + " h)" : "");
        setTip(rTile, [pr.length ? "models: " + pr.map(function(v){ return v[0] + " " + v[1].toFixed(1) + " mm"; }).join(" · ") : "", capeTip]);
        if(!sTip.length && altri.length) why.push("thunderstorms (" + altri.join(", ") + ")");

        if(sTip.length && o.storm){
          o.storm.hidden = false;
          o.icon.innerHTML = ICON_STORM;
          setTip(iTile, [sTip.join(" · ") + (tLand ? "" : " (launch + " + STORM_H + " h)")]);
        } else if(why.length){
          o.unc.hidden = false;
          setTip(iTile, ["models disagree: " + why.join(", ")]);
        }
      });
  }
  return {aggiorna: aggiorna};
})();
