/* ============================================================
   COMETA — la telemetria LoRa nella Diretta: i dati.

   Legge i due file che il Worker cometa-lora pubblica su R2 (vedi
   lora/README.md), attraverso la cache di Cloudflare:
   - traccia.json, tutta la traccia, una volta sola all'apertura (e di
     nuovo solo se qualcosa non torna, vedi sotto);
   - ultimo.json, gli ultimi 20 punti, ogni 20 s.
   Il browser non chiama mai il Worker: con mille spettatori, ogni
   lettura sarebbe una sua esecuzione.

   Qui si decide anche cosa mostrare. La Diretta non mostra i dati
   incoerenti: un punto incoerente si ignora e resta l'ultimo buono, e se
   da un minuto non ne arriva nessuno buono, "segnale perso". La regola
   e le fasi del volo stanno in lora/formato/fasi.js, la stessa usata
   dalla pagina della stazione (che invece mostra tutto).

   Disegnare tocca ad assets/spot.js: questo file gli passa i punti
   buoni con COMETA_LORA.onUpdate(fn).
   ============================================================ */
window.COMETA_LORA = (function(){
  "use strict";

  const POLL_MS = 20000;   // ultimo.json resta in cache 10 s: piu' spesso di cosi' non porterebbe niente di nuovo
  const F = window.COMETA_FASI;

  let colonne = null, idx = {}, chiavi = new Set(), ultimaT = -Infinity;
  let totale = 0, revisione = -1;
  let filtro = null, fasi = null, ultimoPacchettoMs = null, errore = null;
  let pollId = null, inCorso = null;
  const ascoltatori = [];

  function base(){ return window.COMETA_LORA_DATI || "https://dati.cometa.gripe"; }

  function azzera(){
    chiavi = new Set(); ultimaT = -Infinity; totale = 0; revisione = -1; ultimoPacchettoMs = null;
    filtro = F.nuovoFiltro();
    const L0 = window.COMETA_LAUNCH, fl = window.COMETA_FLIGHT;
    fasi = F.nuovo(L0 ? L0.getTime() : null, fl && fl.descentV0Ms);
  }

  /* Le colonne le dice il file stesso ("colonne"): se un giorno cambia il
     formato, qui si legge per nome, non per posizione. */
  function usaColonne(c){
    colonne = c;
    idx = {};
    c.forEach(function(nome, i){ idx[nome] = i; });
  }
  function val(r, nome){ const v = r[idx[nome]]; return v === undefined ? null : v; }

  /* Ritorna false se la riga e' piu' vecchia di quelle gia' viste: e' una
     stazione rimasta senza rete che manda in ritardo, e la traccia va
     riletta intera (il Worker la tiene in ordine). */
  function aggiungi(r){
    const k = JSON.stringify(r.slice(1));
    if(chiavi.has(k)) return true;
    const t = val(r, "t") * 1000;
    if(t < ultimaT) return false;
    chiavi.add(k);
    ultimaT = t;
    ultimoPacchettoMs = t;
    const p = {t:t, lat:val(r, "lat"), lon:val(r, "lon"), alt:val(r, "alt_m"), vz:val(r, "vz_ms"),
      sats:val(r, "sats"), fix:val(r, "fix")};
    F.filtra(filtro, p).forEach(function(b){ F.aggiungi(fasi, b); });
    return true;
  }

  function avvisa(){ ascoltatori.forEach(function(fn){ try { fn(); } catch(e){ console.error(e); } }); }

  function leggi(nome){
    return fetch(base() + "/" + nome).then(function(r){
      if(r.status === 404) return null;          // il primo pacchetto non e' ancora arrivato
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function caricaTraccia(){
    return leggi("traccia.json").then(function(d){
      azzera();
      if(d && d.colonne && Array.isArray(d.righe)){
        usaColonne(d.colonne);
        d.righe.forEach(aggiungi);
        totale = d.righe.length;
        revisione = d.revisione;
      }
      errore = null;
      avvisa();
    });
  }

  function aggiorna(){
    if(inCorso) return inCorso;
    inCorso = leggi("ultimo.json").then(function(u){
      if(!u || !u.colonne) return;
      /* Va riletta la traccia intera se: e' stata azzerata (totale sceso:
         dopo le prove, prima del lancio), o mancano piu' righe di quante
         ultimo.json ne porta (la scheda era in secondo piano e il browser
         ha saltato dei giri), o una riga e' arrivata in ritardo. */
      const nuove = u.totale - totale;
      if(revisione < 0 || u.totale < totale || nuove > u.righe.length) return caricaTraccia();
      if(JSON.stringify(u.colonne) !== JSON.stringify(colonne)) return caricaTraccia();
      for(const r of u.righe){ if(!aggiungi(r)) return caricaTraccia(); }
      totale = u.totale;
      revisione = u.revisione;
      errore = null;
      avvisa();
    }).catch(function(e){ errore = e.message; avvisa(); })
      .then(function(){ inCorso = null; });
    return inCorso;
  }

  function start(){
    if(pollId) return;
    if(!filtro) azzera();
    caricaTraccia().catch(function(e){ errore = e.message; avvisa(); });
    pollId = setInterval(aggiorna, POLL_MS);
  }
  function stop(){ if(pollId){ clearInterval(pollId); pollId = null; } }

  return {
    start:start, stop:stop,
    onUpdate:function(fn){ ascoltatori.push(fn); },
    /* i punti buoni, in ordine: {t, lat, lon, alt, vz, sats, fix} */
    punti:function(){ return filtro ? filtro.buoni : []; },
    /* stato:  "attesa" (niente ancora), "ok", "perso" (niente di buono da un minuto)
       fase:   attesa / salita / caduta / paracadute / atterrata (fasi.js)
       errore: il file non si legge (rete), o null */
    stato:function(adessoMs){
      if(!filtro) return {stato:"attesa", fase:null, errore:errore, ultimoPacchettoMs:null};
      return {stato:F.statoFiltro(filtro, adessoMs), fase:F.fase(fasi, adessoMs), errore:errore,
        ultimoPacchettoMs:ultimoPacchettoMs, scoppio:fasi.scoppio};
    }
  };
})();
