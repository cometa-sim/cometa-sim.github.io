#!/usr/bin/env python3
"""Simulatore della telemetria LoRa di COMETA.

Inventa un volo completo (attesa a terra, salita, scoppio, discesa,
atterraggio), lo trasforma nelle righe che trasmetterebbe la sonda, e lo
fa "ricevere" da due stazioni finte che le mandano al Worker come farebbe
la pagina della stazione di terra: a lotti, ognuna per conto suo, con
pacchetti persi, doppioni, una stazione che resta senza rete per un po'.
Alla fine legge ultimo.json e controlla che il Worker abbia contato
esattamente le righe attese.

Serve a provare tutta la catena senza hardware. Usa solo la libreria
standard di Python: non c'e' niente da installare.

Esempi (vedi lora/README.md):

    # solo le righe, a schermo, senza mandare niente
    python3 simulatore.py --solo-righe

    # contro il Worker locale (npm run dev in lora/worker)
    python3 simulatore.py --url http://localhost:8787 --azzera

    # contro il Worker di prova su Cloudflare, 20 volte piu' veloce
    python3 simulatore.py --url https://cometa-lora-prova.<account>.workers.dev --azzera --velocita 20

La chiave si legge dalla variabile d'ambiente CHIAVE_STAZIONE, o si chiede
all'avvio. Non si passa sulla riga di comando: finirebbe nella cronologia
del terminale.
"""

import argparse
import getpass
import json
import math
import os
import queue
import random
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

# --------------------------------------------------------------------
# Il volo. I valori predefiniti sono quelli della pagina Diretta
# (FLIGHT_* in assets/app.js): partenza dall'aerodromo di Mercedes.
# --------------------------------------------------------------------

PERIODO_S = 5            # una riga ogni 5 s, come COMETA_RADIO_PERIODO_MS
QUOTA_SITO_M = 40.0      # quota del suolo a Mercedes, piu' o meno
ID_SONDA = "C2"


def densita_isa(h):
    """Densita' dell'aria (kg/m^3) a quota h (m), atmosfera standard.

    La stessa formula di densityISA() in assets/spot.js: la discesa col
    paracadute rallenta scendendo perche' l'aria si fa piu' densa."""
    if h < 11000:
        T = 288.15 - 0.0065 * h
        p = 101325 * (T / 288.15) ** 5.2559
    elif h < 20000:
        T = 216.65
        p = 22632 * math.exp(-9.80665 * (h - 11000) / (287.05 * T))
    elif h < 32000:
        T = 216.65 + 0.001 * (h - 20000)
        p = 5474.9 * (T / 216.65) ** -34.1632
    else:
        T = 228.65 + 0.0028 * (h - 32000)
        p = 868.02 * (T / 228.65) ** -12.2011
    return p / (287.05 * T)


RHO0 = densita_isa(0)


def vento(h):
    """Vento (verso est, verso nord) in m/s a quota h.

    Inventato, ma con la forma giusta: debole al suolo, forte verso gli
    11-12 km (la corrente a getto), di nuovo debole sopra i 20 km. Serve
    solo a far muovere la traccia sulla mappa in modo plausibile, non a
    prevedere niente."""
    forza = 6 + 28 * math.exp(-((h - 11500) / 4500) ** 2)
    return forza * 0.95, -forza * 0.3


def volo(args, rnd):
    """Genera lo stato della sonda ogni PERIODO_S secondi, dall'accensione
    a qualche minuto dopo l'atterraggio. Restituisce una lista di dict."""
    lat, lon, alt = args.lat, args.lon, QUOTA_SITO_M
    fase = "attesa"
    t = 0.0
    fine_attesa = args.attesa_min * 60
    t_atterraggio = None
    stati = []
    while True:
        if fase == "attesa" and t >= fine_attesa:
            fase = "salita"
        if fase == "salita":
            vz = args.salita + rnd.gauss(0, 0.3)
            alt += vz * PERIODO_S
            if alt >= args.scoppio_km * 1000:
                fase = "discesa"
        elif fase == "discesa":
            vz = -args.discesa * math.sqrt(RHO0 / densita_isa(max(alt, 0)))
            alt += vz * PERIODO_S
            if alt <= QUOTA_SITO_M:
                alt, fase, t_atterraggio = QUOTA_SITO_M, "a terra", t
        else:
            vz = 0.0
        if fase in ("salita", "discesa"):
            ve, vn = vento(alt)
            lat += vn * PERIODO_S / 111320
            lon += ve * PERIODO_S / (111320 * math.cos(math.radians(lat)))
        stati.append({"t": t, "fase": fase, "lat": lat, "lon": lon, "alt": alt,
                      "vz": vz if fase != "attesa" else 0.0})
        if t_atterraggio is not None and t - t_atterraggio >= args.dopo_min * 60:
            return stati
        t += PERIODO_S


