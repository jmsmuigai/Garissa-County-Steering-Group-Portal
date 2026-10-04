# Garissa County Steering Group (CSG) – Smart Early-Warning & Coordination Portal

A trilingual (English · Kiswahili · Af-Soomaali), map-first web portal for the Garissa County Steering Group:
El Niño 2026 flood early warning, River Tana / Seven Forks forecasting, "Am I at risk?" location checks,
health & WASH risk, nature-based solutions, community map-making, the County Partnerships & Coordination
Policy, and two-way emergency reporting – with a Gemini-powered GeoAI assistant that drives the map.

**Live site:** https://jmsmuigai.github.io/Garissa-County-Steering-Group-Portal/ (GitHub Pages, served from `docs/`)

*Web portal powered by the County Government of Garissa, Directorate of ICT & GIS – james.mukoma@garissa.go.ke*

---

## Quick start

| You have | Do this |
|---|---|
| **Mac** | Double-click `start_portal.command` (first run installs everything, then opens http://localhost:8080) |
| **Windows** | Double-click `start_portal.bat` |
| **Just a browser** | Open `frontend/dist/index.html` through any static web server (e.g. `cd frontend/dist && python3 -m http.server 8080`). Everything works except the Gemini assistant, AI translation and server-side report storage. |

Requirements: Python 3.10+ and (only to rebuild the site) Node.js 20+.

**Gemini AI (placeholder – off until a key is added).** The whole portal works without it; the assistant uses its built-in engine. To switch Gemini on later, use one of:

| Where the portal runs | Where to paste the key |
|---|---|
| OpenWeather live layers | `docs/portal-config.json` → `"openWeatherApiKey"` (keys: https://home.openweathermap.org/api_keys), or paste on the El Niño Watch page for one device. |
| GitHub Pages, for **everyone** | `docs/portal-config.json` (and `frontend/public/portal-config.json` so rebuilds keep it) → `"geminiApiKey": "AIza…"` → commit & push. The file is public: first restrict the key in Google Cloud (website `https://jmsmuigai.github.io/*`, API = Generative Language API). |
| GitHub Pages, **one device only** | Assistant → key icon → paste → *Save & test* (kept only in that browser). |
| County server (`start_portal.command`) | `.env` → `GEMINI_API_KEY=AIza…` → restart. Stays private on the server. |

Get a key at https://aistudio.google.com/apikey (or Google Cloud → APIs & Services → Credentials).

## What is inside

| Page | What it does |
|---|---|
| **Risk map** (home) | Full-screen map with movable, foldable windows (layers, legend, tools, base maps, results, gauge); 12 basemaps (Google Hybrid / Satellite / Maps / Terrain, OSM, OSM Humanitarian, OpenTopoMap, Esri imagery / streets / topo, Carto light / dark); 30+ toggleable layers (county boundary in bright red, sub-counties, River Tana, 0.5–5 km Tana buffers with asset counts, UNOSAT 2023–24 flood extents, flood simulator 3.0–7.5 m, laghas by flash-flood hazard, Tana "blind folds", schools, health facilities, boreholes, water pans, Dadaab camps, KMD stations, Seven Forks dams and catchment, flood-wave travel markers, NBS sites, SRTM elevation, LUC2010 & ESA WorldCover land use, WorldPop density, live NASA IMERG rain); compass, legend, scale, coordinates, hover/click attributes, flood-wave animation, River Tana staff gauge, buffer tool, fullscreen. |
| **Am I at risk?** | GPS, place search, coordinates or tap-the-map → HIGH/MEDIUM/LOW verdict from past flood extents, flood-simulation stage, distance to the Tana and laghas, land cover; nearest 5 schools and 5 health facilities with directions; sources cited. Also answerable from the chat assistant ("Is Saka at risk?"). |
| **El Niño Watch** | Issued from the 3–4 Oct 2026 model runs: this-week bulletin, 16-day flood calendar (catchment rain, Garissa rain, lagha state, simulated Tana level), first-rains / first-floods timeline, Python simulation (`backend/app/watch.py`: model readings → daily timing → Seven Forks hydrology, lagha and Lagh Dera states, farm/asset exposure by gauge level), scenario ladder, flood-zone map with catchment / Ewaso Ng'iro–Lagh Dera / Somalia-border focus, live Windy (ECMWF/GFS/ICON) map, live Open-Meteo multi-model totals, NOAA CPC charts, model chart gallery, trilingual WhatsApp messages, API-key setup. |
| **El Niño analysis** (below the Watch) | Model showdown (ECMWF, US-AI, GFS, AI-ECMWF, KMD) and the Director's 700 mm scenario; Python Monte-Carlo ensemble with exceedance odds; live Open-Meteo multi-model charts; Tana stage forecast with Masinga fill slider; OND outlook; sub-county impacts. |
| **Tana & Seven Forks** | Dam cascade with fill/spill, flood-wave travel times Kiambere → Garissa (36–48 h) → Delta (96–120 h), gauge forecast against CSG thresholds (4.0 / 5.0 / 6.2 m). |
| **Health & WASH** | Disease risk calendar (AWD, cholera, typhoid, leptospirosis, dengue, chikungunya, RVF, malaria, skin, snakebite) under three rainfall scenarios, peak dates, hotspots, mitigation, facilities at risk, evidence. |
| **Nature-based solutions** | 76 screened sites in six families, site finder that flies the map, implementation steps, open-science links. |
| **Community maps** | Plain-language query ("schools within 2 km of the Tana in Fafi"), filters, results table and a print-ready colour map composer (title, legend, north arrow, scale bar, credits; A4 / square / phone poster; light/dark) → download PNG, CSV, GeoJSON. |
| **Partnerships policy** | The Garissa County Partnerships & Coordination Policy (Aug 2025) in colour with one-click PDF download. |
| **About CSG**, **Gallery**, **Report emergency** | Mandate & structure, response scenarios; photo/map lightbox; GPS-tagged reports to emergency@garissa.go.ke. |
| **GeoAI assistant** | Gemini function-calling agent (show layers, set basemap, zoom, find assets, assets near a point, simulate flood, Tana forecast, rain outlook, disease risk, weather, open page). Works offline with a built-in rules engine when no key/server is available. |

## Architecture

```
frontend/  React 19 + Vite + TypeScript + Tailwind v4 + Leaflet + Recharts  → frontend/dist (static)
backend/   FastAPI: /api/forecast, /api/forecast/tana, /api/health-risk, /api/weather, /api/chat,
           /api/translate, /api/bulletin, /api/feedback, /api/updates; serves frontend/dist
scripts/   build_data.py (GIS processing → frontend/public/data/*.geojson)
           export_static_api.py (model snapshots → frontend/public/data/api/*.json for static hosting)
source_data/ copies of the Drive source layers
```

Graceful degradation: the browser tries the live Python API, then the static model snapshots, then calls
Open-Meteo directly. Auto-update: the backend refreshes weather/model output every 3 hours.

## Updating

* **Publish to GitHub Pages** – `cd frontend && npm run build`, then copy `frontend/dist/*` into `docs/` and push.

* **New GIS data** – put files in `source_data/`, run `python scripts/build_data.py`.
* **Model changes** – edit `backend/app/forecast.py` / `health_model.py`, then `python scripts/export_static_api.py`.
* **Rebuild site** – `cd frontend && npm install && npm run build`.
* **Partner logos** – drop official files at `frontend/public/logos/<id>.png` (`national-government`, `ndma`, `kenya-red-cross`, `kmd`, `unhcr`, `partners`) to replace the text badges.

## Data sources (cited in the portal)

UNOSAT flood extents (Nov 2023 VIIRS, Garissa Town, Dadaab; Apr–May 2024 Sentinel-2/PlanetScope) · geoBoundaries ·
HydroSHEDS/HydroRIVERS · NASA SRTM · RCMRD/KFS LUC2010 · ESA WorldCover 2021 · WorldPop 2019 · NASA GPM IMERG (GIBS) ·
KMD forecasts and station ledger · Open-Meteo (ECMWF IFS & AIFS, GFS, ICON, UKMO) · KenGen Seven Forks figures ·
WRA gauge 4G01 thresholds · KMHFL · county education, water and health registers · Garissa NBS screening (NBSOS) ·
Garissa County Partnerships & Coordination Policy 2025.

Forecasts are decision-support scenarios. Always follow official advisories from KMD, WRA, NDMA and the County Government.
