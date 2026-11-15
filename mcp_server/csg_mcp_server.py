"""Garissa CSG MCP server - lets Claude, Gemini or any MCP client read and update the flood situation.

Run (stdio, for Claude Desktop / Claude Code):   python mcp_server/csg_mcp_server.py
Run (HTTP, for remote clients):                  python mcp_server/csg_mcp_server.py --http --port 8765
Requires:  pip install mcp httpx numpy shapely pillow

Tools
  get_situation          current CSG alert level, headline (EN/SW/SO), actions, rain, River Tana, satellite
  get_tana_flow          River Tana at Garissa: GloFAS flow, trend, indicative gauge now and forecast peak
  get_rainfall           observed and forecast rain for a place (Garissa, Dadaab, Embu, Masinga ...)
  check_location         is a point in a past/simulated flood zone, near the Tana or a lagha; nearest school & clinic
  assets_at_risk         schools, clinics, boreholes, buildings and farm area flooded at a given gauge level
  list_events            the event log (Kenya Met, NDOC, Red Cross, NDMA, FEWS NET, field reports)
  log_event              add a field report / agency update to the event log (shown on the portal)
  log_gauge_reading      record an official WRA gauge reading at Garissa (RGS 4G01) - overrides the model
  community_message      ready-to-send WhatsApp/radio message in English, Kiswahili or Somali
  refresh_live_data      re-fetch rain, GloFAS and satellite data and rewrite the portal's situation.json
Resource
  csg://situation        the latest situation.json
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

try:  # MCP Python SDK v2
    from mcp.server.mcpserver import MCPServer as _Server  # noqa: E402
    _V2 = True
except ImportError:  # SDK v1
    from mcp.server.fastmcp import FastMCP as _Server  # noqa: E402
    _V2 = False

from app import live  # noqa: E402

mcp = _Server("garissa-csg", instructions=(
    "Live flood early-warning data for Garissa County, Kenya (County Steering Group). Use get_situation first. "
    "Gauge levels: ALERT 4.0 m, ALARM 5.0 m, EMERGENCY 6.2 m at Garissa (RGS 4G01). Indicative levels come from "
    "bias-corrected GloFAS and must be confirmed with official WRA readings. Emergencies: Kenya Red Cross 1199."))

DATA = live.PUBLIC


def _situation(refresh: bool = False) -> dict:
    if refresh:
        s = live.build_situation()
        live.write_json("situation.json", s)
        return s
    return live.read_json("situation.json", {}) or live.build_situation(with_satellite=False)


def _short(s: dict) -> dict:
    r = s.get("river", {})
    return {
        "issued": s.get("issued"), "level": s.get("level"), "headline": s.get("headline"), "actions": s.get("actions"),
        "garissa_rain": s.get("rain", {}).get("places", {}).get("garissa"), "garissa_state": s.get("rain", {}).get("garissa_state"),
        "catchment_rain_last7d_mm": s.get("rain", {}).get("catchment_last7d"),
        "river": {k: r.get(k) for k in ("q_now", "ratio_to_baseline", "trend", "pct_change_7d", "indicative_stage_now",
                                        "indicative_level_now", "peak_median", "peak_wettest", "first_alert_median",
                                        "first_alert_wettest", "official_latest")},
        "satellite": {"latest": s.get("satellite", {}).get("latest"), "note": s.get("satellite", {}).get("note")},
        "latest_events": (s.get("events") or [])[:5],
    }


@mcp.tool()
def get_situation(refresh: bool = False) -> dict:
    """Current Garissa flood situation: alert level, headline in EN/SW/SO, actions, rain, River Tana and satellite.
    Set refresh=true to re-fetch live data (slower, ~1 min)."""
    return _short(_situation(refresh))


@mcp.tool()
def get_tana_flow(days: int = 21) -> dict:
    """River Tana at Garissa: GloFAS discharge, trend, indicative gauge now and the forecast peak, plus the last
    `days` days and the forecast as a compact daily table."""
    s = _situation()
    r = s.get("river", {})
    ser = r.get("series", [])
    past = [x for x in ser if not x["forecast"]][-days:]
    fut = [x for x in ser if x["forecast"]]
    out = {k: v for k, v in r.items() if k != "series"}
    out["recent"] = [{"date": x["date"], "q": x["q"], "stage": x["stage"]} for x in past]
    out["forecast"] = [{"date": x["date"], "q": x["q"], "stage": x["stage"], "stage_wettest": x["stage_wet"]} for x in fut]
    out["note"] = "Indicative stage = bias-corrected GloFAS through the Garissa rating curve; confirm with WRA gauge 4G01."
    return out


@mcp.tool()
def get_rainfall(place: str = "garissa") -> dict:
    """Observed (last 21 days) and forecast (next 10 days) daily rain in mm for a place. Places: """ \
        + ", ".join(live.PLACES)
    s = _situation()
    key = place.lower().replace(" ", "").split("(")[0]
    key = next((k for k in live.PLACES if k in key or key in k), None)
    if not key:
        return {"error": f"Unknown place. Use one of: {', '.join(live.PLACES)}"}
    rain = s["rain"]
    ti = rain["today_index"]
    ser = rain["series"][key]
    return {"place": live.PLACES[key][0], "zone": live.PLACES[key][3], "summary": rain["places"][key],
            "observed": dict(zip(rain["dates"][:ti], ser[:ti])), "forecast": dict(zip(rain["dates"][ti:], ser[ti:]))}


def _geo(name):
    return json.loads((DATA / name).read_text())


def _km(a, b):
    la = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * 111.32 * math.cos(la), (a[1] - b[1]) * 110.57)


@mcp.tool()
def check_location(lat: float, lon: float) -> dict:
    """Flood risk at a point in Garissa County: inside past UNOSAT flood extents, the gauge level at which the
    simulated flood reaches it, distance to the River Tana and nearest lagha, and the nearest schools and clinics."""
    from shapely.geometry import Point, shape
    from shapely.ops import nearest_points
    p = Point(lon, lat)
    hits = []
    for f in ("flood_2023_viirs", "flood_2023_town", "flood_2023_dadaab", "flood_2024_tana"):
        for ft in _geo(f + ".geojson")["features"]:
            if shape(ft["geometry"]).contains(p):
                hits.append(f)
                break
    floods_at = None
    for ft in sorted(_geo("flood_sim_bands.geojson")["features"], key=lambda x: x["properties"]["stage_m"]):
        if shape(ft["geometry"]).contains(p):
            floods_at = ft["properties"]["stage_m"]
            break

    def dist_to(name, filt=None):
        best = (1e9, None)
        for ft in _geo(name)["features"]:
            if filt and not filt(ft["properties"]):
                continue
            g = shape(ft["geometry"])
            q = nearest_points(g, p)[0]
            d = _km((q.x, q.y), (lon, lat))
            if d < best[0]:
                best = (d, ft["properties"])
        return round(best[0], 2), best[1]

    d_tana, _ = dist_to("tana_river.geojson")
    d_lagha, lp = dist_to("laghas.geojson")

    def nearest(name, n=3):
        rows = []
        for ft in _geo(name)["features"]:
            c = ft["geometry"]["coordinates"]
            rows.append((_km(c, (lon, lat)), ft["properties"].get("name") or ft["properties"].get("village") or "unnamed"))
        return [{"name": nm, "km": round(d, 1)} for d, nm in sorted(rows)[:n]]

    s = _situation()
    peak = (s.get("river", {}).get("peak_median") or {}).get("stage") or 0
    level = "HIGH" if hits or (floods_at is not None and floods_at <= max(peak, 4.0)) or d_tana < 1 or d_lagha < 0.2 else \
        "MEDIUM" if (floods_at is not None) or d_tana < 5 or d_lagha < 0.5 else "LOW"
    return {"risk": level, "inside_past_flood_extents": hits, "simulated_flooding_starts_at_gauge_m": floods_at,
            "forecast_peak_indicative_m": peak, "km_to_river_tana": d_tana, "km_to_nearest_lagha": d_lagha,
            "nearest_lagha_hazard": (lp or {}).get("ff_hazard"), "nearest_schools": nearest("schools.geojson"),
            "nearest_health_facilities": nearest("health_facilities.geojson")}


@mcp.tool()
def assets_at_risk(stage_m: float) -> dict:
    """Schools, health facilities, boreholes, buildings and farm area inside the simulated flood zone when the
    River Tana gauge at Garissa reads `stage_m` metres (3.0-7.5)."""
    return live.assets_at_stage(stage_m) or {"error": "flood bands not available"}


@mcp.tool()
def list_events(limit: int = 15) -> list[dict]:
    """Latest entries in the CSG event log (agency updates, forecasts, field reports), newest first."""
    return live.events()[:limit]


@mcp.tool()
def log_event(date: str, title: str, detail: str = "", source: str = "", url: str = "", kind: str = "report") -> dict:
    """Add an entry to the CSG event log shown on the portal's Situation Room. date = YYYY-MM-DD.
    kind: event | warning | forecast | analysis | report | response. Always give a source."""
    return live.log_event(date, title, detail, source, url, kind)


@mcp.tool()
def log_gauge_reading(stage_m: float, observer: str, time: str = "", note: str = "") -> dict:
    """Record an official River Tana reading at the Garissa gauge (WRA RGS 4G01) in metres. Official readings
    override the model estimate on the portal. time = ISO 'YYYY-MM-DDTHH:MM' (EAT); empty = now."""
    return live.log_gauge(stage_m, time or None, observer, note)


@mcp.tool()
def community_message(lang: str = "en") -> str:
    """A short WhatsApp/radio message for the community from the current situation (lang: en, sw, so)."""
    s = _situation()
    lang = lang if lang in ("en", "sw", "so") else "en"
    acts = {"en": s.get("actions", []),
            "sw": ["Wakulima wa kando ya mto: hamisheni pampu, jenereta na mifugo kutoka eneo la mafuriko sasa.",
                   "Usivuke lagha au barabara zilizofurika.", "Chemsha au tibu maji ya kunywa.",
                   "Ripoti dharura: Kenya Red Cross 1199 au emergency@garissa.go.ke."],
            "so": ["Beeraleyda webiga agtiisa: matoorada, koronto-dhaliyeyaasha iyo xoolaha ka guura dhulka fatahaadda hadda.",
                   "Ha ka gudbin togga ama waddooyinka biyuhu qariyeen.", "Karkari ama nadiifi biyaha la cabbo.",
                   "Xaalad degdeg: Laanqeyrta Cas 1199 ama emergency@garissa.go.ke."]}[lang]
    return f"*Garissa CSG – {s.get('level')}* ({(s.get('issued') or '')[:16].replace('T', ' ')} EAT)\n" + \
        (s.get("headline", {}).get(lang) or "") + "\n" + "\n".join(f"• {a}" for a in acts) + \
        "\nhttps://jmsmuigai.github.io/Garissa-County-Steering-Group-Portal/#/situation"


@mcp.tool()
def refresh_live_data(with_satellite: bool = True) -> dict:
    """Re-fetch Open-Meteo rain, GloFAS River Tana flow and NASA MODIS flood data, recompute the alert and write
    the portal's situation.json. Returns the new short summary."""
    s = live.build_situation(with_satellite)
    paths = live.write_json("situation.json", s)
    return {"written": paths, **_short(s)}


@mcp.resource("csg://situation")
def situation_resource() -> str:
    """The latest full situation.json used by the portal."""
    return json.dumps(_situation(), ensure_ascii=False)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--http", action="store_true", help="serve over streamable HTTP instead of stdio")
    ap.add_argument("--port", type=int, default=8765)
    a = ap.parse_args()
    if a.http:
        if _V2:
            mcp.run(transport="streamable-http", host="0.0.0.0", port=a.port)
        else:
            mcp.settings.port, mcp.settings.host = a.port, "0.0.0.0"
            mcp.run(transport="streamable-http")
    else:
        mcp.run()