def righe(stati, args, rnd, ora_partenza):
    """Dalle posizioni alle righe radio, nel formato del firmware
    (REQUISITOS.md §2.2): stessi decimali, celle vuote senza fix.

    Il formato e' definito in lora/formato/formato.js; qui e' scritto a
    mano perche' Python non puo' importare quel file. Che le righe di
    questo simulatore siano valide lo controlla
    lora/simulatore/simulatore.test.js, con formato.js stesso."""
    out = []
    n = 0
    v0 = 5.05
    buco = 0  # pacchetti che restano ancora senza fix in un buco del GPS
    totale = len(stati)
    for i, s in enumerate(stati):
        # Il GPS ha bisogno di un minuto per il primo fix, dopo
        # l'accensione; in volo, ogni tanto, perde il fix per qualche
        # pacchetto.
        if buco == 0 and s["t"] > 60 and rnd.random() < args.buchi_gps:
            buco = rnd.randint(2, 6)
        senza_fix = s["t"] < 60 or buco > 0
        if buco > 0:
            buco -= 1
        sats = rnd.randint(3, 5) if senza_fix else rnd.randint(8, 12)
        v_batt = v0 - 0.4 * i / totale + rnd.gauss(0, 0.005)
        if args.riavvio_min is not None and abs(s["t"] - args.riavvio_min * 60) < PERIODO_S / 2:
            n = 0  # la scheda si riavvia: il contatore riparte da zero
        if senza_fix:
            campi = [ID_SONDA, str(n), "", "", "", "", "", str(sats), "0", f"{v_batt:.2f}"]
        else:
            utc = (ora_partenza + timedelta(seconds=s["t"])).strftime("%H%M%S")
            campi = [ID_SONDA, str(n), utc,
                     f"{s['lat'] + rnd.gauss(0, 0.00001):.6f}", f"{s['lon'] + rnd.gauss(0, 0.00001):.6f}",
                     f"{s['alt'] + rnd.gauss(0, 2):.1f}", f"{s['vz']:.2f}",
                     str(sats), "3", f"{v_batt:.2f}"]
        riga = ",".join(campi)
        # Ogni tanto una riga rotta: il modulo E220 scarta quelle con il
        # CRC sbagliato, ma un convertitore USB-seriale che perde dei
        # byte puo' capitare a terra. Il taglio cade sempre prima
        # dell'ultima virgola, cosi' la riga ha meno di dieci campi e il
        # Worker la deve scartare: se cadesse dentro l'ultimo campo
        # ("4.98" che diventa "4.9") la riga resterebbe valida, solo
        # sbagliata, e il simulatore non saprebbe piu' cosa aspettarsi.
        rotta = rnd.random() < args.righe_rotte
        if rotta:
            riga = riga[: rnd.randint(3, riga.rfind(","))]
        out.append({"t": s["t"], "fase": s["fase"], "alt": s["alt"], "riga": riga, "rotta": rotta})
        n += 1
    return out


# --------------------------------------------------------------------
# Le stazioni.
# --------------------------------------------------------------------

class Stazione:
    """Una stazione finta: riceve (o no) i pacchetti, li accumula, e un
    thread suo li manda al Worker a lotti, come la pagina vera. Se la rete
    manca, o il Worker non risponde, tiene le righe e riprova al giro
    dopo."""

    def __init__(self, nome, perdita, args, chiave, rnd):
        self.nome = nome
        self.perdita = perdita
        self.args = args
        self.chiave = chiave
        self.rnd = rnd
        self.coda = queue.Queue()
        self.in_attesa = []
        self.senza_rete_fino = 0.0
        self.ricevute = 0
        self.inviate = 0
        self.errori = 0
        self.fermo = threading.Event()
        self.errore_fatale = None
        self.thread = threading.Thread(target=self._ciclo, daemon=True)

    def ricevi(self, riga):
        """Il pacchetto arriva o si perde. t e' l'ora di ricezione, in
        millisecondi: quella vera del computer, come nella pagina della
        stazione."""
        if self.rnd.random() < self.perdita:
            return False
        self.coda.put({"t": int(time.time() * 1000), "r": riga + "\r\n"})
        self.ricevute += 1
        return True

    def _ciclo(self):
        while not self.fermo.is_set() or not self.coda.empty() or self.in_attesa:
            time.sleep(self.args.lotto_s)
            while not self.coda.empty():
                self.in_attesa.append(self.coda.get())
            if not self.in_attesa or time.time() < self.senza_rete_fino:
                if self.fermo.is_set() and time.time() >= self.senza_rete_fino and not self.in_attesa:
                    return
                continue
            lotto = self.in_attesa[:5000]
            try:
                risposta = manda(self.args.url, self.chiave, {"stazione": self.nome, "righe": lotto})
            except PermissionError as e:
                self.errore_fatale = str(e)
                return
            except Exception as e:  # rete, 5xx: si riprova al giro dopo
                self.errori += 1
                print(f"  [{self.nome}] invio fallito, riprovo: {e}", file=sys.stderr)
                continue
            del self.in_attesa[: len(lotto)]
            self.inviate += len(lotto)
            # Una volta su venti la stazione "non vede" la risposta e
            # rimanda lo stesso lotto: nel grezzo finisce due volte, nella
            # traccia deve finire una volta sola.
            if self.rnd.random() < 0.05:
                try:
                    manda(self.args.url, self.chiave, {"stazione": self.nome, "righe": lotto})
                except Exception:
                    pass
            if self.args.verboso:
                print(f"  [{self.nome}] {risposta}")


