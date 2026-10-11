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

per tutti i bersagli T che hanno il riferimento. Stampa mediana, quartili e
scarto quadratico medio (RMS) di e(tau), il numero di campioni e l'eta'
mediana delle corse in ogni classe.

e(tau) misura la CONVERGENZA della previsione, non il suo errore: il
riferimento e' anch'esso una previsione, non la verita'. Con X il punto vero,

    P_tau - X = (P_tau - P_0) + (P_0 - X)

e se l'aggiornamento della previsione (primo termine) e' scorrelato
dall'errore del riferimento (secondo termine), in media quadratica

    RMS_vero(tau)^2 = RMS_e(tau)^2 + RMS_vero(0)^2  >=  RMS_e(tau)^2.

La scorrelazione e' esatta per una previsione ottimale (le previsioni
successive sono una martingala, i loro incrementi sono ortogonali); per il
GFS reale vale solo in modo approssimato. Il limite inferiore vale quindi
per l'RMS e sotto questa ipotesi, non per il singolo volo e non per mediane
e quartili. e(0) e' zero per costruzione.

Se per lo stesso bersaglio e la stessa classe ci sono piu' righe vale quella
con il dataset piu' recente.

Con --calendario l'anticipo e' invece la colonna lead_giorni (giorni di
calendario fra emissione e bersaglio), il criterio della prima versione.

Piu' siti (un CSV ciascuno, dal 12/10/2026): con le colonne durata_min e
percorso_km la tabella riporta anche l'RMS di e/T, l'errore di vento
efficace in m/s, e la mediana di e/L, l'errore relativo al percorso, con T
ed L del volo di riferimento. Con piu' file si stampa anche il confronto fra
i siti: se le curve di e/T coincidono, la scala con la durata del volo regge
e la curva si puo' trasferire; se coincidono quelle di e/L, l'errore e'
relativo.

Uso:  git fetch origin dati && git archive origin/dati | tar -x -C dati/
      python3 calcolo/convergenza_analisi.py dati/convergenza.csv [--out tabella.csv]
      python3 calcolo/convergenza_analisi.py dati/convergenza*.csv
