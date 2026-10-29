/* ============================================================
   COMETA — l'ora del lancio e i dati del volo, in un posto solo.

   Li usano il sito (assets/app.js: conto alla rovescia; assets/spot.js:
   la Diretta; assets/traiettoria.js: il volo della Diretta) e la
   pagina della stazione di terra LoRa (lora/stazione/), che carica
   questo file ma non app.js (app.js comanda menu, lingua e pagine del
   sito, e fuori dal sito si ferma al primo elemento che non trova).
   Va caricato prima di app.js, spot.js e traiettoria.js.

   Le costanti sono "const" in uno script normale: sono visibili anche
   negli altri script della pagina, come quando stavano in app.js.
   ============================================================ */

/* ==========================================================
   Conto alla rovescia — data provvisoria, da confermare
   ========================================================== */
/* Ora locale di Montevideo (UTC-3). Scritta cosi', il conto alla rovescia
   e' identico per un visitatore di Montevideo, di Roma o di Malargue. */
const LAUNCH = new Date("2026-10-29T09:30:00-03:00");
/* La previsione del giorno (assets/traiettoria.js) propone questo giorno
   e quest'ora, quando cadono dentro la settimana coperta dal GFS. */
window.COMETA_LAUNCH = LAUNCH;

/* ==========================================================
   Pagina Diretta — quota stimata in volo (bozza, da affinare)
   ========================================================== */
/* Numeri provvisori. Quota di scoppio e salita sono gli stessi gia'
   scritti su Missione (37,9 km, 5 m/s); la discesa non e' un numero
   fisso — e' la velocita' del paracadute del kit (1,2 m, Cd 1,0) con
   la massa di oggi (≈1,25 kg), calcolata come in assets/traiettoria.js
   (vAtterraggio). assets/spot.js la usa solo come velocita' AL SUOLO:
   piu' in alto, dove l'aria e' rada, la stessa sonda scende molto piu'
   veloce, e rallenta scendendo — lo stesso motivo per cui qui e' "al
   suolo" e non "di discesa" e basta. FLIGHT_SITE e' il punto di partenza
   usato per la traiettoria prevista disegnata in diretta — lo stesso
   luogo (La Calera, Minas) che la pagina Traiettoria propone di default
   (SUGGERITI[0] in assets/traiettoria.js): e' una costante a parte,
   invece di leggerla dal modulo di quella pagina, apposta — cosi' non
   dipende da cosa un visitatore potrebbe aver cambiato lì per curiosita'.
   Il volo vero non si scrive qui a mano: si aggiornano il payload pesato
   e la portanza al collo misurata (FLIGHT_PAYLOAD_KG, FLIGHT_NECK_LIFT_G,
   piu' sotto), e il resto lo calcola il codice della pagina Traiettoria. */
const FLIGHT_BURST_KM = 37.9;
const FLIGHT_ASCENT_MS = 5;
const FLIGHT_DESCENT_V0_MS = 4.6;
/* Il punto di partenza: La Calera, vicino a Minas, dove la DINACIA ci
   chiede di lanciare (prima era l'aerodromo di Mercedes, -33.2486,
   -58.0736). Il giorno del lancio si sostituisce
   con la posizione esatta presa sul posto, con un commit: la traiettoria
   prevista della Diretta e della stazione si ricalcola da sola, al
   caricamento e ogni 20 minuti. Il nome compare in testa alla scheda
   della previsione, sotto il meteo della Diretta. */
const FLIGHT_SITE = {name: "La Calera · Minas", lat: -34.2919, lon: -55.3531};
/* I dati del volo vero, da aggiornare con un commit quando si misurano:
   il payload si pesa prima del lancio, la portanza al collo si legge
   durante il gonfiaggio (in grammi; null finche' non c'e', e allora vale
   la salita prevista FLIGHT_ASCENT_MS). Da questi assets/traiettoria.js
   (voloDiretta) calcola salita, quota di scoppio e discesa con lo stesso
   codice del modulo della pagina Traiettoria e l'atmosfera prevista per
   il giorno e l'ora di LAUNCH; FLIGHT_BURST_KM e FLIGHT_DESCENT_V0_MS
   qui sopra restano solo come valori di riserva, finche' quel calcolo
   non arriva. */
