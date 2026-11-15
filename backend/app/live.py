"""Live situation engine for the Garissa CSG portal (River Tana, rainfall, satellite, events).

One module feeds everything that needs "now" data:
  * the FastAPI backend   -> /api/live/situation  (refreshed every 30 min in a background thread)
  * the MCP server        -> mcp/csg_mcp_server.py tools (get_situation, get_tana_flow, ...)
  * the GitHub Action     -> scripts/update_live.py writes docs/data/live/situation.json every 3 h
  * the static site       -> reads that JSON; the browser also re-fetches the same open sources live

Sources (all free, no API key):
  * Rainfall: Open-Meteo forecast API (best-match ECMWF/ICON/GFS analysis for past days + 10-day forecast)
  * River Tana flow: GloFAS v4 via the Open-Meteo Flood API (Copernicus EMS), grid cell on the main
    channel at Garissa (-0.475, 39.575), 51-member ensemble: median, 75th percentile and maximum
  * Satellite water: NASA LANCE MODIS Combined Flood Product (3-day composite) via NASA GIBS,
    clipped to the Garissa County boundary; cloud cover reported so a "0 km2" under clouds is not
    mistaken for "no flood"
  * Events: data/live/events.json (Kenya Met, NDOC, Kenya Red Cross, NDMA, FEWS NET, field reports),
    maintained by the CSG secretariat through the MCP tool `log_event` or by editing the file
  * Gauge readings: data/live/gauge_readings.json (official WRA RGS 4G01 readings logged by the CSG)

Indicative gauge: GloFAS under-estimates absolute Tana flows, so it is bias-corrected to the
early-October low-flow state (~2.0 m at Garissa) and passed through the portal's rating curve.
It is labelled "indicative" everywhere - official readings always win.
"""
from __future__ import annotations

import datetime as dt
import io
import json
import math
from pathlib import Path

import numpy as np

from . import forecast

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "frontend" / "public" / "data"
LIVE_DIR = PUBLIC / "live"
TZ = dt.timezone(dt.timedelta(hours=3))  # East Africa Time

PLACES = {
    "garissa": ("Garissa Town", -0.4532, 39.6461, "Garissa"),
    "dadaab": ("Dadaab", 0.0573, 40.3092, "Somalia border"),
    "hulugho": ("Hulugho", -1.0833, 41.0167, "Somalia border"),
    "masalani": ("Masalani (Ijara)", -1.6963, 40.1653, "Lower Tana"),
    "bura": ("Bura", -1.1000, 39.9500, "Lower Tana"),
    "modogashe": ("Modogashe", 0.7440, 39.1844, "Lagh Dera"),
    "embu": ("Embu", -0.5388, 37.4596, "Seven Forks catchment"),
    "meru": ("Meru", 0.0463, 37.6559, "Seven Forks catchment"),
    "nyeri": ("Nyeri", -0.4201, 36.9476, "Seven Forks catchment"),
    "masinga": ("Masinga Dam", -0.8869, 37.5977, "Seven Forks catchment"),
    "nanyuki": ("Nanyuki", 0.0167, 37.0667, "Ewaso Ng'iro"),
}
RIVER_CELL = (-0.475, 39.575)      # GloFAS cell on the main Tana channel at Garissa (largest flow nearby)
GLOFAS_BIAS = 6.4                  # early-Oct GloFAS 41 m3/s ~ 263 m3/s ~ 2.0 m on the Garissa rating
COUNTY_BBOX = (38.6, -2.1, 41.6, 1.05)
GIBS_FLOOD = "MODIS_Combined_Flood_3-Day"
LEVELS = ["NORMAL", "WATCH", "ALERT", "ALARM", "EMERGENCY"]


# Observed onset of the 2026 El Nino short rains in Garissa (CSG field reports, 15 Nov 2026).
ONSET_DATE = "2026-11-12"
ONSET = {"en": "The rains reached Garissa on the night of Thursday 12 November.", "sw": "Mvua zilifika Garissa usiku wa Alhamisi 12 Novemba.", "so": "Roobabku waxay gaareen Garissa habeenkii Khamiista 12 Nofeembar."}


def _d(iso: str) -> str:
    """'2026-11-13' -> '13 Nov'."""
    try:
        d = dt.date.fromisoformat(str(iso)[:10]); return f"{d.day} {d:%b}"
    except ValueError:
        return str(iso)