"""
import argparse, csv, math, os, statistics, sys
from datetime import datetime

NOTA = ("e(tau) misura la CONVERGENZA della previsione, non l'errore: il riferimento "
        "(la previsione con anticipo 0) non e' la verita'.\n"
        "Non e' un limite per il singolo volo. Se l'aggiornamento della previsione e' scorrelato "
        "dall'errore del riferimento,\n"
        "l'errore vero in media quadratica e' almeno l'RMS di e(tau). e(0) e' zero per costruzione.")


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


def _num(x):
    try: return float(x)
    except (TypeError, ValueError): return None


def analizza(path, calendario=False):
    """Statistiche di e(tau) per un CSV: {tau: dict}, piu' i conteggi."""
    # (bersaglio, tau) -> la riga con il dataset piu' recente
    prev, scartate = {}, 0
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            if calendario:
                tau = int(r["lead_giorni"])
            else:
                h = eta_h(r)
                if h < 0: scartate += 1; continue      # corsa successiva al lancio
                tau = int(h//24)
            k = (r["bersaglio"], tau)
            if k not in prev or r["dataset"] > prev[k]["dataset"]:
                prev[k] = r

    rif = {b: r for (b, tau), r in prev.items() if tau == 0}
    err, eta, ev, el = {}, {}, {}, {}
    for (b, tau), r in prev.items():
        if b not in rif: continue                 # bersaglio senza riferimento
        r0 = rif[b]
        e = dist_km(float(r["lat"]), float(r["lon"]), float(r0["lat"]), float(r0["lon"]))
        err.setdefault(tau, []).append(e)
        eta.setdefault(tau, []).append(eta_h(r))
        # normalizzazioni sul volo di riferimento, se il CSV le ha (dal 12/10/2026)
        T, L = _num(r0.get("durata_min")), _num(r0.get("percorso_km"))
        if T: ev.setdefault(tau, []).append(e*1000/(T*60))          # m/s
        if L: el.setdefault(tau, []).append(e/L)

    stat = {}
    for tau in sorted(err):
        v = sorted(err[tau]); q1, me, q3 = quartili(v)
        x = {"n": len(v), "eta": statistics.median(eta[tau]), "q1": q1, "me": me, "q3": q3,
             "rms": math.sqrt(sum(e*e for e in v)/len(v))}
        if ev.get(tau): x["sv"] = math.sqrt(sum(e*e for e in ev[tau])/len(ev[tau])); x["nv"] = len(ev[tau])
        if el.get(tau): x["rel"] = statistics.median(el[tau])
        stat[tau] = x
    senza = len({b for b, _ in prev} - set(rif))
    return stat, len(rif), senza, scartate


def stampa(path, stat, nrif, senza, scartate, calendario):
    print(f"== {path}")
    print("Anticipo: " + ("giorni di calendario fra emissione e bersaglio" if calendario
                          else "eta' della corsa GFS al lancio, a passo di 24 h"))
    if scartate: print(f"Righe su corse successive al lancio: {scartate}, escluse")
    print(f"Bersagli con riferimento: {nrif} (senza: {senza}, esclusi)\n")
    norm = any("sv" in x for x in stat.values())
    print(f"{'tau [g]':>7} {'n':>4} {'eta [h]':>8} {'Q1 [km]':>8} {'mediana':>8} {'Q3 [km]':>8} {'RMS [km]':>9}"
          + (f" {'RMS e/T [m/s]':>14} {'med e/L [%]':>12}" if norm else ""))
    for tau, x in stat.items():
        riga = f"{tau:>7} {x['n']:>4} {x['eta']:>8.0f} {x['q1']:>8.1f} {x['me']:>8.1f} {x['q3']:>8.1f} {x['rms']:>9.1f}"
        if norm:
            riga += (f" {x['sv']:>9.2f} n={x['nv']:<3}" if "sv" in x else f" {'':>14}")
            riga += (f" {100*x['rel']:>12.1f}" if "rel" in x else "")
        print(riga)
    print()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("csv", nargs="*", default=["convergenza.csv"],
                    help="uno o piu' CSV (uno per sito); con piu' file, anche il confronto")
    ap.add_argument("--out", help="salva anche la tabella in CSV (con un solo file)")
    ap.add_argument("--calendario", action="store_true",
                    help="anticipo = lead_giorni (giorni fra emissione e bersaglio)")
    a = ap.parse_args()

    tutti = {}
    for path in a.csv:
        stat, nrif, senza, scartate = analizza(path, a.calendario)
        stampa(path, stat, nrif, senza, scartate, a.calendario)
        tutti[path] = stat

    if len(tutti) > 1:
        # confronto: RMS di e/T (errore di vento efficace) per sito e anticipo;
        # se le curve coincidono, la scala con la durata del volo regge
        taus = sorted({t for s in tutti.values() for t in s if t > 0})
        nomi = {p: os.path.basename(p).replace("convergenza_", "").replace("convergenza", "mercedes")
                    .replace(".csv", "") for p in tutti}
        for chiave, titolo, fmt in (("sv", "RMS di e/T [m/s]", "{:.2f}"), ("rel", "mediana di e/L [%]", None)):
            print(f"Confronto fra i siti: {titolo} (fra parentesi i campioni)")
            print(f"{'sito':<16}" + "".join(f"{'tau=' + str(t):>12}" for t in taus))
            for p, s in tutti.items():
                celle = []
                for t in taus:
                    x = s.get(t, {})
                    if chiave not in x: celle.append(f"{'—':>12}"); continue
                    v = x[chiave] if fmt else 100*x[chiave]
                    celle.append(f"{v:>6.2f} ({x.get('nv', x['n']):>2})".rjust(12))
                print(f"{nomi[p]:<16}" + "".join(celle))
            print()
    print(NOTA)

    if a.out and len(tutti) == 1:
        stat = next(iter(tutti.values()))
        with open(a.out, "w", newline="") as f:
            f.write("# " + NOTA.replace("\n", "\n# ") + "\n")
            w = csv.DictWriter(f, fieldnames=["tau_giorni", "n", "eta_mediana_h", "q1_km", "mediana_km",
                                              "q3_km", "rms_km", "rms_e_su_T_ms", "mediana_e_su_L"],
                               lineterminator="\n")
            w.writeheader()
            for tau, x in stat.items():
                w.writerow({"tau_giorni": tau, "n": x["n"], "eta_mediana_h": f"{x['eta']:.0f}",
                            "q1_km": f"{x['q1']:.1f}", "mediana_km": f"{x['me']:.1f}", "q3_km": f"{x['q3']:.1f}",
                            "rms_km": f"{x['rms']:.1f}",
                            "rms_e_su_T_ms": f"{x['sv']:.2f}" if "sv" in x else "",
                            "mediana_e_su_L": f"{x['rel']:.4f}" if "rel" in x else ""})
        print(f"\nTabella salvata in {a.out}")


if __name__ == "__main__":
    sys.exit(main())
