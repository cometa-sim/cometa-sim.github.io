#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nella mappa gia' generata da cometa_venti.py sostituisce il testo dei punti
(«deriva ... km, rotta ..., ... min, inc.adv ... km») con la data del volo,
che e' quello che serve per confrontare: deriva e rotta si leggono dalla mappa.

Le mappe nuove escono gia' cosi' (cometa_venti.py, disegna_mappa_html); questo
serve solo per quella pubblicata, che non si puo' rigenerare senza rifare la
simulazione.

La data non e' scritta nel file, ma si ricava con certezza dall'ordine: dentro
ogni gruppo («Durazno · 10/09-09/10») lo script aggiunge i voli anno per anno
e, in ogni anno, giorno per giorno. Il programma controlla che ogni gruppo
abbia esattamente giorni x anni punti; se non torna si ferma senza scrivere.

Uso:  python3 calcolo/date_nei_popup.py mappe/uru2000_footprint.html --anni 2021-2025
"""
import argparse, json, re, sys
from datetime import date, timedelta

ap = argparse.ArgumentParser()
ap.add_argument("mappa")
ap.add_argument("--anni", default="2021-2025")
a = ap.parse_args()
y0, y1 = (int(x) for x in a.anni.split("-"))
anni = list(range(y0, y1 + 1))

s = open(a.mappa, encoding="utf-8").read()

# gruppi: nome -> variabile
gruppi = {v: json.loads('"%s"' % n) for n, v in re.findall(r'"(.*?)" : (feature_group_[0-9a-f]+)', s)}
# contenuto dei popup: popup -> (inizio, fine, testo) dell'html
html = {m.group(1): m for m in re.finditer(
    r'var (html_[0-9a-f]+) = \$\(`<div id="html_[0-9a-f]+" style="[^"]*">(.*?)</div>`\)\[0\];', s)}
popup_html = dict(re.findall(r'(popup_[0-9a-f]+)\.setContent\((html_[0-9a-f]+)\);', s))
marker_popup = dict(re.findall(r'(circle_marker_[0-9a-f]+)\.bindPopup\((popup_[0-9a-f]+)\)', s))
# marcatori nell'ordine del file, con il gruppo a cui sono aggiunti
marker_gruppo = re.findall(r'var (circle_marker_[0-9a-f]+) = L\.circleMarker\(.*?\)\.addTo\((feature_group_[0-9a-f]+)\);', s, re.S)

per_gruppo = {g: [] for g in gruppi}
for mk, g in marker_gruppo:
    if g not in per_gruppo or mk not in marker_popup: continue
    h = html[popup_html[marker_popup[mk]]]
    if re.match(r"deriva \d+ km", h.group(2)): per_gruppo[g].append(h)

if not any(per_gruppo.values()) and re.search(r'">\d\d/\d\d/\d{4}</div>', s):
    sys.exit("le date ci sono gia': niente da fare.")
sost = []
for g, nome in gruppi.items():
    m = re.search(r"(\d\d)/(\d\d)-(\d\d)/(\d\d)$", nome)
    if not m: sys.exit(f"gruppo senza periodo: {nome}")
    d0, m0, d1, m1 = (int(x) for x in m.groups())
    giorni = (date(2001, m1, d1) - date(2001, m0, d0)).days + 1
    punti = per_gruppo[g]
    if len(punti) != giorni * len(anni):
        sys.exit(f"{nome}: {len(punti)} punti, attesi {giorni} x {len(anni)} = {giorni*len(anni)}. Non scrivo niente.")
    for k, h in enumerate(punti):
        d = date(anni[k // giorni], m0, d0) + timedelta(days=k % giorni)
        sost.append((h.start(2), h.end(2), d.strftime("%d/%m/%Y")))

if not sost:
    sys.exit("nessun punto da cambiare (forse le date ci sono gia').")
for i, j, txt in sorted(sost, reverse=True):
    s = s[:i] + txt + s[j:]
open(a.mappa, "w", encoding="utf-8").write(s)
print(f"{len(sost)} punti aggiornati in {a.mappa}")