const FLIGHT_BALLOON = "2000";       /* Strato 2000, come i preset della pagina Traiettoria */
const FLIGHT_PAYLOAD_KG = 1.25;     /* stima del 28 ottobre; si ripesa la mattina del lancio */
const FLIGHT_NECK_LIFT_G = null;
window.COMETA_FLIGHT = {burstKm: FLIGHT_BURST_KM, ascentMs: FLIGHT_ASCENT_MS, descentV0Ms: FLIGHT_DESCENT_V0_MS, site: FLIGHT_SITE,
  cfg: {bal: FLIGHT_BALLOON, pay: FLIGHT_PAYLOAD_KG, asc: FLIGHT_ASCENT_MS, neckG: FLIGHT_NECK_LIFT_G}};

/* I dati LoRa pubblicati dal Worker cometa-lora (lora/README.md):
   traccia.json e ultimo.json, letti attraverso la cache di Cloudflare. */
const LORA_DATI = "https://dati.cometa.gripe";
window.COMETA_LORA_DATI = LORA_DATI;

/* ==========================================================
   La traiettoria prevista (Tawhiri, SondeHub)
   ========================================================== */
/* La stessa richiesta per la Diretta e per la stazione, cosi' le due
   pagine disegnano la stessa linea: partenza da FLIGHT_SITE all'ora di
   LAUNCH, con salita, quota di scoppio e discesa di window.COMETA_FLIGHT
   (che assets/traiettoria.js, voloDiretta, ricalcola con l'atmosfera
   prevista per quel giorno). Risolve con
     {pts: [[lat, lon], ...], full: [{t, lat, lon, alt, up}, ...] (t in ms),
      burst, end: lo scoppio e l'atterraggio (due punti di full),
      run: corsa GFS (Date o null), key, durMin,
      raw: la risposta di Tawhiri, per la scheda (assets/traiettoria.js)}
   oppure null se il previsore non ha una risposta (data fuori
   dall'orizzonte del GFS, previsore non pronto, rete assente). */
window.COMETA_PREVISIONE = function(over){
  const TAWHIRI = "https://api.v2.sondehub.org/tawhiri";
  const L0 = window.COMETA_LAUNCH;
  /* over: {ascentMs, burstKm, descentV0Ms} al posto di quelli del volo
     (l'area di atterraggio della stazione: COMETA_TRAIETTORIA.incertezza) */
  const F = window.COMETA_FLIGHT && Object.assign({}, window.COMETA_FLIGHT, over || {});
  if(!F || !F.site || !L0) return Promise.resolve(null);
  const q = new URLSearchParams({
    profile: "standard_profile",
    launch_latitude: F.site.lat.toFixed(5),
    launch_longitude: (((F.site.lon % 360) + 360) % 360).toFixed(5),
    launch_datetime: L0.toISOString().replace(/\.\d+Z$/, "Z"),
    ascent_rate: F.ascentMs.toFixed(2),
    burst_altitude: Math.round(F.burstKm * 1000),
    descent_rate: F.descentV0Ms.toFixed(2)
  });
  return fetch(TAWHIRI + "?" + q.toString())
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!d || d.error || !d.prediction) return null;
      const run = d.request && d.request.dataset;
      const pts = [], full = [];
      d.prediction.forEach(function(stage){
        stage.trajectory.forEach(function(p){
          const lon = p.longitude >= 180 ? p.longitude - 360 : p.longitude;
          pts.push([p.latitude, lon]);
          full.push({t:new Date(p.datetime).getTime(), lat:p.latitude, lon:lon, alt:p.altitude, up:stage.stage === "ascent"});
        });
      });
      if(pts.length < 2) return null;
      const st = d.prediction[0].trajectory, en = d.prediction[d.prediction.length - 1].trajectory;
      const su = full.filter(function(p){ return p.up; });
      return {pts:pts, full:full, burst:su.length ? su[su.length - 1] : full[0], end:full[full.length - 1],
        run:run ? new Date(run) : null, key:run + "|" + q.toString(),
        durMin:(new Date(en[en.length - 1].datetime) - new Date(st[0].datetime)) / 6e4, raw:d};
    })
    .catch(function(){ return null; });
};
