"""El Nino WATCH - week-by-week flood simulation for Garissa (issued from the 3-4 Oct 2026 model runs).

What it does (numpy + shapely, transparent, re-runs in under a second):

1. MODEL READINGS. 15-16 day rainfall totals read from the model charts circulated on 3-4 Oct 2026
   (ECMWF IFS HRES, NOAA GFS, ECMWF-AIFS, US-AI (AI-GFS), DWD ICON / AICON 7-day) for five zones:
     catchment  - Upper Tana above the Seven Forks dams (Embu, Meru, Nyeri, Murang'a, Masinga)
     ewaso      - Upper Ewaso Ng'iro (Nanyuki-Isiolo) which feeds Lagh Dera
     garissa    - Garissa Township, Balambala, Fafi (local rain -> laghas)
     border     - Dadaab, Hulugho, Ijara and the Somalia border (tropical-low rain)
     lower_tana - Bura, Hola, Garsen (downstream counties)
   Readings are chart estimates (zone medians), not station data.

2. DAILY TIMING. Totals are spread over 4-19 Oct with the timing all charts agree on:
   light onset in week 1 (5-11 Oct, ICON/GFS week-1: little in Garissa, moderate on Mt Kenya),
   the main El Nino burst in week 2 (12-18 Oct, GFS & ECMWF agree).

3. RIVER TANA. Catchment rain -> existing Seven Forks hydrology (SCS runoff, Masinga storage/spill,
   Muskingum routing, 40 h lag, Garissa rating curve) for each model and a weighted blend.

4. LAGHAS. Local daily rain -> lagha state for Garissa / border areas
   (dry < 15 mm/day, flowing 15-35 mm, flash flood >= 35 mm or >= 50 mm in 2 days),
   and Ewaso Ng'iro / Lagh Dera flow reaching Garissa county 5-8 days after heavy Mt Kenya rain.

5. FARM IMPACT. Predicted peak gauge stage -> simulated flood band -> farms, schools, clinics,
   boreholes and houses inside it (intersected with UNOSAT 2023/2024 extents as the evidence base).

Decision support only - follow official KMD, WRA and NDMA warnings.
"""
from __future__ import annotations

import datetime as dt
import json
from functools import lru_cache
from pathlib import Path

import numpy as np

from . import forecast

ISSUED = dt.date(2026, 10, 4)
START = dt.date(2026, 10, 4)
DAYS = 16  # 4 Oct -> 19 Oct
DATA = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data"

ZONES = {
    "catchment": "Seven Forks catchment (Upper Tana: Embu, Meru, Nyeri, Murang'a, Masinga)",
    "ewaso": "Upper Ewaso Ng'iro (Nanyuki-Isiolo) -> Lagh Dera",
    "garissa": "Garissa Township, Balambala & Fafi",
    "border": "Dadaab, Hulugho, Ijara & Somalia border",
    "lower_tana": "Lower Tana (Bura, Hola, Garsen)",
}

