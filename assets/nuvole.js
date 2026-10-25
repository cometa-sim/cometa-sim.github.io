/* ==========================================================
   Nuvole: quanto e' incerta la previsione
   ==========================================================
   La copertura nuvolosa e' la grandezza piu' incerta dei riquadri meteo
   (Diretta in assets/spot.js, predittore in assets/traiettoria.js). La
   stessa ora si chiede anche a tre modelli globali: se fra loro e il
   valore mostrato (quello di Open-Meteo, best_match, lo stesso dell'icona)
   la distanza arriva a SPREAD_MIN punti, sotto l'etichetta compare
   «incerta». Il title ha due righe, in inglese come gli altri: i modelli
   e, sotto, i tre strati. Se la richiesta fallisce resta solo la riga
   degli strati. */
window.COMETA_NUVOLE = (function(){
  const METEO = "https://api.open-meteo.com/v1/forecast";
  const MODELS = [["ecmwf_ifs025", "ECMWF"], ["gfs_seamless", "GFS"], ["icon_seamless", "ICON"]];
  const SPREAD_MIN = 30;

  function layersTip(h, i){
    const g = function(k){ return h[k] && h[k][i] != null ? Math.round(h[k][i]) + " %" : "—"; };
    return h.cloud_cover_low ? "layers: low " + g("cloud_cover_low") + " · mid " + g("cloud_cover_mid") + " · high " + g("cloud_cover_high") : "";
  }
  function setTip(tile, lines){
    const t = lines.filter(Boolean).join("\n");
    if(t) tile.title = t; else tile.removeAttribute("title");
  }

  /* o: {lat, lon, iso, key, tz, h, i, value, unc, current}
     h, i: la risposta oraria gia' arrivata e l'indice dell'ora;
     value: l'elemento .mk-wv; unc: l'elemento «incerta»;
     current(): false se nel frattempo e' partita un'altra richiesta. */
  function aggiorna(o){
    const tile = o.value.parentNode, best = Math.round(o.h.cloud_cover[o.i]), layers = layersTip(o.h, o.i);
    o.value.textContent = best + "%";
    if(o.unc) o.unc.hidden = true;
    setTip(tile, [layers]);
    const q = new URLSearchParams({
      latitude: o.lat.toFixed(4), longitude: o.lon.toFixed(4), hourly: "cloud_cover",
      models: MODELS.map(function(m){ return m[0]; }).join(","),
      start_date: o.iso, end_date: o.iso, timezone: o.tz
    });
    fetch(METEO + "?" + q.toString())
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if(o.current && !o.current()) return;
        const h = d && d.hourly, i = h && h.time ? h.time.indexOf(o.key) : -1;
        if(i < 0) return;
        const vals = [];
        MODELS.forEach(function(m){
          const a = h["cloud_cover_" + m[0]];
          if(a && a[i] != null) vals.push([m[1], Math.round(a[i])]);
        });
        if(vals.length < 2) return;
        const nums = vals.map(function(v){ return v[1]; }).concat(best);
        if(o.unc) o.unc.hidden = Math.max.apply(null, nums) - Math.min.apply(null, nums) < SPREAD_MIN;
        setTip(tile, ["models: " + vals.map(function(v){ return v[0] + " " + v[1] + " %"; }).join(" · "), layers]);
      })
      .catch(function(){});
  }
  return {aggiorna: aggiorna};
})();
