"""CSG GeoAI agent.

An agentic assistant powered by Google Gemini (function calling). The model can *act on the map*:
toggle layers, switch basemaps, zoom, find and highlight assets, buffer a point, run the flood
simulator and pull forecasts / disease-risk numbers. Each tool returns data for the model AND
`map_actions` that the browser executes, so "Show high-risk schools within 2 km of the Tana in
Balambala" really draws the answer on the map.

If GEMINI_API_KEY is not set (or the API is unreachable) a deterministic offline agent with the
same tools answers in English / Kiswahili / Af-Soomaali using keyword intents + the knowledge base.
"""
from __future__ import annotations

import json
import logging
import os
import re
from functools import lru_cache
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.prepared import prep

from . import forecast, health_model, knowledge, weather

log = logging.getLogger("csg.agent")
DATA = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data"

LAYERS = {
    "county": "Garissa County boundary", "subcounties": "Sub-county boundaries", "tana": "River Tana",
    "tana_buffers": "River Tana buffers (0.5/1/2/5 km)", "flood_sim": "Flood simulation", "flood_2023_viirs": "Nov 2023 El Nino flood (VIIRS)",
    "flood_2023_town": "Nov 2023 flood - Garissa Town", "flood_2023_dadaab": "Nov 2023 flood - Dadaab",
    "flood_2024_tana": "Apr 2024 Tana flood", "structures_2024": "Flood-affected structures May 2024",
    "blindfolds": "Tana blind-folds (meander necks)", "laghas": "Laghas & flash-flood hazard", "catchment": "Seven Forks catchment",
    "dams": "Seven Forks dams", "travel": "Flood travel-time markers", "upper_tana": "Upper Tana tributaries",
    "schools": "Schools", "health": "Health facilities", "boreholes": "Boreholes", "water_pans": "Water pans",
    "farm_zones": "Tana farm & inundation zones", "camps": "Dadaab refugee camps", "met_stations": "KMD observation stations",
    "nbs_sites": "NbS candidate sites", "nbs_storage": "NbS storage areas", "town_catchments": "Garissa Town catchments",
    "places": "Towns & villages",
}
BASEMAPS = ["google_hybrid", "google_satellite", "google_roads", "osm", "esri_imagery", "topo", "carto_dark", "carto_light"]
PAGES = ["home", "about", "policy", "elnino", "tana", "health", "nbs", "gallery", "report"]
ASSET_FILES = {"schools": "schools.geojson", "health": "health_facilities.geojson", "boreholes": "boreholes.geojson",
               "water_pans": "water_pans.geojson", "nbs_sites": "nbs_sites.geojson", "met_stations": "met_stations.geojson",
               "places": "places.geojson"}


@lru_cache(maxsize=None)
def _fc(name):
    return json.load(open(DATA / name, encoding="utf-8"))


@lru_cache(maxsize=None)
def _subcounties():
    return [(f["properties"]["name"], prep(shape(f["geometry"])), shape(f["geometry"])) for f in _fc("subcounties.geojson")["features"]]


def _subcounty_of(lon, lat):
    p = Point(lon, lat)
    for name, pg, _ in _subcounties():
        if pg.contains(p):
            return name
    # riverine assets sit on the Tana, which *is* the county boundary - snap to the nearest sub-county (<15 km)
    name, _, g = min(_subcounties(), key=lambda t: t[2].distance(p))
    return name if g.distance(p) < 0.14 else None


def _name(props):
    for k in ("name", "village", "site_id", "health_fac"):
        if props.get(k):
            return str(props[k])
    return "asset"


GAZ_EXTRA = {"seven forks": (37.75, -0.80, 10), "masinga": (37.5919, -0.8883, 12), "kiambere": (37.8822, -0.6328, 12),
             "tana delta": (40.3, -2.45, 10), "garissa bridge": (39.648, -0.455, 14), "upper tana": (37.4, -0.4, 9),
             "mt kenya": (37.31, -0.15, 10), "aberdares": (36.7, -0.4, 10), "dadaab complex": (40.32, 0.1, 12),
             "garissa county": (40.1, -0.5, 7)}