def manda(url, chiave, corpo):
    req = urllib.request.Request(
        url.rstrip("/") + "/righe",
        data=json.dumps(corpo).encode(),
        headers={"Authorization": "Bearer " + chiave, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 401:
            raise PermissionError("chiave non valida (401)")
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='replace')[:200]}")


def leggi_ultimo(url, chiave):  # noqa: ARG001 (la chiave non serve: il file e' pubblico)
    """ultimo.json: dal Worker di prova (che lo serve, LETTURA_DAL_WORKER)
    o da un indirizzo dato con --leggi."""
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def azzera(url, chiave):
    req = urllib.request.Request(
        url.rstrip("/") + "/azzera",
        data=json.dumps({"conferma": "azzera"}).encode(),
        headers={"Authorization": "Bearer " + chiave},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def e_produzione(url):
    """Il simulatore non deve mai scrivere sulla mappa vera. Si accettano
    solo il Worker locale e quelli con "prova" nel nome; per tutto il
    resto serve --produzione, scritto apposta."""
    host = urllib.parse.urlparse(url).hostname or ""
    return not (host in ("localhost", "127.0.0.1") or "prova" in host)


# --------------------------------------------------------------------

def opzioni():
    p = argparse.ArgumentParser(
        description="Simula un volo COMETA e ne manda la telemetria LoRa al Worker, da due stazioni finte.")
    p.add_argument("--url", help="indirizzo del Worker, es. http://localhost:8787")
    p.add_argument("--solo-righe", action="store_true", help="stampa le righe e basta, senza mandare niente")
    p.add_argument("--azzera", action="store_true", help="svuota traccia.json e ultimo.json prima di cominciare")
    p.add_argument("--velocita", type=float, default=20, help="quante volte piu' veloce del vero (predefinito 20)")
    p.add_argument("--seme", type=int, default=None, help="seme del generatore casuale, per ripetere lo stesso volo")
    p.add_argument("--leggi", help="dove leggere ultimo.json per il controllo finale (predefinito: <url>/ultimo.json)")
    p.add_argument("--produzione", action="store_true", help="permette di scrivere sul Worker vero (non usarlo)")
    p.add_argument("--verboso", action="store_true", help="stampa la risposta del Worker a ogni lotto")
    g = p.add_argument_group("il volo")
    g.add_argument("--lat", type=float, default=-33.2486)
    g.add_argument("--lon", type=float, default=-58.0736)
    g.add_argument("--salita", type=float, default=5.0, help="m/s (predefinito 5)")
    g.add_argument("--scoppio-km", type=float, default=37.9, help="quota di scoppio (predefinito 37,9 km)")
    g.add_argument("--discesa", type=float, default=4.6, help="velocita' del paracadute al suolo, m/s (predefinito 4,6)")
    g.add_argument("--attesa-min", type=float, default=3, help="minuti a terra prima del lancio (predefinito 3)")
    g.add_argument("--dopo-min", type=float, default=10, help="minuti a terra dopo l'atterraggio (predefinito 10)")
    g.add_argument("--riavvio-min", type=float, default=None, help="la sonda si riavvia a questo minuto: n riparte da zero")
    g = p.add_argument_group("la ricezione")
    g.add_argument("--perdita", type=float, default=0.08, help="frazione di pacchetti persi da ogni stazione (predefinito 0,08)")
    g.add_argument("--buchi-gps", type=float, default=0.004, help="probabilita' per pacchetto di perdere il fix per un po'")
    g.add_argument("--righe-rotte", type=float, default=0.005, help="frazione di righe rotte (predefinito 0,005)")
    g.add_argument("--lotto-s", type=float, default=2, help="ogni quanti secondi (veri) una stazione manda il lotto")
    g.add_argument("--senza-rete-s", type=float, default=30,
                   help="secondi (veri) in cui il telefono resta senza rete, a meta' volo (predefinito 30)")
    return p.parse_args()


def main():
    args = opzioni()
    rnd = random.Random(args.seme)
    ora_partenza = datetime.now(timezone.utc)
    stati = volo(args, rnd)
    pacchetti = righe(stati, args, rnd, ora_partenza)

    if args.solo_righe:
        try:
            for p in pacchetti:
                print(p["riga"])
        except BrokenPipeError:  # es. "| head": chi legge ha finito prima
            sys.stderr.close()
        return

    if not args.url:
        sys.exit("serve --url (oppure --solo-righe)")
    if e_produzione(args.url) and not args.produzione:
        sys.exit(f"{args.url} sembra il Worker vero: il simulatore scrive solo su quello di prova "
                 "o su quello locale. Vedi lora/README.md.")
    chiave = os.environ.get("CHIAVE_STAZIONE") or getpass.getpass("Chiave della stazione: ")
    chiave = chiave.strip()
    leggi = args.leggi or args.url.rstrip("/") + "/ultimo.json"

    try:
        if args.azzera:
            print("azzero:", azzera(args.url, chiave))
        prima = leggi_ultimo(leggi, chiave)
    except urllib.error.HTTPError as e:
        sys.exit(f"il Worker risponde {e.code}: " + ("chiave non valida" if e.code == 401 else e.read().decode(errors="replace")[:200]))
    except Exception as e:
        sys.exit(f"non riesco a raggiungere il Worker: {e}")
    totale_prima = (prima or {}).get("totale", 0) or 0

    durata = stati[-1]["t"]
    print(f"volo di {durata / 3600:.1f} h, {len(pacchetti)} pacchetti; "
          f"a {args.velocita:g}x ci vogliono {durata / args.velocita / 60:.1f} minuti")

    portatile = Stazione("portatile", args.perdita, args, chiave, random.Random(rnd.random()))
    telefono = Stazione("telefono", args.perdita, args, chiave, random.Random(rnd.random()))
    stazioni = [portatile, telefono]
    for s in stazioni:
        s.thread.start()

    # Le righe che almeno una stazione ha ricevuto: sono quelle che il
    # Worker deve avere alla fine, una volta sola ciascuna. Le righe rotte
    # si scartano, e due righe identiche contano una volta sola, come le
    # conta il Worker (chiaveDoppione in formato.js).
    attese = set()
    rotte_ricevute = 0
    meta = len(pacchetti) // 2
    inizio = time.time()
    fase_prima = None
    try:
        for i, p in enumerate(pacchetti):
            if i == meta and args.senza_rete_s > 0:
                telefono.senza_rete_fino = time.time() + args.senza_rete_s
                print(f"  [telefono] senza rete per {args.senza_rete_s:g} s")
            presa = [s.ricevi(p["riga"]) for s in stazioni]
            if any(presa):
                if p["rotta"]:
                    rotte_ricevute += 1
                else:
                    attese.add(p["riga"])
            if p["fase"] != fase_prima:
                print(f"{p['t'] / 60:6.1f} min  {p['fase']}")
                fase_prima = p["fase"]
            elif i % 120 == 0:
                print(f"{p['t'] / 60:6.1f} min  {p['fase']:8s} quota {p['alt'] / 1000:5.1f} km")
            for s in stazioni:
                if s.errore_fatale:
                    sys.exit(f"[{s.nome}] {s.errore_fatale}")
            # Si aspetta l'istante "vero" del pacchetto successivo, non
            # PERIODO_S/velocita' dopo questo: cosi' il tempo speso a
            # mandare i lotti non fa scivolare il volo.
            prossimo = inizio + p["t"] / args.velocita + PERIODO_S / args.velocita
            time.sleep(max(0, prossimo - time.time()))
    except KeyboardInterrupt:
        print("\ninterrotto: mando quello che resta e controllo")

    for s in stazioni:
        s.fermo.set()
    for s in stazioni:
        s.thread.join(timeout=120)

    print()
    for s in stazioni:
        print(f"[{s.nome}] ricevute {s.ricevute}, inviate {s.inviate}, invii falliti {s.errori}")
    print(f"righe distinte ricevute da almeno una stazione: {len(attese)} (piu' {rotte_ricevute} rotte)")

    dopo = leggi_ultimo(leggi, chiave) or {}
    nuove = (dopo.get("totale") or 0) - totale_prima
    print(f"il Worker ne ha contate {nuove} nuove (totale {dopo.get('totale')}, revisione {dopo.get('revisione')})")
    if nuove == len(attese):
        print("OK: nessuna riga persa, nessun doppione")
    else:
        print(f"ATTENZIONE: attese {len(attese)}, contate {nuove}")
        sys.exit(1)


if __name__ == "__main__":
    main()