# 15-16 day totals (mm) read from the charts. week1 = share falling 4-11 Oct.
MODELS = [
    {"key": "ecmwf", "label": "ECMWF IFS HRES", "run": "3 Oct 00z, 15 days to 18 Oct", "weight": 0.30, "color": "#d32f2f",
     "img": "watch/ecmwf_hres_15d.jpg",
     "mm": {"catchment": 220, "ewaso": 160, "garissa": 70, "border": 120, "lower_tana": 110},
     "says": "Heavy, possibly catastrophic rain over most of Kenya: 200-300 mm around Mt Kenya and the Seven Forks catchment, 60-80 mm at Garissa, 100-150 mm on the Somalia border, over 200 mm at the coast."},
    {"key": "aifs", "label": "ECMWF-AIFS (AI)", "run": "3 Oct, to 18 Oct", "weight": 0.20, "color": "#00897b",
     "img": "watch/ecmwf_aifs_kenya.jpg",
     "mm": {"catchment": 120, "ewaso": 150, "garissa": 40, "border": 90, "lower_tana": 70},
     "says": "125-175 mm (5-7 in) on the Mt Kenya east slopes, 30-50 mm at Garissa, 175-250 mm over southern Somalia as a tropical low moves inland."},
    {"key": "usai", "label": "US-AI (AI-GFS)", "run": "3 Oct, 16 days to 19 Oct", "weight": 0.20, "color": "#8e24aa",
     "img": "watch/usai_16d.jpg",
     "mm": {"catchment": 90, "ewaso": 120, "garissa": 25, "border": 100, "lower_tana": 60},
     "says": "Patchy but intense: 175-250 mm bursts on Nyambene/Meru, 90-125 mm along the Somalia border and very heavy rain over southern Somalia and the coast."},
    {"key": "gfs", "label": "NOAA GFS", "run": "3 Oct 12z, 15 days to 19 Oct", "weight": 0.20, "color": "#1e88e5",
     "img": "watch/gfs_15d_kenya.jpg",
     "mm": {"catchment": 110, "ewaso": 40, "garissa": 12, "border": 20, "lower_tana": 60},
     "says": "100-150 mm Embu-Mwingi (lower Seven Forks), 200-305 mm on the coast near Mombasa, but only 5-15 mm at Garissa: the driest major model for the county."},
    {"key": "icon", "label": "DWD ICON / AICON (7 days)", "run": "3 Oct 12z, 7 days to 11 Oct", "weight": 0.10, "color": "#f9a825",
     "img": "watch/icon_7d.jpg",
     "mm": {"catchment": 90, "ewaso": 60, "garissa": 15, "border": 25, "lower_tana": 25},
     "says": "Week 1 only: 20-60 mm on the central highlands, 1-10 mm at Garissa. Week-2 total extrapolated from the GFS/ECMWF agreement."},
]

# daily timing weights, 4..19 Oct (onset week 1, burst week 2)
SHAPE = {
    "catchment": [0.2, 0.4, 1.0, 2.0, 2.5, 2.5, 3.0, 3.0, 6.0, 8.0, 10.0, 11.0, 10.0, 8.0, 6.0, 4.0],
    "ewaso": [0.1, 0.3, 0.8, 1.5, 2.0, 2.0, 2.5, 3.0, 6.0, 8.0, 10.0, 11.0, 10.0, 8.0, 6.0, 4.0],
    # dryland rain falls in a few convective storms - two storm days carry much of week 2
    "garissa": [0.0, 0.0, 0.2, 0.5, 0.5, 1.0, 1.0, 1.5, 2.0, 4.0, 14.0, 4.0, 12.0, 4.0, 3.0, 2.0],
    "border": [0.0, 0.1, 0.3, 0.8, 1.0, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0, 14.0, 8.0, 12.0, 5.0, 3.0],
    "lower_tana": [0.1, 0.2, 0.5, 1.0, 1.0, 1.5, 2.0, 2.0, 4.0, 6.0, 9.0, 10.0, 10.0, 8.0, 6.0, 4.0],
}

# Calibration for the watch runs (wetter antecedent response than the default; tributaries below the dams
# drain ~5,000 km2 of Mt Kenya east / Nyambene). Checked against the Oct-Nov 2023 analogue (~500-700 mm on
# the highlands over 4-6 weeks -> Garissa gauge above 6 m in late November).
CAL = {"cn_base": 66.0, "cn_slope": 0.12, "local_coef": 9.0}

FARM_IMPACT = [
    (3.0, "Normal", "River inside its banks. Pumps on the riverbank are safe to run."),
    (4.0, "Alert", "Low-lying banana, mango and vegetable plots next to the river get waterlogged. Lift pumps and generators to higher ground."),
    (4.5, "Alert", "Water spreads into the first farm terraces at Saka, Sankuri, Korakora and Bour-Algi. Harvest what is ready."),
    (5.0, "Alarm", "Most riverine farms flooded; canals and feeder roads cut. Move livestock and families from the floodplain."),
    (5.5, "Alarm", "Farm villages surrounded; Garissa-Madogo and Bura roads at risk at low points."),
    (6.2, "Emergency", "Like 1997/98 and Nov 2023: farms under water for 2-4 weeks, bridge approaches and town wards flooded."),
]