def gazetteer(q):
    q = q.lower().strip()
    for k, (lon, lat, z) in GAZ_EXTRA.items():
        if k in q:
            return {"name": k.title(), "lat": lat, "lon": lon, "zoom": z}
    for f in _fc("places.geojson")["features"]:
        n = f["properties"]["name"]
        if n.lower().split(" (")[0] in q or q in n.lower():
            lon, lat = f["geometry"]["coordinates"]
            return {"name": n, "lat": lat, "lon": lon, "zoom": 13}
    for name, _, g in _subcounties():
        if name.lower() in q or q in name.lower():
            w, s, e, n = g.bounds
            return {"name": name, "bbox": [w, s, e, n]}
    for f in _fc("seven_forks_dams.geojson")["features"]:
        if f["properties"]["name"].lower().split()[0] in q:
            lon, lat = f["geometry"]["coordinates"]
            return {"name": f["properties"]["name"], "lat": lat, "lon": lon, "zoom": 13}
    return None


# ----------------------------------------------------------------------------------- tools
def t_show_layers(show=None, hide=None):
    show = [l for l in (show or []) if l in LAYERS]
    hide = [l for l in (hide or []) if l in LAYERS]
    return {"ok": True, "shown": show, "hidden": hide}, [{"type": "layers", "show": show, "hide": hide}]


def t_set_basemap(basemap):
    b = basemap if basemap in BASEMAPS else "google_hybrid"
    return {"ok": True, "basemap": b}, [{"type": "basemap", "id": b}]


def t_zoom_to_place(place):
    g = gazetteer(place)
    if not g:
        return {"ok": False, "error": f"Place '{place}' not found in the Garissa gazetteer"}, []
    act = {"type": "zoom", **g}
    return {"ok": True, **g}, [act]


def t_find_assets(asset_type, max_dist_tana_km=None, subcounty=None, risk=None, name_contains=None, limit=50):
    if asset_type not in ASSET_FILES:
        return {"ok": False, "error": f"asset_type must be one of {list(ASSET_FILES)}"}, []
    feats = _fc(ASSET_FILES[asset_type])["features"]
    res = []
    for f in feats:
        pr = f["properties"]
        lon, lat = f["geometry"]["coordinates"]
        if max_dist_tana_km is not None and (pr.get("dist_tana_km") is None or pr["dist_tana_km"] > float(max_dist_tana_km)):
            continue
        if risk and str(pr.get("risk", pr.get("flood_exposure", pr.get("priority", "")))).upper() != str(risk).upper():
            continue
        if name_contains and name_contains.lower() not in _name(pr).lower():
            continue
        sc = _subcounty_of(lon, lat)
        if subcounty and (not sc or subcounty.lower() not in sc.lower()):
            continue
        res.append({"name": _name(pr), "lat": lat, "lon": lon, "subcounty": sc,
                    "dist_tana_km": pr.get("dist_tana_km"),
                    "info": {k: v for k, v in pr.items() if k in ("risk", "pupils", "kephl_level", "functional", "flood_exposure",
                                                                  "nbs_type", "priority", "level", "ward", "patients_per_day")}})
    res.sort(key=lambda r: (r["dist_tana_km"] if r["dist_tana_km"] is not None else 999))
    title = f"{len(res)} {asset_type.replace('_', ' ')}" + (f" within {max_dist_tana_km} km of the Tana" if max_dist_tana_km else "") + \
            (f" in {subcounty}" if subcounty else "") + (f" ({risk} risk)" if risk else "")
    acts = [{"type": "layers", "show": [asset_type if asset_type != "places" else "places"] + (["tana_buffers"] if max_dist_tana_km else []), "hide": []},
            {"type": "highlight", "title": title, "features": res[:400]}]
    return {"ok": True, "count": len(res), "title": title, "items": res[: int(limit)]}, acts


