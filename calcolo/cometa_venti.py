#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COMETA - Venti storici, modello del pallone e footprint di atterraggio  (v6)
============================================================================
Dal pallone + payload + velocita' di salita calcola ELIO NECESSARIO e QUOTA DI
SCOPPIO; integra la traiettoria (salita+discesa) per piu' anni e da piu' siti
sui venti in quota (Open-Meteo); produce tabella statistica e mappa con ellissi
di dispersione 50%/90%. Avvisi automatici per parametri fuori range.

NOVITA' v6 - previsione del giorno con Tawhiri (NOAA GFS):
* --tawhiri: invece dello studio storico chiede la traiettoria PREVISTA al
  predittore Tawhiri di SondeHub, che integra salita e discesa sui venti
  dell'ultima corsa del modello globale GFS della NOAA (0,5 gradi, 3 ore).
  Funziona solo nei giorni coperti dalla previsione, circa una settimana.
* La quota di scoppio e la velocita' di discesa sono quelle del modello del
  pallone qui sotto (o --quota / --vatterraggio): Tawhiri le riceve, non le
  calcola.
* --lancio YYYY-MM-DD[THH:MM] (ora locale di Montevideo), --giorni-prev N per
  piu' giorni consecutivi alla stessa ora: serve a scegliere il giorno.
* Uscite: tabella, {prefix}_tawhiri.csv, e con --html una mappa con le
  traiettorie complete.
Esempio: python3 cometa_venti.py --tawhiri --pallone 2000 --payload 1.5 --lancio 2026-10-07T08:00 --giorni-prev 3 --html

NOVITA' v5:
* Modello del pallone integrato: --diametro, --massa-pallone, --payload, --vsalita
  -> stampa elio necessario, quota di scoppio attesa, portanza al collo.
