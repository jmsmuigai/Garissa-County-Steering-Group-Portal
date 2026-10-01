"""Curated knowledge base used to ground the CSG GeoAI assistant and the auto-bulletins.

Every fact here is sourced from project files in GARISSADRM/CSG (KMD bulletins of 28-30 Sep 2026,
the CSG master plan, NBSOS data package) or from the Director of ICT & GIS's field assessment.
Edit this file to update what the assistant "knows" - no retraining needed.
"""

KNOWLEDGE = [
    {
        "id": "policy",
        "title": "Garissa County Partnerships and Coordination Policy (August 2025)",
        "keywords": "policy donor partner partnership coordination ddpc cais ccc technical forum entry mou swg sector working group funding aid",
        "text": (
            "The Garissa County Partnerships and Coordination Policy (Aug 2025, Dept. of Resource Mobilization, Donor & Partner "
            "Coordination - DDPC) is one of the first in Kenya's ASALs. Goal: a legally-anchored, well-resourced, inclusive and "
            "data-driven coordination system aligning all external assistance with the CIDP 2023-2027. Partners spent over KSh 2.7 "
            "billion in Garissa in FY2023/24 (KSh 1.5 bn on livelihoods); conditional grants were KSh 1.006 bn (10.13% of the "
            "FY2024/25 envelope). It finds the CSG valuable for drought/flood early warning and contingency planning but lacking legal "
            "anchoring, a funded secretariat, GIS mapping and standard data. It creates a County Coordination Committee (CCC, chaired "
            "by the Governor with the County Commissioner), a County Technical Forum chaired by the DDPC Director, Sector Working "
            "Groups synchronised to the budget cycle, a 7-step Partner Entry Process (expression of interest, pre-entry consultation, "
            "due diligence, MoU, integration into SWGs/JWPs, quarterly reporting, exit & close-out) and a GIS-enabled County Aid "
            "Information System (CAIS) with ward maps and dashboards. Cost KSh 38 M (KSh 18 M allocated, KSh 20 M gap). Download: "
            "/docs/Garissa_County_Partnerships_and_Coordination_Policy_2025.pdf"
        ),
    },
    {
        "id": "csg",
        "title": "What is the County Steering Group (CSG)?",
        "keywords": "csg county steering group mandate roles members chair secretariat what who",
        "text": (
            "The Garissa County Steering Group (CSG) is the apex multi-agency body that coordinates disaster risk "
            "management, early warning and humanitarian response in Garissa County. It is co-chaired by H.E. the "
            "Governor of Garissa County and the County Commissioner (National Government). The National Drought "
            "Management Authority (NDMA) Garissa office is the secretariat, working with the County Directorate of "
            "Special Programmes/Disaster Management and the Directorate of ICT & GIS. Members include Kenya Red Cross "
            "Society, Kenya Meteorological Department (KMD), Water Resources Authority, county departments (Health, "
            "Water, Agriculture & Livestock, Education, Roads), UNHCR, WFP, UNICEF, WHO, FAO, NGOs and community "
            "representatives."
        ),
    },
    {
        "id": "mandate",
        "title": "CSG mandate",
        "keywords": "mandate functions responsibilities role duties",
        "text": (
            "Core mandate: (1) validate and disseminate early-warning information (NDMA monthly bulletins, KMD seasonal, "
            "monthly and weekly forecasts); (2) approve and activate contingency plans and response scenarios; "
            "(3) mobilise and allocate resources (County Emergency Fund, Drought Contingency Fund, partner pipelines); "
            "(4) coordinate sector working groups - Health & Nutrition, WASH, Education, Agriculture & Livestock, Peace "
            "& Security, Infrastructure; (5) commission rapid assessments and track response; (6) report to the National "
            "Disaster Operations Centre and the County Assembly."
        ),
    },
    {
        "id": "scenarios",
        "title": "Flood response scenarios and Tana gauge thresholds",
        "keywords": "scenario threshold gauge level alert alarm emergency worst case moderate households displaced 4.0 6.2",
        "text": (
            "Garissa (RGS 4G01) River Tana gauge thresholds used by the CSG: below 4.0 m = Normal/Watch; 4.0 m = ALERT "
            "(Moderate case: ~3,000 households / ~18,000 people displaced along riverine farms and low-lying Garissa "
            "Township); 5.0 m = ALARM (evacuate riverine farms, pre-position boats and NFIs); 6.2 m and above = "
            "EMERGENCY/Worst case (>8,000 households / 48,000+ people displaced, Garissa-Madogo bridge approaches and "
            "Bour-Algi, Korakora, Sankuri, Saka, Nanighi submerged)."
        ),
    },
    {
        "id": "kmd_monthly",
        "title": "KMD Monthly Forecast for October 2026 and OND 2026 outlook (issued 30 Sep 2026)",
        "keywords": "kmd october forecast monthly outlook ond short rains above average onset cessation temperature",
        "text": (
            "KMD (Ref KMD/FCST/04-2026/MO/10, 30 Sep 2026): Above-average rainfall, with higher probabilities, is likely "
            "over parts of Garissa, Tana River, Wajir, Mandera and the coast in October 2026. The October-November-"
            "December (OND) 2026 outlook is above-average rainfall for Garissa and the whole Upper Tana catchment "
            "(Embu, Meru, Tharaka-Nithi, Kirinyaga, Murang'a, Nyeri, Kiambu, Machakos, Kitui). Expected onset for "
            "Garissa: 1st-2nd week of October; cessation 1st-2nd week of December; distribution fair to good. Mean "
            "temperatures warmer than average (Garissa max 23-39 C, min 16-28 C). KMD warns of flash floods, riverine "
            "flooding, malaria and water-borne disease risk, and road disruption."
        ),
    },
    {
        "id": "kmd_weekly",
        "title": "KMD Garissa weekly forecast 29 Sep - 5 Oct 2026",
        "keywords": "weekly forecast this week garissa today tomorrow temperature showers",
        "text": (
            "KMD Garissa (MET/GAR/WKLY/FCST/16, issued 28 Sep 2026): light morning rains in a few places in Garissa "
            "Township and Dadaab; afternoon showers likely in a few places in the south (Ijara, Hulugho, Fafi, Masalani, "
            "Bura, Dadaab); partly cloudy nights. Maximum 33-35 C, minimum 21-24 C, moderate to strong southerly to "
            "south-easterly winds. The previous week (22-28 Sep) had light to moderate rain in a few areas."
        ),
    },
    {
        "id": "models",
        "title": "Model guidance - 14-day rainfall (issued 1 Oct 2026)",
        "keywords": "european ecmwf american gfs us ai aifs model 350 700 100 hyper aggressive monster el nino guidance",
        "text": (
            "Director of ICT & GIS model review (1 Oct 2026): the European model (ECMWF) and the US AI model are "
            "hyper-aggressive, indicating catastrophic flooding rains of up to 350 mm in the next two weeks over the "
            "Eastern highlands (Upper Tana catchment) and coastal Kenya. The American model (GFS) and the AI-enhanced "
            "European model (AIFS) are more modest at up to 100 mm. Field assessment: the European and US AI solutions "
            "are favoured - this is a monster El Nino season, odds of extreme rain exceed 50%, 14-day totals of 700 mm "
            "are plausible, and the 100 mm GFS total may be exceeded in a single day at the Garissa demo farm."
        ),
    },
    {
        "id": "elnino",
        "title": "What is El Nino and why does it flood Garissa?",
        "keywords": "el nino enso what is iod indian ocean dipole why sea surface temperature walker",
        "text": (
            "El Nino is the warm phase of the El Nino-Southern Oscillation (ENSO): the central/eastern Pacific warms, the "
            "Walker circulation shifts and East Africa receives enhanced October-December rains. When it coincides with a "
            "positive Indian Ocean Dipole (warm western Indian Ocean near Kenya, cool near Indonesia) moisture and "
            "convection pile over Kenya - the 1997/98 and 2023 floods are the classic examples. Garissa floods in two "
            "ways: (a) River Tana riverine floods driven by heavy rain on Mt Kenya and the Aberdares and spills from the "
            "Seven Forks dams, arriving 1.5-2 days later; and (b) local flash floods in laghas (seasonal sandy river beds) "
            "after intense storms on crusted soils."
        ),
    },
    {
        "id": "sevenforks",
        "title": "Seven Forks cascade and flood travel times",
        "keywords": "seven forks masinga kamburu gitaru kindaruma kiambere dam spill travel time hours catchment delta",
        "text": (
            "The Seven Forks cascade on the Upper Tana: Masinga (1,560 MCM storage, the main regulating reservoir), "
            "Kamburu (150 MCM), Gitaru (20 MCM), Kindaruma (16 MCM) and Kiambere (585 MCM). When Masinga is full, inflow "
            "spills down the cascade; small reservoirs pass it within hours. Indicative travel times of a release from "
            "Kiambere: Kora 10-14 h, Mbalambala 18-24 h, Saka 24-28 h, Sankuri 28-34 h, Garissa Town & farms 36-48 h, "
            "Bura 50-60 h, Hola 60-72 h, Garsen 84-96 h, Tana Delta 96-120 h. This 1.5-2 day lead is the CSG's window "
            "to evacuate riverine farms."
        ),
    },
    {
        "id": "blindfolds",
        "title": "River Tana 'blind-folds' (meander necks)",
        "keywords": "blind fold blindfold meander neck oxbow cut off avulsion",
        "text": (
            "'Blind-folds' are tight meander loops where flood water short-circuits across the neck, inundating farms that "
            "seem far from the channel and leaving ox-bow pools that later breed mosquitoes. The portal flags relative "
            "sinuosity hotspots, with the sharpest near Sankuri, Bour-Algi and Nanighi."
        ),
    },
    {
        "id": "laghas",
        "title": "Laghas and flash floods",
        "keywords": "lagha laghas flash flood dera bor seasonal river gully hafir",
        "text": (
            "Laghas are seasonal sandy riverbeds (Lagh Dera, Lagh Bor and hundreds of minor gullies) that are dry most of "
            "the year but flash within hours of a storm. The NBSOS analysis classified 1,540 lagha reaches by catchment "
            "size and flash-flood index; Very High hazard reaches pass Garissa Town, Dadaab/Hagadera and Modogashe. "
            "Never cross a flowing lagha on foot or by vehicle."
        ),
    },
    {
        "id": "health",
        "title": "Flood-related disease risks",
        "keywords": "health disease cholera malaria rvf rift valley fever dengue chikungunya diarrhoea typhoid leptospirosis wash",
        "text": (
            "After floods Garissa typically sees: acute watery diarrhoea and cholera within 3-10 days (submerged pit "
            "latrines, contaminated shallow wells - Garissa Township, Bura, Dadaab camps); Rift Valley Fever in livestock "
            "then people 2-4 weeks after flooding of clay depressions where Aedes mosquito eggs hatch (Lagdera, Fafi, "
            "Ijara - 1997/98 and 2006/07 outbreaks); malaria peaks 3-6 weeks after rain as pools and ox-bows breed "
            "Anopheles arabiensis; dengue and chikungunya 2-4 weeks after rain in town water containers. Also typhoid, "
            "leptospirosis, skin and eye infections, snakebites and malnutrition when crops and livestock are lost."
        ),
    },
    {
        "id": "nbs",
        "title": "Nature-based solutions for Garissa",
        "keywords": "nbs nature based solutions hafir sand dam check dam vetiver bamboo riparian sponge bioswale half moon zai",
        "text": (
            "The NBSOS opportunity scan (World Bank GFDRR / University of Turku / ESA with Garissa County) identified 76 "
            "candidate NbS sites: flood detention and retention basins (hafirs) on laghas, sand dams and gabion check-dams, "
            "riparian buffers (vetiver, bamboo, indigenous Doum palm) along the Tana, half-moon (zai) micro-catchments on "
            "rangelands, and sponge-town bioswales and rain gardens in Garissa Town and Dadaab. NbS slow, spread and sink "
            "flood water, recharge aquifers and convert hazard into water for the dry season."
        ),
    },
    {
        "id": "contacts",
        "title": "Emergency contacts",
        "keywords": "contact emergency phone hotline report email help red cross 1199",
        "text": (
            "Emergency reports and citizen feedback: emergency@garissa.go.ke. Kenya Red Cross toll-free: 1199. National "
            "emergency: 999 / 112. Portal and GIS: Directorate of ICT & GIS, james.mukoma@garissa.go.ke. KMD Garissa: "
            "cdmgarissa@meteo.go.ke."
        ),
    },
    {
        "id": "county",
        "title": "About Garissa County",
        "keywords": "garissa county population area sub counties wards economy livestock refugees dadaab",
        "text": (
            "Garissa County (code 007) covers about 44,800 km2 of arid and semi-arid land in north-eastern Kenya, with "
            "six constituencies/sub-counties (Garissa Township, Balambala, Lagdera, Dadaab, Fafi, Ijara) and further "
            "administrative sub-counties (Hulugho, Liboi, Bura East, Bothai, etc.). Over 90% of households depend on "
            "livestock; irrigated farms along the River Tana grow bananas, mangoes, watermelon, tomatoes and vegetables. "
            "The Dadaab refugee complex (Hagadera, Ifo, Dagahaley) hosts one of the world's largest refugee populations. "
            "Mean annual rainfall is only ~275 mm, yet the county suffers severe floods in El Nino years."
        ),
    },
]


def search(query: str, k: int = 3):
    q = set(w.strip(".,?!").lower() for w in query.split())
    scored = []
    for item in KNOWLEDGE:
        words = set(item["keywords"].split()) | set(item["title"].lower().split())
        score = len(q & words) + sum(1 for w in q if len(w) > 4 and w in item["text"].lower()) * 0.3
        scored.append((score, item))
    scored.sort(key=lambda x: -x[0])
    return [it for s, it in scored[:k] if s > 0]


def as_context() -> str:
    return "\n\n".join(f"## {k['title']}\n{k['text']}" for k in KNOWLEDGE)
