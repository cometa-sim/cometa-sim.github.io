/* ============================================================
   COMETA — il profilo di quota della Diretta, dai dati LoRa.

   Un grafico solo: la quota (km) nel tempo (ora di Montevideo), con i
   punti buoni che assets/lora.js passa ad assets/spot.js. Una sola
   serie, quindi niente legenda: il titolo, in index.html, dice cos'e'.
   Linea sottile, griglia leggera, un'etichetta sola (la quota massima),
   e un mirino con il valore sotto il dito o il mouse. SVG scritto a
   mano: il sito non usa librerie da una CDN.
   ============================================================ */
window.COMETA_PROFILO = (function(){
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const TZ = "America/Montevideo";
  const ALTO = 200, M = {l:40, r:14, t:16, b:26};

  function el(nome, attr, padre){
    const e = document.createElementNS(NS, nome);
    Object.keys(attr || {}).forEach(function(k){ e.setAttribute(k, attr[k]); });
    if(padre) padre.appendChild(e);
    return e;
  }
  function ora(ms){
    return new Intl.DateTimeFormat("en-GB", {timeZone:TZ, hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).format(ms);
  }
  /* Passo "tondo" per le tacche: 1, 2, 5 × 10^n. */
  function passo(span, n){
    const grezzo = span / n, p = Math.pow(10, Math.floor(Math.log10(grezzo)));
    const f = grezzo / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }

  /* contenitore: l'elemento dove disegnare; punti: [{t, alt}] in ordine;
     testi: {vuoto, km}; colore: della linea. */
  function crea(contenitore, colore){
    let punti = [], testi = {vuoto:"…", km:"km"};
    const svg = el("svg", {class:"prof-svg", role:"img"});
    const tip = document.createElement("div");
    tip.className = "prof-tip"; tip.hidden = true;
    contenitore.appendChild(svg);
    contenitore.appendChild(tip);

    let scala = null;
    function disegna(){
      while(svg.firstChild) svg.removeChild(svg.firstChild);
      const W = Math.max(260, contenitore.clientWidth || 600);
      svg.setAttribute("viewBox", "0 0 " + W + " " + ALTO);
      svg.setAttribute("width", W); svg.setAttribute("height", ALTO);
      const q = punti.filter(function(p){ return p.alt !== null; });
      if(q.length < 2){
        const t = el("text", {x:W/2, y:ALTO/2, "text-anchor":"middle", class:"prof-vuoto"}, svg);
        t.textContent = testi.vuoto;
        svg.setAttribute("aria-label", testi.vuoto);
        scala = null;
        return;
      }
      const t0 = q[0].t, t1 = Math.max(q[q.length - 1].t, t0 + 60000);
      const maxKm = Math.max(1, Math.max.apply(null, q.map(function(p){ return p.alt; })) / 1000);
      const yTop = Math.ceil(maxKm * 1.1 / passo(maxKm, 4)) * passo(maxKm, 4);
      const X = function(t){ return M.l + (t - t0) / (t1 - t0) * (W - M.l - M.r); };
      const Y = function(km){ return ALTO - M.b - Math.max(km, 0) / yTop * (ALTO - M.t - M.b); };
      scala = {X:X, Y:Y, q:q, W:W};

      /* griglia e assi: recessivi */
      const sy = passo(yTop, 4);
      for(let v = 0; v <= yTop + 1e-9; v += sy){
        el("line", {x1:M.l, x2:W - M.r, y1:Y(v), y2:Y(v), class:"prof-griglia"}, svg);
        const t = el("text", {x:M.l - 6, y:Y(v) + 3.5, "text-anchor":"end", class:"prof-asse"}, svg);
        t.textContent = (Math.round(v * 10) / 10) + (v + sy > yTop + 1e-9 ? " " + testi.km : "");
      }
      const sx = [5, 10, 15, 30, 60, 120].map(function(m){ return m * 60000; })
        .find(function(s){ return (t1 - t0) / s <= Math.max(2, Math.floor((W - M.l - M.r) / 70)); }) || 7200000;
      for(let t = Math.ceil(t0 / sx) * sx; t <= t1; t += sx){
        const x = X(t);
        el("line", {x1:x, x2:x, y1:ALTO - M.b, y2:ALTO - M.b + 4, class:"prof-tacca"}, svg);
        const tt = el("text", {x:x, y:ALTO - 8, "text-anchor":"middle", class:"prof-asse"}, svg);
        tt.textContent = ora(t);
      }

      /* la quota: una linea di 2 px, spezzata dove mancano dati per piu'
         di 2 minuti (non si inventa il tratto che non si e' visto) */
      let d = "";
      q.forEach(function(p, i){
        const salto = i === 0 || p.t - q[i - 1].t > 120000;
        d += (salto ? "M" : "L") + X(p.t).toFixed(1) + " " + Y(p.alt / 1000).toFixed(1);
      });
      el("path", {d:d, fill:"none", stroke:colore, "stroke-width":2, "stroke-linejoin":"round", "stroke-linecap":"round"}, svg);

      /* un'etichetta sola: la quota massima */
      let iMax = 0;
      q.forEach(function(p, i){ if(p.alt > q[iMax].alt) iMax = i; });
      const pm = q[iMax], xm = X(pm.t), ym = Y(pm.alt / 1000);
      if(iMax < q.length - 1){
        el("circle", {cx:xm, cy:ym, r:3, fill:colore, class:"prof-anello"}, svg);
        const lab = el("text", {x:Math.min(Math.max(xm, M.l + 30), W - M.r - 30), y:ym - 7, "text-anchor":"middle", class:"prof-etichetta"}, svg);
        lab.textContent = (pm.alt / 1000).toFixed(1) + " " + testi.km;
      }
      /* l'ultimo punto, piu' grande, con l'anello del colore di fondo */
      const pu = q[q.length - 1];
      el("circle", {cx:X(pu.t), cy:Y(pu.alt / 1000), r:4.5, fill:colore, class:"prof-anello"}, svg);
      svg.setAttribute("aria-label", testi.km + ": " + (pu.alt / 1000).toFixed(1) + " (" + ora(pu.t) + ")");

      mirino = el("line", {y1:M.t, y2:ALTO - M.b, class:"prof-mirino", visibility:"hidden"}, svg);
      puntino = el("circle", {r:5, fill:colore, class:"prof-anello", visibility:"hidden"}, svg);
    }

    /* Il mirino: il punto piu' vicino in orizzontale al dito o al mouse. */
    let mirino = null, puntino = null;
    function muovi(ev){
      if(!scala || !mirino) return;
      const r = svg.getBoundingClientRect();
      const x = (ev.clientX - r.left) * scala.W / r.width;
      let best = scala.q[0];
      scala.q.forEach(function(p){ if(Math.abs(scala.X(p.t) - x) < Math.abs(scala.X(best.t) - x)) best = p; });
      const bx = scala.X(best.t), by = scala.Y(best.alt / 1000);
      mirino.setAttribute("x1", bx); mirino.setAttribute("x2", bx); mirino.setAttribute("visibility", "visible");
      puntino.setAttribute("cx", bx); puntino.setAttribute("cy", by); puntino.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.textContent = ora(best.t) + " · " + (best.alt / 1000).toFixed(2) + " " + testi.km;
      const sinistra = bx * r.width / scala.W;
      tip.style.left = Math.min(Math.max(sinistra, 60), r.width - 60) + "px";
    }
    function esci(){
      if(mirino){ mirino.setAttribute("visibility", "hidden"); puntino.setAttribute("visibility", "hidden"); }
      tip.hidden = true;
    }
    svg.addEventListener("pointermove", muovi);
    svg.addEventListener("pointerdown", muovi);
    svg.addEventListener("pointerleave", esci);
    if("ResizeObserver" in window) new ResizeObserver(function(){ disegna(); }).observe(contenitore);

    return {
      aggiorna:function(p, t){ punti = p || []; if(t) testi = t; disegna(); }
    };
  }

  return {crea:crea};
})();