def t_assets_near_point(lat, lon, radius_km=5, asset_types=None):
    asset_types = asset_types or ["schools", "health", "boreholes", "water_pans"]
    from pyproj import Geod
    geod = Geod(ellps="WGS84")
    found = []
    for at in asset_types:
        if at not in ASSET_FILES:
            continue
        for f in _fc(ASSET_FILES[at])["features"]:
            lo, la = f["geometry"]["coordinates"]
            _, _, d = geod.inv(lon, lat, lo, la)
            if d <= radius_km * 1000:
                found.append({"name": _name(f["properties"]), "type": at, "lat": la, "lon": lo, "dist_km": round(d / 1000, 2)})
    found.sort(key=lambda x: x["dist_km"])
    title = f"{len(found)} assets within {radius_km} km"
    return {"ok": True, "count": len(found), "items": found[:60]}, [
        {"type": "circle", "lat": lat, "lon": lon, "radius_km": radius_km, "label": title},
        {"type": "highlight", "title": title, "features": found}]


@lru_cache(maxsize=None)
def _bands():
    return {f["properties"]["stage_m"]: (prep(shape(f["geometry"])), f["properties"]) for f in _fc("flood_sim_bands.geojson")["features"]}


def t_simulate_flood(stage_m):
    stage = max(3.0, min(7.5, float(stage_m)))
    key = min(_bands(), key=lambda s: abs(s - stage))
    pg, props = _bands()[key]
    counts, items = {}, []
    for at in ("schools", "health", "boreholes", "water_pans"):
        n = 0
        for f in _fc(ASSET_FILES[at])["features"]:
            lo, la = f["geometry"]["coordinates"]
            if pg.contains(Point(lo, la)):
                n += 1
                items.append({"name": _name(f["properties"]), "type": at, "lat": la, "lon": lo})
        counts[at] = n
    return {"ok": True, "stage_m": key, "level": props["level"], "flooded_area_km2": props["area_km2"], "assets_inside": counts}, [
        {"type": "flood_stage", "stage": key}, {"type": "layers", "show": ["flood_sim", "schools", "health"], "hide": []},
        {"type": "highlight", "title": f"Assets inside {key} m flood footprint", "features": items}]


def t_tana_forecast(masinga_fill_pct=None):
    r = forecast.tana_scenarios(masinga_fill_pct or forecast.DEFAULT_MASINGA_FILL)
    return {k: {kk: v[kk] for kk in ("peak_stage_m", "peak_discharge_m3s", "peak_time", "level", "first_alert_time")} for k, v in r.items()}, []


def t_rain_outlook():
    e = forecast.ensemble()
    e.pop("_blend_daily", None)
    o = forecast.ond_outlook(n=200)
    return {"models_14day": e["models"], "exceedance_pct": e["exceedance_pct"], "blend_total_mm": e["blend_total_mm"],
            "ond_median_totals": {k: v["total_median"] for k, v in o["scenarios"].items()}}, []


def t_disease_risk(scenario="elnino"):
    r = health_model.disease_risk(scenario)
    return {"scenario": scenario, "diseases": [{k: d[k] for k in ("name", "peak_risk", "level", "peak_date", "lag_days", "hotspots")} for d in r["diseases"]]}, []


def t_weather(place="garissa"):
    key = place.lower() if place.lower() in weather.POINTS else "garissa"
    try:
        w = weather.open_meteo_point(key)
        return {"place": w["point"]["name"], "current": w["current"], "next_7_days": w["daily"][:7]}, []
    except Exception as e:
        return {"error": f"Live weather unavailable: {e}"}, []


def t_open_page(page):
    p = page if page in PAGES else "home"
    return {"ok": True, "page": p}, [{"type": "navigate", "page": p}]


