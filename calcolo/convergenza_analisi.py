#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COMETA - analisi della convergenza delle previsioni di Tawhiri
==============================================================
Legge il CSV di convergenza_raccolta.py (branch `dati`) e per ogni anticipo
tau (lead_giorni) calcola

    e(tau) = distanza fra il punto d'atterraggio previsto a T-tau
             e quello previsto il giorno T stesso (il riferimento)

per tutti i bersagli T che hanno il riferimento. Stampa mediana e quartili
di e(tau) e il numero di campioni per ciascun anticipo.

e(tau) misura la CONVERGENZA della previsione, non il suo errore: il
riferimento e' anch'esso una previsione, non la verita'. E' quindi un limite
inferiore dell'errore vero, ed e(0) e' zero per costruzione.

Se per lo stesso bersaglio e lo stesso anticipo ci sono piu' righe (run
lanciati a mano nello stesso giorno su corse GFS diverse) vale quella con
il dataset piu' recente.

Uso:  git fetch origin dati && git show origin/dati:convergenza.csv > convergenza.csv
      python3 calcolo/convergenza_analisi.py convergenza.csv [--out tabella.csv]
"""
import argparse, csv, math, statistics, sys

NOTA = ("e(tau) misura la CONVERGENZA della previsione, non l'errore: il riferimento "
        "(la previsione del giorno stesso) non e' la verita'.\n"
        "E' un limite inferiore dell'errore vero; e(0) e' zero per costruzione.")


def dist_km(la1, lo1, la2, lo2):
    """Distanza sul cerchio massimo [km] (haversine)."""
    R = 6371.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = p2 - p1, math.radians(lo2 - lo1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))


def quartili(v):
    """(Q1, mediana, Q3); con un solo campione tutti e tre coincidono."""
    if len(v) == 1: return v[0], v[0], v[0]
    q1, q2, q3 = statistics.quantiles(v, n=4, method="inclusive")
    return q1, q2, q3


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("csv", nargs="?", default="convergenza.csv")
    ap.add_argument("--out", help="salva anche la tabella in CSV")
    a = ap.parse_args()

    # (bersaglio, lead) -> la riga con il dataset piu' recente
    prev = {}
    with open(a.csv, newline="") as f:
        for r in csv.DictReader(f):
            k = (r["bersaglio"], int(r["lead_giorni"]))
            if k not in prev or r["dataset"] > prev[k]["dataset"]:
                prev[k] = r

    rif = {b: r for (b, lead), r in prev.items() if lead == 0}
    err = {}
    for (b, lead), r in prev.items():
        if b not in rif: continue                 # bersaglio senza previsione del giorno stesso
        r0 = rif[b]
        e = dist_km(float(r["lat"]), float(r["lon"]), float(r0["lat"]), float(r0["lon"]))
        err.setdefault(lead, []).append(e)

    senza = len({b for b, _ in prev} - set(rif))
    print(f"Bersagli con riferimento: {len(rif)} (senza: {senza}, esclusi)\n")
    righe = []
    print(f"{'tau [g]':>7} {'n':>4} {'Q1 [km]':>8} {'mediana':>8} {'Q3 [km]':>8}")
    for lead in sorted(err):
        q1, me, q3 = quartili(sorted(err[lead]))
        righe.append({"lead_giorni": lead, "n": len(err[lead]),
                      "q1_km": f"{q1:.1f}", "mediana_km": f"{me:.1f}", "q3_km": f"{q3:.1f}"})
        print(f"{lead:>7} {len(err[lead]):>4} {q1:>8.1f} {me:>8.1f} {q3:>8.1f}")
    print("\n" + NOTA)

    if a.out:
        with open(a.out, "w", newline="") as f:
            f.write("# " + NOTA.replace("\n", "\n# ") + "\n")
            w = csv.DictWriter(f, fieldnames=["lead_giorni", "n", "q1_km", "mediana_km", "q3_km"],
                               lineterminator="\n")
            w.writeheader(); w.writerows(righe)
        print(f"\nTabella salvata in {a.out}")


if __name__ == "__main__":
    sys.exit(main())
