#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COMETA - raccolta della convergenza delle previsioni di Tawhiri
===============================================================
Lo lancia una volta al giorno il workflow .github/workflows/convergenza.yml.
Per ogni sito e ogni giorno-bersaglio T da oggi a oggi+7 (la corsa GFS arriva
a 192 h) chiede a Tawhiri il volo previsto e aggiunge al CSV del sito:

    dataset, emissione, bersaglio, lead_giorni, lat, lon,
    durata_min, percorso_km, deriva_km

dataset     la corsa GFS che Tawhiri dichiara nella risposta (request.dataset)
emissione   quando e' stata fatta la chiamata, UTC
bersaglio   l'istante di lancio previsto, UTC
lead_giorni giorni fra la data dell'emissione in Uruguay e quella del bersaglio
lat, lon    punto di atterraggio, lon in [-180, 180)
durata_min  durata del volo previsto
percorso_km lunghezza della traiettoria al suolo (somma dei tratti)
deriva_km   distanza fra partenza e atterraggio

Le ultime tre servono a confrontare i siti: e/T (errore di vento efficace)
ed e/L (errore relativo al percorso). Le righe raccolte prima che esistessero
restano con quei campi vuoti.

Una riga con la stessa coppia (dataset, bersaglio) di una gia' presente si
scarta: se il giro ricade sulla corsa GFS del giorno prima non aggiunge
nulla, e un giro perso costa solo un campione.

I siti
------
mercedes     il volo proposto dalla pagina La traiettoria: aerodromo di
             Mercedes, Strato 2000, payload 1,5 kg, salita 5 m/s, paracadute
             del kit. File convergenza.csv, raccolto dal 26/9/2026.
Gli altri servono a capire se la curva si puo' trasferire: stesso pallone
(salvo mercedes_22km) e partenza alle 11 locali.
durazno, rivera, rocha   altri punti dell'Uruguay (centro, nord, sud-est)
comodoro     Patagonia: correnti occidentali forti
cuiaba       Mato Grosso, tropici: venti deboli
bologna      medie latitudini dell'emisfero nord, in un'altra stagione
mercedes_22km  come mercedes ma scoppio a 22 km: profilo diverso, per
             verificare la scala con la durata del volo
lacalera     il sito del lancio: aerodromo La Calera (SUCL) vicino a Minas,
             consigliato dalla DINACIA perche' e' quello con meno traffico
             aereo. Dal 24/10/2026 si raccoglie a ogni corsa GFS (il
             workflow gira quattro volte al giorno, `--sito lacalera`), per
             misurare la curva a passo di 6 h; la pagina usa questa curva
             appena ha abbastanza campioni.

Quota di scoppio e discesa sono FISSE (atmosfera ISA, stesso modello di
cometa_venti.py), non quelle dell'atmosfera del giorno: cosi' fra una
previsione e l'altra cambia solo il vento. Se si cambiano i parametri di un
sito le righe vecchie non sono piu' confrontabili: meglio un sito nuovo.

Uso:  python3 calcolo/convergenza_raccolta.py --dir DIR          (tutti i siti)
      python3 calcolo/convergenza_raccolta.py --dir DIR --sito rocha
