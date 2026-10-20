/* ============================================================
   COMETA — le fasi del volo, dai fix GPS della telemetria LoRa.

   Una regola sola per la pagina della stazione e per la Diretta,
   perche' non dicano mai cose diverse. E' uno script normale, non un
   modulo: la stazione e la Diretta lo caricano con <script src>, e i
   test lo importano (definisce globalThis.COMETA_FASI).

   Le fasi vanno solo avanti, in quest'ordine:

     attesa      prima dell'ora del lancio (LAUNCH in assets/volo.js,
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
     al suolo, m/s (FLIGHT_DESCENT_V0_MS in assets/volo.js). */
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

  /* ----------------------------------------------------------
     Il filtro della Diretta

     La pagina della stazione mostra tutto, anche i dati incoerenti:
     e' di servizio, deve far vedere quello che succede davvero. La
     Diretta no: un punto incoerente si ignora, e resta mostrato
     l'ultimo buono; se da un minuto non arriva nessun punto buono,
     "segnale perso". Incoerente vuol dire:
     - senza fix, o con meno di 6 satelliti (il fix non e' affidabile);
     - una quota impossibile: sotto i -100 m (in Uruguay il terreno sta
       fra 0 e 500 m; alla prova del 20 ottobre, vicino a un edificio,
       il GPS e' scivolato fino a -225 m con 10-14 satelliti) o sopra i
       45 km;
     - un salto dall'ultimo punto buono che la sonda non puo' fare: piu'
       di 150 m/s in orizzontale (la corrente a getto arriva a 60-70) o
       di 200 m/s in verticale.
     Se pero' 3 punti di fila sono coerenti fra loro ma non con
     l'ultimo buono, era quello a essere sbagliato: si accettano, cosi'
     un solo punto sbagliato preso per buono non blocca la mappa.
     ---------------------------------------------------------- */
  const COERENZA = { satsMin: 6, quotaMin: -100, quotaMax: 45000, vOrizMax: 150, vVertMax: 200, conferme: 3, persoMs: 60000 };

  function compatibili(a, b) {
    const dt = Math.max((b.t - a.t) / 1000, 1);
    if (distanzaM(a, b) / dt > COERENZA.vOrizMax) return false;
    if (a.alt !== null && b.alt !== null && Math.abs(b.alt - a.alt) / dt > COERENZA.vVertMax) return false;
    return true;
  }

  function nuovoFiltro() { return { buoni: [], sospesi: [] }; }

  /* p: {t (ms), lat, lon, alt, vz, sats, fix}. Restituisce i punti
     accettati con questo (di solito [p], a volte i 3 sospesi, o
     nessuno). */
  function filtra(f, p) {
    if (p.lat === null || p.lon === null || !(p.fix > 0)) return [];
    if (p.sats !== null && p.sats < COERENZA.satsMin) return [];
    if (p.alt !== null && (p.alt < COERENZA.quotaMin || p.alt > COERENZA.quotaMax)) return [];
    const prec = f.buoni[f.buoni.length - 1];
    if (!prec || compatibili(prec, p)) { f.buoni.push(p); f.sospesi = []; return [p]; }
    const s = f.sospesi;
    if (s.length && !compatibili(s[s.length - 1], p)) f.sospesi = [];
    f.sospesi.push(p);
    if (f.sospesi.length >= COERENZA.conferme) {
      const presi = f.sospesi;
      f.buoni = f.buoni.concat(presi);
      f.sospesi = [];
      return presi;
    }
    return [];
  }

  /* "attesa" (nessun punto buono, ancora), "ok", o "perso". */
  function statoFiltro(f, adessoMs) {
    const u = f.buoni[f.buoni.length - 1];
    if (!u) return "attesa";
    return adessoMs - u.t > COERENZA.persoMs ? "perso" : "ok";
  }

  g.COMETA_FASI = { SOGLIE: SOGLIE, nuovo: nuovo, aggiungi: aggiungi, fase: fase, vParacadute: vParacadute,
    COERENZA: COERENZA, nuovoFiltro: nuovoFiltro, filtra: filtra, statoFiltro: statoFiltro };
})(typeof window !== "undefined" ? window : globalThis);
