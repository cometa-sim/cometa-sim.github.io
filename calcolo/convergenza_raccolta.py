#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COMETA - raccolta della convergenza delle previsioni di Tawhiri
===============================================================
Lo lancia una volta al giorno il workflow .github/workflows/convergenza.yml.
Per ogni giorno-bersaglio T da oggi a oggi+7 (la corsa GFS arriva a 192 h)
chiede a Tawhiri il volo previsto e aggiunge al CSV il punto di atterraggio:

    dataset, emissione, bersaglio, lead_giorni, lat, lon

dataset     la corsa GFS che Tawhiri dichiara nella risposta (request.dataset)
emissione   quando e' stata fatta la chiamata, UTC
bersaglio   l'istante di lancio previsto, UTC
lead_giorni bersaglio - emissione, in giorni di calendario dell'Uruguay
lat, lon    punto di atterraggio, lon in [-180, 180)

Una riga con la stessa coppia (dataset, bersaglio) di una gia' presente si
scarta: se il run ricade sulla corsa GFS del giorno prima non aggiunge nulla,
e un run perso costa solo un campione. Non serve inseguire i cicli GFS.

Il volo e' quello proposto dalla pagina La traiettoria: aerodromo di
Mercedes, Strato 2000, payload 1,5 kg, salita 5 m/s, paracadute del kit,
ore 11:00 dell'Uruguay. Quota di scoppio e discesa sono FISSE (atmosfera
ISA, stesso modello di cometa_venti.py), non quelle dell'atmosfera del
giorno: cosi' fra una previsione e l'altra cambia solo il vento.
Se si cambia uno di questi parametri le righe vecchie non sono piu'
confrontabili: meglio un CSV nuovo (--csv).

Uso:  python3 calcolo/convergenza_raccolta.py --csv convergenza.csv
Test: python3 calcolo/convergenza_raccolta.py --csv /tmp/prova.csv --mock
"""
import argparse, csv, os, sys, time
from datetime import date, datetime, time as dtime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cometa_venti as cv          # solo libreria standard all'importazione

# ---- il volo previsto (gli stessi valori proposti dalla pagina) ----
SITO = ("Mercedes aerodromo", -33.2486, -58.0736)    # SUME, come PREDEFINITO in traiettoria.js
ORA_LANCIO = dtime(11, 0)                             # ora dell'Uruguay, come LAUNCH in app.js
PALLONE = cv.PRESET["2000"]
PAYLOAD = 1.5                                         # kg
VSALITA = 5.0                                         # m/s
GIORNI = 7                                            # da oggi a oggi+7: otto chiamate

COLONNE = ["dataset", "emissione", "bersaglio", "lead_giorni", "lat", "lon"]


def parametri_volo():
    """Quota di scoppio [m] e discesa al suolo [m/s] del modello del pallone, in ISA."""
    V = cv.V_per_salita(PALLONE["massa"], PAYLOAD, VSALITA)
    burst = cv.quota_scoppio(V, PALLONE["diametro"])
    vdisc = cv.v_atterraggio(PAYLOAD + PALLONE["para_m"], PALLONE["para_d"], PALLONE["para_cd"])
    return burst, vdisc


def _iso(dt): return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def leggi(percorso):
    if not os.path.exists(percorso): return []
    with open(percorso, newline="") as f:
        return list(csv.DictReader(f))


def chiedi(lat, lon, quando, burst, vdisc, mock, tentativi=3):
    """Punto di atterraggio e dataset; ritenta sugli errori di rete."""
    for k in range(tentativi):
        try:
            if mock:
                punti, info = cv._mock_tawhiri(argparse.Namespace(vsalita=VSALITA), lat, lon,
                                               quando, burst, vdisc)
                oggi_utc = datetime.now(timezone.utc).date()   # come se ci fosse solo la corsa 00Z
                info["dataset"] = _iso(datetime.combine(oggi_utc, dtime(0), timezone.utc))
            else:
                punti, info = cv.tawhiri(lat, lon, quando, VSALITA, burst, vdisc)
            fine = punti[-1]
            return info["dataset"], fine[1], fine[2]
        except Exception as e:
            if k == tentativi - 1: raise
            print(f"  [!] {e}: nuovo tentativo fra {10*(k+1)} s")
            time.sleep(10*(k + 1))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--csv", default="convergenza.csv")
    ap.add_argument("--mock", action="store_true", help="risposte finte, senza rete")
    a = ap.parse_args()

    burst, vdisc = parametri_volo()
    _, lat0, lon0 = SITO
    emissione = datetime.now(timezone.utc).replace(microsecond=0)
    oggi = emissione.astimezone(cv.TZ_LANCIO).date()
    print(f"Volo: {SITO[0]} {lat0}, {lon0} | salita {VSALITA} m/s | scoppio {burst:.0f} m | "
          f"discesa {vdisc:.2f} m/s | ore {ORA_LANCIO:%H:%M} dell'Uruguay")

    righe = leggi(a.csv)
    visti = {(r["dataset"], r["bersaglio"]) for r in righe}
    nuove, errori = [], 0
    for lead in range(GIORNI + 1):
        g = oggi + timedelta(days=lead)
        quando = datetime.combine(g, ORA_LANCIO, cv.TZ_LANCIO)
        try:
            ds, lat, lon = chiedi(lat0, lon0, quando, burst, vdisc, a.mock)
        except Exception as e:
            errori += 1
            print(f"  {g} (lead {lead}): errore - {e}")
            continue
        chiave = (ds, _iso(quando))
        if chiave in visti:
            print(f"  {g} (lead {lead}): dataset {ds} gia' registrato, scartata")
            continue
        visti.add(chiave)
        nuove.append({"dataset": ds, "emissione": _iso(emissione), "bersaglio": _iso(quando),
                      "lead_giorni": lead, "lat": f"{lat:.5f}", "lon": f"{lon:.5f}"})
        print(f"  {g} (lead {lead}): dataset {ds} -> {lat:.4f}, {lon:.4f}")

    if nuove:
        nuovo_file = not os.path.exists(a.csv)
        with open(a.csv, "a", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLONNE, lineterminator="\n")
            if nuovo_file: w.writeheader()
            w.writerows(nuove)
    print(f"{len(nuove)} righe nuove, {errori} errori su {GIORNI + 1} chiamate")
    # fallisce (e il workflow lo segnala) solo se Tawhiri non ha mai risposto
    return 1 if errori == GIORNI + 1 else 0


if __name__ == "__main__":
    sys.exit(main())
