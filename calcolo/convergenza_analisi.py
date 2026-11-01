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
      python3 calcolo/convergenza_analisi.py dati/convergenza.csv --json curva.json
      python3 calcolo/convergenza_analisi.py dati/convergenza_lacalera.csv --passo 6
"""
import argparse, csv, json, math, os, statistics, sys
from datetime import datetime, timezone

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


def analizza(path, calendario=False, passo=24):
    """Statistiche di e(tau) per un CSV: {tau: dict}, piu' i conteggi.

    passo: ampiezza delle classi di anticipo [h]. Con 24 (il default) il
    riferimento e' la classe 0, eta' in [0, 24). Con un passo piu' corto
    (6: una classe per corsa GFS, per i siti raccolti a ogni corsa) il
    riferimento di ogni bersaglio e' la corsa piu' recente prima del lancio,
    se ha meno di 24 h, e prende l'etichetta 0; le altre righe vanno nella
    classe floor(eta'/passo)."""
    # (bersaglio, tau) -> la riga con il dataset piu' recente
    prev, scartate, righe = {}, 0, {}
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            if calendario:
                tau = int(r["lead_giorni"])
            else:
                h = eta_h(r)
                if h < 0: scartate += 1; continue      # corsa successiva al lancio
                if passo < 24:
                    righe.setdefault(r["bersaglio"], []).append(r); continue
                tau = int(h//24)
            k = (r["bersaglio"], tau)
            if k not in prev or r["dataset"] > prev[k]["dataset"]:
                prev[k] = r
    for b, rr in righe.items():                        # solo con passo < 24
        rr.sort(key=eta_h)
        if eta_h(rr[0]) < 24: prev[(b, 0)] = rr[0]; rr = rr[1:]
        for r in rr:
            k = (b, max(1, int(eta_h(r)//passo)))
            if k not in prev or r["dataset"] > prev[k]["dataset"]:
                prev[k] = r

    rif = {b: r for (b, tau), r in prev.items() if tau == 0}
    durate = [d for d in (_num(r.get("durata_min")) for r in rif.values()) if d]
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
    stat_durata = statistics.median(durate) if durate else None
    return stat, len(rif), senza, scartate, stat_durata


def ritardo_gfs(paths):
    """Ritardo con cui le corse GFS arrivano in Tawhiri [h], misurato dai giri.

    Ogni giro (un'emissione) ha trovato una corsa d: d era disponibile entro
    l'emissione e (limite superiore e - d) e la corsa successiva, d + 6 h, non
    ancora (limite inferiore e - d - 6). Restituisce (min, max): il piu'
    grande dei limiti inferiori e il piu' piccolo dei superiori."""
    giri = {}
    for path in paths:
        with open(path, newline="") as f:
            for r in csv.DictReader(f):
                e, d = _t(r["emissione"]).replace(second=0), _t(r["dataset"])
                if e not in giri or d > giri[e]: giri[e] = d
    if not giri: return None
    su = min((e - d).total_seconds()/3600 for e, d in giri.items())
    giu = max((e - d).total_seconds()/3600 - 6 for e, d in giri.items())
    return (round(max(0.0, giu), 2), round(su, 2)) if giu <= su else None


def stampa(path, stat, nrif, senza, scartate, calendario, passo=24):
    print(f"== {path}")
    print("Anticipo: " + ("giorni di calendario fra emissione e bersaglio" if calendario
                          else f"eta' della corsa GFS al lancio, a passo di {passo} h"))
    if scartate: print(f"Righe su corse successive al lancio: {scartate}, escluse")
    print(f"Bersagli con riferimento: {nrif} (senza: {senza}, esclusi)\n")
    norm = any("sv" in x for x in stat.values())
    print(f"{'tau [g]' if passo >= 24 else 'cl.' + str(passo) + 'h':>7} {'n':>4} {'eta [h]':>8} {'Q1 [km]':>8} {'mediana':>8} {'Q3 [km]':>8} {'RMS [km]':>9}"
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
    ap.add_argument("--json", help="salva la curva per la pagina La traiettoria (con un solo file)")
    ap.add_argument("--disponibilita", nargs="*", default=[],
                    help="con --json: i CSV da cui misurare il ritardo con cui le corse GFS "
                         "arrivano in Tawhiri (tutti i siti: piu' giri, misura piu' stretta)")
    ap.add_argument("--passo", type=int, default=24,
                    help="ampiezza delle classi di anticipo in ore (6: una per corsa GFS)")
    ap.add_argument("--nome", default="Mercedes (Uruguay)", help="il sito, nel JSON")
    ap.add_argument("--copertura-h", type=float, default=0,
                    help="con --min-n: le classi con abbastanza campioni devono arrivare almeno a "
                         "quest'eta' della corsa [h], altrimenti la curva non copre la settimana")
    ap.add_argument("--min-n", type=int, default=0,
                    help="con --json: se meno di 3 classi hanno almeno questi campioni, "
                         "non scrive il file ed esce con 3 (il workflow ripiega su un altro sito)")
    a = ap.parse_args()

    tutti, durata = {}, None
    for path in a.csv:
        stat, nrif, senza, scartate, durata = analizza(path, a.calendario, a.passo)
        stampa(path, stat, nrif, senza, scartate, a.calendario, a.passo)
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

    if a.json and len(tutti) == 1:
        # la curva che legge assets/traiettoria.js: eta' mediana e quartili per
        # classe; la pagina interpola Q3 sull'eta' della corsa e lo scala con
        # la durata del volo (durata_ref_min e' quella del volo misurato)
        stat = next(iter(tutti.values()))
        piene = [x for x in stat.values() if x["n"] >= a.min_n] if a.min_n else list(stat.values())
        if a.min_n and (len(piene) < 3 or max(x["eta"] for x in piene) < a.copertura_h):
            print(f"\nCurva non scritta: le classi con almeno {a.min_n} campioni sono {len(piene)}"
                  + (f" e arrivano a {max(x['eta'] for x in piene):.0f} h" if piene else "")
                  + (f", ne servono fino a {a.copertura_h:.0f} h" if a.copertura_h else ""))
            return 3
        out = {"aggiornato": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "sito": a.nome, "passo_h": a.passo, "durata_ref_min": round(durata or 176.0, 1),
               "ritardo_gfs_h": ritardo_gfs(a.disponibilita or a.csv),
               "classi": [{"tau": tau, "n": x["n"], "eta_h": round(x["eta"], 1),
                           "q1_km": round(x["q1"], 2), "mediana_km": round(x["me"], 2),
                           "q3_km": round(x["q3"], 2), "rms_km": round(x["rms"], 2)}
                          for tau, x in stat.items()]}
        with open(a.json, "w") as f: json.dump(out, f, indent=1)
        print(f"\nCurva salvata in {a.json}")

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