* Preset --pallone 1600|2000 (StratoFlights). Override con i parametri singoli.
* AVVISI per parametri fuori range (payload, velocita', elio, endpoint, anni...).
* Mappa geografica VERA con cartopy (qualsiasi coordinata); fallback schematico.
* Area di esclusione e territorio caricabili da file (--esclusione, --territorio).

Uso:   python3 cometa_venti.py            (interattivo)
       python3 cometa_venti.py --pallone 1600 --payload 1.2 --sito "Mercedes,-33.25,-58.03"
       python3 cometa_venti.py --help
Test:  python3 cometa_venti.py --mock --pallone 1600 --payload 1.2
       python3 cometa_venti.py --mock --tawhiri --pallone 2000 --payload 1.5
"""
import json, math, os, sys, csv, argparse, urllib.request, urllib.parse, urllib.error
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

# ---- costanti fisiche ----
G=9.80665; CD_ASC=0.25
R_ARIA=287.05          # costante specifica dell'aria secca [J/(kg K)]
R_ELIO=2077.1          # costante specifica dell'elio [J/(kg K)]
P_STD=101325.0         # pressione al livello del mare [Pa]
T_RIF=288.15           # temperatura di riferimento ISA (15 C): definisce V0
RE_GEO=6356766.0       # raggio terrestre convenzionale ISA [m] (geopotenziale -> geometrica)

def densita_gas(T,R,p=P_STD): return p/(R*T)
# Aria ed elio vanno presi alla STESSA temperatura: prima RHO0_=1.225 era l'aria a
# 15 C e RHO_HE=0.1664 l'elio a 20 C, un'incoerenza da 0.3% su Delta rho.
RHO0_ =densita_gas(T_RIF,R_ARIA)      # 1.2250 kg/m3 a 15 C
RHO_HE=densita_gas(T_RIF,R_ELIO)      # 0.16929 kg/m3 a 15 C
DRATIO=RHO0_-RHO_HE                   # 1.0557 kg/m3

# ---- preset palloni StratoFlights ----
PRESET={
 "1600":dict(diametro=11.1, massa=1.6, pmax=1.6, vmin=4, vmax=5, para_d=1.2, para_cd=1.0, para_m=0.08),
 "2000":dict(diametro=12.5, massa=2.0, pmax=2.0, vmin=3, vmax=4, para_d=1.2, para_cd=1.0, para_m=0.08),
}  # para_*: Stratoflights Parachute 2500 (diametro 1.2 m, massa 80 g, Cd ~1.0)

# ---- livelli di pressione e quota ISA [m] ----
LIVELLI_HPA=[1000,925,850,700,500,400,300,250,200,150,100,70,50,30]
QUOTA_LIV={1000:111,925:762,850:1457,700:3012,500:5574,400:7185,300:9164,
           250:10363,200:11784,150:13608,100:16180,70:18442,50:20576,30:23849}

# ---- geografia di default (approssimata; sovrascrivibile da file) ----
URU_POLY=[(-57.65,-30.20),(-55.55,-30.90),(-53.90,-32.10),(-53.40,-33.70),
          (-54.15,-34.66),(-54.95,-34.97),(-56.20,-34.90),(-57.85,-34.47),
          (-58.40,-34.00),(-58.10,-33.10),(-58.05,-32.10),(-57.90,-31.40)]
EXCL_POLY=[(-56.78,-34.55),(-56.75,-34.20),(-56.20,-34.12),(-55.74,-34.18),
           (-55.10,-34.15),(-54.60,-34.35),(-54.30,-34.62),(-54.63,-34.84),
           (-54.95,-34.97),(-55.30,-34.90),(-55.85,-34.80),(-56.20,-34.90),(-56.50,-34.78)]
CITTA=[(-56.18,-34.90,"Montevideo"),(-57.84,-34.47,"Colonia"),(-57.96,-31.39,"Salto"),
       (-55.55,-30.90,"Rivera"),(-54.18,-32.37,"Melo"),(-55.98,-31.71,"Tacuarembo"),
       (-56.21,-34.10,"Florida"),(-55.24,-34.37,"Minas"),(-54.33,-34.48,"Rocha")]

# ==========================================================================
# Atmosfera e galleggiamento
# ==========================================================================
def densita_isa(h):
    """Densita' dell'atmosfera standard ISA [kg/m3]. Valida fino a ~47 km."""
    if h<11000:   T=288.15-0.0065*h; p=101325*(T/288.15)**5.2559
    elif h<20000: T=216.65;          p=22632*math.exp(-9.80665*(h-11000)/(287.05*T))
    elif h<32000: T=216.65+0.001*(h-20000);  p=5474.9*(T/216.65)**(-34.1632)
    else:         T=228.65+0.0028*(h-32000); p=868.02*(T/228.65)**(-12.2011)
    return p/(287.05*T)
densita=densita_isa          # alias di compatibilita'
RHO0=densita_isa(0.0)

# ---- NRLMSIS 2.1 (opzionale: pip install pymsis) --------------------------
# Climatologia empirica per latitudine e giorno dell'anno. Sotto i ~30 km e'
# essenzialmente una media zonale: NON aggiunge informazione sul singolo giorno,
# serve solo come forma verticale piu' realistica dell'ISA sopra i livelli
# disponibili da Open-Meteo. Gli indici solari sono irrilevanti in stratosfera
# ma vanno passati a mano, altrimenti pymsis prova a scaricarli.
_MSIS_CACHE={}
def msis_disponibile():
    try:
        import pymsis, numpy  # noqa: F401
        return True
    except Exception:
        return False

def densita_msis(h,lat,lon,quando):
    """Densita' NRLMSIS [kg/m3] a quota geometrica h [m]. Tabulata e interpolata
    in ln(rho) per non chiamare il modello a ogni passo di integrazione."""
    import numpy as np, pymsis
    key=(round(lat,1),round(lon,1),quando[:10])
    tab=_MSIS_CACHE.get(key)
    if tab is None:
        alts=np.arange(0.0,51.0,1.0)                     # km
        r=pymsis.calculate(np.datetime64(quando),lon,lat,alts,150.0,150.0,[[4]*7])
        rho=np.asarray(r[...,0]).ravel()
        tab=([float(a)*1000.0 for a in alts],[math.log(float(x)) for x in rho])
        _MSIS_CACHE[key]=tab
    zs,ln=tab
    return math.exp(interp(h,zs,ln))

class Colonna:
    """Profilo di densita' verticale ricostruito dai dati del giorno.

    zs, rho: livelli misurati (quota geometrica [m], densita' [kg/m3]).
    Sotto il primo livello e sopra l'ultimo si estrapola ANCORANDO una forma di
    riferimento (ISA o NRLMSIS) al valore reale dell'estremo:

        rho(z) = rho(z_top) * rif(z)/rif(z_top)          per z > z_top

    Cosi' l'integrale della colonna sotto z_top resta quello osservato e dal
    riferimento si prende solo il gradiente residuo. E' la parte che conta:
    la quota alla quale si trova una data densita' dipende da tutta la colonna
    sottostante, non dalla temperatura locale a quella quota.
    """
    def __init__(self,zs,rho,rif=None,fonte="reale"):
        pair=sorted(zip(zs,rho))
        self.zs=[z for z,_ in pair]
        self.ln=[math.log(r) for _,r in pair]
        self.rif=rif or densita_isa
        self.fonte=fonte
        self.ztop=self.zs[-1]; self.zbot=self.zs[0]
        self.k_top=self.ln[-1]-math.log(self.rif(self.ztop))
        self.k_bot=self.ln[0] -math.log(self.rif(self.zbot))
    def rho(self,z):
        if z>self.ztop: return math.exp(math.log(self.rif(z))+self.k_top)
        if z<self.zbot: return math.exp(math.log(self.rif(z))+self.k_bot)
        return math.exp(interp(z,self.zs,self.ln))
    def __call__(self,z): return self.rho(z)

class ColonnaRif(Colonna):
    """Colonna che coincide con il riferimento (nessun dato osservato)."""
    def __init__(self,rif=None,fonte="isa"):
        self.rif=rif or densita_isa; self.fonte=fonte
        self.ztop=float("inf"); self.zbot=-float("inf")
    def rho(self,z): return self.rif(z)

def bisez(f,a,b,tol=1e-7,it=300):
    fa=f(a)
    for _ in range(it):
        m=(a+b)/2; fm=f(m)
        if abs(fm)<tol or (b-a)/2<tol: return m
        if (fa<0)==(fm<0): a,fa=m,fm
        else: b=m
    return (a+b)/2

def asc_rate(V,mb,mp):
    free=V*DRATIO-mb-mp
    if free<=0: return -1
    r=(3*V/(4*math.pi))**(1/3)
    return math.sqrt(free*G/(0.5*RHO0*CD_ASC*math.pi*r*r))

def V_per_salita(mb,mp,v):
    if asc_rate(60,mb,mp) < v: return None      # payload troppo pesante
    return bisez(lambda V:asc_rate(V,mb,mp)-v,0.3,60)

def quota_scoppio(V,d,rho=None):
    """Quota alla quale il pallone raggiunge il diametro di scoppio d.

    Il volume V e' riferito alla densita' RHO0 (ISA al livello del mare), la
    stessa usata da asc_rate(): l'invariante e' il prodotto rho*V, quindi
    rb = RHO0*V/Vb resta corretto qualunque profilo si usi per l'inversione.
    rho: funzione densita'(z); se None si usa l'ISA.
    """
    rho=rho or densita_isa
    Vb=(math.pi/6)*d**3; rb=RHO0*V/Vb
    if rho(0.0)<rb: return 0.0
    return bisez(lambda h:rho(h)-rb,0,50000)

def neck_g(V,mb): return (V*DRATIO-mb)*1000

def volume_a_T(V,Tc,p=P_STD):
    """Litri da caricare a temperatura Tc [C] e pressione p, a parita' di
    portanza al collo.

    A pressione fissata rho_aria e rho_elio vanno entrambe come 1/T, quindi
    Delta rho ~ 1/T: per mantenere la stessa portanza N = V*Delta rho - m_pallone
    serve V ~ T. Ma allora la massa di elio m = V*rho_elio ~ T*(1/T) resta
    COSTANTE. Conseguenza operativa: riempiendo a portanza al collo misurata si
    carica sempre la stessa quantita' di elio, qualunque sia la temperatura.
    La temperatura cambia i litri, non le moli - e quindi non tocca la quota di
    scoppio, che dipende dalle moli.
    """
    return V*((Tc+273.15)/T_RIF)*(P_STD/p)

def v_atterraggio(massa, d_para, cd=1.0):
    """Velocita' terminale al suolo [m/s]: equilibrio peso-resistenza a rho0 (livello del mare).
    massa = massa del sistema in discesa [kg]; d_para = diametro paracadute [m]; cd ~ 1.0.
    Al di sopra del suolo la discesa scala come 1/sqrt(rho) (vedi traiettoria())."""
    A=math.pi*(d_para/2.0)**2
    return math.sqrt(2*massa*G/(RHO0*cd*A))

# ==========================================================================
# Vento / geometria
# ==========================================================================
def comp_uv(sp,d):
    r=math.radians(d); return -sp*math.sin(r), -sp*math.cos(r)
def interp(z,zs,vals):
    if z<=zs[0]:  return vals[0]
    if z>=zs[-1]: return vals[-1]
    for i in range(len(zs)-1):
        if zs[i]<=z<=zs[i+1]:
            f=(z-zs[i])/(zs[i+1]-zs[i]); return vals[i]+f*(vals[i+1]-vals[i])
    return vals[-1]
def point_in_poly(x,y,poly):
    if not poly: return True
    inside=False; n=len(poly); j=n-1
    for i in range(n):
        xi,yi=poly[i]; xj,yj=poly[j]
        if ((yi>y)!=(yj>y)) and (x<(xj-xi)*(y-yi)/(yj-yi)+xi): inside=not inside
        j=i
    return inside

def in_zona(lat,lon,z):
    """True se il punto e' dentro la zona (poligono o cerchio)."""
    if z.get("tipo")=="cerchio":
        return dist_km(lat,lon,z["lat"],z["lon"])<=z["raggio_km"]
    return point_in_poly(lon,lat,z["punti"])   # poligono: punti come [lon,lat]

def in_qualche_zona(lat,lon,zone):
    return any(in_zona(lat,lon,z) for z in (zone or []))

def carica_zone(percorso):
    """Carica zone di esclusione da file JSON: {"zone":[{...},{...}]}."""
    with open(percorso) as f: dati=json.load(f)
    zone=dati.get("zone",dati) if isinstance(dati,dict) else dati
    out=[]
    for z in zone:
        if z.get("tipo")=="cerchio":
            out.append({"tipo":"cerchio","nome":z.get("nome","cerchio"),
                        "lat":float(z["lat"]),"lon":float(z["lon"]),"raggio_km":float(z["raggio_km"])})
        else:
            out.append({"tipo":"poligono","nome":z.get("nome","poligono"),
                        "punti":[[float(a),float(b)] for a,b in z["punti"]]})
    return out

# ==========================================================================
# Open-Meteo
# ==========================================================================
def base_url(ep):
    return {"era5":"https://archive-api.open-meteo.com/v1/archive",
            "hist_forecast":"https://historical-forecast-api.open-meteo.com/v1/forecast",
            "forecast":"https://api.open-meteo.com/v1/forecast"}[ep]     # solo per --tawhiri
def finestra(cfg,anno):
    """Restituisce (start, end, [date di lancio]) per la finestra dell'anno, o None
    se la data di inizio non esiste in quell'anno (es. 29/02 in anno non bisestile)."""
    try: start=date(anno,cfg.mm,cfg.dd)
    except ValueError: return None
    end=start+timedelta(days=cfg.ngiorni-1)
    lanci=[start+timedelta(days=k) for k in range(0,cfg.ngiorni,cfg.step)]
    return start,end,lanci

def scarica_finestra(cfg,lat,lon,start,end):
    if cfg.mock: return _mock_finestra(cfg,start,end,lat,lon)
    hourly=["wind_speed_10m","wind_direction_10m","temperature_2m","surface_pressure"]
    for l in LIVELLI_HPA: hourly+=[f"wind_speed_{l}hPa",f"wind_direction_{l}hPa"]
    if cfg.atm=="reale":
        # stesse chiamata, stessi livelli: temperatura e quota geopotenziale
        # bastano per ricavare rho = p/(R T) del giorno effettivo.
        for l in LIVELLI_HPA: hourly+=[f"temperature_{l}hPa",f"geopotential_height_{l}hPa"]
    params={"latitude":lat,"longitude":lon,
            "start_date":start.isoformat(),"end_date":end.isoformat(),
            "hourly":",".join(hourly),"wind_speed_unit":"ms","timezone":"America/Montevideo"}
    with urllib.request.urlopen(base_url(cfg.endpoint)+"?"+urllib.parse.urlencode(params),timeout=60) as r:
        return json.load(r)["hourly"]
def livelli_vivi(h):
    return [l for l in LIVELLI_HPA
            if h.get(f"wind_speed_{l}hPa") and any(v is not None for v in h[f"wind_speed_{l}hPa"])]
def profilo(cfg,h,data_iso):
    tg=f"{data_iso}T{cfg.ora:02d}:00"
    try: idx=next(i for i,t in enumerate(h["time"]) if t.startswith(tg))
    except StopIteration: return None
    zs=[10.0]; sp=[h["wind_speed_10m"][idx]]; di=[h["wind_direction_10m"][idx]]
    for l in LIVELLI_HPA:
        s=h.get(f"wind_speed_{l}hPa"); d=h.get(f"wind_direction_{l}hPa")
        if not s or not d or s[idx] is None or d[idx] is None: continue
        # quota vera del livello se disponibile, altrimenti quota ISA tabulata:
        # una colonna calda alza i livelli di pressione di alcune centinaia di metri
        # e il vento va collocato dove sta davvero, non dove lo mette l'ISA.
        Z=h.get(f"geopotential_height_{l}hPa")
        z=z_geometrica(float(Z[idx])) if (Z and Z[idx] is not None) else QUOTA_LIV[l]
        zs.append(z); sp.append(s[idx]); di.append(d[idx])
    if len(zs)<3 or sp[0] is None: return None
    return zs,sp,di

def z_geometrica(hgp):
    """Quota geopotenziale -> geometrica [m]. A 24 km sono ~90 m di differenza."""
    return RE_GEO*hgp/(RE_GEO-hgp)

def colonna(cfg,h,data_iso,lat=None,lon=None):
    """Colonna di densita' del giorno, o None se i dati non ci sono.

    Usa i livelli in cui temperatura E quota geopotenziale sono entrambe
    presenti: rho = p/(R T), con p = livello di pressione (esatto per
    definizione) e z dalla quota geopotenziale convertita in geometrica.
    """
    rif=riferimento(cfg,lat,lon,data_iso)
    if cfg.atm!="reale": return ColonnaRif(rif,fonte=cfg.rif)
    tg=f"{data_iso}T{cfg.ora:02d}:00"
    try: idx=next(i for i,t in enumerate(h["time"]) if t.startswith(tg))
    except (StopIteration,KeyError,TypeError): return None
    zs=[]; rr=[]
    for l in LIVELLI_HPA:
        T=h.get(f"temperature_{l}hPa"); Z=h.get(f"geopotential_height_{l}hPa")
        if not T or not Z or T[idx] is None or Z[idx] is None: continue
        TK=T[idx]+273.15
        if TK<=150 or TK>=350: continue                  # guardia su valori assurdi
        zs.append(z_geometrica(float(Z[idx]))); rr.append(l*100.0/(R_ARIA*TK))
    if len(zs)<4: return None
    return Colonna(zs,rr,rif=rif,fonte="reale+"+cfg.rif)

def riferimento(cfg,lat,lon,data_iso):
    """Forma verticale di riferimento per l'estrapolazione sopra l'ultimo livello."""
    if cfg.rif=="msis" and lat is not None:
        quando=f"{data_iso}T{cfg.ora:02d}:00"
        try:
            densita_msis(30000.0,lat,lon,quando)          # probe: fallisce subito, non a meta' integrazione
            return lambda z: densita_msis(z,lat,lon,quando)
        except Exception as e:
            if not getattr(cfg,"_msis_warned",False):
                print(f"  [!] NRLMSIS non utilizzabile ({e}): estrapolazione su ISA.")
                cfg._msis_warned=True
            cfg.rif="isa"
    return densita_isa

def _uv_liste(prof):
    zs,sp,di=prof
    return zs,[comp_uv(s,d)[0] for s,d in zip(sp,di)],[comp_uv(s,d)[1] for s,d in zip(sp,di)]

def endpoint_ascesa(cfg,lat0,lon0,prof,quota=None):
    """Posizione di apogeo (scoppio) integrando solo la salita col profilo dato."""
    quota=cfg.quota if quota is None else quota
    zs,us,vs=_uv_liste(prof); x=y=0.0; z=10.0
    while z<quota:
        x+=interp(z,zs,us)*cfg.dt; y+=interp(z,zs,vs)*cfg.dt; z+=cfg.vsalita*cfg.dt
    return lat0+y/111320.0, lon0+x/(111320.0*math.cos(math.radians(lat0)))

def traiettoria(cfg,lat0,lon0,prof_asc,prof_desc=None,quota=None,col=None):
    """Salita col profilo A (sito); discesa col profilo B (punto sottovento).
    Se prof_desc e' None usa A per tutto (vecchio comportamento, colonna singola).
    quota: quota di scoppio del giorno; col: colonna di densita' del giorno."""
    if prof_desc is None: prof_desc=prof_asc
    quota=cfg.quota if quota is None else quota
    rho=col.rho if col is not None else densita_isa
    zsa,usa,vsa=_uv_liste(prof_asc); zsd,usd,vsd=_uv_liste(prof_desc)
    x=y=0.0; z=10.0; t=0.0
    while z<quota:                                       # salita: colonna del sito
        x+=interp(z,zsa,usa)*cfg.dt; y+=interp(z,zsa,vsa)*cfg.dt; z+=cfg.vsalita*cfg.dt; t+=cfg.dt
    xb,yb=x,y                                           # spostamento orizzontale allo scoppio (apogeo)
    z=quota
    while z>10.0:                                        # discesa: colonna sottovento
        vd=cfg.vatt*math.sqrt(RHO0/rho(z))
        x+=interp(z,zsd,usd)*cfg.dt; y+=interp(z,zsd,vsd)*cfg.dt; z-=vd*cfg.dt; t+=cfg.dt
    dlat=y/111320.0; dlon=x/(111320.0*math.cos(math.radians(lat0)))
    return (lat0+dlat, lon0+dlon, math.hypot(x,y)/1000.0,
            (math.degrees(math.atan2(x,y))+360)%360, t/60.0, math.hypot(xb,yb)/1000.0)

def dist_km(la1,lo1,la2,lo2):
    dx=(lo2-lo1)*111320.0*math.cos(math.radians((la1+la2)/2)); dy=(la2-la1)*111320.0
    return math.hypot(dx,dy)/1000.0

def stato(cfg,lat,lon):
    if cfg.territorio and not point_in_poly(lon,lat,cfg.territorio): return "FUORI"
    if cfg.esclusione and point_in_poly(lon,lat,cfg.esclusione):    return "ESCL"
    if in_qualche_zona(lat,lon,getattr(cfg,"zone",None)):           return "ESCL"
    return "ok"

def rotta_deg(la1,lo1,la2,lo2):
    """Rotta dal punto 1 al punto 2 [gradi, 0=N 90=E], stessa geometria di dist_km()."""
    dx=(lo2-lo1)*111320.0*math.cos(math.radians((la1+la2)/2)); dy=(la2-la1)*111320.0
    return (math.degrees(math.atan2(dx,dy))+360)%360

# ==========================================================================
# Tawhiri (SondeHub): previsione del giorno sui venti NOAA GFS
# ==========================================================================
# Tawhiri e' il predittore di traiettorie nato con il CUSF di Cambridge e oggi
# gestito da SondeHub. Integra salita e discesa sui venti dell'ultima corsa del
# modello globale GFS della NOAA (griglia 0,5 gradi, passo 3 ore, aggiornato
# ogni 6 ore). A differenza dello studio storico non serve a fare statistica:
# e' UNA traiettoria, la piu' probabile secondo la previsione di oggi, e vale
# solo per i giorni che quella previsione copre (circa una settimana).
TAWHIRI_URL="https://api.v2.sondehub.org/tawhiri"
try:
    from zoneinfo import ZoneInfo
    TZ_LANCIO=ZoneInfo("America/Montevideo")
except Exception:                                  # Python < 3.9 o tzdata assente
    TZ_LANCIO=timezone(timedelta(hours=-3))         # l'Uruguay non ha ora legale dal 2015

def _iso_z(dt): return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
def _da_iso(s): return datetime.fromisoformat(s.replace("Z","+00:00"))

def tawhiri(lat,lon,quando,vsalita,quota,vdisc,alt_lancio=None,url=TAWHIRI_URL):
    """Traiettoria prevista da Tawhiri con il profilo standard (salita, scoppio, discesa).

    quando: datetime con fuso orario. quota: quota di scoppio [m], la decide il
    nostro modello del pallone. vdisc: velocita' di discesa AL LIVELLO DEL MARE
    [m/s]; Tawhiri la fa crescere in quota come 1/sqrt(rho), la stessa legge usata
    in traiettoria(). alt_lancio None: Tawhiri usa la quota del terreno.
    Restituisce (punti, info), punti = [(t, lat, lon, z, fase)] con lon in [-180,180).
    """
    q={"profile":"standard_profile","launch_latitude":f"{lat:.5f}",
       "launch_longitude":f"{lon%360:.5f}",            # Tawhiri vuole la longitudine in 0-360
       "launch_datetime":_iso_z(quando),"ascent_rate":f"{vsalita:.2f}",
       "burst_altitude":f"{quota:.0f}","descent_rate":f"{vdisc:.2f}"}
    if alt_lancio is not None: q["launch_altitude"]=f"{alt_lancio:.0f}"
    req=urllib.request.Request(url+"?"+urllib.parse.urlencode(q),
                               headers={"User-Agent":"COMETA cometa_venti.py"})
    try:
        with urllib.request.urlopen(req,timeout=90) as r: d=json.load(r)
    except urllib.error.HTTPError as e:
        # gli errori di Tawhiri (data fuori previsione, parametri...) arrivano in JSON
        try: msg=json.load(e).get("error",{}).get("description") or str(e)
        except Exception: msg=str(e)
        raise RuntimeError(msg) from None
    if "error" in d: raise RuntimeError(d["error"].get("description","errore Tawhiri"))
    return _leggi_tawhiri(d)

def _leggi_tawhiri(d):
    punti=[]
    for fase in d["prediction"]:
        for p in fase["trajectory"]:
            lo=p["longitude"]; lo=lo-360 if lo>=180 else lo
            punti.append((_da_iso(p["datetime"]),p["latitude"],lo,p["altitude"],fase["stage"]))
    rq=d.get("request",{})
    return punti,{"dataset":rq.get("dataset"),"warnings":d.get("warnings") or {}}

def _mock_tawhiri(cfg,lat,lon,quando,quota,vdisc):
    """Risposta finta, nello stesso formato JSON di Tawhiri, sui venti di _mock_finestra."""
    loc=quando.astimezone(TZ_LANCIO); g=loc.date(); i=loc.hour
    h=_mock_finestra(cfg,g,g,lat,lon)
    zs=[10.0]+[QUOTA_LIV[l] for l in LIVELLI_HPA]
    sp=[h["wind_speed_10m"][i]]+[h[f"wind_speed_{l}hPa"][i] for l in LIVELLI_HPA]
    di=[h["wind_direction_10m"][i]]+[h[f"wind_direction_{l}hPa"][i] for l in LIVELLI_HPA]
    zs,us,vs=_uv_liste((zs,sp,di))
    fasi={"ascent":[],"descent":[]}; x=y=0.0; z=10.0; t=0.0; dt=60.0
    def punto(f):
        fasi[f].append({"datetime":_iso_z(quando+timedelta(seconds=t)),"altitude":z,
                        "latitude":lat+y/111320.0,
                        "longitude":(lon+x/(111320.0*math.cos(math.radians(lat))))%360})
    punto("ascent")
    while z<quota:
        x+=interp(z,zs,us)*dt; y+=interp(z,zs,vs)*dt; z=min(quota,z+cfg.vsalita*dt); t+=dt; punto("ascent")
    punto("descent")
    while z>10.0:
        vd=vdisc*math.sqrt(RHO0/densita_isa(z))
        x+=interp(z,zs,us)*dt; y+=interp(z,zs,vs)*dt; z=max(10.0,z-vd*dt); t+=dt; punto("descent")
    return _leggi_tawhiri({"prediction":[{"stage":s,"trajectory":fasi[s]} for s in ("ascent","descent")],
                           "request":{"dataset":"MOCK"}})

GIORNI_SETT=["lun","mar","mer","gio","ven","sab","dom"]

def istanti_lancio(cfg):
    """Istanti di lancio da --lancio (ora locale di Montevideo) e --giorni-prev."""
    try:
        if cfg.lancio:
            d0=datetime.fromisoformat(cfg.lancio)
            if "T" not in cfg.lancio: d0=d0.replace(hour=cfg.ora)
        else:                                          # default: domani all'ora di lancio
            d0=datetime.now(TZ_LANCIO).replace(hour=cfg.ora,minute=0,second=0,microsecond=0)+timedelta(days=1)
    except ValueError:
        print('\nErrore: --lancio deve essere YYYY-MM-DD oppure YYYY-MM-DDTHH:MM (es. 2026-10-07T08:00).\n'); sys.exit(1)
    if d0.tzinfo is None: d0=d0.replace(tzinfo=TZ_LANCIO)
    return [d0+timedelta(days=k) for k in range(max(1,cfg.giorni_prev))]

def riassunto_volo(sito,lat,lon,quando,punti,info,cfg):
    t0=punti[0][0]; fine=punti[-1]
    asc=[p for p in punti if p[4]=="ascent"]; apo=asc[-1] if asc else max(punti,key=lambda p:p[3])
    la,lo=fine[1],fine[2]
    return dict(sito=sito,quando=quando,lat=la,lon=lo,punti=punti,dataset=info.get("dataset"),
                deriva=dist_km(lat,lon,la,lo),rotta=rotta_deg(lat,lon,la,lo),
                durata=(fine[0]-t0).total_seconds()/60.0,
                salita=(apo[0]-t0).total_seconds()/60.0,
                scoppio_lat=apo[1],scoppio_lon=apo[2],quota_max=apo[3],
                dist_scoppio=dist_km(lat,lon,apo[1],apo[2]),stato=stato(cfg,la,lo))

def atmosfera_prevista(cfg,lat,lon,istanti):
    """Previsione Open-Meteo (T e quota geopotenziale fino a 30 hPa) per i giorni dei lanci,
    o None. E' la stessa atmosfera del giorno dello studio storico, ma dalla previsione."""
    if cfg.quota_forzata is not None or cfg.atm!="reale": return None
    giorni=[q.astimezone(TZ_LANCIO).date() for q in istanti]
    ep=cfg.endpoint; cfg.endpoint="forecast"
    try: return scarica_finestra(cfg,lat,lon,min(giorni),max(giorni))
    except Exception as e:
        print(f"  [!] atmosfera del giorno non disponibile ({e}): quota di scoppio sull'ISA.")
        return None
    finally: cfg.endpoint=ep

def quota_del_giorno(cfg,h,lat,lon,q):
    """(quota di scoppio [m], fonte) per l'istante q: atmosfera del giorno, o il valore di cfg.quota."""
    if cfg.quota_forzata is not None: return cfg.quota,"imposta"
    if h is None: return cfg.quota,"isa"
    ql=q.astimezone(TZ_LANCIO); ora=cfg.ora
    cfg.ora=min(23,ql.hour+(1 if ql.minute>=30 else 0))          # colonna() legge l'ora da cfg
    try: col=colonna(cfg,h,ql.date().isoformat(),lat,lon)
    finally: cfg.ora=ora
    if col is None: return cfg.quota,"isa"
    return quota_scoppio(cfg.V_elio,cfg.diametro,col.rho),"giorno+"+cfg.rif

def previsione_tawhiri(cfg):
    istanti=istanti_lancio(cfg)
    print(f"PREVISIONE TAWHIRI (SondeHub, venti NOAA GFS){' [MOCK]' if cfg.mock else ''}")
    print(f"  salita {cfg.vsalita} m/s | discesa al suolo {cfg.vatt:.1f} m/s | scoppio {cfg.quota/1000:.1f} km con l'ISA")
    if cfg.quota_forzata is None and cfg.atm=="reale":
        print(f"  La quota di scoppio si ricalcola per ogni lancio con l'atmosfera prevista (Open-Meteo fino a"
              f" 30 hPa, sopra {cfg.rif.upper()}).")
    print("  Quota di scoppio e discesa vengono dal modello del pallone: Tawhiri integra solo i venti.")
    ora=datetime.now(timezone.utc)
    if not cfg.mock and max(istanti)-ora>timedelta(days=7):
        print("  [AVVISO] oltre ~7 giorni la corsa GFS di Tawhiri non arriva: quei lanci falliranno.")
    elif not cfg.mock and max(istanti)-ora>timedelta(days=4):
        print("  [AVVISO] a piu' di 4-5 giorni la previsione dei venti e' poco affidabile: "
              "ripetere il calcolo nei giorni successivi.")
    print()
    print(f"{'SITO':22s}{'lancio (ora UY)':>18}{'atterraggio':>21}{'deriva':>8}{'rotta':>7}"
          f"{'durata':>8}{'scoppio a':>11}{'quota':>8}{'stato':>7}")
    voli=[]
    for sito,(lat,lon) in cfg.siti.items():
        h=atmosfera_prevista(cfg,lat,lon,istanti)
        for q in istanti:
            ql=q.astimezone(TZ_LANCIO)
            qb,fonte=quota_del_giorno(cfg,h,lat,lon,q)
            try:
                punti,info=(_mock_tawhiri(cfg,lat,lon,q,qb,cfg.vatt) if cfg.mock else
                            tawhiri(lat,lon,q,cfg.vsalita,qb,cfg.vatt,cfg.alt_lancio,cfg.tawhiri_url))
            except Exception as e:
                print(f"  [!] {sito} {ql:%d/%m %H:%M}: {e}"); continue
            if len(punti)<2:
                print(f"  [!] {sito} {ql:%d/%m %H:%M}: traiettoria vuota"); continue
            v=riassunto_volo(sito,lat,lon,q,punti,info,cfg); voli.append(v)
            etq=f"{GIORNI_SETT[ql.weekday()]} {ql:%d/%m %H:%M}"
            print(f"{sito:22s}{etq:>18}{v['lat']:>10.3f},{v['lon']:>9.3f}"
                  f"{v['deriva']:>6.0f}km{v['rotta']:>6.0f}°{v['durata']:>5.0f}min"
                  f"{v['dist_scoppio']:>8.0f} km{v['quota_max']/1000:>6.2f}km{v['stato']:>7}"
                  f"{'' if fonte.startswith('giorno') else '  ('+fonte+')'}")
    print()
    if not voli:
        print("Nessuna traiettoria: la data e' fuori dalla previsione GFS (circa una settimana"
              " da oggi) oppure il servizio non e' raggiungibile.")
        return
    corse=sorted({v["dataset"] for v in voli if v["dataset"]})
    if corse: print(f"Corsa GFS usata: {', '.join(corse)} (UTC)")
    print("Previsione deterministica: una sola traiettoria, senza incertezza associata. Per sapere")
    print("quanto fidarsi, ripetere il calcolo sulle corse successive (ogni 6 ore) e guardare quanto")
    print("si sposta l'atterraggio; il confronto con l'ellisse dello studio storico dice se il giorno")
    print("e' tipico o anomalo.")
    out=f"{cfg.prefix}_tawhiri.csv"
    with open(out,"w",newline="") as f:
        w=csv.writer(f)
        w.writerow(["sito","lancio_locale","lancio_utc","lat","lon","deriva_km","rotta_deg","durata_min",
                    "salita_min","quota_scoppio_km","dist_scoppio_km","stato","corsa_gfs"])
        for v in voli:
            w.writerow([v["sito"],v["quando"].astimezone(TZ_LANCIO).strftime("%Y-%m-%d %H:%M"),_iso_z(v["quando"]),
                        f"{v['lat']:.4f}",f"{v['lon']:.4f}",f"{v['deriva']:.1f}",f"{v['rotta']:.0f}",
                        f"{v['durata']:.0f}",f"{v['salita']:.0f}",f"{v['quota_max']/1000:.2f}",
                        f"{v['dist_scoppio']:.1f}",v["stato"],v["dataset"] or ""])
    print(f"\nCSV -> {out}")
    if getattr(cfg,"html",False): mappa_tawhiri_html(cfg,voli)

def mappa_tawhiri_html(cfg,voli):
    try:
        import folium
    except ImportError:
        print("(folium non installato: salto la mappa HTML. Installa con: pip install folium)"); return
    lats=[p[1] for v in voli for p in v["punti"]]; lons=[p[2] for v in voli for p in v["punti"]]
    m=folium.Map(location=[media(lats),media(lons)],tiles="OpenStreetMap",control_scale=True)
    m.fit_bounds([[min(lats),min(lons)],[max(lats),max(lons)]])
    if cfg.esclusione:
        folium.Polygon([(p[1],p[0]) for p in cfg.esclusione],color="red",weight=2,
                       fill=True,fill_color="red",fill_opacity=0.18,popup="Area di esclusione").add_to(m)
    for z in getattr(cfg,"zone",[]):
        if z["tipo"]=="cerchio":
            folium.Circle([z["lat"],z["lon"]],radius=z["raggio_km"]*1000,color="red",weight=2,
                          fill=True,fill_color="red",fill_opacity=0.18,popup=z["nome"]).add_to(m)
        else:
            folium.Polygon([(p[1],p[0]) for p in z["punti"]],color="red",weight=2,
                           fill=True,fill_color="red",fill_opacity=0.18,popup=z["nome"]).add_to(m)
    cols=["blue","green","orange","purple","cadetblue","darkred","lightblue","red"]
    col_sito={s:cols[i%len(cols)] for i,s in enumerate(cfg.siti)}
    for sito,(lat,lon) in cfg.siti.items():
        folium.Marker([lat,lon],tooltip=f"Lancio: {sito}",
                      icon=folium.Icon(color=col_sito[sito],icon="star")).add_to(m)
    for v in voli:
        c=col_sito[v["sito"]]; ql=v["quando"].astimezone(TZ_LANCIO)
        fg=folium.FeatureGroup(name=f"{v['sito']} · {ql:%d/%m %H:%M}")
        asc=[(p[1],p[2]) for p in v["punti"] if p[4]=="ascent"]
        disc=[(p[1],p[2]) for p in v["punti"] if p[4]!="ascent"]
        if len(asc)>1: folium.PolyLine(asc,color=c,weight=3,opacity=0.9,tooltip="salita").add_to(fg)
        if len(disc)>1: folium.PolyLine(disc,color=c,weight=2,opacity=0.9,dash_array="6 6",tooltip="discesa").add_to(fg)
        folium.CircleMarker([v["scoppio_lat"],v["scoppio_lon"]],radius=5,color=c,fill=True,fill_color="white",
                            fill_opacity=1,popup=f"scoppio a {v['quota_max']/1000:.1f} km, dopo {v['salita']:.0f} min").add_to(fg)
        folium.CircleMarker([v["lat"],v["lon"]],radius=7,color=c,fill=True,fill_opacity=1,
                            popup=(f"{v['sito']} {ql:%d/%m %H:%M}: atterraggio {v['lat']:.4f}, {v['lon']:.4f}<br>"
                                   f"deriva {v['deriva']:.0f} km, rotta {v['rotta']:.0f}°, {v['durata']:.0f} min"
                                   f"<br>corsa GFS {v['dataset']}")).add_to(fg)
        fg.add_to(m)
    folium.LayerControl(collapsed=False).add_to(m)
    out=f"{cfg.prefix}_tawhiri.html"; m.save(out)
    print(f"Mappa HTML interattiva -> {out}")

# ==========================================================================
# Statistica
# ==========================================================================
def media(v): return sum(v)/len(v)
def mediana(v):
    s=sorted(v); n=len(s); m=n//2; return s[m] if n%2 else (s[m-1]+s[m])/2
def devstd(v):
    if len(v)<2: return 0.0
    mu=media(v); return math.sqrt(sum((x-mu)**2 for x in v)/(len(v)-1))
def percentile(v,p):
    s=sorted(v); k=max(0,min(len(s)-1,math.ceil(p/100*len(s))-1)); return s[k]
def rotta_media(g):
    sx=media([math.sin(math.radians(a)) for a in g]); cy=media([math.cos(math.radians(a)) for a in g])
    return (math.degrees(math.atan2(sx,cy))+360)%360
def ellisse(xs,ys,p):
    n=len(xs); cx=media(xs); cy=media(ys)
    a=sum((x-cx)**2 for x in xs)/(n-1); d=sum((y-cy)**2 for y in ys)/(n-1)
    b=sum((x-cx)*(y-cy) for x,y in zip(xs,ys))/(n-1)
    R=math.sqrt(((a-d)/2)**2+b**2); lmaj=(a+d)/2+R; lmin=max(1e-12,(a+d)/2-R)
    ang=0.0 if abs(b)<1e-12 else math.degrees(math.atan2(lmaj-a,b))
    k=math.sqrt(-2*math.log(1-p))
    return cx,cy,2*k*math.sqrt(lmaj),2*k*math.sqrt(lmin),ang
def ellisse_punti(cx,cy,w,h,ang,n=120):
    a=w/2; b=h/2; th=math.radians(ang); xs=[]; ys=[]
    for i in range(n+1):
        t=2*math.pi*i/n; ex=a*math.cos(t); ey=b*math.sin(t)
        xs.append(cx+ex*math.cos(th)-ey*math.sin(th)); ys.append(cy+ex*math.sin(th)+ey*math.cos(th))
    return xs,ys

def _mock_finestra(cfg,start,end,lat=-33,lon=-57):
    import random; random.seed(start.year); base=270+random.uniform(-30,30)
    grad=(lon+57)*4   # gradiente: la direzione ruota con la longitudine (per testare le 2 colonne)
    keys=["wind_speed_10m","wind_direction_10m","temperature_2m","surface_pressure"]
    for l in LIVELLI_HPA: keys+=[f"wind_speed_{l}hPa",f"wind_direction_{l}hPa",
                                 f"temperature_{l}hPa",f"geopotential_height_{l}hPa"]
    h={k:[] for k in keys}; h["time"]=[]
    jet={1000:5,925:7,850:9,700:12,500:18,400:28,300:38,250:45,200:38,150:28,100:20,70:16,50:13,30:11}
    d=start
    while d<=end:
        for hr in range(24):
            h["time"].append(f"{d.isoformat()}T{hr:02d}:00")
            dd=base+grad+random.uniform(-20,20)
            h["wind_speed_10m"].append(4+random.uniform(0,3)); h["wind_direction_10m"].append(dd%360)
            h["temperature_2m"].append(18+random.uniform(-6,8)); h["surface_pressure"].append(1013+random.uniform(-8,8))
            dT=random.uniform(-4,4)                       # anomalia termica del giorno, uniforme in colonna
            for l in LIVELLI_HPA:
                h[f"wind_speed_{l}hPa"].append(jet[l]*(0.8+random.uniform(0,0.4)))
                h[f"wind_direction_{l}hPa"].append((dd+random.uniform(-15,15))%360)
                zi=QUOTA_LIV[l]                          # quota ISA del livello
                Ti=l*100.0/(R_ARIA*densita_isa(zi))      # temperatura ISA coerente col livello
                h[f"temperature_{l}hPa"].append(Ti+dT-273.15)
                # colonna piu' calda -> livelli piu' alti (relazione ipsometrica, approx.)
                h[f"geopotential_height_{l}hPa"].append(zi*(1+dT/250.0))
        d+=timedelta(days=1)
    return h

# ==========================================================================
# Parsing / interattivo
# ==========================================================================
def parse_range(s):
    s=s.strip()
    if "-" in s and "," not in s: a,b=s.split("-"); return list(range(int(a),int(b)+1))
    return [int(x) for x in s.split(",")]
def parse_sito(s):
    t=s.strip().strip("[]()").strip().strip('"').strip("'").strip()
    try:
        nome,lat,lon=t.rsplit(",",2); return nome.strip().strip('"').strip("'"),(float(lat),float(lon))
    except ValueError:
        raise ValueError(f'sito non valido: "{s}". Formato Nome,lat,lon (es. Mercedes,-33.25,-58.03).')
def carica_poligono(path):
    pts=[]
    with open(path) as f:
        for ln in f:
            ln=ln.strip()
            if not ln or ln.startswith("#") or ln.lower().startswith("lon"): continue
            a,b=ln.replace(";",",").split(",")[:2]; pts.append((float(a),float(b)))
    return pts
def chiedi(p,d):
    try: r=input(f"  {p} [{d}]: ").strip()
    except EOFError: r=""
    return r if r else d
def args_interattivi():
    print("=== COMETA - setup interattivo (Invio = default) ===")
    ns=argparse.Namespace()
    ns.tawhiri=chiedi("Studio storico o previsione del giorno (storico/tawhiri)","storico").lower().startswith("t")
    print(" PALLONE")
    pal=chiedi("Pallone (1600 / 2000 / custom)","1600")
    ns.pallone=pal
    if pal=="custom":
        ns.diametro=float(chiedi("  Diametro di scoppio [m]","9.5"))
        ns.massa=float(chiedi("  Massa del pallone [kg]","1.5"))
    else: ns.diametro=None; ns.massa=None
    ns.payload=float(chiedi("Payload [kg]","1.2"))
    ns.vsalita=float(chiedi("Velocita di salita [m/s]","5"))
    ns.elio=float(chiedi("Elio disponibile [m3]","6"))
    if pal in PRESET:
        pd=chiedi("Diametro paracadute [m] (Invio = Parachute 2500 del kit: 1.2 m, 80 g)","")
    else:
        pd=chiedi("Diametro paracadute [m] (Invio = stima default 5 m/s)","")
    if pd.strip():
        ns.paracadute=float(pd)
        mp=chiedi("Massa paracadute [kg]","0.08")
        ns.massa_para=float(mp) if mp.strip() else 0.08
    else:
        ns.paracadute=None; ns.massa_para=None
    ns.cd_paracadute=1.0
    ns.vatt=None  # calcolata in get_args(): preset 2500 / paracadute dato / 5.0 di default
    print(" MISSIONE")
    s=chiedi('Siti "Nome,lat,lon" separati da ;',"Durazno,-33.38,-56.52; Mercedes,-33.249,-58.030")
    ns.sito=[x.strip() for x in s.split(";") if x.strip()]
    if ns.tawhiri:
        # le altre opzioni prendono il default del parser (vedi get_args)
        domani=(date.today()+timedelta(days=1)).isoformat()
        ns.lancio=chiedi("Data di lancio (YYYY-MM-DD, ora locale)",domani)
        ns.ora=int(chiedi("Ora di lancio locale","9"))
        ns.giorni_prev=int(chiedi("Quanti giorni consecutivi","1"))
        ns.html=chiedi("Anche mappa HTML interattiva? (s/n)","s").lower().startswith("s")
        ns.prefix=(chiedi("Nome base dei file di output","cometa").strip().replace(" ","_") or "cometa")
        ns.mock=False; ns.quota=None
        print()
        return ns
    ns.anni=chiedi("Anni","2021-2024")
    ns.data_inizio=chiedi("Data di inizio (MM-DD)","10-01")
    ns.giorni=int(chiedi("Numero di giorni della finestra","31"))
    ns.step=int(chiedi("Campiona ogni N giorni","3"))
    ns.ora=int(chiedi("Ora di lancio locale","9"))
    ns.endpoint=chiedi("Endpoint (era5/hist_forecast)","hist_forecast")
    ns.atm=chiedi("Profilo di densita' (reale = T del giorno da Open-Meteo / isa)","reale")
    if ns.atm not in ("reale","isa"): ns.atm="reale"
    dr="msis" if msis_disponibile() else "isa"
    ns.rif=chiedi("Riferimento sopra i 24 km (isa/msis)",dr)
    if ns.rif not in ("isa","msis"): ns.rif="isa"
    g=chiedi("Suddividi in periodi? date MM-DD che chiudono ogni gruppo, separate da virgola\n"
             "  (Invio = nessuna suddivisione; es. 10-09,10-24)","").strip()
    ns.gruppi = g or None
    if ns.gruppi:
        ns.ellissi=chiedi("Ellisse su quali gruppi (primo/tutti/nessuno)","primo")
        if ns.ellissi not in ("primo","tutti","nessuno"): ns.ellissi="primo"
    else:
        ns.ellissi="primo"
    ns.basemap=chiedi("Mappa (auto/cartopy/simple)","auto")
    ns.html=chiedi("Anche mappa HTML interattiva? (s/n)","s").lower().startswith("s")
    z=chiedi("File zone di esclusione JSON (Invio = nessuno)","")
    ns.zone = z.strip() or None
    ns.prefix = (chiedi("Nome base dei file di output","cometa").strip().replace(" ","_") or "cometa")
    ns.risoluzione="50m"
    ns.dt=10.0; ns.mock=False; ns.diag=False; ns.advezione="due-colonne"
    ns.esclusione=None; ns.territorio=None; ns.quota=None
    print()
    return ns
def get_args():
    p=argparse.ArgumentParser(description="COMETA - footprint atterraggi da venti storici")
    p.add_argument("--pallone",choices=["1600","2000","custom"],default="1600")
    p.add_argument("--diametro",type=float,help="diametro di scoppio [m] (override)")
    p.add_argument("--massa-pallone",dest="massa",type=float,help="massa pallone [kg] (override)")
    p.add_argument("--payload",type=float,default=1.2,help="massa payload [kg]")
    p.add_argument("--vsalita",type=float,default=5.0)
    p.add_argument("--vatterraggio",dest="vatt",type=float,default=None,
                   help="velocita di atterraggio al suolo [m/s] (override manuale; avanzato)")
    p.add_argument("--paracadute",type=float,default=None,
                   help="diametro paracadute [m]: se dato, calcola v_atterraggio (altrimenti 5 m/s di default)")
    p.add_argument("--cd-paracadute",dest="cd_paracadute",type=float,default=1.0,
                   help="coefficiente di resistenza del paracadute (default 1.0)")
    p.add_argument("--massa-paracadute",dest="massa_para",type=float,default=None,
                   help="massa del paracadute [kg] da sommare al payload in discesa (preset 2500: 0.08)")
    p.add_argument("--elio",type=float,default=6.0,help="elio disponibile [m3]")
    p.add_argument("--quota",type=float,help="forza la quota di scoppio [m] (altrimenti calcolata)")
    p.add_argument("--sito",action="append",help='"Nome,lat,lon" (ripetibile)')
    p.add_argument("--anni",default="2021-2024")
    p.add_argument("--data-inizio",dest="data_inizio",default="10-01",help="inizio finestra, formato MM-DD")
    p.add_argument("--giorni",type=int,default=31,help="numero di giorni della finestra (puo' attraversare i mesi)")
    p.add_argument("--step",type=int,default=3)
    p.add_argument("--ora",type=int,default=9)
    p.add_argument("--endpoint",choices=["era5","hist_forecast"],default="hist_forecast")
    p.add_argument("--temp-gonfiaggio",dest="tgonf",default="auto",
                   help="Temperatura dell'aria al gonfiaggio in C, oppure 'auto' (mediana "
                        "dei dati all'ora di lancio). Cambia i LITRI da caricare, non la "
                        "quantita' di elio ne' la quota di scoppio.")
    p.add_argument("--gruppi",default=None,
                   help="Suddivide gli atterraggi in periodi, per non mescolare popolazioni con "
                        "statistiche diverse. Date MM-DD che CHIUDONO ogni gruppo tranne l'ultimo, "
                        "separate da virgola. Es: --gruppi 10-09,10-24 . L'ellisse viene calcolata "
                        "solo sul primo gruppo (quello che contiene la data prevista di lancio).")
    p.add_argument("--ellissi",choices=["primo","tutti","nessuno"],default="primo",
                   help="Su quali gruppi calcolare l'ellisse di confidenza (default: solo il primo)")
    p.add_argument("--atm",choices=["isa","reale"],default="reale",
                   help="profilo di densita': 'reale' usa T e quota geopotenziale del giorno "
                        "(Open-Meteo, fino a 30 hPa ~24 km); 'isa' usa l'atmosfera standard")
    p.add_argument("--rif",choices=["isa","msis","auto"],default="auto",
                   help="forma verticale usata SOPRA l'ultimo livello disponibile "
                        "('msis' richiede pymsis; tiene conto di latitudine e stagione). "
                        "Default: msis con --tawhiri se pymsis c'e' (come il sito), altrimenti isa")
    p.add_argument("--esclusione",help="file lon,lat del poligono di esclusione")
    p.add_argument("--zone",help="file JSON con zone di esclusione (poligoni e cerchi); vale anche fuori Uruguay")
    p.add_argument("--territorio",help='file lon,lat del territorio recuperabile ("none" per disattivare)')
    p.add_argument("--basemap",choices=["auto","cartopy","simple"],default="auto")
    p.add_argument("--risoluzione",choices=["10m","50m","110m"],default="50m",help="risoluzione mappa cartopy")
    p.add_argument("--html",action="store_true",help="genera anche una mappa interattiva HTML (folium)")
    p.add_argument("--advezione",choices=["singola","due-colonne"],default="due-colonne",
                   help="singola = colonna del sito per tutto; due-colonne = salita al sito, discesa sottovento (+ auto-test incertezza)")
    p.add_argument("--prefix",default="cometa")
    p.add_argument("--dt",type=float,default=10.0)
    p.add_argument("--mock",action="store_true"); p.add_argument("--diag",action="store_true")
    tw=p.add_argument_group("previsione del giorno (Tawhiri, venti NOAA GFS)")
    tw.add_argument("--tawhiri",action="store_true",
                    help="traiettoria prevista da Tawhiri/SondeHub invece dello studio storico")
    tw.add_argument("--lancio",default=None,
                    help="YYYY-MM-DD oppure YYYY-MM-DDTHH:MM, ora locale di Montevideo "
                         "(senza ora vale --ora; default: domani)")
    tw.add_argument("--giorni-prev",dest="giorni_prev",type=int,default=1,
                    help="numero di giorni consecutivi da prevedere, stessa ora (default 1)")
    tw.add_argument("--quota-lancio",dest="alt_lancio",type=float,default=None,
                    help="quota del sito [m] (default: quella del terreno, la sceglie Tawhiri)")
    tw.add_argument("--tawhiri-url",dest="tawhiri_url",default=TAWHIRI_URL,
                    help="indirizzo dell'API (per un'istanza propria di Tawhiri)")
    a=args_interattivi() if len(sys.argv)==1 else p.parse_args()
    # La modalita' interattiva costruisce il Namespace a mano: qualunque opzione
    # non chiesta esplicitamente prende il default del parser, cosi' aggiungerne
    # una nuova non rompe piu' il percorso interattivo.
    for k,v in vars(p.parse_args([])).items():
        if not hasattr(a,k): setattr(a,k,v)
    # preset pallone + override
    if a.pallone in PRESET:
        pr=PRESET[a.pallone]
        if a.diametro is None: a.diametro=pr["diametro"]
        if a.massa is None:    a.massa=pr["massa"]
        a.pmax=pr["pmax"]; a.vrec=(pr["vmin"],pr["vmax"])
    else:
        a.pmax=None; a.vrec=None
        if a.diametro is None or a.massa is None:
            print("\nErrore: con --pallone custom servono --diametro e --massa-pallone.\n"); sys.exit(1)
    # velocita' di atterraggio al suolo: priorita' manuale > paracadute manuale > paracadute del preset > default.
    # massa in discesa = payload + massa paracadute (il residuo di lattice e' solo il collo: trascurabile).
    a.cd_paracadute=getattr(a,"cd_paracadute",1.0) or 1.0
    a.massa_para=getattr(a,"massa_para",None)
    _pr=PRESET.get(a.pallone)
    if a.vatt is not None:
        a.vatt_src="manuale"; a.paracadute=getattr(a,"paracadute",None)
    elif getattr(a,"paracadute",None):                      # paracadute manuale (altri palloni)
        if a.massa_para is None: a.massa_para=0.0
        a.m_disc=a.payload+a.massa_para
        a.vatt=v_atterraggio(a.m_disc,a.paracadute,a.cd_paracadute); a.vatt_src="paracadute"
    elif _pr and _pr.get("para_d"):                          # paracadute del preset (2500)
        a.paracadute=_pr["para_d"]; a.cd_paracadute=_pr["para_cd"]
        a.massa_para=_pr["para_m"]; a.m_disc=a.payload+a.massa_para
        a.vatt=v_atterraggio(a.m_disc,a.paracadute,a.cd_paracadute); a.vatt_src="paracadute"
    else:
        a.vatt=5.0; a.vatt_src="default"; a.paracadute=getattr(a,"paracadute",None)
    if a.rif=="auto": a.rif="msis" if (a.tawhiri and msis_disponibile()) else "isa"
    a.anni=parse_range(a.anni)
    try: mm,dd=a.data_inizio.split("-"); a.mm=int(mm); a.dd=int(dd)
    except Exception: print('\nErrore: --data-inizio deve essere MM-DD (es. 10-01).\n'); sys.exit(1)
    a.ngiorni=int(a.giorni)
    if a.sito:
        try: a.siti=dict(parse_sito(s) for s in a.sito)
        except ValueError as e: print(f"\nErrore: {e}\n"); sys.exit(1)
    else: a.siti={"Durazno":(-33.380,-56.520),"Mercedes (Soriano)":(-33.249,-58.030)}
    # poligoni
    a.escl_default = not getattr(a,"esclusione",None)
    a.esclusione = EXCL_POLY if a.escl_default else (None if a.esclusione=="none" else carica_poligono(a.esclusione))
    a.terr_default = getattr(a,"territorio",None) in (None,"")
    if a.terr_default: a.territorio=URU_POLY
    elif a.territorio=="none": a.territorio=None
    else: a.territorio=carica_poligono(a.territorio)
    a.zone = carica_zone(a.zone) if getattr(a,"zone",None) else []
    return a

# ==========================================================================
# Tabella prestazioni del pallone (range di massa -> elio, quota di scoppio)
# ==========================================================================
def tabella_pallone(cfg):
    print("PRESTAZIONI DEL PALLONE")
    print("  Salita piu' lenta -> scoppio piu' alto ma volo piu' lungo e piu' deriva; piu' veloce -> meno deriva.")
    pmax=cfg.pmax or 2.0
    pls=[]; x=0.6
    while x<=pmax+1e-9: pls.append(round(x,2)); x+=0.2
    if not pls or pls[-1]<pmax-1e-9: pls.append(round(pmax,2))
    print(f"  Range di massa (a v_salita = {cfg.vsalita:.1f} m/s):")
    print(f"    {'payload(kg)':>11} {'elio(L)':>8} {'neck(g)':>8} {'burst(km)':>10}")
    for mp in pls:
        V=V_per_salita(cfg.massa,mp,cfg.vsalita)
        if not V:
            print(f"    {mp:>11.1f}   (troppo pesante per salire)"); continue
        b=quota_scoppio(V,cfg.diametro)
        flag=" *oltre nominale" if (cfg.pmax and mp>cfg.pmax+1e-9) else ""
        print(f"    {mp:>11.1f} {V*1000:>8.0f} {neck_g(V,cfg.massa):>8.0f} {b/1000:>10.1f}{flag}")
    print()

# ==========================================================================
# Avvisi
# ==========================================================================
def avvisi(cfg,V,burst,neck):
    A=[]
    if cfg.payload<=0: print("\nErrore: payload non valido (<=0).\n"); sys.exit(1)
    if V is None:
        print(f"\nErrore: payload {cfg.payload} kg troppo pesante per il pallone "
              f"(massa {cfg.massa} kg): impossibile salire a {cfg.vsalita} m/s.\n"); sys.exit(1)
    if cfg.pmax and cfg.payload>cfg.pmax:
        A.append(f"payload {cfg.payload*1000:.0f} g supera il massimo nominale del pallone ({cfg.pmax*1000:.0f} g).")
    # Gli stessi avvisi del sito (assets/traiettoria.js): solo cio' che compromette il volo.
    if cfg.vsalita<3:   A.append("salita <3 m/s: volo molto lungo, deriva ampia, rischio di galleggiamento.")
    if cfg.vatt>6:
        m=getattr(cfg,"m_disc",cfg.payload)
        d5=math.sqrt(8*m*G/(RHO0*(cfg.cd_paracadute or 1.0)*math.pi*25))
        A.append(f"discesa al suolo {cfg.vatt:.1f} m/s: oltre 6 m/s l'urto rischia di danneggiare la sonda "
                 f"(per 5 m/s serve un paracadute di almeno {d5:.1f} m).")
    if V>cfg.elio:      A.append(f"elio necessario {V*1000:.0f} L ({V:.2f} m3) SUPERA il disponibile "
                                 f"({cfg.elio:.2f} m3). Riduci payload o velocita'.")
    if burst<30000:     A.append(f"quota di scoppio attesa bassa ({burst/1000:.1f} km).")
    if cfg.tawhiri: pass                     # lo studio storico non viene eseguito
    elif cfg.endpoint=="era5":
        A.append("endpoint era5: NON fornisce i venti in quota -> usa --endpoint hist_forecast.")
    elif cfg.endpoint=="hist_forecast" and min(cfg.anni)<2021:
        A.append("hist_forecast disponibile dal 2021: anni precedenti verranno saltati.")
    for m in A: print(f"  [AVVISO] {m}")
    if A: print()

# ==========================================================================
# Mappa
# ==========================================================================
def raggruppa(cfg,dati):
    """Suddivide gli atterraggi in periodi di calendario.

    L'ellisse di confidenza e' un riassunto parametrico: presuppone UNA popolazione,
    con media, dispersione e orientamento definiti. Su un periodo in cui le statistiche
    stanno cambiando quel presupposto e' falso, e l'ellisse descriverebbe una situazione
    che non si verifica in nessun giorno. Qui i punti si mostrano tutti; l'ellisse si
    calcola solo dove la stazionarieta' e' stata verificata (per default il primo
    gruppo, quello che contiene la data prevista di lancio).
    """
    cfg.sito_di={s:s for s in dati}; cfg.chiavi_ellisse=set(dati)
    if not cfg.gruppi:
        if cfg.ellissi=="nessuno": cfg.chiavi_ellisse=set()
        return dati
    tagli=[]
    for t in cfg.gruppi.split(","):
        mm,dd=t.strip().split("-"); tagli.append((int(mm),int(dd)))
    def et(g): return (g.month,g.day)
    def idx(g):                                  # indice del gruppo di appartenenza
        for i,t in enumerate(tagli):
            if et(g)<=t: return i
        return len(tagli)
    ini=date(2000,cfg.mm,cfg.dd); fin=ini+timedelta(days=cfg.ngiorni-1)
    def etichetta(i,gs):
        # confini nominali dei gruppi, non min/max osservati: cosi' l'etichetta non
        # cambia al variare di --step
        a=ini if i==0 else date(2000,*tagli[i-1])+timedelta(days=1)
        b=fin if i==len(tagli) else date(2000,*tagli[i])
        return f"{a.day:02d}/{a.month:02d}-{b.day:02d}/{b.month:02d}"
    out={}; cfg.sito_di={}; cfg.chiavi_ellisse=set()
    for sito,L in dati.items():
        per=defaultdict(list)
        for r in L: per[idx(r[9])].append(r)
        for i in sorted(per):
            k=f"{sito} · {etichetta(i,[r[9] for r in per[i]])}"
            out[k]=per[i]; cfg.sito_di[k]=sito
            if cfg.ellissi=="tutti" or (cfg.ellissi=="primo" and i==0):
                cfg.chiavi_ellisse.add(k)
    return out

def disegna_mappa(cfg,dati):
    try:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    except ImportError:
        print("(matplotlib non installato: salto la mappa)"); return
    # estensione
    allx=[r[0] for L in dati.values() for r in L]+[lon for _,lon in cfg.siti.values()]
    ally=[r[1] for L in dati.values() for r in L]+[lat for lat,_ in cfg.siti.values()]
    if cfg.esclusione: allx+=[p[0] for p in cfg.esclusione]; ally+=[p[1] for p in cfg.esclusione]
    for z in getattr(cfg,"zone",[]):
        if z["tipo"]=="cerchio":
            dlat=z["raggio_km"]/111.0; dlon=z["raggio_km"]/(111.0*math.cos(math.radians(z["lat"])))
            allx+=[z["lon"]-dlon,z["lon"]+dlon]; ally+=[z["lat"]-dlat,z["lat"]+dlat]
        else:
            allx+=[p[0] for p in z["punti"]]; ally+=[p[1] for p in z["punti"]]
    if not allx: print("(nessun atterraggio: salto la mappa)"); return
    mx=0.6; ext=[min(allx)-mx,max(allx)+mx,min(ally)-mx,max(ally)+mx]
    colori=["tab:blue","tab:cyan","tab:olive","tab:green","tab:orange","tab:red","tab:purple","tab:brown"]

    usa_cartopy=False
    if cfg.basemap in ("auto","cartopy"):
        try:
            import cartopy.crs as ccrs, cartopy.feature as cfeature
            usa_cartopy=True
        except ImportError:
            if cfg.basemap=="cartopy":
                print("cartopy non installato. Installa con: pip install cartopy  (poi rilancia).")
            else:
                print("(cartopy non disponibile: uso mappa schematica. Per la mappa reale: pip install cartopy)")

    if usa_cartopy:
        import warnings as _w
        try:
            from cartopy.io import DownloadWarning as _DW
            _w.filterwarnings("ignore", category=_DW)
        except Exception:
            _w.filterwarnings("ignore", message="Downloading:")
        sc=getattr(cfg,"risoluzione","50m")
        proj=ccrs.PlateCarree()
        fig,ax=plt.subplots(figsize=(10,9),subplot_kw={"projection":proj})
        ax.set_extent(ext,crs=proj)
        ax.add_feature(cfeature.OCEAN.with_scale(sc),facecolor="#d8ecf6")
        ax.add_feature(cfeature.LAND.with_scale(sc),facecolor="#f4f1ea")
        ax.add_feature(cfeature.LAKES.with_scale(sc),facecolor="#d8ecf6")
        ax.add_feature(cfeature.RIVERS.with_scale(sc),edgecolor="#9ec7e0",linewidth=0.4)
        ax.add_feature(cfeature.COASTLINE.with_scale(sc),linewidth=0.7)
        ax.add_feature(cfeature.BORDERS.with_scale(sc),linestyle=":",linewidth=0.7)
        ax.gridlines(draw_labels=True,alpha=0.25)
        tr=dict(transform=proj)
    else:
        fig,ax=plt.subplots(figsize=(10,9))
        ax.set_xlim(ext[0],ext[1]); ax.set_ylim(ext[2],ext[3]); ax.set_aspect(1.2)
        ax.grid(alpha=0.3); ax.set_xlabel("Longitudine"); ax.set_ylabel("Latitudine")
        for clon,clat,nome in CITTA:
            if ext[0]<clon<ext[1] and ext[2]<clat<ext[3]:
                ax.plot(clon,clat,"ks",ms=3); ax.annotate(nome,(clon,clat),fontsize=7,xytext=(3,2),textcoords="offset points")
        tr={}

    # area di esclusione (resa migliore: riempimento + bordo + tratteggio)
    if cfg.esclusione:
        ex=[p[0] for p in cfg.esclusione]+[cfg.esclusione[0][0]]
        ey=[p[1] for p in cfg.esclusione]+[cfg.esclusione[0][1]]
        ax.fill(ex,ey,facecolor="red",alpha=0.15,hatch="///",edgecolor="red",linewidth=1.6,zorder=3,**tr)
        cxe=media([p[0] for p in cfg.esclusione]); cye=media([p[1] for p in cfg.esclusione])
        ax.text(cxe,cye,"ESCLUSIONE",color="darkred",fontsize=8,ha="center",va="center",weight="bold",zorder=4,**tr)

    # zone di esclusione multiple (poligoni e cerchi aerodromo)
    for z in getattr(cfg,"zone",[]):
        if z["tipo"]=="cerchio":
            th=[i*2*math.pi/72 for i in range(73)]
            dlat=z["raggio_km"]/111.0; dlon=z["raggio_km"]/(111.0*math.cos(math.radians(z["lat"])))
            cx=[z["lon"]+dlon*math.cos(t) for t in th]; cy=[z["lat"]+dlat*math.sin(t) for t in th]
            ax.fill(cx,cy,facecolor="red",alpha=0.18,edgecolor="red",linewidth=1.3,zorder=3,**tr)
            ax.text(z["lon"],z["lat"],z["nome"],color="darkred",fontsize=6.5,ha="center",va="center",zorder=4,**tr)
        else:
            px=[p[0] for p in z["punti"]]+[z["punti"][0][0]]; py=[p[1] for p in z["punti"]]+[z["punti"][0][1]]
            ax.fill(px,py,facecolor="red",alpha=0.15,hatch="///",edgecolor="red",linewidth=1.4,zorder=3,**tr)
            ax.text(media(px),media(py),z["nome"],color="darkred",fontsize=6.5,ha="center",va="center",zorder=4,**tr)

    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch
    handles=[]; visti=set()
    for c,(sito,L) in zip(colori,dati.items()):
        if not L: continue
        xs=[r[0] for r in L]; ys=[r[1] for r in L]
        lat,lon=cfg.siti[getattr(cfg,"sito_di",{}).get(sito,sito)]
        # zone di confidenza: solo dove la popolazione e' stazionaria (vedi raggruppa())
        if sito in getattr(cfg,"chiavi_ellisse",{sito}):
            for pp,al in [(0.90,0.12),(0.50,0.24)]:
                ex2,ey2=ellisse_punti(*ellisse(xs,ys,pp))
                ax.fill(ex2,ey2,facecolor=c,alpha=al,edgecolor=c,linewidth=0.6,zorder=4,**tr)
        ax.scatter(xs,ys,s=8,c=c,alpha=0.35,zorder=5,**tr)
        cx,cy=media(xs),media(ys)
        ax.plot([lon,cx],[lat,cy],"-",c=c,lw=1,alpha=0.8,zorder=5,**tr)
        nome_sito=getattr(cfg,"sito_di",{}).get(sito,sito)
        if nome_sito not in visti:
            visti.add(nome_sito)
            ax.scatter([lon],[lat],s=200,c=c,marker="*",edgecolor="k",zorder=6,**tr)
        ax.scatter([cx],[cy],s=45,c=c,marker="X",edgecolor="k",zorder=6,**tr)
        handles.append(Line2D([],[],marker="o",color="w",markerfacecolor=c,markeredgecolor="k",markersize=9,label=sito))
    handles+=[Patch(facecolor="gray",alpha=0.24,label="zona 50%"),
              Patch(facecolor="gray",alpha=0.12,label="zona 90%"),
              Line2D([],[],marker="X",color="w",markerfacecolor="gray",markeredgecolor="k",label="atterraggio medio")]
    ax.set_title(f"COMETA - footprint atterraggi (dal {cfg.mm:02d}-{cfg.dd:02d} per {cfg.ngiorni} g, anni {min(cfg.anni)}-{max(cfg.anni)})\n"
                 f"pallone d={cfg.diametro} m, payload {cfg.payload} kg, scoppio {cfg.quota/1000:.1f} km")
    ax.legend(handles=handles,fontsize=8,loc="best")
    fig.savefig(f"{cfg.prefix}_footprint.png",dpi=130,bbox_inches="tight")
    print(f"Mappa -> {cfg.prefix}_footprint.png  ({'cartopy' if usa_cartopy else 'schematica'})")
    if getattr(cfg,"html",False): disegna_mappa_html(cfg,dati)

def disegna_mappa_html(cfg,dati):
    try:
        import folium, jinja2
    except ImportError:
        print("(folium non installato: salto la mappa HTML. Installa con: pip install folium)"); return
    allpts=[(r[1],r[0]) for L in dati.values() for r in L]
    for lat,lon in cfg.siti.values(): allpts.append((lat,lon))
    if cfg.esclusione: allpts+=[(p[1],p[0]) for p in cfg.esclusione]
    for z in getattr(cfg,"zone",[]):
        if z["tipo"]=="cerchio": allpts.append((z["lat"],z["lon"]))
        else: allpts+=[(p[1],p[0]) for p in z["punti"]]
    if not allpts: print("(nessun atterraggio: salto HTML)"); return
    lats=[p[0] for p in allpts]; lons=[p[1] for p in allpts]
    m=folium.Map(location=[media(lats),media(lons)],tiles="OpenStreetMap",control_scale=True)
    m.fit_bounds([[min(lats),min(lons)],[max(lats),max(lons)]])
    if cfg.esclusione:
        folium.Polygon([(p[1],p[0]) for p in cfg.esclusione],color="red",weight=2,
                       fill=True,fill_color="red",fill_opacity=0.18,popup="Area di esclusione").add_to(m)
    for z in getattr(cfg,"zone",[]):
        if z["tipo"]=="cerchio":
            folium.Circle([z["lat"],z["lon"]],radius=z["raggio_km"]*1000,color="red",weight=2,
                          fill=True,fill_color="red",fill_opacity=0.18,popup=z["nome"]).add_to(m)
        else:
            folium.Polygon([(p[1],p[0]) for p in z["punti"]],color="red",weight=2,
                           fill=True,fill_color="red",fill_opacity=0.18,popup=z["nome"]).add_to(m)
    cols=["blue","cadetblue","lightblue","green","orange","red","purple","darkred"]
    visti=set()
    for c,(sito,L) in zip(cols,dati.items()):
        if not L: continue
        con_ell=sito in getattr(cfg,"chiavi_ellisse",{sito})
        fg=folium.FeatureGroup(name=sito,show=con_ell)   # gruppi senza ellisse: spenti all'apertura
        lat,lon=cfg.siti[getattr(cfg,"sito_di",{}).get(sito,sito)]
        xs=[r[0] for r in L]; ys=[r[1] for r in L]
        if con_ell:                               # solo dove la popolazione e' stazionaria
            for pp,op in [(0.90,0.12),(0.50,0.25)]:
                ex,ey=ellisse_punti(*ellisse(xs,ys,pp))
                folium.Polygon(list(zip(ey,ex)),color=c,weight=1,fill=True,fill_color=c,
                               fill_opacity=op,popup=f"{sito} - zona {int(pp*100)}%").add_to(fg)
        # nel punto solo la data del volo: deriva e rotta si leggono dalla mappa,
        # la data serve a confrontare (e a ritrovare il giorno nel CSV)
        for r in L:
            folium.CircleMarker([r[1],r[0]],radius=2,color=c,fill=True,fill_opacity=0.55,
                                popup=f"{r[9]:%d/%m/%Y}").add_to(fg)
        cx=media(xs); cy=media(ys)
        folium.CircleMarker([cy,cx],radius=6,color=c,fill=True,fill_opacity=1.0,
                            popup=f"{sito}: atterraggio medio").add_to(fg)
        nome_sito=getattr(cfg,"sito_di",{}).get(sito,sito)
        if nome_sito not in visti:                    # una stella per sito, non per gruppo
            visti.add(nome_sito)
            folium.Marker([lat,lon],tooltip=f"Lancio: {nome_sito}",
                          icon=folium.Icon(color=c,icon="star")).add_to(fg)
        fg.add_to(m)
    folium.LayerControl(collapsed=False).add_to(m)
    # I vettori Leaflet stanno tutti nello stesso overlayPane e si sovrappongono
    # nell'ordine di inserimento; folium emette il JS raggruppato per FeatureGroup,
    # quindi l'ellisse del secondo sito finiva sopra i punti del primo: restavano
    # visibili in trasparenza ma il click andava all'ellisse. folium non espone
    # l'opzione 'pane' sui vettori, quindi si rialzano i punti a mano dopo il
    # disegno, e di nuovo a ogni riattivazione di un livello dal controllo.
    mv=m.get_name()
    js=folium.MacroElement()
    js._template=jinja2.Template("""
        {%% macro script(this, kwargs) %%}
        function cometa_punti_in_cima() {
            %s.eachLayer(function (g) {
                if (!g.eachLayer) return;
                g.eachLayer(function (l) {
                    if (l instanceof L.CircleMarker && l.bringToFront) l.bringToFront();
                });
            });
        }
        cometa_punti_in_cima();
        %s.on('overlayadd', cometa_punti_in_cima);
        {%% endmacro %%}
    """ % (mv,mv))
    m.add_child(js)                      # ultimo figlio: rendered dopo tutti i layer
    out=f"{cfg.prefix}_footprint.html"; m.save(out)
    print(f"Mappa HTML interattiva -> {out}")

# ==========================================================================
# Main
# ==========================================================================
def main():
    cfg=get_args()
    # ---- modello pallone: elio necessario + quota di scoppio ----
    V=V_per_salita(cfg.massa,cfg.payload,cfg.vsalita)
    burst=quota_scoppio(V,cfg.diametro) if V else 0
    neck=neck_g(V,cfg.massa) if V else 0
    cfg.quota_forzata=cfg.quota          # se l'utente ha imposto --quota, resta fissa
    cfg.V_elio=V; cfg._atm_warned=False; cfg._msis_warned=False
    cfg._t2m=[]; cfg._psup=[]
    if cfg.rif=="msis" and not msis_disponibile():
        print("  [!] pymsis non installato (pip install pymsis): estrapolazione su ISA.")
        cfg.rif="isa"
    if cfg.quota is None and V: cfg.quota=burst   # valore ISA, usato come fallback
    print(f"PALLONE: d_scoppio {cfg.diametro} m | massa {cfg.massa} kg | payload {cfg.payload} kg | salita {cfg.vsalita} m/s")
    if cfg.vatt_src=="paracadute":
        print(f"  -> v_atterraggio (al suolo) {cfg.vatt:.1f} m/s  [paracadute d={cfg.paracadute} m, Cd={cfg.cd_paracadute:.1f}, "
              f"massa in discesa {getattr(cfg,'m_disc',cfg.payload):.2f} kg (payload {cfg.payload} + paracadute {getattr(cfg,'massa_para',0) or 0:.2f}); "
              f"in quota scala come 1/sqrt(rho)]")
    elif cfg.vatt_src=="manuale":
        print(f"  -> v_atterraggio (al suolo) {cfg.vatt:.1f} m/s  [valore manuale; in quota scala come 1/sqrt(rho)]")
    else:
        print(f"  -> v_atterraggio (al suolo) {cfg.vatt:.1f} m/s  [default; passare --paracadute per stimarla dal Cd e dal diametro]")
    if V:
        print(f"  -> ELIO NECESSARIO: {V*1000:.0f} L ({V:.2f} m3, {100*V/cfg.elio:.0f}% del disponibile) | "
              f"portanza al collo {neck:.0f} g | QUOTA DI SCOPPIO {burst/1000:.1f} km")
    avvisi(cfg,V,burst,neck)
    tabella_pallone(cfg)
    # esclusione/territorio di default valgono solo per lanci dall'Uruguay
    parte_uru = any(point_in_poly(lon,lat,URU_POLY) for lat,lon in cfg.siti.values())
    if not parte_uru:
        if cfg.escl_default and cfg.esclusione:
            cfg.esclusione=None
            print("  [info] siti fuori dall'Uruguay: area di esclusione DINACIA disattivata.")
        if cfg.terr_default and cfg.territorio:
            cfg.territorio=None
            print("  [info] siti fuori dall'Uruguay: controllo territorio uruguaiano disattivato.\n")
    if cfg.tawhiri:
        previsione_tawhiri(cfg); return
    if cfg.quota_forzata is not None:
        print(f"ATMOSFERA: quota di scoppio IMPOSTA a {cfg.quota_forzata/1000:.1f} km (--quota): "
              "il profilo atmosferico non la modifica.")
    elif cfg.atm=="reale":
        print(f"ATMOSFERA: profilo del giorno da Open-Meteo (T e quota geopotenziale, fino a "
              f"{min(LIVELLI_HPA)} hPa ~ {QUOTA_LIV[min(LIVELLI_HPA)]/1000:.0f} km); "
              f"sopra, forma {cfg.rif.upper()} ancorata all'ultimo livello osservato.")
        print(f"           quota di scoppio ricalcolata giorno per giorno (riferimento ISA: {burst/1000:.1f} km).")
    else:
        print("ATMOSFERA: ISA standard (--atm isa): quota di scoppio identica per tutti i giorni.")
    print(f"MISSIONE: {cfg.endpoint} | anni {cfg.anni} | finestra dal {cfg.mm:02d}-{cfg.dd:02d} per {cfg.ngiorni} g | step {cfg.step} | ora {cfg.ora}\n")

    dati={}; righe=[]; diag_done=False
    for sito,(lat,lon) in cfg.siti.items():
        dati[sito]=[]
        for anno in cfg.anni:
            fw=finestra(cfg,anno)
            if fw is None:
                print(f"  [!] {sito} {anno}: data di inizio {cfg.mm:02d}-{cfg.dd:02d} inesistente in quell'anno, salto."); continue
            start,end,lanci=fw; lanci_ok=[]
            try: h=scarica_finestra(cfg,lat,lon,start,end)
            except Exception as e: print(f"  [!] {sito} {anno}: errore download ({e})"); continue
            if not diag_done:
                vivi=livelli_vivi(h)
                peaks=[max(pr[1]) for gd in lanci if (pr:=profilo(cfg,h,gd.isoformat()))]
                pkmax=max(peaks) if peaks else 0; pkmed=mediana(peaks) if peaks else 0
                dati_ok=bool(vivi) and len(peaks)>0
                if not dati_ok:                       # vero problema: dati mancanti
                    print(f"  >> DIAGNOSTICA ({sito} {anno}): livelli attivi = {vivi if vivi else 'NESSUNO (!!)'}")
                    print("     !! venti in quota ASSENTI -> usa --endpoint hist_forecast\n")
                elif cfg.diag or pkmax<20:            # dati presenti: eventuale nota informativa
                    print(f"  >> DIAGNOSTICA ({sito} {anno}): {len(vivi)} livelli in quota attivi | "
                          f"picco vento nella finestra: max {pkmax:.0f} m/s, mediano {pkmed:.0f} m/s")
                    if pkmax<20:
                        print("     nota: venti in quota deboli in questa finestra/posizione - "
                              "e' un dato reale, non un errore (deriva modesta).\n")
                    else:
                        print("     dati OK\n")
                diag_done=True

            for gd in lanci:
                try:
                    j=next(i for i,t in enumerate(h["time"]) if t.startswith(f"{gd.isoformat()}T{cfg.ora:02d}:00"))
                    if h.get("temperature_2m") and h["temperature_2m"][j] is not None:
                        cfg._t2m.append(float(h["temperature_2m"][j]))
                    if h.get("surface_pressure") and h["surface_pressure"][j] is not None:
                        cfg._psup.append(float(h["surface_pressure"][j]))
                except StopIteration: pass
                prA=profilo(cfg,h,gd.isoformat())
                if prA is None: continue
                col=colonna(cfg,h,gd.isoformat(),lat,lon)
                if col is None:
                    if not cfg._atm_warned:
                        print("  [!] temperatura/quota geopotenziale assenti dai dati: "
                              "quota di scoppio calcolata sull'ISA. (--atm isa per silenziare)")
                        cfg._atm_warned=True
                    col=ColonnaRif(densita_isa,fonte="isa")
                qb=quota_scoppio(cfg.V_elio,cfg.diametro,col.rho) if cfg.quota_forzata is None else cfg.quota_forzata
                lanci_ok.append((gd,prA,col,qb))
            # --- advezione a due colonne: stima apogeo medio e scarica colonna sottovento ---
            hB=None; lon_apo=lat_apo=None
            if cfg.advezione=="due-colonne" and lanci_ok:
                apos=[endpoint_ascesa(cfg,lat,lon,pr,qb) for _,pr,_,qb in lanci_ok]
                lat_apo=media([a[0] for a in apos]); lon_apo=media([a[1] for a in apos])
                if dist_km(lat,lon,lat_apo,lon_apo) > 8:   # solo se l'apogeo e' lontano
                    try: hB=scarica_finestra(cfg,lat_apo,lon_apo,start,end)
                    except Exception as e: print(f"  [!] {sito} {anno}: colonna sottovento non disponibile ({e})")
            for gd,prA,col,qb in lanci_ok:
                prB=profilo(cfg,hB,gd.isoformat()) if hB else None
                la,lo,dist,rotta,tmin,dscop=traiettoria(cfg,lat,lon,prA,prB,qb,col)  # due colonne
                la1,lo1,_,_,_,_=traiettoria(cfg,lat,lon,prA,prA,qb,col)              # colonna singola
                inc=dist_km(la,lo,la1,lo1)                                    # auto-test incertezza advezione
                st=stato(cfg,la,lo)
                dati[sito].append((lo,la,dist,rotta,tmin,st,inc,dscop,qb,gd))
                righe.append([sito,gd.isoformat(),f"{la:.4f}",f"{lo:.4f}",f"{dist:.1f}",f"{rotta:.0f}",f"{tmin:.0f}",st,f"{inc:.1f}",f"{dscop:.1f}",f"{qb/1000:.2f}"])

    dati=raggruppa(cfg,dati)          # eventuale suddivisione in periodi
    print("\n"+"="*100)
    print("TABELLA STATISTICA (deriva in km; rotta in gradi: 90=E 180=S 270=O)")
    print("-"*100)
    print(f"{'SITO':34s}{'n':>4}{'media':>7}{'mediana':>8}{'dev.st':>7}{'p90':>6}{'max':>6}{'scoppio':>8}"
          f"{'qScop':>7}{'sigmaQ':>7}{'rotta':>7}{'tempo':>7}{'incAdv':>7}{'%ok':>6}{'%esc':>6}{'%fuo':>6}")
    stat=[]
    for sito,L in dati.items():
        if not L: continue
        dd=[r[2] for r in L]; rr=[r[3] for r in L]; tt=[r[4] for r in L]; ss=[r[5] for r in L]
        ii=[r[6] for r in L]; bb=[r[7] for r in L]; qq=[r[8]/1000.0 for r in L]; n=len(L)
        row=dict(sito=sito,n=n,media=media(dd),med=mediana(dd),dev=devstd(dd),p90=percentile(dd,90),
                 mx=max(dd),scop=mediana(bb),qscop=mediana(qq),qdev=devstd(qq),qmin=min(qq),qmax=max(qq),
                 rot=rotta_media(rr),tm=media(tt),inc=media(ii),incp90=percentile(ii,90),
                 ok=100*ss.count("ok")/n,esc=100*ss.count("ESCL")/n,fuo=100*ss.count("FUORI")/n)
        stat.append(row)
        print(f"{sito:34s}{n:>4}{row['media']:>7.0f}{row['med']:>8.0f}{row['dev']:>7.0f}{row['p90']:>6.0f}"
              f"{row['mx']:>6.0f}{row['scop']:>8.0f}{row['qscop']:>7.2f}{row['qdev']:>7.2f}"
              f"{row['rot']:>7.0f}{row['tm']:>7.0f}{row['inc']:>7.0f}{row['ok']:>5.0f}%{row['esc']:>5.0f}%{row['fuo']:>5.0f}%")
    print("="*100)
    print("scoppio = distanza mediana orizzontale dal lancio al punto di scoppio (apogeo).")
    print("qScop / sigmaQ = quota di scoppio [km]: mediana e dev.st. sui giorni della finestra.")
    print("  sigmaQ misura SOLO la variabilita' atmosferica: il diametro di scoppio e' tenuto fisso.")
    print("  Va confrontata con la dispersione del lattice, che non e' inclusa in questo conto.")
    if cfg.gruppi:
        print("L'ellisse e' calcolata solo su:", ", ".join(sorted(cfg.chiavi_ellisse)) or "nessun gruppo")
        print("  Gli altri periodi sono mostrati come soli punti: le loro statistiche non sono")
        print("  stazionarie, quindi un'ellisse descriverebbe una popolazione inesistente.")
    if V:
        if str(cfg.tgonf).lower()=="auto":
            Tg=mediana(cfg._t2m) if cfg._t2m else T_RIF-273.15
            fonte=f"mediana dei dati alle {cfg.ora}:00" if cfg._t2m else "nessun dato: uso 15 C"
        else:
            Tg=float(cfg.tgonf); fonte="impostata da riga di comando"
        pg=mediana(cfg._psup)*100 if cfg._psup else P_STD
        print("-"*100)
        print("GONFIAGGIO")
        print(f"  Portanza al collo obiettivo: {neck_g(V,cfg.massa):.0f} g   <-- e' QUESTO il riferimento")
        print(f"  Temperatura al gonfiaggio: {Tg:.1f} C ({fonte}); pressione {pg/100:.0f} hPa")
        print(f"  Litri da caricare: {volume_a_T(V,Tg,pg)*1000:.0f} L   (a 15 C e 1013 hPa sarebbero {V*1000:.0f} L)")
        print("  A pressione fissata rho_aria e rho_elio vanno entrambe come 1/T, quindi a parita'")
        print("  di portanza al collo la MASSA di elio caricata e' la stessa a ogni temperatura.")
        print("  La temperatura cambia i litri, non le moli: la quota di scoppio non ne risente.")
    print("incAdv = incertezza media da advezione (km): scarto tra due-colonne e colonna singola.")
    print("Indicativo dell'errore del modello: piccolo -> stima robusta; grande -> usare con cautela.")

    with open(f"{cfg.prefix}_atterraggi.csv","w",newline="") as f:
        w=csv.writer(f); w.writerow(["sito","data","lat","lon","deriva_km","rotta_deg","tempo_min","stato","inc_advez_km","dist_scoppio_km","quota_scoppio_km"]); w.writerows(righe)
    with open(f"{cfg.prefix}_statistiche.csv","w",newline="") as f:
        w=csv.writer(f); w.writerow(["sito","n","media_km","mediana_km","devstd_km","p90_km","max_km","dist_scoppio_km","quota_scoppio_km","sigma_quota_km","quota_min_km","quota_max_km","rotta_deg","tempo_min","incAdv_media_km","incAdv_p90_km","pct_ok","pct_escl","pct_fuori"])
        for r in stat: w.writerow([r['sito'],r['n'],f"{r['media']:.1f}",f"{r['med']:.1f}",f"{r['dev']:.1f}",
            f"{r['p90']:.1f}",f"{r['mx']:.1f}",f"{r['scop']:.1f}",f"{r['qscop']:.2f}",f"{r['qdev']:.2f}",f"{r['qmin']:.2f}",f"{r['qmax']:.2f}",f"{r['rot']:.0f}",f"{r['tm']:.0f}",f"{r['inc']:.1f}",f"{r['incp90']:.1f}",f"{r['ok']:.0f}",f"{r['esc']:.0f}",f"{r['fuo']:.0f}"])
    print(f"\nCSV -> {cfg.prefix}_atterraggi.csv , {cfg.prefix}_statistiche.csv")
    disegna_mappa(cfg,dati)

if __name__=="__main__":
    main()
