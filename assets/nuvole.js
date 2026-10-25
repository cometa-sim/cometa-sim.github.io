/* ==========================================================
   Meteo: quanto e' incerta la previsione
   ==========================================================
   Nuvole e pioggia sono le grandezze piu' incerte dei riquadri meteo
   (Diretta in assets/spot.js, predittore in assets/traiettoria.js). I
   valori mostrati sono quelli di Open-Meteo (best_match, che in Uruguay
   e' ECMWF IFS a 9 km); la stessa ora si chiede anche a ECMWF e a tre
   modelli di altri centri (GFS, ICON, UKMO). Sotto l'icona compare
   «incerta» se:
   - nuvole: fra il valore piu' basso e il piu' alto (quello mostrato
     compreso) ci sono SPREAD_MIN punti o piu';
   - pioggia: un modello da' almeno RAIN_MM mm in quell'ora e un altro
     meno di DRY_MM (piove o no?).
   La probabilita' di pioggia non entra nel confronto: viene dagli
   ensemble ed e' gia' lei una misura dell'incertezza. Il vento nemmeno:
   a pochi giorni i modelli lo prevedono molto meglio.
   Title, in inglese come gli altri: nuvole «models: ...» e sotto
   «layers: ...»; pioggia i mm dei modelli; icona il motivo dell'avviso.
   Se la richiesta fallisce restano gli strati e niente avviso. */
window.COMETA_NUVOLE = (function(){
  const METEO = "https://api.open-meteo.com/v1/forecast";
  const MODELS = [["ecmwf_ifs", "ECMWF"], ["gfs_seamless", "GFS"], ["icon_seamless", "ICON"], ["ukmo_seamless", "UKMO"]];
  const SPREAD_MIN = 30;
  const RAIN_MM = 0.5, DRY_MM = 0.1;

  function layersTip(h, i){
    const g = function(k){ return h[k] && h[k][i] != null ? Math.round(h[k][i]) + "%" : "—"; };
    return h.cloud_cover_low ? "layers: low " + g("cloud_cover_low") + " · mid " + g("cloud_cover_mid") + " · high " + g("cloud_cover_high") : "";
  }
  function setTip(tile, lines){
    const t = lines.filter(Boolean).join("\n");
    if(t) tile.title = t; else tile.removeAttribute("title");
  }
  function mm(x){ return x.toFixed(1) + " mm"; }

  /* o: {lat, lon, iso, key, tz, h, i, clouds, rain, icon, unc, current}
     h, i: la risposta oraria gia' arrivata e l'indice dell'ora;
     clouds, rain, icon: gli elementi .mk-wv dei tre riquadri;
     unc: «incerta» sotto l'icona;
     current(): false se nel frattempo e' partita un'altra richiesta. */
  function aggiorna(o){
    const best = Math.round(o.h.cloud_cover[o.i]), layers = layersTip(o.h, o.i);
    const cTile = o.clouds.parentNode, rTile = o.rain.parentNode, iTile = o.icon.parentNode;
    o.clouds.textContent = best + "%";
    o.unc.hidden = true;
    setTip(cTile, [layers]); setTip(rTile, []); setTip(iTile, []);
    const q = new URLSearchParams({
      latitude: o.lat.toFixed(4), longitude: o.lon.toFixed(4), hourly: "cloud_cover,precipitation",
      models: MODELS.map(function(m){ return m[0]; }).join(","),
      start_date: o.iso, end_date: o.iso, timezone: o.tz
    });
    fetch(METEO + "?" + q.toString())
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if(o.current && !o.current()) return;
        const h = d && d.hourly, i = h && h.time ? h.time.indexOf(o.key) : -1;
        if(i < 0) return;
        const cl = [], pr = [];
        MODELS.forEach(function(m){
          const c = h["cloud_cover_" + m[0]], p = h["precipitation_" + m[0]];
          if(c && c[i] != null) cl.push([m[1], Math.round(c[i])]);
          if(p && p[i] != null) pr.push([m[1], p[i]]);
        });
        const why = [];
        if(cl.length >= 2){
          const n = cl.map(function(v){ return v[1]; }).concat(best);
          if(Math.max.apply(null, n) - Math.min.apply(null, n) >= SPREAD_MIN) why.push("clouds");
          setTip(cTile, ["models: " + cl.map(function(v){ return v[0] + " " + v[1] + "%"; }).join(" · "), layers]);
        }
        if(pr.length >= 2){
          const n = pr.map(function(v){ return v[1]; });
          if(Math.max.apply(null, n) >= RAIN_MM && Math.min.apply(null, n) < DRY_MM) why.push("rain");
          setTip(rTile, ["models: " + pr.map(function(v){ return v[0] + " " + mm(v[1]); }).join(" · ")]);
        }
        o.unc.hidden = !why.length;
        if(why.length) setTip(iTile, ["models disagree: " + why.join(", ")]);
      })
      .catch(function(){});
  }
  return {aggiorna: aggiorna};
})();
