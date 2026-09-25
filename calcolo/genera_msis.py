#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera assets/msis.js: la forma verticale della densita' NRLMSIS 2.1 che il
sito usa sopra l'ultimo livello di pressione dei dati meteorologici (~24 km),
come fa cometa_venti.py con --rif msis.

Il browser non puo' far girare NRLMSIS, quindi qui lo si tabula una volta:
ln(rho) [kg/m3] da 10 a 50 km ogni 2 km, per latitudini da -60 a +60 ogni 10
gradi e per il giorno 15 di ogni mese, alle 12 UTC, longitudine -56. Sotto i
50 km la dipendenza da longitudine e ora e' trascurabile rispetto a quella da
latitudine e stagione. Indici solari fissi (F10.7 = 150, Ap = 4): in
stratosfera non contano, ma vanno passati, altrimenti pymsis li scarica.

Uso:  pip install pymsis numpy
      python3 calcolo/genera_msis.py
"""
import json, os
import numpy as np, pymsis

ALT = list(range(10, 51, 2))          # km
LAT = list(range(-60, 61, 10))        # gradi
MESI = list(range(1, 13))

tab = []
for lat in LAT:
    riga = []
    for m in MESI:
        r = pymsis.calculate(np.datetime64(f"2026-{m:02d}-15T12:00"), -56.0, float(lat),
                             np.array(ALT, float), 150.0, 150.0, [[4]*7])
        rho = np.asarray(r[..., 0]).ravel()
        riga.append([round(float(np.log(x)), 5) for x in rho])
    tab.append(riga)

out = os.path.join(os.path.dirname(__file__), "..", "assets", "msis.js")
with open(out, "w") as f:
    f.write("/* NRLMSIS 2.1 tabulato da calcolo/genera_msis.py: NON modificare a mano.\n"
            "   ln(rho [kg/m3]) per latitudine x mese (giorno 15) x quota. */\n")
    f.write("window.COMETA_MSIS = " + json.dumps({"alt_km": ALT, "lat": LAT, "lnrho": tab},
                                                 separators=(",", ":")) + ";\n")
print("scritto", os.path.normpath(out))
