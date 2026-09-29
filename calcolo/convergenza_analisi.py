#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COMETA - analisi della convergenza delle previsioni di Tawhiri
==============================================================
Legge il CSV di convergenza_raccolta.py (branch `dati`). L'anticipo di una
previsione e' l'eta' della corsa GFS su cui e' fatta:

    tau_h = bersaglio - dataset   [ore]

raggruppato a passo di 24 h: tau = 0 per tau_h in [0, 24), 1 per [24, 48)...
Cosi' non conta a che ora e' partito il workflow (le schedule di GitHub
arrivano con ore di ritardo) ne' quale corsa GFS ha trovato. Le previsioni
fatte su una corsa successiva al lancio (tau_h < 0) si scartano.

Per ogni bersaglio T il riferimento e' la previsione con tau = 0, e

    e(tau) = distanza fra il punto d'atterraggio previsto con anticipo tau
             e quello di riferimento

per tutti i bersagli T che hanno il riferimento. Stampa mediana e quartili
di e(tau), il numero di campioni e l'eta' mediana delle corse in ogni classe.

e(tau) misura la CONVERGENZA della previsione, non il suo errore: il
riferimento e' anch'esso una previsione, non la verita'. E' quindi un limite
inferiore dell'errore vero, ed e(0) e' zero per costruzione.

Se per lo stesso bersaglio e la stessa classe ci sono piu' righe vale quella
con il dataset piu' recente.

Con --calendario l'anticipo e' invece la colonna lead_giorni (giorni di
calendario fra emissione e bersaglio), il criterio della prima versione.

Uso:  git fetch origin dati && git show origin/dati:convergenza.csv > convergenza.csv
      python3 calcolo/convergenza_analisi.py convergenza.csv [--out tabella.csv]
"""
import argparse, csv, math, statistics, sys
from datetime import datetime

NOTA = ("e(tau) misura la CONVERGENZA della previsione, non l'errore: il riferimento "
        "(la previsione con anticipo 0) non e' la verita'.\n"
        "E' un limite inferiore dell'errore vero; e(0) e' zero per costruzione.")


def dist_km(la1, lo1, la2, lo2):
    """Distanza sul cerchio massimo [km] (haversine)."""
    R = 6371.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = p2 - p1, math.radians(lo2 - lo1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))


def _t(s): return datetime.fromisoformat(s.replace("Z", "+00:00"))


def eta_h(r):
    """Eta' della corsa GFS all'istante del lancio [h]."""
    return (_t(r["bersaglio"]) - _t(r["dataset"])).total_seconds()/3600


def quartili(v):
    """(Q1, mediana, Q3); con un solo campione tutti e tre coincidono."""
    if len(v) == 1: return v[0], v[0], v[0]
    q1, q2, q3 = statistics.quantiles(v, n=4, method="inclusive")
    return q1, q2, q3


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("csv", nargs="?", default="convergenza.csv")
    ap.add_argument("--out", help="salva anche la tabella in CSV")
    ap.add_argument("--calendario", action="store_true",
                    help="anticipo = lead_giorni (giorni fra emissione e bersaglio)")
    a = ap.parse_args()

    # (bersaglio, tau) -> la riga con il dataset piu' recente
    prev, scartate = {}, 0
    with open(a.csv, newline="") as f:
        for r in csv.DictReader(f):
            if a.calendario:
                tau = int(r["lead_giorni"])
            else:
                h = eta_h(r)
                if h < 0: scartate += 1; continue      # corsa successiva al lancio
                tau = int(h//24)
            k = (r["bersaglio"], tau)
            if k not in prev or r["dataset"] > prev[k]["dataset"]:
                prev[k] = r

    rif = {b: r for (b, tau), r in prev.items() if tau == 0}
    err, eta = {}, {}
    for (b, tau), r in prev.items():
        if b not in rif: continue                 # bersaglio senza riferimento
        r0 = rif[b]
        e = dist_km(float(r["lat"]), float(r["lon"]), float(r0["lat"]), float(r0["lon"]))
        err.setdefault(tau, []).append(e)
        eta.setdefault(tau, []).append(eta_h(r))

    senza = len({b for b, _ in prev} - set(rif))
    print("Anticipo: " + ("giorni di calendario fra emissione e bersaglio" if a.calendario
                          else "eta' della corsa GFS al lancio, a passo di 24 h"))
    if scartate: print(f"Righe su corse successive al lancio: {scartate}, escluse")
    print(f"Bersagli con riferimento: {len(rif)} (senza: {senza}, esclusi)\n")
    righe = []
    print(f"{'tau [g]':>7} {'n':>4} {'eta [h]':>8} {'Q1 [km]':>8} {'mediana':>8} {'Q3 [km]':>8}")
    for tau in sorted(err):
        q1, me, q3 = quartili(sorted(err[tau]))
        eh = statistics.median(eta[tau])
        righe.append({"tau_giorni": tau, "n": len(err[tau]), "eta_mediana_h": f"{eh:.0f}",
                      "q1_km": f"{q1:.1f}", "mediana_km": f"{me:.1f}", "q3_km": f"{q3:.1f}"})
        print(f"{tau:>7} {len(err[tau]):>4} {eh:>8.0f} {q1:>8.1f} {me:>8.1f} {q3:>8.1f}")
    print("\n" + NOTA)

    if a.out:
        with open(a.out, "w", newline="") as f:
            f.write("# " + NOTA.replace("\n", "\n# ") + "\n")
            w = csv.DictWriter(f, fieldnames=["tau_giorni", "n", "eta_mediana_h", "q1_km", "mediana_km", "q3_km"],
                               lineterminator="\n")
            w.writeheader(); w.writerows(righe)
        print(f"\nTabella salvata in {a.out}")


if __name__ == "__main__":
    sys.exit(main())
