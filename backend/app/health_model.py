"""Flood -> disease risk model for the Health & WASH page.

Method (transparent, literature-based lag structure):
  risk_d(t) = 1 - exp( - sum_k  w_d(k) * R(t-k) / S_d )
where R is daily rainfall (mm) from the chosen scenario, w_d(k) is a lag kernel (gamma-shaped)
centred on the disease's documented lag after heavy rain/flooding, and S_d a sensitivity scale.
A flood-exposure multiplier is applied using the number of health facilities / schools / water
points inside the modelled flood footprint.

Lags (days after rain/flood) from WHO, Kenya MoH and East-Africa El Nino literature
(1997/98 RVF outbreak, 2006/07 RVF, 2015/16 & 2023 cholera):
  Acute watery diarrhoea 2-7, Cholera 3-10, Typhoid 7-21, Leptospirosis 7-21,
  Dengue 14-30, Chikungunya 14-30, Rift Valley Fever 14-28 (livestock first),
  Malaria 21-45, Skin & eye infections 1-10, Snakebite 0-7.
"""
from __future__ import annotations

import datetime as dt

import numpy as np

from .forecast import ISSUE_DATE, ond_outlook

DISEASES = [
    # key, name, lag_mode, lag_spread, sensitivity, color, vector/agent, hotspots
    ("awd", "Acute watery diarrhoea", 4, 2.0, 70, "#8d6e63", "Contaminated water & food",
     "Garissa Township informal areas, Dadaab camps, riverine villages"),
    ("cholera", "Cholera", 6, 3.0, 110, "#6d4c41", "Vibrio cholerae in faecally contaminated water",
     "Hagadera, Ifo, Dagahaley; Bour-Algi, Korakora, Bulla Iftin; Masalani"),
    ("typhoid", "Typhoid", 14, 5.0, 160, "#a1887f", "Salmonella Typhi via water/food", "Garissa Township, Dadaab"),
    ("lepto", "Leptospirosis", 14, 5.0, 220, "#7cb342", "Rodent urine in floodwater", "Riverine farms, Tana floodplain"),
    ("dengue", "Dengue fever", 22, 6.0, 130, "#ef6c00", "Aedes aegypti (water containers, tyres)", "Garissa Town, Dadaab, Masalani"),
    ("chik", "Chikungunya", 22, 6.0, 210, "#fb8c00", "Aedes aegypti / albopictus", "Garissa Town, Ijara"),
    ("rvf", "Rift Valley Fever", 21, 5.0, 100, "#c62828", "Aedes mcintoshi floodwater mosquitoes -> livestock -> people",
     "Lagdera, Fafi, Ijara, Balambala grazing depressions (dambos)"),
    ("malaria", "Malaria (P. falciparum)", 33, 8.0, 80, "#1565c0", "Anopheles arabiensis breeding in pools & ox-bows",
     "Tana riverine belt, Ijara/Boni fringe, Dadaab"),
    ("skin", "Skin & eye infections", 5, 3.0, 120, "#00897b", "Prolonged flood-water contact, crowding", "Displacement sites"),
    ("snake", "Snakebite", 2, 2.0, 160, "#5d4037", "Snakes displaced by floodwater", "Riverine farms, night-time movement"),
]

MITIGATION = {
    "awd": ["Chlorinate household water (Aquatabs / PUR) and protect shallow wells", "ORS & zinc corners in every health facility",
            "Hand-washing stations at markets, schools and camps"],
    "cholera": ["Pre-position cholera kits & ORS at Garissa CRH, Dadaab, Masalani", "Rapid response teams + case-area targeted interventions (CATI)",
                "Oral cholera vaccine (OCV) campaign request via MoH if cases confirmed", "Decommission/flood-proof latrines near laghas"],
    "typhoid": ["Boil or treat drinking water", "Food-hygiene messaging for hotels and markets"],
    "lepto": ["Gloves/boots for farm workers clearing floodwater", "Rodent control at food stores"],
    "dengue": ["Search-and-destroy campaigns for water containers, tyres, jerrycans", "Cover water storage; larviciding",
               "Fever-clinic triage (dengue vs malaria RDT)"],
    "chik": ["Same as dengue: eliminate Aedes breeding sites", "Community clean-up days"],
    "rvf": ["Vaccinate livestock BEFORE floods peak (Smithburn / Clone 13)", "Ban slaughter of sick animals; protect herders handling abortions",
            "Livestock movement surveillance (DVS) and joint human-animal One Health teams"],
    "malaria": ["Mass distribution of LLINs to riverine & camp households", "Larviciding ox-bows and borrow pits",
                "Stock ACTs & RDTs for 6-8 weeks post-flood", "IRS in Dadaab & riverine villages"],
    "skin": ["Dry clothing/NFI kits", "Topical treatment stocks at mobile clinics"],
    "snake": ["Anti-venom stocks at Garissa CRH & sub-county hospitals", "Torches and boots for night movement"],
}


def kernel(mode, spread, length=60):
    k = np.arange(length, dtype=float)
    shape = (mode / spread) ** 2
    scale = spread ** 2 / mode
    w = np.power(np.maximum(k, 1e-6), shape - 1) * np.exp(-k / scale)
    return w / w.sum()


def disease_risk(scenario="elnino", flood_exposure=1.0):
    ond = ond_outlook(n=200)
    rain = np.array(ond["scenarios"][scenario]["daily_mean"]) * 1.0
    # add an extreme 14-day burst consistent with the model guidance at the start of the season
    if scenario == "elnino":
        burst = np.zeros_like(rain)
        burst[3:17] = np.array([4, 8, 14, 22, 30, 34, 30, 24, 18, 12, 8, 6, 4, 3])
        rain = rain + burst
    dates = ond["dates"]
    out = []
    for key, name, mode, spread, sens, color, agent, hot in DISEASES:
        k = kernel(mode, spread)
        conv = np.convolve(rain, k)[: len(rain)]
        risk = 1 - np.exp(-conv * 6 / sens * flood_exposure)
        risk = np.clip(risk * 100, 0, 100)
        pk = int(np.argmax(risk))
        lvl = "Very High" if risk[pk] >= 70 else "High" if risk[pk] >= 45 else "Moderate" if risk[pk] >= 25 else "Low"
        out.append({"key": key, "name": name, "color": color, "agent": agent, "hotspots": hot,
                    "lag_days": f"{max(0, mode - spread):.0f}-{mode + spread * 1.5:.0f}",
                    "peak_date": dates[pk], "peak_risk": round(float(risk[pk]), 1), "level": lvl,
                    "series": [round(float(x), 1) for x in risk], "mitigation": MITIGATION[key]})
    return {"scenario": scenario, "dates": dates, "rain": [round(float(x), 1) for x in rain], "diseases": out,
            "method": __doc__.strip().split("\n\n")[1]}


if __name__ == "__main__":
    r = disease_risk()
    for d in r["diseases"]:
        print(f"{d['name']:28s} peak {d['peak_risk']:5.1f}  {d['level']:9s} {d['peak_date']}")