TOOLS = {
    "show_layers": (t_show_layers, "Show and/or hide map layers.", {
        "type": "object", "properties": {"show": {"type": "array", "items": {"type": "string", "enum": list(LAYERS)}},
                                         "hide": {"type": "array", "items": {"type": "string", "enum": list(LAYERS)}}}}),
    "set_basemap": (t_set_basemap, "Switch the basemap.", {
        "type": "object", "properties": {"basemap": {"type": "string", "enum": BASEMAPS}}, "required": ["basemap"]}),
    "zoom_to_place": (t_zoom_to_place, "Zoom the map to a town, village, sub-county, dam or camp in/around Garissa.", {
        "type": "object", "properties": {"place": {"type": "string"}}, "required": ["place"]}),
    "find_assets": (t_find_assets, "Find, list and highlight assets (schools, health, boreholes, water_pans, nbs_sites, met_stations, places) with optional filters.", {
        "type": "object", "properties": {
            "asset_type": {"type": "string", "enum": list(ASSET_FILES)},
            "max_dist_tana_km": {"type": "number", "description": "Only assets within this distance of the River Tana"},
            "subcounty": {"type": "string", "description": "Garissa Township, Balambala, Lagdera, Dadaab, Fafi or Ijara"},
            "risk": {"type": "string", "description": "HIGH, MEDIUM, LOW (schools) or exposure class"},
            "name_contains": {"type": "string"}, "limit": {"type": "integer"}}, "required": ["asset_type"]}),
    "assets_near_point": (t_assets_near_point, "Draw a buffer circle around a point and list assets inside it.", {
        "type": "object", "properties": {"lat": {"type": "number"}, "lon": {"type": "number"}, "radius_km": {"type": "number"},
                                         "asset_types": {"type": "array", "items": {"type": "string"}}}, "required": ["lat", "lon"]}),
    "simulate_flood": (t_simulate_flood, "Run the River Tana flood simulator for a Garissa gauge stage (3.0-7.5 m) and count assets flooded.", {
        "type": "object", "properties": {"stage_m": {"type": "number"}}, "required": ["stage_m"]}),
    "tana_forecast": (t_tana_forecast, "Python hydrology forecast of the River Tana at Garissa for each weather model.", {
        "type": "object", "properties": {"masinga_fill_pct": {"type": "number"}}}),
    "rain_outlook": (t_rain_outlook, "Multi-model 14-day rainfall ensemble and 90-day OND outlook.", {"type": "object", "properties": {}}),
    "disease_risk": (t_disease_risk, "Flood-linked disease risk outlook (cholera, malaria, RVF, dengue...).", {
        "type": "object", "properties": {"scenario": {"type": "string", "enum": ["normal", "above", "elnino"]}}}),
    "weather": (t_weather, "Live weather for garissa, dadaab, masalani, modogashe, embu, meru or masinga.", {
        "type": "object", "properties": {"place": {"type": "string"}}}),
    "open_page": (t_open_page, "Open a portal page.", {
        "type": "object", "properties": {"page": {"type": "string", "enum": PAGES}}, "required": ["page"]}),
}

SYSTEM = f"""You are "CSG GeoAI", the agentic GIS assistant of the Garissa County Steering Group (CSG) early-warning portal,
built by the County Government of Garissa Directorate of ICT & GIS. You help county officers, NDMA, Kenya Red Cross,
partners and citizens understand flood and El Nino risk and act on it.

Rules:
- Reply in the user's language: English, Kiswahili or Af-Soomaali (Somali). Use simple words; short paragraphs or bullets.
- Prefer ACTING with tools: when the user asks to see, show, map, find, list, zoom, buffer or simulate, call the tools so the map updates.
  You may call several tools. Then explain what is now on the map in 2-5 sentences.
- Use numbers from tools; never invent data. Say clearly when something is a model scenario vs an official KMD/NDMA product.
- Safety first: for emergencies tell people to move to higher ground, avoid laghas/flood water, and call 1199 (Kenya Red Cross)
  or report to emergency@garissa.go.ke.
- Layer ids: {", ".join(LAYERS)}. Basemaps: {", ".join(BASEMAPS)}.

Knowledge base (sourced from KMD bulletins of 28-30 Sep 2026, CSG master plan and NBSOS data):
{knowledge.as_context()}
"""


# ----------------------------------------------------------------------------------- Gemini
def _gemini_client():
    key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
    if not key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=key)
    except Exception as e:  # pragma: no cover
        log.warning("Gemini client failed: %s", e)
        return None


