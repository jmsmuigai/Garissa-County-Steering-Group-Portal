"""Live weather feeds with caching.

* Open-Meteo (free, no key): 16-day daily forecasts and a live multi-model comparison
  (ECMWF IFS, ECMWF AIFS, GFS, ICON, ...) for Garissa and the Upper Tana catchment.
* OpenWeather (optional, needs OPENWEATHER_API_KEY): current conditions + 5-day/3-hour forecast.
* KMD: official product links (daily, 5-day, 7-day, monthly, seasonal). KMD does not publish an
  open API, so the portal links to products and the CSG uploads PDFs to the Drive CSG folder.
"""
from __future__ import annotations

import os
import time

import httpx

CACHE: dict[str, tuple[float, dict]] = {}
TTL = 3 * 3600

POINTS = {
    "garissa": {"name": "Garissa Town", "lat": -0.4532, "lon": 39.6461},
    "dadaab": {"name": "Dadaab", "lat": 0.0585, "lon": 40.3107},
    "masalani": {"name": "Masalani (Ijara)", "lat": -1.70, "lon": 40.117},
    "modogashe": {"name": "Modogashe", "lat": 0.469, "lon": 39.633},
    "embu": {"name": "Embu (Upper Tana)", "lat": -0.53, "lon": 37.45},
    "meru": {"name": "Meru (Upper Tana)", "lat": 0.05, "lon": 37.65},
    "masinga": {"name": "Masinga Dam", "lat": -0.888, "lon": 37.592},
}

OM_MODELS = ["ecmwf_ifs025", "ecmwf_aifs025_single", "gfs_seamless", "icon_seamless", "ukmo_seamless"]
OM_LABELS = {"ecmwf_ifs025": "ECMWF IFS (European)", "ecmwf_aifs025_single": "ECMWF AIFS (AI-European)",
             "gfs_seamless": "NOAA GFS (American)", "icon_seamless": "DWD ICON (German)",
             "ukmo_seamless": "UK Met Office"}

KMD_LINKS = [
    {"title": "KMD daily forecast", "url": "https://meteo.go.ke/forecast/daily-forecast"},
    {"title": "KMD 5-day forecast", "url": "https://meteo.go.ke/forecast/5-day-forecast"},
    {"title": "KMD 7-day forecast", "url": "https://meteo.go.ke/forecast/7-day-forecast"},
    {"title": "KMD monthly forecast", "url": "https://meteo.go.ke/forecast/monthly-forecast"},
    {"title": "KMD seasonal forecast", "url": "https://meteo.go.ke/forecast/seasonal-forecast"},
    {"title": "KMD impact-based warnings", "url": "https://meteo.go.ke/"},
]


def _cached(key, fn):
    now = time.time()
    if key in CACHE and now - CACHE[key][0] < TTL:
        return CACHE[key][1]
    data = fn()
    CACHE[key] = (now, data)
    return data


def _get(url, params):
    with httpx.Client(timeout=20) as c:
        r = c.get(url, params=params)
        r.raise_for_status()
        return r.json()


def open_meteo_point(key="garissa"):
    p = POINTS[key]

    def fetch():
        j = _get("https://api.open-meteo.com/v1/forecast", {
            "latitude": p["lat"], "longitude": p["lon"], "timezone": "Africa/Nairobi", "forecast_days": 16,
            "daily": "precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,weather_code",
            "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code,cloud_cover",
        })
        d = j["daily"]
        days = [{"date": d["time"][i], "rain_mm": d["precipitation_sum"][i], "rain_prob": d["precipitation_probability_max"][i],
                 "tmax": d["temperature_2m_max"][i], "tmin": d["temperature_2m_min"][i], "wind": d["wind_speed_10m_max"][i],
                 "code": d["weather_code"][i]} for i in range(len(d["time"]))]
        return {"point": p, "current": j.get("current"), "daily": days, "source": "Open-Meteo", "fetched": time.time()}
    return _cached(f"om:{key}", fetch)


def open_meteo_models(key="embu"):
    p = POINTS[key]

    def fetch():
        out, dates = [], []
        for m in OM_MODELS:  # one request per model so an unavailable model never breaks the others
            try:
                j = _get("https://api.open-meteo.com/v1/forecast", {
                    "latitude": p["lat"], "longitude": p["lon"], "timezone": "Africa/Nairobi", "forecast_days": 14,
                    "daily": "precipitation_sum", "models": m})
            except Exception:
                continue
            d = j.get("daily", {})
            vals = [v for v in d.get("precipitation_sum", []) if v is not None]
            if not vals:
                continue
            dates = dates or d["time"][:len(vals)]
            cum, c = [], 0.0
            for v in vals:
                c += v
                cum.append(round(c, 1))
            out.append({"model": m, "label": OM_LABELS[m], "daily": vals, "cum": cum, "total": round(c, 1)})
        if not out:
            raise RuntimeError("Open-Meteo unreachable")
        return {"point": p, "dates": dates, "models": out, "source": "Open-Meteo multi-model", "fetched": time.time()}
    return _cached(f"omm:{key}", fetch)


def openweather(key="garissa"):
    api = os.getenv("OPENWEATHER_API_KEY", "").strip()
    if not api:
        return {"enabled": False, "message": "Set OPENWEATHER_API_KEY in .env to enable OpenWeather."}
    p = POINTS[key]

    def fetch():
        cur = _get("https://api.openweathermap.org/data/2.5/weather", {"lat": p["lat"], "lon": p["lon"], "appid": api, "units": "metric"})
        fc = _get("https://api.openweathermap.org/data/2.5/forecast", {"lat": p["lat"], "lon": p["lon"], "appid": api, "units": "metric"})
        return {"enabled": True, "point": p, "current": cur,
                "forecast": [{"time": x["dt_txt"], "temp": x["main"]["temp"], "rain_3h": x.get("rain", {}).get("3h", 0),
                              "desc": x["weather"][0]["description"]} for x in fc.get("list", [])],
                "source": "OpenWeather", "fetched": time.time()}
    return _cached(f"ow:{key}", fetch)


def summary():
    out = {"kmd_links": KMD_LINKS, "points": {}, "errors": []}
    for k in ("garissa", "dadaab", "masalani", "modogashe", "embu", "meru"):
        try:
            out["points"][k] = open_meteo_point(k)
        except Exception as e:  # network down - portal still works with cached/static data
            out["errors"].append(f"{k}: {e}")
    try:
        out["models_upper_tana"] = open_meteo_models("embu")
    except Exception as e:
        out["errors"].append(f"models: {e}")
    try:
        out["models_garissa"] = open_meteo_models("garissa")
    except Exception as e:
        out["errors"].append(f"models garissa: {e}")
    out["openweather"] = openweather()
    return out