def now_eat() -> dt.datetime:
    return dt.datetime.now(TZ)


def level_for_stage(s: float) -> str:
    return "EMERGENCY" if s >= 6.2 else "ALARM" if s >= 5.0 else "ALERT" if s >= 4.0 else "WATCH" if s >= 3.0 else "NORMAL"


def stage_from_glofas(q: float | None) -> float | None:
    if q is None or (isinstance(q, float) and math.isnan(q)):
        return None
    return round(float(forecast.stage_from_q(q * GLOFAS_BIAS)), 2)


# ------------------------------------------------------------------------------------------ fetchers
def _get(url: str, timeout: float = 25.0):
    import httpx
    r = httpx.get(url, timeout=timeout, headers={"User-Agent": "Garissa-CSG-portal/2 (+https://jmsmuigai.github.io/Garissa-County-Steering-Group-Portal/)"})
    r.raise_for_status()
    return r


def fetch_rain(past_days: int = 21, forecast_days: int = 10) -> dict:
    keys = list(PLACES)
    lat = ",".join(str(PLACES[k][1]) for k in keys)
    lon = ",".join(str(PLACES[k][2]) for k in keys)
    j = _get(f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=precipitation_sum"
             f"&past_days={past_days}&forecast_days={forecast_days}&timezone=Africa%2FNairobi").json()
    arr = j if isinstance(j, list) else [j]
    out = {"dates": arr[0]["daily"]["time"], "series": {}}
    for k, a in zip(keys, arr):
        out["series"][k] = [None if v is None else round(float(v), 1) for v in a["daily"]["precipitation_sum"]]
    return out


def fetch_river(past_days: int = 60, forecast_days: int = 30) -> dict:
    la, lo = RIVER_CELL
    j = _get(f"https://flood-api.open-meteo.com/v1/flood?latitude={la}&longitude={lo}"
             f"&daily=river_discharge,river_discharge_median,river_discharge_p75,river_discharge_max"
             f"&past_days={past_days}&forecast_days={forecast_days}").json()
    d = j["daily"]
    return {"dates": d["time"], "q": d["river_discharge"], "median": d.get("river_discharge_median"),
            "p75": d.get("river_discharge_p75"), "max": d.get("river_discharge_max"),
            "cell": [j.get("latitude"), j.get("longitude")]}


