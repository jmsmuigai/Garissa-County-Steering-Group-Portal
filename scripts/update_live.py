"""Refresh the live situation (rain, River Tana GloFAS, NASA MODIS flood) and write situation.json.

Used by the GitHub Action every 3 hours and by the county server; safe to run by hand:
    python scripts/update_live.py            # full refresh incl. satellite
    python scripts/update_live.py --no-sat   # rain + river only (faster)
Self-healing: if a source fails, the last good values are kept and the failure is recorded in
situation.json["health"], so the portal shows which feed is stale instead of breaking.
"""
import argparse
import datetime as dt
import json
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app import live  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--no-sat", action="store_true")
a = ap.parse_args()

prev = live.read_json("situation.json", {})
health = {"checked": live.now_eat().isoformat(timespec="minutes")}
issued = live.now_eat()


def attempt(name, fn, fallback):
    try:
        v = fn()
        health[name] = "ok"
        return v
    except Exception as e:  # keep the last good data
        health[name] = f"failed: {type(e).__name__}: {str(e)[:120]}"
        traceback.print_exc()
        return fallback


rain = attempt("open_meteo_rain", live.fetch_rain, {"dates": prev.get("rain", {}).get("dates"), "series": prev.get("rain", {}).get("series")})
r_prev = prev.get("river", {}).get("series") or []
river = attempt("glofas_river", live.fetch_river, {"dates": [x["date"] for x in r_prev], "q": [x["q"] for x in r_prev],
                                                   "max": [x["max"] for x in r_prev], "p75": [x["p75"] for x in r_prev], "cell": list(live.RIVER_CELL)})
sat = prev.get("satellite", {}).get("days", [])
if not a.no_sat:
    days = [(issued.date() - dt.timedelta(days=k)).isoformat() for k in (14, 10, 7, 5, 3, 2, 1)]
    sat = attempt("nasa_gibs_modis_flood", lambda: live.satellite_water(days), sat)

if not rain.get("dates") or not river.get("dates"):
    print("No usable data and no previous snapshot - nothing written.")
    sys.exit(1)

sit = live.analyse(rain, river, sat, live.gauge_readings(), issued)
sit["events"] = live.events()[:40]
sit["gauge_readings"] = live.gauge_readings()[-60:]
sit["health"] = health
paths = live.write_json("situation.json", sit)
print(json.dumps({"level": sit["level"], "headline": sit["headline"]["en"], "health": health, "written": paths}, indent=1))
