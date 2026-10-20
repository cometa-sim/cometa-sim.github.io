/* ============================================================
   COMETA — le fasi del volo, dai fix GPS della telemetria LoRa.

   Una regola sola per la pagina della stazione e per la Diretta,
   perche' non dicano mai cose diverse. E' uno script normale, non un
   modulo: la stazione e la Diretta lo caricano con <script src>, e i
   test lo importano (definisce globalThis.COMETA_FASI).

   Le fasi vanno solo avanti, in quest'ordine:

     attesa      prima dell'ora del lancio (LAUNCH in assets/app.js,
                 la stessa del conto alla rovescia): la sonda parte a
                 quell'ora, e qualunque cosa faccia il GPS prima — prove
                 a terra, un GPS che "scivola" vicino a un edificio — resta
                 attesa;
     salita      dall'ora del lancio in poi;
     caduta      dopo lo scoppio, finche' si scende molto piu' veloce di
                 quanto il paracadute permetterebbe a quella quota;
     paracadute  dopo lo scoppio, discesa frenata;
     atterrata   dopo lo scoppio, ferma: vz quasi zero e posizione che non
                 cambia per 30 s. Resta atterrata anche se poi si muove
                 (e' nell'auto di chi l'ha recuperata).

   Lo scoppio si riconosce da due fix consecutivi con vz sotto -10 m/s:
   dopo lo scoppio si scende a decine di m/s, e camminando a terra, alla
   prova del 20 ottobre, la vz non e' mai scesa sotto -3,7. Bastano 10
   secondi per accorgersene.
   ============================================================ */
(function (g) {
  "use strict";

  const SOGLIE = {
    scoppioVz: -10,      // m/s: sotto questo, due fix di fila = scoppio
    scoppioFix: 2,
    consecutiviS: 15,    // due fix sono "consecutivi" se distano al massimo 15 s (al piu' due righe perse)
    cadutaRapporto: 1.6, // caduta se si scende piu' di 1,6 volte la velocita' attesa del paracadute
    fermoVz: 1,          // m/s
    fermoM: 30,          // m
    fermoS: 30           // s
  };

  /* Densita' dell'aria, atmosfera standard: la stessa formula di
     densityISA() in assets/spot.js. */
  function densita(h) {
    let T, p;
    if (h < 11000) { T = 288.15 - 0.0065 * h; p = 101325 * Math.pow(T / 288.15, 5.2559); }
    else if (h < 20000) { T = 216.65; p = 22632 * Math.exp(-9.80665 * (h - 11000) / (287.05 * T)); }
    else if (h < 32000) { T = 216.65 + 0.001 * (h - 20000); p = 5474.9 * Math.pow(T / 216.65, -34.1632); }
    else { T = 228.65 + 0.0028 * (h - 32000); p = 868.02 * Math.pow(T / 228.65, -12.2011); }
    return p / (287.05 * T);
  }

  /* La velocita' del paracadute a quota h: al suolo v0, piu' in alto
     molto di piu', perche' l'aria e' rada (decine di m/s sopra i 30 km). */
  function vParacadute(h, v0) {
    return v0 * Math.sqrt(densita(0) / densita(Math.max(h || 0, 0)));
  }

  function distanzaM(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dl = (b.lat - a.lat) * rad, dn = (b.lon - a.lon) * rad;
    const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dn / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /* Uno stato nuovo. lancioMs: l'ora del lancio (ms), o null se non si
     conosce (allora si resta in attesa). v0: la velocita' del paracadute
     al suolo, m/s (FLIGHT_DESCENT_V0_MS in assets/app.js). */
  function nuovo(lancioMs, v0) {
    return { lancioMs: lancioMs, v0: v0 || 4.6, recenti: [], scoppio: null, atterrata: null, quotaMax: null, ultimo: null };
  }

  /* Un fix nuovo, in ordine di ricezione: {t (ms), lat, lon, alt, vz}.
     alt e vz possono mancare (null). */
  function aggiungi(s, p) {
    s.ultimo = p;
    s.recenti.push(p);
    while (s.recenti.length && s.recenti[0].t < p.t - 60000) s.recenti.shift();
    const lanciata = s.lancioMs !== null && p.t >= s.lancioMs;
    if (lanciata && p.alt !== null && (s.quotaMax === null || p.alt > s.quotaMax.alt)) s.quotaMax = { t: p.t, alt: p.alt };
    if (lanciata && !s.scoppio && p.vz !== null && p.vz < SOGLIE.scoppioVz) {
      const k = s.recenti.length;
      const prima = s.recenti[k - 2];
      if (prima && prima.vz !== null && prima.vz < SOGLIE.scoppioVz && p.t - prima.t <= SOGLIE.consecutiviS * 1000) {
        /* Lo scoppio e' avvenuto al massimo della quota, non adesso. */
        s.scoppio = s.quotaMax || { t: prima.t, alt: prima.alt };
      }
    }
    if (s.scoppio && !s.atterrata && fermo(s, p)) s.atterrata = { t: p.t, lat: p.lat, lon: p.lon };
  }

  /* Ferma da almeno 30 s: tutti i fix degli ultimi 30 s con
     |vz| piccolo ed entro 30 m dall'ultimo, e i fix coprono davvero 30 s. */
  function fermo(s, p) {
    const fin = s.recenti.filter(function (x) { return x.t >= p.t - SOGLIE.fermoS * 1000; });
    if (!fin.length || p.t - fin[0].t < SOGLIE.fermoS * 1000 - 5000 || fin.length < 4) return false;
    return fin.every(function (x) {
      return (x.vz === null || Math.abs(x.vz) < SOGLIE.fermoVz) && distanzaM(x, p) <= SOGLIE.fermoM;
    });
  }

  /* La fase adesso (adessoMs: l'ora del computer). */
  function fase(s, adessoMs) {
    if (s.atterrata) return "atterrata";
    if (s.scoppio) {
      const p = s.ultimo;
      if (p && p.vz !== null && -p.vz > SOGLIE.cadutaRapporto * vParacadute(p.alt, s.v0)) return "caduta";
      return "paracadute";
    }
    if (s.lancioMs !== null && adessoMs >= s.lancioMs) return "salita";
    return "attesa";
  }

  /* L'ora del lancio letta dal testo di assets/app.js, dalla riga
       const LAUNCH = new Date("2026-10-28T11:00:00-03:00");
     cosi' la pagina della stazione segue da sola un rinvio del lancio,
     senza una seconda copia da aggiornare. null se la riga non c'e' o
     non e' una data. */
  function lancioDaAppJs(testo) {
    const m = /const\s+LAUNCH\s*=\s*new Date\(\s*"([^"]+)"\s*\)/.exec(testo || "");
    if (!m) return null;
    const t = Date.parse(m[1]);
    return isNaN(t) ? null : t;
  }

  /* La velocita' del paracadute al suolo, dalla stessa riga di app.js
     (FLIGHT_DESCENT_V0_MS). */
  function v0DaAppJs(testo) {
    const m = /const\s+FLIGHT_DESCENT_V0_MS\s*=\s*([0-9.]+)/.exec(testo || "");
    return m ? Number(m[1]) : null;
  }

  g.COMETA_FASI = { SOGLIE: SOGLIE, nuovo: nuovo, aggiungi: aggiungi, fase: fase, vParacadute: vParacadute,
    lancioDaAppJs: lancioDaAppJs, v0DaAppJs: v0DaAppJs };
})(typeof window !== "undefined" ? window : globalThis);
