# Garissa CSG Portal – User Guide

For CSG members, sector working groups, ward administrators, partners and residents.
Works on phones, tablets and laptops. Change language with **EN / SW / SO** at the top right.

---

## 1. Risk map (home page)

1. **Layers** (stack icon, left): tick layers on/off. Groups: Boundaries · River Tana & floods · Hazards ·
   Assets · Upper Tana & dams · Nature-based solutions · Terrain, land & people.
2. **Basemap** (top right button): Google Hybrid, Google Satellite, Google Roads, OpenStreetMap, Esri imagery, Topo, dark/light.
3. **Hover or tap** any feature for its attributes. **Fit to Garissa** (crosshair icon) returns to the county; the arrows icon opens full screen.
4. **Flood tools** (waves icon):
   * *Flood simulator* – slide the Garissa gauge from 3.0 to 7.5 m to see which areas go under water.
   * *Flood wave* – press Play to watch a Masinga spill travel down the Tana to Garissa and the Delta.
   * *River Tana buffer* – choose 0.5, 1, 2 or 5 km and read how many schools, health facilities and boreholes fall inside.
   * *Buffer a point* – click anywhere to count assets within a radius.
5. **Legend** (bottom right) updates with the layers you turn on. The **staff gauge** shows the forecast peak against the CSG thresholds.

## 2. "Am I at risk?"

1. Tap the sand-coloured **Am I at risk?** button on the map.
2. Choose one:
   * **Use my current location (GPS)** – your browser asks permission. Say *Allow*.
     *Phone:* Settings → Privacy/Location → turn on for your browser.
     *Laptop:* click the padlock next to the web address → Location → Allow.
   * **Type** a village, school or coordinates (e.g. `-0.4532, 39.6461`).
   * **Tap a point on the map.**
3. Read the verdict: **HIGH / MEDIUM / LOW**, the reasons (inside the 2023 or 2024 flood extent, gauge level at which the
   spot floods, distance to the Tana and to the nearest lagha, land cover) and the **nearest schools and health facilities**
   with distance and a directions link.
4. You can also ask the assistant: *"Am I at risk where I am now?"* or *"Is Saka in a flood risk area?"*.

The verdict is a screening tool based on past floods and models – always follow official warnings.

## 3. Community maps – make and download your own map

1. Type a question, e.g. *"high risk boreholes in Garissa Township"*, and press **Make my map** – or use a ready recipe.
2. Refine in **Query**: what to map, sub-county, distance to the Tana, risk class, only inside past floods, name contains.
3. Style it in **Map style**: title, background (elevation, land use, population, plain), colour points by risk or an attribute,
   show past floods / 2 km buffer / laghas / labels, paper (A4 landscape, social square, phone poster), light or dark.
4. Download: **Map (PNG)** for printing/WhatsApp, **Table (CSV)** for Excel, **GIS (GeoJSON)** for QGIS/ArcGIS.
5. Published county maps (JPG) are at the bottom of the page.

## 4. El Niño warning

* Compare models: ECMWF and the US AI model (up to 350 mm in 14 days), GFS and AI-ECMWF (~100 mm), KMD, and the Director's 700 mm scenario.
* **Exceedance chart** – chance that 14-day rain over the Upper Tana passes 100, 200, 350, 500 and 700 mm.
* **Live charts** – today's model runs for Embu (Upper Tana) and Garissa from Open-Meteo.
* **Tana forecast** – move the Masinga fill slider to see how reservoir level changes the Garissa peak.

## 5. Tana & Seven Forks

Dam cascade, travel-time cards (Garissa 36–48 h after a Kiambere release), gauge forecast by model, blind-fold hotspots map.

## 6. Health & WASH

Pick a rainfall scenario; toggle diseases on the chart; read each disease card for peak date, lag, hotspots and actions.

## 7. Nature-based solutions

Click a family card to filter; search the site finder; tap a site to fly to it on the map.

## 8. Partnerships policy

Colourful summary of the 2025 policy – principles, objectives, coordination structure, 7-step partner entry,
quarterly calendar – and **Download the policy (PDF)**.

## 9. Report an emergency

Choose what is happening and how urgent, add the place (and GPS), describe it, and **Send report**.
It goes to **emergency@garissa.go.ke**. If the server is offline your mail app opens with the report ready.
Life-threatening: call **1199** (Kenya Red Cross) or **999 / 112** first.

## 10. GeoAI assistant (bottom right)

Ask in English, Kiswahili or Somali. Examples:
* "Show schools within 2 km of the Tana in Balambala"
* "Simulate a 6 m flood at Garissa"
* "Switch to OpenStreetMap and show laghas"
* "What does the El Niño outlook say?" · "Which diseases follow the floods?"
* "Make me a map" (opens Community maps)

With a Gemini key on the server the assistant reasons over the portal's tools; without it a built-in engine handles common requests.

## 11. For administrators

* Start: `start_portal.command` (Mac) / `start_portal.bat` (Windows). Settings in `.env` (see `.env.example`).
* Stored reports: `curl -H "x-admin-token: <ADMIN_TOKEN>" http://localhost:8080/api/feedback`.
* Health check: http://localhost:8080/api/health. Data refresh: automatic every 3 h; see README for rebuilding data.
