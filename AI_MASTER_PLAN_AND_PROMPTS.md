# AI Master Plan & Prompts – Garissa CSG Portal

How Gemini and Claude work on this portal: the agent design, the system prompts, and ready-to-paste prompts
for maintaining and extending it. Keys are read only from environment variables – never paste keys into code or chat.

---

## 1. Roles

| Agent | Where | Job |
|---|---|---|
| **Gemini 2.5 Pro** (fallback 2.5 Flash) | `backend/app/agent.py` | Live GeoAI assistant: function-calling over portal tools; translation EN↔SW↔SO; daily bulletin drafting. |
| **Browser rules engine** | `frontend/src/components/ChatBot.tsx` | Offline fallback + "Am I at risk?" intent computed on the portal's GIS layers. |
| **Claude** (Claude Code / claude.ai) | developer workstation | Builds and maintains code, data pipeline, models, docs; reviews Gemini outputs; tests with Playwright. |

## 2. Gemini assistant – tools

`show_layers`, `set_basemap`, `zoom_to_place`, `find_assets`, `assets_near_point`, `simulate_flood`, `tana_forecast`,
`rain_outlook`, `disease_risk`, `weather`, `open_page`. Each returns data plus `map_actions`
(`layers`, `basemap`, `zoom`, `highlight`, `circle`, `flood_stage`, `navigate`, `assess`) that the browser executes.

### System prompt (in `agent.py`, summarised)

> You are the CSG GeoAI assistant for Garissa County, Kenya. Answer in the user's language (English, Kiswahili or Somali).
> Use tools for anything about places, assets, layers, floods, forecasts or health – never invent numbers.
> Thresholds at Garissa gauge RGS 4G01: ALERT 4.0 m, ALARM 5.0 m, EMERGENCY 6.2 m. Cite sources (UNOSAT, KMD, NDMA,
> WRA, KenGen, WHO/MoH). Forecasts are scenarios; always point to official KMD/NDMA advisories. Emergencies: 1199 / 999,
> emergency@garissa.go.ke. Be brief, concrete and kind.

## 3. Prompts for maintaining the portal

### 3.1 Weekly forecast refresh (Gemini or Claude)
```
You are updating the Garissa CSG El Niño page for the week of <DATE>.
Inputs: KMD weekly forecast PDF, KMD monthly outlook, ECMWF/GFS/AIFS 14-day totals for Embu and Garissa (Open-Meteo),
Masinga reservoir level from KenGen.
1. Update MODELS totals and ISSUE_DATE in backend/app/forecast.py; set DEFAULT_MASINGA_FILL to the latest level.
2. Run python scripts/export_static_api.py and report peak gauge per scenario and the exceedance odds.
3. Draft a 120-word trilingual bulletin (EN/SW/SO) with the alert level, dates of expected peaks and three actions.
Never change thresholds without CSG approval. List every source with its date.
```

### 3.2 New flood extent after an event
```
A new UNOSAT/Copernicus flood extent for Garissa (<DATE>) is attached as GeoJSON/shapefile.
Add it to source_data/, extend scripts/build_data.py to clip it to the county and write
frontend/public/data/flood_<YYYY_MM>.geojson with properties layer, label, date, area_ha, pop_exposed_worldpop.
Register a layer in frontend/src/lib/layers.ts (group "River Tana & floods"), add it to the flood list in assessLocation() in
frontend/src/lib/risk.ts and pages/Community.tsx so "Am I at risk?" and community maps use it. Rebuild and test.
```

### 3.3 Translation review
```
Review these Kiswahili and Somali UI strings from frontend/src/lib/i18n.ts for a pastoralist and riverine farming
audience in Garissa. Keep them short, plain and respectful. Flag anything a county translator must check.
Return the corrected dictionary entries only.
```

### 3.4 Health risk update
```
Using the latest MoH/WHO situation reports for Garissa (<links>), check the disease lags, hotspots and mitigation
in backend/app/health_model.py. Propose changes with citations. Do not present the index as case counts.
```

### 3.5 Adding a new page or capability (Claude)
```
Read README.md and frontend/src/App.tsx. Add <feature> following the existing design tokens (tana, sand, acacia,
crest, night, paper; Lexend + Bricolage Grotesque; 18 px base), mobile-first, trilingual labels in i18n.ts,
static fallbacks in lib/api.ts, sources cited on the page. Build, then test every page at 1440×900 and 390×844 with
Playwright and fix console errors before reporting.
```

## 4. Guardrails

* Keys only via `.env` (`GEMINI_API_KEY`, `OPENWEATHER_API_KEY`); `.env` is never shared or committed.
* The assistant never sends email or messages on anyone's behalf; reports go through `/api/feedback` (SMTP if configured).
* Location checks run in the user's browser; coordinates are not stored unless the user submits a report.
* Every number shown on the portal must trace to a model in `backend/app` or a cited dataset.
* Partner logos are only displayed from official files supplied by the partner (`frontend/public/logos/`).

## 5. Roadmap

1. Live WRA gauge feed for 4G01 and KenGen Masinga level (API or daily SMS parsing).
2. GloFAS discharge comparison layer; Copernicus EMS rapid-mapping activation link.
3. County Aid Information System (policy objective): partner 3W (who/what/where) registry on the map.
4. Offline-first PWA with SMS/USSD alert subscription per ward.
5. Somali/Kiswahili voice notes for alerts (Gemini TTS) reviewed by county translators.


## 6. Live monitoring and the CSG MCP server (Nov 2026)

* `backend/app/live.py` – single source for live rain (Open-Meteo), River Tana flow (GloFAS via Open-Meteo Flood API),
  NASA MODIS flood product statistics, events and official gauge readings.
* `mcp_server/csg_mcp_server.py` – MCP tools for assistants (see `mcp_server/README.md`). Use it from Claude Desktop,
  Claude Code or Gemini CLI.
* `.github/workflows/live-update.yml` – refresh every 3 h; keeps last good data when a feed fails.

### Prompt – daily situation report (any MCP assistant)
```
Use the garissa-csg MCP tools. Call get_situation(refresh=true) and get_tana_flow(days=14).
Write a 150-word CSG situation report: alert level, rain last 24 h / 3 days at Garissa, Dadaab and the
Seven Forks catchment, River Tana trend and the date it is expected to reach 4.0 m, what changed since
yesterday (list_events), and 3 actions. Then give community_message in en, sw and so.
Flag clearly that gauge levels are indicative unless an official WRA reading exists.
```

### Prompt – log field information
```
Log this with the garissa-csg tools: <paste report>. Use log_event with today's date, a short title,
the details, the source (who reported it) and kind=report or response. If it contains a WRA gauge
reading, also call log_gauge_reading. Confirm what was saved.
```