COMMUNITY = {
    "en": ["Rains start on Mt Kenya this week; the River Tana rises 2-4 days later at Garissa.",
           "Main El Nino rains: 12-18 October. Do not cross flowing laghas – 30 cm of water can carry away a car.",
           "Riverine farmers: harvest ready crops and lift pumps before 15 October.",
           "Boil or treat drinking water; sleep under a mosquito net.",
           "Emergency: Kenya Red Cross 1199 · emergency@garissa.go.ke"],
    "sw": ["Mvua inaanza Mlima Kenya wiki hii; Mto Tana utapanda Garissa baada ya siku 2-4.",
           "Mvua kubwa za El Nino: 12-18 Oktoba. Usivuke lagha inayotiririka – maji ya sm 30 yanaweza kusomba gari.",
           "Wakulima wa kando ya mto: vuneni mazao yaliyo tayari na hamisheni pampu kabla ya 15 Oktoba.",
           "Chemsha au tibu maji ya kunywa; lala ndani ya chandarua.",
           "Dharura: Kenya Red Cross 1199 · emergency@garissa.go.ke"],
    "so": ["Roobku wuxuu ka bilaabanayaa Buur Kenya toddobaadkan; Webiga Tana wuxuu kor u kacayaa Garissa 2-4 maalmood kadib.",
           "Roobabka waaweyn ee El Nino: 12-18 Oktoobar. Ha ka gudbin togga socda – 30 sm oo biyo ah waxay qaadi karaan gaari.",
           "Beeraleyda webiga agtiisa: goosta dalagga diyaarka ah oo matoorada kor u qaada ka hor 15 Oktoobar.",
           "Karkari ama nadiifi biyaha la cabbo; ku seexo maro kaneeco.",
           "Xaalad degdeg: Laanqeyrta Cas 1199 · emergency@garissa.go.ke"],
}


def _days():
    return [START + dt.timedelta(days=i) for i in range(DAYS)]


def daily(total_mm: float, zone: str) -> np.ndarray:
    w = np.array(SHAPE[zone], dtype=float)
    return total_mm * w / w.sum()


def _blend(zone: str) -> np.ndarray:
    tot = sum(m["weight"] for m in MODELS)
    return sum(daily(m["mm"][zone], zone) * m["weight"] for m in MODELS) / tot


def lagha_state(rain: np.ndarray):
    out = []
    for i, r in enumerate(rain):
        two = r + (rain[i - 1] if i else 0)
        if r >= 35 or two >= 50:
            out.append("flash")
        elif r >= 15 or two >= 25:
            out.append("flowing")
        elif r >= 5:
            out.append("wet")
        else:
            out.append("dry")
    return out


def ewaso_arrival(rain: np.ndarray, lag_days: int = 6):
    """Lagh Dera flow reaching Habaswein/Modogashe ~6 days after heavy upper Ewaso Ng'iro rain.
    The Lorian swamp absorbs small floods, so flow only passes once 10-day rain exceeds ~80 mm."""
    cum10 = np.convolve(rain, np.ones(10), mode="full")[: len(rain)]
    state = []
    for i in range(len(rain)):
        j = i - lag_days
        v = cum10[j] if j >= 0 else 0
        state.append("flood" if v >= 140 else "flowing" if v >= 80 else "dry")
    return state, [round(float(x), 1) for x in cum10]


@lru_cache(maxsize=1)
def _stage_exposure():
    """Assets inside each simulated flood band (stage 3.0-7.5 m) - shapely intersections."""
    try:
        from shapely.geometry import shape
        from shapely.ops import unary_union
        from shapely.prepared import prep
    except Exception:
        return {}
    bands = json.loads((DATA / "flood_sim_bands.geojson").read_text())["features"]
    farms = [shape(f["geometry"]) for f in json.loads((DATA / "farm_zones.geojson").read_text())["features"]
             if f["properties"].get("zone_type") == "agricultural_impact"]
    farm_u = unary_union(farms) if farms else None

    def pts(name):
        return [shape(f["geometry"]) for f in json.loads((DATA / name).read_text())["features"]]

    sets = {"schools": pts("schools.geojson"), "health": pts("health_facilities.geojson"),
            "boreholes": pts("boreholes.geojson"), "structures": pts("structures_2024.geojson")}
    out = {}
    for b in bands:
        st = float(b["properties"]["stage_m"])
        g = shape(b["geometry"])
        pg = prep(g)
        row = {"area_km2": b["properties"].get("area_km2")}
        for k, arr in sets.items():
            row[k] = int(sum(1 for p in arr if pg.contains(p)))
        # farm area in km2 (approx at 0.5 deg S: 1 deg ~ 111 km)
        row["farm_km2"] = round(float(g.intersection(farm_u).area) * 111.0 * 110.6, 1) if farm_u is not None else None
        out[st] = row
    return out


