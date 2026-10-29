/* ============================================================
   COMETA — la discesa prevista dall'ultima posizione, dopo lo scoppio.

   La traiettoria prevista prima del lancio (COMETA_PREVISIONE in
   assets/volo.js) parte da terra con i dati del volo ipotizzati. Dopo lo
   scoppio si sa molto di piu': dove e a che quota e' la sonda, e quanto
   scende davvero. Questo file prepara la richiesta a Tawhiri che parte da
   li', e la ripete a intervalli regolari: lo usa la pagina della stazione
   (lora/stazione/index.html), che ha sempre rete in almeno uno dei due
   veicoli. E' uno script normale, come fasi.js: la stazione lo carica con
   <script src>, i test lo importano (definisce globalThis.COMETA_DISCESA).

   - Il punto di partenza e' l'ultimo punto buono (il filtro di fasi.js,
     quello della Diretta) se non ha piu' di 30 s: un punto vecchio darebbe
     una previsione vecchia, e allora resta quella di prima.
   - Tawhiri calcola solo la discesa se lo scoppio e' appena sopra la quota
     di partenza (1 m): e' quello che fa SondeHub per le sonde che scendono.
   - La velocita' del paracadute si misura: Tawhiri vuole quella al suolo
     (v0) e la fa crescere con la quota come fasi.js (vParacadute). Dalla
     vz dell'ultimo minuto, v0 = -vz / vParacadute(quota, 1); la mediana,
     perche' un punto storto non la sposti. Funziona anche se il paracadute
     non frena come dovrebbe: si usa quello che fa davvero.
   - Si ricalcola ogni 60 s, ogni 30 s sotto i 3 km (gli ultimi 10 minuti
     di discesa, quando ogni correzione conta di piu').
   - Anche prima dello scoppio, dal lancio in poi: dall'ultima posizione,
     con la salita misurata (vSalita, la mediana della vz dell'ultimo
     minuto) fino alla quota di scoppio prevista, poi la discesa con la
     velocita' del paracadute prevista. Il vento gia' attraversato non
     conta piu': da dove si parte e' vero, non previsto.
   ============================================================ */
(function (g) {
  "use strict";

  const DISCESA = {
    ogniS: 60,          // un ricalcolo al minuto...
    ogniBassoS: 30,     // ...ogni 30 s sotto bassoM
    bassoM: 3000,
    freschezzaS: 30,    // il punto di partenza non ha piu' di 30 s
    finestraS: 60,      // v0 dalla vz dell'ultimo minuto...
    minPunti: 3,        // ...con almeno 3 punti
    vzMin: -0.5,        // m/s: i punti che non scendono non dicono niente sul paracadute
    v0Min: 1, v0Max: 40 // m/s: fuori da qui la misura e' sbagliata, si usa quella del volo
  };

  /* La velocita' del paracadute al suolo, misurata. punti: i punti buoni,
     in ordine, {t (ms), alt, vz}. null se non bastano. */
  function v0Misurata(punti) {
    const F = g.COMETA_FASI;
    const u = punti[punti.length - 1];
    if (!u) return null;
    const v = [];
    for (let i = punti.length - 1; i >= 0 && punti[i].t >= u.t - DISCESA.finestraS * 1000; i--) {
      const p = punti[i];
      if (p.alt === null || p.vz === null || p.vz > DISCESA.vzMin) continue;
      v.push(-p.vz / F.vParacadute(p.alt, 1));
    }
    if (v.length < DISCESA.minPunti) return null;
    v.sort(function (a, b) { return a - b; });
    const m = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
    return m >= DISCESA.v0Min && m <= DISCESA.v0Max ? m : null;
  }

  /* La velocita' di salita misurata: la mediana della vz dell'ultimo
     minuto, dei punti che salgono. null se non bastano. */
  function vSalita(punti) {
    const u = punti[punti.length - 1];
    if (!u) return null;
    const v = [];
    for (let i = punti.length - 1; i >= 0 && punti[i].t >= u.t - DISCESA.finestraS * 1000; i--) {
      if (punti[i].vz !== null && punti[i].vz > 0.5) v.push(punti[i].vz);
    }
    if (v.length < DISCESA.minPunti) return null;
    v.sort(function (a, b) { return a - b; });
    const m = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
    return m >= 0.5 && m <= 15 ? m : null;
  }

  /* Il punto da cui partire: l'ultimo punto buono con la quota, se e'
     fresco; altrimenti null. */
  function partenza(punti, adessoMs) {
    const u = punti[punti.length - 1];
    if (!u || u.alt === null || adessoMs - u.t > DISCESA.freschezzaS * 1000) return null;
    return u;
  }

  /* Se e' ora di ricalcolare: prec e' il punto di partenza dell'ultima
     richiesta (o null). Il tempo si conta sui punti, non sull'orologio:
     se non arriva niente di nuovo non si ricalcola. */
  function daRifare(prec, p) {
    if (!prec) return true;
    const ogni = p.alt < DISCESA.bassoM ? DISCESA.ogniBassoS : DISCESA.ogniS;
    return p.t - prec.t >= ogni * 1000;
  }

  /* I parametri della richiesta a Tawhiri. salita (prima dello scoppio):
     {asc (m/s), burstM (m)}; senza, solo la discesa. */
  function parametri(p, v0, salita) {
    const alt = Math.max(0, Math.round(p.alt));
    const sale = salita && salita.burstM > alt + 1;
    return {
      profile: "standard_profile",
      launch_latitude: p.lat.toFixed(5),
      launch_longitude: (((p.lon % 360) + 360) % 360).toFixed(5),   // Tawhiri vuole 0-360
      launch_altitude: String(alt),
      launch_datetime: new Date(p.t).toISOString().replace(/\.\d+Z$/, "Z"),
      ascent_rate: sale ? salita.asc.toFixed(2) : "5.00",
      burst_altitude: String(sale ? Math.round(salita.burstM) : alt + 1),
      descent_rate: v0.toFixed(2)
    };
  }

  /* La risposta di Tawhiri: la traiettoria, [{t, lat, lon, alt}] (la
     salita solo se c'e' davvero, prima dello scoppio), lo scoppio e
     l'arrivo. null se non c'e' la discesa. */
  function leggi(d) {
    if (!d || d.error || !Array.isArray(d.prediction)) return null;
    const fase = function (nome) { return d.prediction.filter(function (s) { return s.stage === nome; })[0]; };
    const punto = function (p) {
      return { t: new Date(p.datetime).getTime(), lat: p.latitude, lon: p.longitude >= 180 ? p.longitude - 360 : p.longitude, alt: p.altitude };
    };
    const st = fase("descent");
    if (!st || !st.trajectory || st.trajectory.length < 2) return null;
    const giu = st.trajectory.map(punto);
    const sa = fase("ascent"), su = sa && sa.trajectory ? sa.trajectory.map(punto) : [];
    const sale = su.length >= 2 && su[su.length - 1].alt - su[0].alt > 10;
    const pts = sale ? su.concat(giu.slice(1)) : giu;
    return { pts: pts, burst: sale ? giu[0] : null, end: pts[pts.length - 1] };
  }

  g.COMETA_DISCESA = { DISCESA: DISCESA, v0Misurata: v0Misurata, vSalita: vSalita, partenza: partenza, daRifare: daRifare,
    parametri: parametri, leggi: leggi };
})(typeof window !== "undefined" ? window : globalThis);