def _models():
    primary = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
    return [m for m in [primary, os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")] if m]


def chat(messages: list[dict], lang: str = "en") -> dict:
    client = _gemini_client()
    if client is not None:
        try:
            return _chat_gemini(client, messages, lang)
        except Exception as e:
            log.warning("Gemini failed, using offline agent: %s", e)
            r = offline_chat(messages, lang)
            r["note"] = f"Gemini unavailable ({type(e).__name__}); offline agent answered."
            return r
    return offline_chat(messages, lang)


def _chat_gemini(client, messages, lang):
    from google.genai import types
    decls = [{"name": n, "description": d, "parameters": p} for n, (_, d, p) in TOOLS.items()]
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM + f"\nUI language selected by the user: {lang}.",
        tools=[types.Tool(function_declarations=decls)],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.4)
    contents = []
    for m in messages[-12:]:
        role = "user" if m["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=m["content"])]))
    actions, trace = [], []
    last_err = None
    for model in _models():
        try:
            for _ in range(6):
                resp = client.models.generate_content(model=model, contents=contents, config=config)
                calls = resp.function_calls or []
                if not calls:
                    return {"reply": resp.text or "", "map_actions": actions, "tools_used": trace, "engine": model}
                contents.append(resp.candidates[0].content)
                parts = []
                for fc in calls:
                    fn = TOOLS.get(fc.name)
                    args = dict(fc.args or {})
                    if not fn:
                        result = {"error": "unknown tool"}
                    else:
                        try:
                            result, acts = fn[0](**args)
                            actions.extend(acts)
                        except Exception as e:
                            result = {"error": str(e)}
                    trace.append({"tool": fc.name, "args": args})
                    parts.append(types.Part.from_function_response(name=fc.name, response={"result": result}))
                contents.append(types.Content(role="tool", parts=parts))
            return {"reply": "I ran several map operations - see the map.", "map_actions": actions, "tools_used": trace, "engine": model}
        except Exception as e:
            last_err = e
            continue
    raise last_err or RuntimeError("no model")


def translate(text: str, target: str) -> dict:
    names = {"en": "English", "sw": "Kiswahili (Kenyan)", "so": "Af-Soomaali (Somali as spoken in north-eastern Kenya)"}
    client = _gemini_client()
    if not client:
        return {"text": text, "engine": "none", "note": "Set GEMINI_API_KEY to enable AI translation."}
    prompt = (f"Translate the following disaster early-warning text into {names.get(target, target)}. Keep numbers, units, "
              f"place names and emails unchanged. Use plain words a community member understands. Return only the translation.\n\n{text}")
    for model in _models()[::-1]:  # flash first for speed
        try:
            r = client.models.generate_content(model=model, contents=prompt)
            return {"text": (r.text or "").strip(), "engine": model}
        except Exception:
            continue
    return {"text": text, "engine": "none"}


def bulletin(lang="en") -> dict:
    tana = forecast.tana_scenarios()
    ens = forecast.ensemble()
    facts = {"exceedance": ens["exceedance_pct"], "blend_mm": ens["blend_total_mm"],
             "tana_blend": {k: tana["blend"][k] for k in ("peak_stage_m", "peak_time", "level")},
             "tana_ecmwf": {k: tana["ecmwf"][k] for k in ("peak_stage_m", "peak_time", "level")},
             "tana_usai": {k: tana["usai"][k] for k in ("peak_stage_m", "peak_time", "level")}}
    client = _gemini_client()
    if client:
        prompt = (f"Write a short CSG daily flood & El Nino situation bulletin (max 170 words) for Garissa County in "
                  f"{ {'en': 'English', 'sw': 'Kiswahili', 'so': 'Af-Soomaali'}.get(lang, 'English') }. Use these model facts: "
                  f"{json.dumps(facts)}. Include: headline, rainfall outlook, River Tana outlook with gauge thresholds "
                  f"(4.0 alert, 5.0 alarm, 6.2 emergency), 3 priority actions, and contacts 1199 / emergency@garissa.go.ke. "
                  f"Plain text with short lines.")
        for model in _models()[::-1]:
            try:
                r = client.models.generate_content(model=model, contents=SYSTEM[:4000] + "\n\n" + prompt)
                return {"text": r.text, "engine": model, "facts": facts}
            except Exception:
                continue
    e = facts
    text = (f"CSG FLOOD & EL NINO BULLETIN - Garissa County\n"
            f"Rain outlook (Upper Tana, 14 days): weighted multi-model {e['blend_mm']} mm; chance of >200 mm {e['exceedance']['200']}%, "
            f">350 mm {e['exceedance']['350']}%.\n"
            f"River Tana at Garissa: blend peak {e['tana_blend']['peak_stage_m']} m ({e['tana_blend']['level']}); ECMWF scenario "
            f"{e['tana_ecmwf']['peak_stage_m']} m; US-AI scenario {e['tana_usai']['peak_stage_m']} m. Thresholds 4.0 alert / 5.0 alarm / 6.2 emergency.\n"
            f"Actions: 1) Riverine farmers move pumps, seed and livestock to higher ground. 2) Avoid crossing flowing laghas. "
            f"3) Treat drinking water and sleep under nets.\nReport emergencies: 1199 | emergency@garissa.go.ke")
    return {"text": text, "engine": "template", "facts": facts}


# ----------------------------------------------------------------------------------- offline agent
INTENT_WORDS = {
    "schools": ["school", "schools", "shule", "iskuul", "dugsi", "dugsiyada"],
    "health": ["health", "hospital", "clinic", "dispensary", "afya", "hospitali", "isbitaal", "caafimaad"],
    "boreholes": ["borehole", "boreholes", "kisima", "visima", "ceel", "ceelasha"],
    "water_pans": ["water pan", "water pans", "pan", "pans", "bwawa", "barkad", "war"],
    "nbs_sites": ["nbs", "nature-based", "nature based", "hafir", "sand dam"],
    "met_stations": ["station", "stations", "met station", "rain gauge", "kituo"],
}
LAYER_WORDS = {
    "laghas": ["lagha", "laghas", "togga", "toggag"], "flood_2023_viirs": ["2023", "last flood", "previous flood", "flood extent", "mafuriko", "fatahaad"],
    "flood_2024_tana": ["2024"], "camps": ["camp", "camps", "refugee", "kambi", "xero"], "dams": ["dam", "dams", "seven forks", "masinga", "kiambere"],
    "catchment": ["catchment"], "blindfolds": ["blind", "meander", "oxbow"], "tana_buffers": ["buffer"],
    "farm_zones": ["farm", "farms", "shamba", "beer"], "structures_2024": ["structures", "houses", "buildings"],
}
BASE_WORDS = {"google_hybrid": ["hybrid"], "google_satellite": ["satellite"], "osm": ["osm", "openstreetmap", "street"],
              "esri_imagery": ["esri", "imagery"], "topo": ["topo", "terrain", "contour"], "carto_dark": ["dark", "night"]}
PAGE_WORDS = {"elnino": ["el nino", "elnino", "forecast", "model"], "health": ["disease", "cholera", "malaria", "rvf", "dengue", "wash"],
              "nbs": ["nature based", "nbs"], "tana": ["seven forks", "travel time", "spill"], "report": ["report", "feedback", "emergency"], "policy": ["policy", "donor", "partner coordination"]}


def offline_chat(messages, lang="en"):
    q = messages[-1]["content"].lower() if messages else ""
    actions, trace, lines = [], [], []

    def run(name, **kw):
        res, acts = TOOLS[name][0](**kw)
        actions.extend(acts)
        trace.append({"tool": name, "args": kw})
        return res

    # basemap
    for b, words in BASE_WORDS.items():
        if any(w in q for w in words) and any(x in q for x in ["map", "basemap", "switch", "change", "ramani", "khariidad", "show"]):
            run("set_basemap", basemap=b)
            lines.append(f"Basemap switched to {b.replace('_', ' ')}.")
            break
    # distance filter
    dist = None
    m = re.search(r"(\d+(?:\.\d+)?)\s*(km|kilomet)", q)
    if m:
        dist = float(m.group(1))
    sub = next((s for s in ["garissa township", "balambala", "lagdera", "dadaab", "fafi", "ijara"] if s in q), None)
    risk = "HIGH" if any(w in q for w in ["high risk", "high-risk", "hatari kubwa", "khatar sare"]) else None
    did_asset = False
    for at, words in INTENT_WORDS.items():
        if any(re.search(rf"\b{re.escape(w)}\b", q) for w in words):
            r = run("find_assets", asset_type=at, max_dist_tana_km=dist if ("tana" in q or "river" in q or "mto" in q or "webi" in q or dist) else None,
                    subcounty=sub.title() if sub else None, risk=risk if at == "schools" else None)
            lines.append(f"Highlighted {r['title']}." + (f" Nearest: " + ", ".join(i["name"] for i in r["items"][:5]) + "." if r["items"] else ""))
            did_asset = True
    # flood simulation
    m = re.search(r"(\d(?:\.\d)?)\s*m\b", q)
    if any(w in q for w in ["simulate", "simulation", "stage", "gauge", "iga", "kipimo"]) or (m and "tana" in q and not did_asset):
        st = float(m.group(1)) if m else 5.0
        r = run("simulate_flood", stage_m=st)
        lines.append(f"Flood simulation at {r['stage_m']} m ({r['level']}): ~{r['flooded_area_km2']} km² inundated; "
                     f"assets inside: {r['assets_inside']}.")
    # layers
    show = [l for l, words in LAYER_WORDS.items() if any(w in q for w in words)]
    if show and any(w in q for w in ["show", "display", "map", "onyesha", "tus", "layer", "where", "wapi", "xaggee"]):
        run("show_layers", show=show)
        lines.append("Now showing: " + ", ".join(LAYERS[s] for s in show) + ".")
    # zoom
    g = None
    for token in ["zoom", "go to", "nenda", "u dhaqaaq", "where is", "iko wapi"]:
        if token in q:
            g = gazetteer(q.split(token, 1)[1])
            break
    if not g and not did_asset:
        for f in _fc("places.geojson")["features"]:
            n = f["properties"]["name"].lower().split(" (")[0]
            if re.search(rf"\b{re.escape(n)}\b", q):
                g = gazetteer(n)
                break
    if g:
        actions.append({"type": "zoom", **g})
        lines.append(f"Zoomed to {g['name']}.")
    # weather / forecast / health
    if any(w in q for w in ["weather", "hali ya hewa", "cimilada", "rain today", "mvua"]):
        r = run("weather", place="garissa")
        if "error" not in r:
            c = r["current"] or {}
            lines.append(f"Garissa now: {c.get('temperature_2m', '?')}°C, humidity {c.get('relative_humidity_2m', '?')}%. "
                         f"Next 7 days rain: " + ", ".join(f"{d['date'][5:]}: {d['rain_mm']} mm" for d in r["next_7_days"]))
        else:
            lines.append(r["error"])
    if any(w in q for w in ["forecast", "tana level", "river level", "peak", "utabiri", "saadaal"]):
        r = run("tana_forecast")
        lines.append("River Tana at Garissa (Python hydrology): " + "; ".join(
            f"{k.upper()} peak {v['peak_stage_m']} m ({v['level']})" for k, v in r.items() if k in ("ecmwf", "usai", "gfs", "blend")))
    if any(w in q for w in ["disease", "cholera", "malaria", "rvf", "rift valley", "dengue", "ugonjwa", "cudur"]):
        r = run("disease_risk", scenario="elnino")
        lines.append("Disease risk (El Nino scenario): " + "; ".join(f"{d['name']} {d['level']} (peak {d['peak_date'][5:]})" for d in r["diseases"][:8]))
    if not lines:
        hits = knowledge.search(q)
        if hits:
            lines.append(hits[0]["text"])
            if len(hits) > 1:
                lines.append("Related: " + hits[1]["title"])
        else:
            lines.append("I can show layers, find schools/health facilities/boreholes near the Tana, simulate River Tana flood stages, "
                         "give the El Nino rainfall outlook and disease-risk outlook. Try: 'Show high-risk schools within 2 km of the "
                         "Tana in Balambala' or 'Simulate a 6 m flood'.")
    reply = "\n".join(lines)
    if lang in ("sw", "so"):
        reply += {"sw": "\n\n(Jibu kwa Kiingereza - weka GEMINI_API_KEY kwa majibu ya Kiswahili kamili.)",
                  "so": "\n\n(Jawaab Ingiriisi ah - geli GEMINI_API_KEY si aad u hesho jawaab Af-Soomaali ah.)"}[lang]
    return {"reply": reply, "map_actions": actions, "tools_used": trace, "engine": "offline"}