def _county_mask(z: int, x0: int, y0: int, w: int, h: int):
    from PIL import Image, ImageDraw
    n = 256 * 2 ** z
    px = lambda lon: (lon + 180) / 360 * n - x0 * 256  # noqa: E731
    py = lambda lat: (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n - y0 * 256  # noqa: E731
    g = json.loads((PUBLIC / "county.geojson").read_text())["features"][0]["geometry"]
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    m = Image.new("L", (w, h), 0)
    dr = ImageDraw.Draw(m)
    for p in polys:
        dr.polygon([(px(x), py(y)) for x, y in p[0]], fill=255)
        for hole in p[1:]:
            dr.polygon([(px(x), py(y)) for x, y in hole], fill=0)
    return np.array(m) > 0


def satellite_water(dates: list[str], z: int = 8) -> list[dict]:
    """km2 of surface water / flood inside Garissa County from the MODIS flood product, plus cloud %."""
    from PIL import Image
    n = 2 ** z
    tx = lambda lon: int((lon + 180) / 360 * n)  # noqa: E731
    ty = lambda lat: int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)  # noqa: E731
    w0, s0, e0, n0 = COUNTY_BBOX
    x0, x1, y0, y1 = tx(w0), tx(e0), ty(n0), ty(s0)
    W, H = (x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256
    mask = _county_mask(z, x0, y0, W, H)
    px_km2 = (40075.016 * math.cos(math.radians(-0.5)) / (256 * n)) ** 2
    out = []
    for d in dates:
        canvas = np.zeros((H, W, 4), dtype=np.uint8)
        ok = 0
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                try:
                    r = _get(f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{GIBS_FLOOD}/default/{d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png", 20)
                    im = np.array(Image.open(io.BytesIO(r.content)).convert("RGBA"))
                    canvas[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = im
                    ok += 1
                except Exception:
                    pass
        if not ok:
            out.append({"date": d, "available": False})
            continue
        px = canvas[mask]
        rgb = px[:, :3].astype(int)
        vis = px[:, 3] > 0
        is_ = lambda c: vis & (np.abs(rgb - np.array(c)).sum(axis=1) < 12)  # noqa: E731
        water, recur, flood, cloud = is_((50, 210, 245)).sum(), is_((255, 255, 0)).sum(), is_((250, 30, 36)).sum(), is_((175, 175, 175)).sum()
        tot = int(mask.sum())
        out.append({"date": d, "available": True, "water_km2": round(water * px_km2), "recurring_km2": round(recur * px_km2),
                    "flood_km2": round(flood * px_km2), "cloud_pct": round(100 * cloud / tot), "county_km2": round(tot * px_km2)})
    return out


# ------------------------------------------------------------------------------------------ files
def read_json(name: str, default):
    for p in (LIVE_DIR / name, ROOT / "docs" / "data" / "live" / name):
        if p.exists():
            try:
                return json.loads(p.read_text())
            except Exception:
                pass
    return default


def write_json(name: str, obj) -> list[str]:
    paths = [LIVE_DIR / name]
    if (ROOT / "docs").exists():
        paths.append(ROOT / "docs" / "data" / "live" / name)
    for p in paths:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(obj, ensure_ascii=False, indent=1))
    return [str(p) for p in paths]


def events() -> list[dict]:
    return sorted(read_json("events.json", []), key=lambda e: e.get("date", ""), reverse=True)


def log_event(date: str, title: str, detail: str = "", source: str = "", url: str = "", kind: str = "report") -> dict:
    ev = read_json("events.json", [])
    item = {"date": date, "title": title, "detail": detail, "source": source, "url": url, "kind": kind,
            "logged": now_eat().isoformat(timespec="minutes")}
    ev.append(item)
    write_json("events.json", ev)
    return item


def gauge_readings() -> list[dict]:
    return sorted(read_json("gauge_readings.json", []), key=lambda r: r.get("time", ""))


def log_gauge(stage_m: float, time: str | None = None, observer: str = "", note: str = "") -> dict:
    g = read_json("gauge_readings.json", [])
    item = {"time": time or now_eat().isoformat(timespec="minutes"), "stage_m": round(float(stage_m), 2),
            "level": level_for_stage(float(stage_m)), "observer": observer, "note": note, "station": "RGS 4G01 Garissa"}
    g.append(item)
    write_json("gauge_readings.json", g)
    return item


# ------------------------------------------------------------------------------------------ analysis
def _sum(vals, i0, i1):
    return round(sum(v or 0 for v in vals[max(0, i0):i1]), 1)


def analyse(rain: dict, river: dict, sat: list[dict], gauges: list[dict], issued: dt.datetime) -> dict:
    today = issued.date().isoformat()
    dates = rain["dates"]
    ti = dates.index(today) if today in dates else len(dates) - 11
    places = {}
    for k, (name, la, lo, zone) in PLACES.items():
        s = rain["series"][k]
        places[k] = {"name": name, "zone": zone, "lat": la, "lon": lo,
                     "last24": s[ti - 1] if ti >= 1 else None, "last72": _sum(s, ti - 3, ti), "last7d": _sum(s, ti - 7, ti),
                     "last21d": _sum(s, 0, ti), "next3d": _sum(s, ti, ti + 3), "next10d": _sum(s, ti, ti + 10),
                     "max_day": max((v or 0, dates[i]) for i, v in enumerate(s[:ti]))}
    catch = ["embu", "meru", "nyeri", "masinga"]
    catch7 = round(np.mean([places[k]["last7d"] for k in catch]), 1)
    catch10f = round(np.mean([places[k]["next10d"] for k in catch]), 1)

    # river
    rd, q = river["dates"], river["q"]
    ri = rd.index(today) if today in rd else None
    if ri is None:
        ri = max(i for i, d in enumerate(rd) if d <= today)
    q_now, q_7 = q[ri], q[max(0, ri - 7)]
    base = float(np.nanmean([v for v in q[:max(1, ri - 40)] if v is not None][:10] or [q[0]]))
    fut = [(rd[i], q[i], (river.get("max") or q)[i], (river.get("p75") or q)[i]) for i in range(ri, len(rd))]
    peak_med = max(fut, key=lambda r: r[1] or 0)
    peak_max = max(fut, key=lambda r: r[2] or 0)
    st_now, st_peak, st_wet = stage_from_glofas(q_now), stage_from_glofas(peak_med[1]), stage_from_glofas(peak_max[2])
    trend = "rising" if q_now > q_7 * 1.08 else "falling" if q_now < q_7 * 0.92 else "steady"
    first_alert = next((d for d, v, _, _ in fut if stage_from_glofas(v) and stage_from_glofas(v) >= 4.0), None)
    first_alert_wet = next((d for d, _, m, _ in fut if stage_from_glofas(m) and stage_from_glofas(m) >= 4.0), None)
    official = gauges[-1] if gauges else None

    river_out = {
        "cell": river.get("cell"), "q_now": round(q_now, 1), "q_7days_ago": round(q_7, 1), "q_baseline_early_oct": round(base, 1),
        "ratio_to_baseline": round(q_now / base, 1) if base else None, "trend": trend,
        "pct_change_7d": round(100 * (q_now - q_7) / q_7) if q_7 else None,
        "indicative_stage_now": st_now, "indicative_level_now": level_for_stage(st_now or 0),
        "peak_median": {"date": peak_med[0], "q": round(peak_med[1], 1), "stage": st_peak, "level": level_for_stage(st_peak or 0)},
        "peak_wettest": {"date": peak_max[0], "q": round(peak_max[2], 1), "stage": st_wet, "level": level_for_stage(st_wet or 0)},
        "first_alert_median": first_alert, "first_alert_wettest": first_alert_wet,
        "official_latest": official,
        "series": [{"date": d, "q": q[i], "p75": (river.get("p75") or [None] * len(rd))[i], "max": (river.get("max") or [None] * len(rd))[i],
                    "stage": stage_from_glofas(q[i]), "stage_wet": stage_from_glofas((river.get("max") or q)[i]), "forecast": d > today}
                   for i, d in enumerate(rd)],
    }

    g = places["garissa"]
    flash = "FLASH FLOODS LIKELY" if (g["last24"] or 0) >= 40 or g["last72"] >= 60 else "LAGHAS FLOWING" if (g["last24"] or 0) >= 15 or g["last72"] >= 30 else "LOCAL PONDING" if g["last72"] >= 10 else "DRY"
    river_lvl = official["level"] if official else level_for_stage(max(st_now or 0, st_peak or 0))
    lvl_idx = max(LEVELS.index(river_lvl), 2 if flash in ("FLASH FLOODS LIKELY", "LAGHAS FLOWING") else 1 if flash == "LOCAL PONDING" else 0)
    level = LEVELS[lvl_idx]

    sat_ok = [s for s in sat if s.get("available")]
    sat_latest = sat_ok[-1] if sat_ok else None
    cloudy = sat_latest and sat_latest["cloud_pct"] >= 60

    headline = {
        "en": f"{level}: {ONSET['en']} {g['last72']:.0f} mm fell on Garissa in the last 3 days ({g['max_day'][0]:.0f} mm on {_d(g['max_day'][1])}). "
              f"The River Tana is {trend} – flow is {river_out['ratio_to_baseline']}× its dry early-October level. "
              f"Indicative Garissa gauge ~{st_now} m now, ~{st_peak} m by {_d(peak_med[0])} (wettest run {st_wet} m).",
        "sw": f"{level}: {ONSET['sw']} Mvua ya mm {g['last72']:.0f} imenyesha Garissa siku 3 zilizopita. Mto Tana unazidi kupanda – "
              f"kiwango cha kipimo cha Garissa kinakadiriwa mita {st_now} sasa na mita {st_peak} kufikia {_d(peak_med[0])}.",
        "so": f"{level}: {ONSET['so']} {g['last72']:.0f} mm roob ah ayaa ka da'ay Garissa 3dii maalmood ee la soo dhaafay. Webiga Tana wuu sii kacayaa – "
              f"cabbirka Garissa qiyaastii {st_now} m hadda, {st_peak} m ilaa {_d(peak_med[0])}.",
    }
    actions = [
        "Riverine farmers: move pumps, generators and livestock off the floodplain now – do not wait for the river to reach 4 m.",
        "Do not walk or drive through flowing laghas or flooded roads.",
        "Boil or treat drinking water; clear stagnant water around homes (malaria, cholera).",
        "Report flooding, trapped people or damaged roads: Kenya Red Cross 1199 or emergency@garissa.go.ke.",
    ]
    if level in ("ALARM", "EMERGENCY"):
        actions.insert(0, "Evacuate low-lying riverine villages (Saka, Sankuri, Korakora, Bour-Algi) to the designated higher-ground sites.")

    return {
        "issued": issued.isoformat(timespec="minutes"), "level": level, "headline": headline, "actions": actions,
        "rain": {"dates": dates, "today_index": ti, "series": rain["series"], "places": places,
                 "catchment_last7d": catch7, "catchment_next10d": catch10f, "garissa_state": flash},
        "river": river_out,
        "satellite": {"product": "NASA LANCE MODIS Combined Flood (3-day) via GIBS", "days": sat,
                      "latest": sat_latest, "note": ("Clouds hide most of the county – optical satellites cannot see the floods; use radar (Sentinel-1) "
                                                     "via Copernicus EMS / UNOSAT for flood extents.") if cloudy else "Clear enough for MODIS water detection."},
        "verification": verification(),
        "sources": SOURCES,
    }


SOURCES = [
    {"name": "Open-Meteo forecast API (ECMWF/ICON/GFS best match)", "url": "https://open-meteo.com/en/docs"},
    {"name": "GloFAS v4 river discharge via Open-Meteo Flood API (Copernicus EMS)", "url": "https://open-meteo.com/en/docs/flood-api"},
    {"name": "NASA LANCE MODIS flood product via NASA GIBS / Worldview", "url": "https://worldview.earthdata.nasa.gov/"},
    {"name": "Kenya Meteorological Service Authority", "url": "https://meteo.go.ke"},
    {"name": "Kenya Red Cross Society", "url": "https://www.redcross.or.ke"},
    {"name": "National Drought Management Authority", "url": "https://www.ndma.go.ke"},
    {"name": "FEWS NET East Africa seasonal monitor", "url": "https://fews.net/east-africa"},
]


def verification() -> list[dict]:
    """How the 4 Oct 2026 El Nino Watch forecast compares with what happened (honest scorecard)."""
    return [
        {"claim": "El Nino rains would start on Mt Kenya 5-11 Oct and peak 12-18 Oct", "result": "missed",
         "evidence": "Onset was delayed: FEWS NET (13 Nov) reports a drier- and hotter-than-average September-October; the rains only reached Garissa on the night of Thursday 12 November – about four weeks after the forecast onset."},
        {"claim": "Rain reaches the mountains first and the River Tana at Garissa rises later", "result": "right",
         "evidence": "GloFAS shows the Tana at Garissa well above its dry early-October flow by mid-November and still rising after the Garissa storms – the river follows the rain, it does not lead it."},
        {"claim": "The first danger in Garissa town is flash flooding from local storms, before the river floods", "result": "right",
         "evidence": "Heavy rain on the night of Thursday 12 Nov flooded parts of Garissa (CSG field reports; ~30 mm at Garissa and Dadaab on 13 Nov in Open-Meteo analysis) while the Tana was still below alert."},
        {"claim": "If heavy rain persists, the Tana flood season at Garissa runs from November, near 4 m", "result": "on track",
         "evidence": "GloFAS forecasts continued rise to late November; bias-corrected it passes 4 m (ALERT) in the median run and approaches 6 m in the wettest member."},
        {"claim": "Garissa, Tana River and the Somalia-border areas are high-risk this season", "result": "right",
         "evidence": "NDOC lists Garissa among high-risk counties; Kenya Met forecast rain over Garissa, Wajir, Mandera and Tana River 3-16 Nov."},
    ]


def build_situation(with_satellite: bool = True) -> dict:
    issued = now_eat()
    rain = fetch_rain()
    river = fetch_river()
    sat = []
    if with_satellite:
        days = [(issued.date() - dt.timedelta(days=k)).isoformat() for k in (14, 10, 7, 5, 3, 2, 1)]
        try:
            sat = satellite_water(days)
        except Exception as e:  # satellite is a bonus; never block the bulletin
            sat = [{"date": d, "available": False, "error": str(e)[:120]} for d in days]
    sit = analyse(rain, river, sat, gauge_readings(), issued)
    sit["events"] = events()[:40]
    sit["gauge_readings"] = gauge_readings()[-60:]
    return sit


def assets_at_stage(stage: float) -> dict | None:
    from . import watch
    return watch.exposure_at(stage)