def exposure_at(stage: float):
    tab = _stage_exposure()
    if not tab:
        return None
    keys = sorted(tab)
    sel = max([k for k in keys if k <= stage] or [keys[0]])
    return {"band_stage_m": sel, **tab[sel]}


def watch(masinga_fill_pct: float = forecast.DEFAULT_MASINGA_FILL):
    days = _days()
    zones = {}
    for z in ZONES:
        per = {m["key"]: [round(float(x), 1) for x in daily(m["mm"][z], z)] for m in MODELS}
        bl = _blend(z)
        per["blend"] = [round(float(x), 1) for x in bl]
        zones[z] = {"label": ZONES[z], "daily": per,
                    "totals": {m["key"]: m["mm"][z] for m in MODELS} | {"blend": round(float(bl.sum()))},
                    "week1": round(float(bl[:8].sum())), "week2": round(float(bl[8:15].sum()))}

    # River Tana: hydrology for each model and the blend.
    # Tributaries below the dams (Thiba, Kathita, Mutonga, Thingithu - Mt Kenya east & Nyambene) get the
    # catchment rain; the reach above Garissa gets local rain.
    def run(rain_c, rain_g, extend=0):
        rc = np.array(rain_c, dtype=float)
        rg = np.array(rain_g, dtype=float)
        if extend:  # "burst continues": week-2 rain repeats at 80 % for `extend` more days
            rc = np.concatenate([rc, np.resize(rc[8:15] * 0.8, extend)])
            rg = np.concatenate([rg, np.resize(rg[8:15] * 0.8, extend)])
        rc = np.concatenate([rc, np.zeros(5)])
        rg = np.concatenate([rg, np.zeros(5)])
        return forecast.hydrology(rc, masinga_fill_pct, local_rain_mm=0.65 * rc + 0.35 * rg, hours=24 * len(rc), **CAL)

    tana, tana_ext = {}, {}
    for m in MODELS + [{"key": "blend"}]:
      for target, ext in ((tana, 0), (tana_ext, 14)):
        h = run(zones["catchment"]["daily"][m["key"]], zones["garissa"]["daily"][m["key"]], ext)
        # re-date the series to the watch start
        shift = (START - forecast.ISSUE_DATE).days * 24
        for r in h["series"]:
            t = dt.datetime.fromisoformat(r["time"]) + dt.timedelta(hours=shift)
            r["time"] = t.isoformat(timespec="minutes")
        for k in ("peak_time", "first_alert_time"):
            if h.get(k):
                h[k] = (dt.datetime.fromisoformat(h[k]) + dt.timedelta(hours=shift)).isoformat(timespec="minutes")
        spill_day = next((i for i, f in enumerate(h["masinga_fill_pct"]) if f >= 100.0), None)
        h["masinga_full_date"] = (START + dt.timedelta(days=spill_day)).isoformat() if spill_day is not None else None
        h["exposure"] = exposure_at(h["peak_stage_m"])
        target[m["key"]] = h

    # Laghas
    g = np.array(zones["garissa"]["daily"]["blend"])
    b = np.array(zones["border"]["daily"]["blend"])
    g_hi = np.array(zones["garissa"]["daily"]["ecmwf"])
    b_hi = np.array(zones["border"]["daily"]["ecmwf"])
    ew_state, ew_cum = ewaso_arrival(np.array(zones["ewaso"]["daily"]["blend"]))
    ew_state_hi, _ = ewaso_arrival(np.array(zones["ewaso"]["daily"]["ecmwf"]))
    ew_ext = np.array(zones["ewaso"]["daily"]["ecmwf"])
    ew_ext = np.concatenate([ew_ext, np.resize(ew_ext[8:15] * 0.8, 14)])
    ew_state_ext, _ = ewaso_arrival(ew_ext)
    laghas = {"garissa": lagha_state(g), "border": lagha_state(b),
              "garissa_ecmwf": lagha_state(g_hi), "border_ecmwf": lagha_state(b_hi),
              "lagh_dera": ew_state, "lagh_dera_ecmwf": ew_state_hi, "lagh_dera_extended": ew_state_ext, "ewaso_10day_mm": ew_cum}

    def first(cond_list, val):
        i = next((i for i, s in enumerate(cond_list) if s in val), None)
        return (START + dt.timedelta(days=i)).isoformat() if i is not None else None

    first_rain_catch = next((i for i, r in enumerate(zones["catchment"]["daily"]["blend"]) if r >= 3), None)
    first_rain_gar = next((i for i, r in enumerate(zones["garissa"]["daily"]["blend"]) if r >= 5), None)
    bl = tana["blend"]
    ec = tana["ecmwf"]
    ex = tana_ext["ecmwf"]
    exb = tana_ext["blend"]
    milestones = [
        {"date": (START + dt.timedelta(days=first_rain_catch)).isoformat() if first_rain_catch is not None else None,
         "icon": "cloud", "title": "First rains on Mt Kenya & the Seven Forks catchment", "who": "Embu, Meru, Nyeri, Murang'a"},
        {"date": (START + dt.timedelta(days=first_rain_gar)).isoformat() if first_rain_gar is not None else None,
         "icon": "rain", "title": "First real rains in Garissa", "who": "Garissa Township, Balambala, Fafi"},
        {"date": first(laghas["garissa_ecmwf"], ("flowing", "flash")) or first(laghas["garissa"], ("flowing", "flash")),
         "icon": "lagha", "scenario": "wet", "title": "Laghas start flowing around Garissa during the first storms", "who": "Garissa Town laghas, Dadaab road"},
        {"date": first(laghas["border_ecmwf"], ("flash",)) or first(laghas["border_ecmwf"], ("flowing",)), "icon": "flash", "scenario": "wet",
         "title": "Laghas run on the Somalia border – flash floods possible if the tropical low comes inland", "who": "Dadaab, Hulugho, Liboi, Ijara"},
        {"date": (START + dt.timedelta(days=15)).isoformat(), "icon": "dam", "scenario": "wet",
         "title": f"Masinga about {ec['masinga_fill_pct'][15]:.0f}% full (ECMWF) – room for only {100 - ec['masinga_fill_pct'][15]:.0f}% more", "who": "Seven Forks cascade"},
        {"date": ec.get("masinga_full_date") or ex.get("masinga_full_date"), "icon": "dam", "scenario": "wet" if ec.get("masinga_full_date") else "continues",
         "title": "Masinga full – Seven Forks dams start spilling", "who": "Watch for KenGen release notices"},
        {"date": (ec.get("first_alert_time") or ex.get("first_alert_time") or "")[:10] or None, "icon": "river", "scenario": "wet" if ec.get("first_alert_time") else "continues",
         "title": "River Tana passes ALERT (4.0 m) at Garissa – first farm flooding", "who": "Riverine farms, Saka–Sankuri–Korakora"},
        {"date": ex["peak_time"][:10], "icon": "peak", "scenario": "continues",
         "title": f"Tana peak at Garissa if the burst continues: {ex['peak_stage_m']} m ({ex['level']})", "who": "Garissa bridge, Bour-Algi, Ijara riverine villages"},
        {"date": first(laghas["lagh_dera_ecmwf"], ("flowing", "flood")) or first(ew_state_ext, ("flowing", "flood")), "icon": "lagha", "scenario": "continues",
         "title": "Lagh Dera (Ewaso Ng'iro) flow reaches Habaswein/Modogashe", "who": "Habaswein, Modogashe, Shantaabaq"},
    ]
    milestones = [m for m in milestones if m["date"]]
    for m in milestones:
        m.setdefault("scenario", "models")
    milestones.sort(key=lambda m: m["date"])

    return {
        "issued": ISSUED.isoformat(),
        "dates": [d.isoformat() for d in days],
        "dates_extended": [(START + dt.timedelta(days=i)).isoformat() for i in range(DAYS + 14 + 5)],
        "models": [{k: m[k] for k in ("key", "label", "run", "weight", "color", "img", "mm", "says")} for m in MODELS],
        "zones": zones,
        "tana": tana,
        "tana_extended": tana_ext,
        "laghas": laghas,
        "milestones": milestones,
        "extreme700": {k: forecast.tana_scenarios(masinga_fill_pct)["extreme700"][k] for k in ("peak_stage_m", "level", "peak_discharge_m3s")},
        "farm_impact": [{"stage_m": s, "level": l, "text": t} for s, l, t in FARM_IMPACT],
        "exposure_by_stage": {str(k): v for k, v in _stage_exposure().items()},
        "community": COMMUNITY,
        "masinga_fill_pct": masinga_fill_pct,
        "method": __doc__.strip(),
    }
