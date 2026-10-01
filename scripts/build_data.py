"""
Garissa CSG Portal - GIS data pipeline
======================================
Builds every web map layer used by the portal from the GARISSADRM / NBSOS project
files (see ../source_data) and writes compact GeoJSON to frontend/public/data.

Run:  python scripts/build_data.py
Re-run any time the source files change (the portal picks up the new files on reload).

Sources
-------
* County / sub-county boundaries  : geoBoundaries (gbOpen KEN ADM1/ADM2, CC-BY 4.0)
* River Tana main stem             : HydroSHEDS river network (Rivers.gpkg), traced
                                     downstream from Masinga Dam to the Indian Ocean
* Historical flood extents         : UNOSAT (Nov-2023 El Nino VIIRS/Sentinel-2, Apr-2024)
* Schools / health facilities      : GARISSADRM enriched datasets (schools_enriched, health_facilities)
* Boreholes, water pans, laghas,
  NbS candidate sites, structures  : NBSOS Garissa data package
* Met observation stations         : KMD "Garissa County Observation Networks" ledger (digitised)
"""
from __future__ import annotations

import json
import math
import sqlite3
from pathlib import Path

from pyproj import Transformer
from shapely import wkb
from shapely.geometry import (LineString, MultiLineString, MultiPoint, Point,
                              mapping, shape)
from shapely.ops import linemerge, transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "source_data"
OUT = ROOT / "frontend" / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

to_m = Transformer.from_crs("EPSG:4326", "EPSG:32737", always_xy=True).transform
to_ll = Transformer.from_crs("EPSG:32737", "EPSG:4326", always_xy=True).transform


def load(name):
    return json.load(open(SRC / name, encoding="utf-8"))


def rnd(geom, nd=5):
    """Round coordinates to keep files small (5 dp ~ 1 m)."""
    def r(obj):
        if isinstance(obj, (list, tuple)):
            if obj and isinstance(obj[0], (int, float)):
                return [round(obj[0], nd), round(obj[1], nd)]
            return [r(x) for x in obj]
        return obj
    g = mapping(geom) if not isinstance(geom, dict) else geom
    return {"type": g["type"], "coordinates": r(g["coordinates"])}


def fc(features):
    return {"type": "FeatureCollection", "features": features}


def save(name, obj):
    p = OUT / name
    p.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"  wrote {name:34s} {p.stat().st_size/1024:8.1f} KB  ({len(obj.get('features', []))} features)")