Test: python3 calcolo/convergenza_raccolta.py --dir /tmp/prova --mock
"""
import argparse, csv, os, sys, time
from datetime import datetime, time as dtime, timedelta, timezone
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cometa_venti as cv          # solo libreria standard all'importazione

PALLONE = cv.PRESET["2000"]
PAYLOAD = 1.5                                         # kg
VSALITA = 5.0                                         # m/s
ORA_LANCIO = dtime(11, 0)                             # ora locale del sito
GIORNI = 7                                            # da oggi a oggi+7: otto chiamate per sito

# id: (nome, lat, lon, fuso, quota di scoppio [m] o None = modello del pallone)
SITI = {
    "mercedes":      ("Mercedes aerodromo", -33.2486, -58.0736, "America/Montevideo", None),
    "durazno":       ("Durazno",            -33.380,  -56.520,  "America/Montevideo", None),
    "rivera":        ("Rivera",             -30.905,  -55.551,  "America/Montevideo", None),
    "rocha":         ("Rocha",              -34.483,  -54.333,  "America/Montevideo", None),
    "comodoro":      ("Comodoro Rivadavia", -45.864,  -67.497,  "America/Argentina/Catamarca", None),
    "cuiaba":        ("Cuiaba",             -15.601,  -56.097,  "America/Cuiaba", None),
    "bologna":       ("Bologna",             44.494,   11.343,  "Europe/Rome", None),
    "mercedes_22km": ("Mercedes, scoppio 22 km", -33.2486, -58.0736, "America/Montevideo", 22000.0),
    # SUCL, punto di riferimento dell'aerodromo da confermare con l'AIP della DINACIA
    "lacalera":      ("La Calera (Minas)",  -34.2905, -55.3552,  "America/Montevideo", None),
}

COLONNE = ["dataset", "emissione", "bersaglio", "lead_giorni", "lat", "lon",
           "durata_min", "percorso_km", "deriva_km"]


def file_sito(sid):
    return "convergenza.csv" if sid == "mercedes" else f"convergenza_{sid}.csv"


def parametri_volo(quota=None):
    """Quota di scoppio [m] e discesa al suolo [m/s] del modello del pallone, in ISA."""
    V = cv.V_per_salita(PALLONE["massa"], PAYLOAD, VSALITA)
    burst = quota if quota else cv.quota_scoppio(V, PALLONE["diametro"])
    vdisc = cv.v_atterraggio(PAYLOAD + PALLONE["para_m"], PALLONE["para_d"], PALLONE["para_cd"])
    return burst, vdisc


def _iso(dt): return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def leggi(percorso):
    """Righe del CSV; un file con le colonne della prima versione si riscrive
    con quelle nuove (vuote nelle righe vecchie)."""
    if not os.path.exists(percorso): return []
    with open(percorso, newline="") as f:
        rd = csv.DictReader(f)
        righe, campi = list(rd), rd.fieldnames or []
    if campi != COLONNE:
        with open(percorso, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLONNE, lineterminator="\n", restval="")
            w.writeheader(); w.writerows({k: r.get(k, "") for k in COLONNE} for r in righe)
        print(f"  {percorso}: aggiunte le colonne {', '.join(c for c in COLONNE if c not in campi)}")
    return righe


def misure(punti, lat0, lon0):
    """Durata [min], percorso al suolo [km], deriva [km] di una traiettoria."""
    dur = (punti[-1][0] - punti[0][0]).total_seconds()/60
    perc = sum(cv.dist_km(a[1], a[2], b[1], b[2]) for a, b in zip(punti, punti[1:]))
    return dur, perc, cv.dist_km(lat0, lon0, punti[-1][1], punti[-1][2])


def chiedi(lat, lon, quando, burst, vdisc, mock, tentativi=3):
    """(dataset, punti); ritenta sugli errori di rete."""
    for k in range(tentativi):
        try:
            if mock:
                punti, info = cv._mock_tawhiri(argparse.Namespace(vsalita=VSALITA), lat, lon,
                                               quando, burst, vdisc)
                oggi_utc = datetime.now(timezone.utc).date()   # come se ci fosse solo la corsa 00Z
                info["dataset"] = _iso(datetime.combine(oggi_utc, dtime(0), timezone.utc))
            else:
                punti, info = cv.tawhiri(lat, lon, quando, VSALITA, burst, vdisc)
            return info["dataset"], punti
        except Exception as e:
            if k == tentativi - 1: raise
            print(f"  [!] {e}: nuovo tentativo fra {10*(k+1)} s")
            time.sleep(10*(k + 1))


def raccogli(sid, cartella, emissione, mock):
    """Gli otto bersagli di un sito; restituisce (righe nuove, errori)."""
    nome, lat0, lon0, fuso, quota = SITI[sid]
    tz = ZoneInfo(fuso)
    burst, vdisc = parametri_volo(quota)
    # la data di partenza e' quella dell'Uruguay per tutti i siti: dalle 03:00
    # UTC coincide con quella UTC, mentre a Cuiaba' (UTC-4) alle 03:37 UTC
    # sarebbe ancora il giorno prima e il bersaglio di oggi sarebbe ieri
    oggi = emissione.astimezone(cv.TZ_LANCIO).date()
    percorso = os.path.join(cartella, file_sito(sid))
    print(f"[{sid}] {nome} {lat0}, {lon0} | salita {VSALITA} m/s | scoppio {burst:.0f} m | "
          f"discesa {vdisc:.2f} m/s | ore {ORA_LANCIO:%H:%M} locali ({fuso})")
    visti = {(r["dataset"], r["bersaglio"]) for r in leggi(percorso)}
    nuove, errori = [], 0
    for lead in range(GIORNI + 1):
        g = oggi + timedelta(days=lead)
        quando = datetime.combine(g, ORA_LANCIO, tz)
        try:
            ds, punti = chiedi(lat0, lon0, quando, burst, vdisc, mock)
        except Exception as e:
            errori += 1
            print(f"  {g} (lead {lead}): errore - {e}")
            continue
        chiave = (ds, _iso(quando))
        if chiave in visti:
            print(f"  {g} (lead {lead}): dataset {ds} gia' registrato, scartata")
            continue
        visti.add(chiave)
        dur, perc, der = misure(punti, lat0, lon0)
        lat, lon = punti[-1][1], punti[-1][2]
        nuove.append({"dataset": ds, "emissione": _iso(emissione), "bersaglio": _iso(quando),
                      "lead_giorni": lead, "lat": f"{lat:.5f}", "lon": f"{lon:.5f}",
                      "durata_min": f"{dur:.1f}", "percorso_km": f"{perc:.1f}", "deriva_km": f"{der:.1f}"})
        print(f"  {g} (lead {lead}): dataset {ds} -> {lat:.4f}, {lon:.4f} | {dur:.0f} min, "
              f"percorso {perc:.0f} km, deriva {der:.0f} km")
    if nuove:
        nuovo_file = not os.path.exists(percorso)
        with open(percorso, "a", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLONNE, lineterminator="\n")
            if nuovo_file: w.writeheader()
            w.writerows(nuove)
    print(f"  {len(nuove)} righe nuove, {errori} errori su {GIORNI + 1} chiamate")
    return len(nuove), errori


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--dir", default=".", help="cartella dei CSV (il branch dati)")
    ap.add_argument("--sito", choices=sorted(SITI), action="append",
                    help="solo questi siti (ripetibile); senza, tutti")
    ap.add_argument("--mock", action="store_true", help="risposte finte, senza rete")
    a = ap.parse_args()

    emissione = datetime.now(timezone.utc).replace(microsecond=0)
    siti = a.sito or list(SITI)
    tot_n = tot_e = 0
    for sid in siti:
        n, e = raccogli(sid, a.dir, emissione, a.mock)
        tot_n += n; tot_e += e
    chiamate = len(siti)*(GIORNI + 1)
    print(f"Totale: {tot_n} righe nuove, {tot_e} errori su {chiamate} chiamate")
    # fallisce (e il workflow lo segnala) solo se Tawhiri non ha mai risposto
    return 1 if tot_e == chiamate else 0


if __name__ == "__main__":
    sys.exit(main())