def clean(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


# --------------------------------------------------------------------------- boundaries
print("Boundaries")
adm1 = load("geoBoundaries-KEN-ADM1_simplified.geojson")
county = [shape(f["geometry"]) for f in adm1["features"] if f["properties"]["shapeName"] == "Garissa"][0]
county = county.buffer(0)
county_m = transform(to_m, county)
save("county.geojson", fc([{
    "type": "Feature",
    "properties": {"name": "Garissa County", "code": "007",
                   "area_km2": round(county_m.area / 1e6),
                   "capital": "Garissa Town",
                   "source": "geoBoundaries gbOpen (CC-BY 4.0)"},
    "geometry": rnd(county.simplify(0.0015))}]))

adm2 = load("geoBoundaries-KEN-ADM2_simplified.geojson")
SUB_INFO = {
    "Dujis": ("Garissa Township", "Urban hub on the Tana; riverine & lagha flash-flood exposure"),
    "Balambala": ("Balambala", "Upstream Tana reach: Mbalambala, Saka, Sankuri farms"),
    "Lagdera": ("Lagdera", "Pastoral north; Lagh Dera system, Modogashe"),
    "Dadaab": ("Dadaab", "Refugee complex: Hagadera, Ifo, Dagahaley + host community"),
    "Fafi": ("Fafi", "Central rangelands; Bura, Hagadera road, water pans"),
    "Ijara": ("Ijara", "Southern belt: Masalani, Hulugho, Ijara; borders Tana delta"),
}
subs = []
for f in adm2["features"]:
    s = shape(f["geometry"]).buffer(0)
    if s.intersection(county).area > 0.5 * s.area:
        nm = f["properties"]["shapeName"]
        name, note = SUB_INFO.get(nm, (nm, ""))
        s = s.intersection(county)
        subs.append({"type": "Feature",
                     "properties": {"name": name, "constituency": nm, "note": note,
                                    "area_km2": round(transform(to_m, s).area / 1e6)},
                     "geometry": rnd(s.simplify(0.0015))})
save("subcounties.geojson", fc(subs))

# --------------------------------------------------------------------------- River Tana
print("River Tana")
c = sqlite3.connect(SRC / "Rivers.gpkg")
rows = c.execute("select geom,FROM_NODE,TO_NODE,Strahler,Regime,SUB_NAME,ARCID from Rivers").fetchall()


def gp(b):
    env = (b[3] >> 1) & 7
    n = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
    return wkb.loads(bytes(b[8 + n:]))


segs = [dict(g=gp(r[0]), f=r[1], t=r[2], s=r[3], reg=r[4], sub=r[5], id=r[6]) for r in rows]
byfrom = {}
for s in segs:
    byfrom.setdefault(s["f"], []).append(s)


def parts(g):
    return list(g.geoms) if g.geom_type.startswith("Multi") else [g]


start = Point(37.59, -0.89)  # Masinga Dam
cand = [s for s in segs if s["sub"] == "Tana" and s["reg"] == "P" and s["s"] >= 3]
s = min(cand, key=lambda q: q["g"].distance(start))
path, seen = [s], {s["id"]}
while True:
    nx = byfrom.get(s["t"])
    if not nx:
        break
    s = max(nx, key=lambda q: q["s"])
    if s["id"] in seen:
        break
    seen.add(s["id"])
    path.append(s)
ls = []
for x in path:
    ls += parts(x["g"])
tana = linemerge(MultiLineString(ls))
if tana.geom_type == "MultiLineString":  # keep longest continuous chain
    tana = max(tana.geoms, key=lambda g: g.length)
# orient upstream -> downstream (Masinga is west)
if tana.coords[0][0] > tana.coords[-1][0]:
    tana = LineString(list(tana.coords)[::-1])
tana_m = transform(to_m, tana)
total_km = tana_m.length / 1000
print(f"  Tana main stem traced: {total_km:.0f} km")
save("tana_river.geojson", fc([{
    "type": "Feature",
    "properties": {"name": "River Tana (main stem)", "length_km": round(total_km),
                   "note": "Kenya's longest river (~1,000 km incl. headwaters). Traced Masinga Dam to the Indian Ocean.",
                   "source": "HydroSHEDS river network"},
    "geometry": rnd(tana.simplify(0.0006))}]))

upper = [s for s in segs if s["sub"] == "Tana" and s["reg"] == "P" and s["s"] >= 2 and s["g"].bounds[0] < 38.2]
save("upper_tana_rivers.geojson", fc([{
    "type": "Feature", "properties": {"strahler": x["s"], "name": "Upper Tana tributary"},
    "geometry": rnd(x["g"].simplify(0.001))} for x in upper]))

tana_pts = [pt for s2 in segs if s2["sub"] == "Tana" and s2["g"].bounds[2] < 38.0 for g in parts(s2["g"]) for pt in g.coords]
catch = MultiPoint(tana_pts).convex_hull.buffer(0.03).simplify(0.01)
save("seven_forks_catchment.geojson", fc([{
    "type": "Feature",
    "properties": {"name": "Upper Tana / Seven Forks contributing catchment (indicative)",
                   "area_km2": round(transform(to_m, catch).area / 1e6),
                   "note": "Indicative envelope of the HydroSHEDS Upper Tana network draining Mt Kenya & the Aberdares into the Seven Forks cascade.",
                   "source": "Derived from HydroSHEDS"},
    "geometry": rnd(catch)}]))

# Garissa reach of the Tana (north of -2.05 and east of 38.6)
reach = tana.intersection(county.buffer(0.08).envelope)
reach_m = transform(to_m, reach)

# buffers (both banks - the Tana forms Garissa's western boundary)
buf_feats = []
prev = None
for km, col in [(0.5, "#ff1744"), (1, "#ff9100"), (2, "#ffd600"), (5, "#00e5ff")]:
    b = reach_m.buffer(km * 1000, resolution=8)
    ring = b if prev is None else b.difference(prev)
    prev = b
    buf_feats.append({"type": "Feature",
                      "properties": {"buffer_km": km, "label": f"{km:g} km Tana asset-capture buffer", "color": col},
                      "geometry": rnd(transform(to_ll, ring).simplify(0.0004))})
save("tana_buffers.geojson", fc(buf_feats))


def dist_tana_km(pt):
    return round(transform(to_m, pt).distance(reach_m) / 1000, 2)


# --------------------------------------------------------------------------- meander "blind-folds"
print("Blind-folds / meander necks")
coords = list(reach_m.coords) if reach_m.geom_type == "LineString" else [c for g in reach_m.geoms for c in g.coords]
line = LineString(coords)
step = 250
pts = [line.interpolate(d) for d in range(0, int(line.length), step)]
hot = []
W = 10  # 10 x 250 m = 2.5 km either side
for i in range(W, len(pts) - W):
    along = 2 * W * step
    straight = pts[i - W].distance(pts[i + W])
    sinu = along / max(straight, 1)
    hot.append((sinu, i))
hot.sort(reverse=True)
chosen = []
for sinu, i in hot:
    if all(abs(i - j) > 3 * W for _, j in chosen):
        chosen.append((sinu, i))
    if len(chosen) >= 12:
        break
smax = max(x[0] for x in chosen)
NAMED = {"Mbalambala": (39.067, -0.033), "Saka": (39.317, -0.133), "Sankuri": (39.555, -0.305),
         "Garissa Bridge": (39.648, -0.455), "Bour-Algi": (39.67, -0.52), "Korakora": (39.78, -0.61),
         "Nanighi": (39.864, -0.851), "Hola (Tana River Co.)": (40.03, -1.50), "Bura (Tana River Co.)": (39.95, -1.10)}
bf = []
for sinu, i in sorted(chosen, key=lambda x: x[1]):
    p = transform(to_ll, pts[i])
    near = min(NAMED, key=lambda k: Point(NAMED[k]).distance(p))
    dkm = Point(NAMED[near]).distance(p) * 111
    bf.append({"type": "Feature",
               "properties": {"name": f"Meander neck near {near}" if dkm < 25 else "Meander neck (unnamed reach)",
                              "sinuosity": round(sinu, 2),
                              "risk": "Very High" if sinu >= 2.0 else "High" if sinu >= 1.5 else "Moderate",
                              "method": "Relative sinuosity hotspot (along-channel / straight-line length over a 5 km window)",
                              "explain": "Tight meander loop: in high flows water can jump the neck (avulsion/cut-off), "
                                         "flooding farms 'blind' to the main channel and creating ox-bow pools.",
                              "dist_garissa_bridge_km": round(pts[i].distance(transform(to_m, Point(39.648, -0.455))) / 1000, 1)},
               "geometry": rnd(p)})
save("tana_blindfolds.geojson", fc(bf))

# --------------------------------------------------------------------------- flood simulation bands
print("Flood simulation bands")
hist = []
for fn in ["flood_2023_viirs.geojson", "flood_2024_tana.geojson", "flood_2023_town.geojson"]:
    for f in load(fn)["features"]:
        hist.append(shape(f["geometry"]).buffer(0))
hist_u = unary_union(hist)
hist_m = transform(to_m, hist_u.intersection(county.buffer(0.15)))
plain = reach_m.buffer(9000).intersection(hist_m.buffer(600))
sim = []
STAGES = [(3.0, 0.25), (3.5, 0.5), (4.0, 0.9), (4.5, 1.4), (5.0, 2.0), (5.5, 2.8), (6.0, 3.7), (6.5, 4.8), (7.0, 6.2), (7.5, 8.0)]
for stage, w in STAGES:
    core = reach_m.buffer(min(w, 1.2) * 1000)
    env = reach_m.buffer(w * 1000).intersection(plain.buffer(w * 250))
    band = unary_union([core, env]).simplify(120)
    sim.append({"type": "Feature",
                "properties": {"stage_m": stage, "width_km": w,
                               "area_km2": round(band.area / 1e6, 1),
                               "level": "Normal" if stage < 4 else "Alert" if stage < 5 else "Alarm" if stage < 6.2 else "Emergency"},
                "geometry": rnd(transform(to_ll, band).simplify(0.0006), 4)})
save("flood_sim_bands.geojson", fc(sim))

# --------------------------------------------------------------------------- historical floods
print("Historical flood extents")
for fn, tol in [("flood_2023_viirs.geojson", 0.003), ("flood_2023_town.geojson", 0.0005),
                ("flood_2023_dadaab.geojson", 0.0006), ("flood_2024_tana.geojson", 0.0006)]:
    d = load(fn)
    feats = [{"type": "Feature", "properties": {k: clean(v) for k, v in f["properties"].items()},
              "geometry": rnd(shape(f["geometry"]).buffer(0).simplify(tol), 4)} for f in d["features"]]
    save(fn.replace(".geojson", "") + ".geojson", fc(feats))

# --------------------------------------------------------------------------- point assets
print("Assets")


def pts_layer(src, out, keep=None, rename=None, extra=None):
    d = load(src)
    feats = []
    for f in d["features"]:
        g = f.get("geometry")
        if not g:
            continue
        p = shape(g)
        if p.is_empty:
            continue
        props = {k: clean(v) for k, v in f["properties"].items() if (keep is None or k in keep)}
        if rename:
            props = {rename.get(k, k): v for k, v in props.items()}
        props["dist_tana_km"] = dist_tana_km(p)
        props["in_county"] = bool(county.buffer(0.02).contains(p))
        if extra:
            props.update(extra(props))
        feats.append({"type": "Feature", "properties": props, "geometry": rnd(p)})
    save(out, fc(feats))
    return feats


schools = pts_layer("schools_enriched.geojson", "schools.geojson")
health = pts_layer("health_facilities.geojson", "health_facilities.geojson",
                   keep=["name", "kephl_level", "service", "ward", "staff", "patients_per_day", "water_on_site",
                         "water_available", "rain_effects", "waterborne_cases", "camp", "elev_m", "risk", "flooded_2023",
                         "flooded_2024", "flood_exposure"])
bh = pts_layer("boreholes.geojson", "boreholes.geojson")
wp = pts_layer("water_pans.geojson", "water_pans.geojson")
nbs = pts_layer("nbs_candidate_sites.geojson", "nbs_sites.geojson")

d = load("structures_affected_2024.geojson")
save("structures_2024.geojson", fc([{"type": "Feature", "properties": {"event": f["properties"].get("event")},
                                      "geometry": rnd(shape(f["geometry"]), 5)} for f in d["features"]]))

d = load("nbs_storage_areas.geojson")
save("nbs_storage.geojson", fc([{"type": "Feature", "properties": f["properties"],
                                  "geometry": rnd(shape(f["geometry"]).simplify(0.0002))} for f in d["features"]]))

d = load("tana_farm_zones.geojson")
save("farm_zones.geojson", fc([{"type": "Feature", "properties": f["properties"],
                                 "geometry": rnd(shape(f["geometry"]).simplify(0.0002))} for f in d["features"]]))

d = load("garissa_town_catchments.geojson")
save("town_catchments.geojson", fc([{"type": "Feature", "properties": f["properties"],
                                      "geometry": rnd(shape(f["geometry"]).simplify(0.0005))} for f in d["features"]]))

# --------------------------------------------------------------------------- laghas
print("Laghas")
d = load("laghas_classified.geojson")
lf = []
for f in d["features"]:
    pr = f["properties"]
    g = shape(f["geometry"])
    if (pr.get("strahler") or 0) < 2:
        continue
    keep = {k: clean(pr.get(k)) for k in ["id", "lagha_class", "ff_hazard", "ff_index", "system", "upstream_km2",
                                         "strahler", "length_km", "near_town", "dist_town_km", "flooded_2023", "flooded_2024"]}
    lf.append({"type": "Feature", "properties": keep, "geometry": rnd(g.simplify(0.0012), 4)})
save("laghas.geojson", fc(lf))

# --------------------------------------------------------------------------- refugee camps
print("Dadaab camps")
camp_feats = []
for fn, nm in [("hagadera.geojson", "Hagadera"), ("ifo.geojson", "Ifo"), ("dagahaley.geojson", "Dagahaley")]:
    d = load(fn)
    for f in d["features"]:
        pr = f["properties"]
        block = pr.get("Block") or pr.get("CAMPADM2NA") or pr.get("Name") or ""
        pop = pr.get("TOTPOP")
        camp_feats.append({"type": "Feature",
                           "properties": {"camp": nm, "block": str(block), "population": clean(pop),
                                          "type": pr.get("type", "camp block")},
                           "geometry": rnd(shape(f["geometry"]).buffer(0).simplify(0.00008))})
save("refugee_camps.geojson", fc(camp_feats))

# --------------------------------------------------------------------------- KMD observation stations (digitised ledger, 4 Apr 2013)
print("Met stations")
LEDGER = [
    ("Alinjugur S/Chief's Office", "8940006", 0, 2, "N", 40, 22, 1973), ("Bangale Police Station", "9039006", 0, 43, "S", 39, 0, None),
    ("Benane Primary School", "8938002", 0, 30, "N", 38, 39.6, 1973), ("Bodhai Holding Ground", "9140011", 1, 49, "S", 40, 41, 1976),
    ("Bothei Police Station", "", 1, 51, "S", 40, 43, None), ("Bura East Police Station", "9139000", 1, 6, "S", 39, 57, 1920),
    ("Bura Research Station", "9139003", 1, 8, "S", 39, 54, 1983), ("Dadaab Police Station", "8940002", 0, 20, "N", 40, 53, None),
    ("Dadaab Water Department", "8940005", 0, 4, "N", 40, 19, 1970), ("Dertu Millennium Village", "", 0, 16.3, "N", 39, 47.9, None),
    ("Galole Tana Irrigation Scheme", "9140005", 1, 31, "S", 40, 0, 1957), ("Garissa Farmers Training Centre", "9039008", 0, 28.38, "S", 39, 38, None),
    ("Garissa Met Station", "9039000", 0, 29, "S", 39, 38, 1932), ("Handampia Primary School", "9140009", 1, 35, "S", 40, 4, 1971),
    ("Hara AP Camp, Masalani", "", 1, 51, "S", 40, 13, None), ("Ijara Police Station", "9140002", 1, 35, "S", 40, 30, None),
    ("Korakora AP Post", "", 0, 36.629, "S", 39, 46.8, 2012), ("Kotile AP Camp", "", 1, 58, "S", 40, 12, 2008),
    ("Liboi Police Post", "8940003", 0, 22, "N", 40, 52, 1960), ("Modogashe Police Station", "9039010", 0, 28.14, "S", 39, 38, 2009),
    ("Makere Full Primary School", "9140010", 1, 20, "S", 40, 0, 1971), ("Masalani Police Station", "9140007", 1, 42, "S", 40, 7, 1970),
    ("Mbalambala Police Post", "9039001", 0, 2, "S", 39, 4, 1936), ("Mlanjo School Garissa", "9039003", 0, 18, "S", 39, 29, 1977),
    ("Mnazini Primary School", "9240011", 2, 1, "S", 40, 9, 1965), ("Modika CCK Post", "9039007", 0, 26, "S", 39, 42, 2009),
    ("Muddo Gashi Police Post", "8939000", 0, 45, "N", 39, 11, 1962), ("Saka Veterinary Station", "9039002", 0, 8, "S", 39, 19, 1973),
    ("Santabak AP Camp", "", 0, 27.6, "N", 39, 44, 2008), ("Shangailu", "", 1, 18, "S", 40, 45, None),
    ("Tana Experimental Station", "9140006", 1, 28, "S", 40, 0, 1966), ("Tana River Forest Station", "9140012", 1, 28, "S", 40, 2, 1977),
    ("Wenje Full Primary School", "9140008", 1, 47, "S", 40, 6, 1971),
]
mf = []
for name, num, ld, lm, hemi, od, om, opened in LEDGER:
    lat = (ld + lm / 60) * (1 if hemi == "N" else -1)
    lon = od + om / 60
    p = Point(lon, lat)
    mf.append({"type": "Feature",
               "properties": {"name": name, "kmd_number": num or "n/a", "opened": opened or "n/a",
                              "in_county": bool(county.buffer(0.05).contains(p)),
                              "dist_tana_km": dist_tana_km(p),
                              "source": "KMD Garissa County Observation Networks ledger (4 Apr 2013), digitised"},
               "geometry": rnd(p)})
save("met_stations.geojson", fc(mf))

# --------------------------------------------------------------------------- Seven Forks cascade + travel markers
print("Seven Forks & travel times")
DAMS = [
    ("Masinga", 37.5919, -0.8883, 1560, 40, 1981, "Largest storage reservoir; regulates the whole cascade. Spill at full supply level ~1,056.5 m a.s.l."),
    ("Kamburu", 37.6836, -0.8122, 150, 94, 1974, "Run-of-river dam immediately below Masinga."),
    ("Gitaru", 37.7447, -0.7983, 20, 225, 1978, "Highest-output station of the cascade; small storage, spills fast."),
    ("Kindaruma", 37.8133, -0.8117, 16, 72, 1968, "Oldest dam of the cascade; minimal storage."),
    ("Kiambere", 37.8822, -0.6328, 585, 168, 1988, "Last dam; releases enter the free-flowing lower Tana toward Garissa."),
]
dams = [{"type": "Feature",
         "properties": {"name": f"{n} Dam", "storage_mcm": st, "capacity_mw": mw, "commissioned": yr, "note": note,
                        "order": i + 1, "source": "KenGen / published figures (approx.)"},
         "geometry": rnd(Point(x, y))} for i, (n, x, y, st, mw, yr, note) in enumerate(DAMS)]
save("seven_forks_dams.geojson", fc(dams))

TRAVEL = [("Kiambere Dam (release)", 0, "0 h"), ("Kora / Adamson's Falls", 12, "10-14 h"),
          ("Mbalambala", 21, "18-24 h"), ("Saka", 26, "24-28 h"), ("Sankuri", 31, "28-34 h"),
          ("Garissa Town & farms", 42, "36-48 h"), ("Bura (Tana River Co.)", 56, "50-60 h"),
          ("Hola (Tana River Co.)", 66, "60-72 h"), ("Garsen", 90, "84-96 h"), ("Tana Delta / Kipini", 108, "96-120 h")]
DIST_TARGET = {"Kora / Adamson's Falls": (38.40, -0.05), "Mbalambala": (39.067, -0.033), "Saka": (39.317, -0.133),
               "Sankuri": (39.555, -0.305), "Garissa Town & farms": (39.648, -0.455), "Bura (Tana River Co.)": (39.95, -1.10),
               "Hola (Tana River Co.)": (40.03, -1.50), "Garsen": (40.12, -2.27), "Tana Delta / Kipini": (40.50, -2.50),
               "Kiambere Dam (release)": (37.8822, -0.6328)}
tm = []
for name, hrs, rng in TRAVEL:
    tgt = transform(to_m, Point(DIST_TARGET[name]))
    d_along = tana_m.project(tgt)
    snap = transform(to_ll, tana_m.interpolate(d_along))
    tm.append({"type": "Feature",
               "properties": {"name": name, "travel_h": hrs, "travel_range": rng, "river_km": round(d_along / 1000)},
               "geometry": rnd(snap)})
save("tana_travel_markers.geojson", fc(tm))

# --------------------------------------------------------------------------- towns / places
print("Places")
PLACES = [("Garissa Town", 39.6461, -0.4532, "County HQ"), ("Dadaab", 40.3107, 0.0585, "Sub-county HQ"),
          ("Hagadera", 40.3689, -0.0028, "Refugee camp"), ("Ifo", 40.315, 0.115, "Refugee camp"),
          ("Dagahaley", 40.29, 0.19, "Refugee camp"), ("Modogashe", 39.633, 0.469, "Town"),
          ("Masalani", 40.117, -1.70, "Ijara HQ"), ("Ijara", 40.521, -1.574, "Town"), ("Hulugho", 41.048, -1.148, "Town"),
          ("Bura (Fafi)", 39.95, -0.10, "Town"), ("Balambala", 39.089, -0.078, "Town"), ("Liboi", 40.867, 0.367, "Border town"),
          ("Bothai", 40.717, -1.85, "Town"), ("Sankuri", 39.555, -0.305, "Riverine village"), ("Saka", 39.327, -0.145, "Riverine village"),
          ("Mbalambala", 39.067, -0.033, "Riverine village"), ("Korakora", 39.781, -0.614, "Riverine village"),
          ("Bour-Algi", 39.67, -0.52, "Riverine village"), ("Nanighi", 39.864, -0.851, "Riverine village"),
          ("Benane", 38.66, 0.50, "Town"), ("Shantabaq", 39.74, 0.46, "Town"), ("Kotile", 40.20, -1.97, "Village"),
          ("Dertu", 39.80, 0.27, "Village"), ("Fafi", 40.32, -0.39, "Village")]
save("places.geojson", fc([{"type": "Feature", "properties": {"name": n, "kind": k, "dist_tana_km": dist_tana_km(Point(x, y))},
                             "geometry": rnd(Point(x, y))} for n, x, y, k in PLACES]))

# --------------------------------------------------------------------------- summary statistics
print("Statistics")


def within(feats, km):
    return sum(1 for f in feats if f["properties"]["dist_tana_km"] <= km and f["properties"].get("in_county", True))


stats = {
    "county_area_km2": round(county_m.area / 1e6),
    "tana_length_km": round(total_km),
    "tana_reach_garissa_km": round(reach_m.length / 1000),
    "schools": len(schools), "schools_high_risk": sum(1 for f in schools if f["properties"].get("risk") == "HIGH"),
    "schools_medium_risk": sum(1 for f in schools if f["properties"].get("risk") == "MEDIUM"),
    "health_facilities": len(health), "boreholes": len(bh), "water_pans": len(wp), "nbs_sites": len(nbs),
    "laghas": len(lf), "structures_affected_2024": len(load("structures_affected_2024.geojson")["features"]),
    "met_stations": len(mf), "blindfolds": len(bf),
    "buffers": {str(km): {"schools": within(schools, km), "health": within(health, km),
                          "boreholes": within(bh, km), "water_pans": within(wp, km)} for km in [0.5, 1, 2, 5, 10]},
    "flood_2023_viirs_ha": 243942, "flood_2023_town_ha": 4570, "flood_2023_dadaab_ha": 11063, "flood_2024_tana_ha": 8704,
    "pop_exposed_2023_town": 19001, "pop_exposed_2023_dadaab": 27655,
}
(OUT / "stats.json").write_text(json.dumps(stats, indent=1))
print(json.dumps(stats, indent=1))
