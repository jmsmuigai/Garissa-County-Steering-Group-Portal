"""El Nino early-warning analytics for the Garissa CSG portal.

Three linked Python models (numpy only, fully transparent, re-run in milliseconds):

1. MULTI-MODEL ENSEMBLE (14 days, Upper Tana catchment / Eastern highlands)
   Each NWP model's 14-day total is treated as a lognormal distribution (median = stated total,
   spread = model-specific uncertainty). A weighted Monte-Carlo mixture (default weights favour
   the ECMWF + US-AI solution, per the Director's field assessment) gives exceedance odds for
   100 / 200 / 350 / 700 mm.

2. CATCHMENT -> SEVEN FORKS -> GARISSA HYDROLOGY
   SCS Curve-Number runoff on the ~7,300 km2 catchment above Masinga, a storage bucket for Masinga
   (spill when full), the four downstream run-of-river dams passing flow quickly, Muskingum
   routing with a 40 h lag to Garissa (RGS 4G01) and a power-law rating curve -> river stage.
   Thresholds: 4.0 m Alert, 5.0 m Alarm, 6.2 m Emergency.

3. 90-DAY OND OUTLOOK FOR GARISSA (local rainfall)
   Stochastic daily rainfall generator (Markov wet/dry + gamma amounts) scaled to Garissa's
   climatology and three scenarios: Normal, KMD Above-Average, Strong El Nino (1997/2023 analogue).
   500 realisations -> P10/P50/P90 cumulative curves.

All parameters are explicit below so hydrologists at WRA / KMD / NDMA can calibrate them.
These are decision-support scenarios, NOT official KMD forecasts.
"""
from __future__ import annotations

import datetime as dt
import math

import numpy as np

ISSUE_DATE = dt.date(2026, 10, 1)

MODELS = [
    # key, label, 14-day median (mm), lognormal sigma, default weight, colour, character
    ("ecmwf", "European model (ECMWF IFS)", 350, 0.35, 0.30, "#e53935", "Hyper-aggressive"),
    ("usai", "US AI model", 350, 0.45, 0.30, "#8e24aa", "Hyper-aggressive (tail to 700 mm)"),
    ("gfs", "American model (GFS)", 100, 0.35, 0.15, "#1e88e5", "Modest"),
    ("aifs", "AI-enhanced European (AIFS)", 100, 0.35, 0.15, "#00897b", "Modest"),
    ("kmd", "KMD outlook (above-average OND)", 160, 0.40, 0.10, "#f9a825", "Above-average"),
]

# Garissa monthly climatology (mm) - Garissa Met Station 9039000 long-term means (approx.)
GARISSA_CLIM = {10: 38.0, 11: 98.0, 12: 42.0}
SCENARIOS = {
    "normal": ("Normal OND", 1.0, "#90a4ae"),
    "above": ("KMD above-average", 1.6, "#ffb300"),
    "elnino": ("Strong El Nino (1997/2023 analogue)", 3.2, "#d32f2f"),
}

# Hydrology parameters (indicative - calibrate with WRA data)
CATCHMENT_KM2 = 7300.0          # contributing area above Masinga
MASINGA_CAP_MCM = 1560.0
BASEFLOW_M3S = 160.0            # typical early-October flow at Garissa
LAG_H = 40.0                    # Kiambere -> Garissa travel time (36-48 h)
MUSK_K_H, MUSK_X = 30.0, 0.2
RATING = (0.1185, 0.507)        # stage = a * Q^b  (fit: 300->2.1 m, 1000->4.0 m, 2600->6.5 m)
THRESHOLDS = {"alert": 4.0, "alarm": 5.0, "emergency": 6.2}
BANKFULL_M3S = 1500.0
DEFAULT_MASINGA_FILL = 90.0


def stage_from_q(q):
    """Compound rating: in-channel power law, flatter once water spreads over the floodplain."""
    a, b = RATING
    sb = a * BANKFULL_M3S ** b
    q = np.asarray(q, dtype=float)
    return np.where(q <= BANKFULL_M3S, a * np.power(q, b), sb * np.power(q / BANKFULL_M3S, 0.30))


def _rng(seed=2026):
    return np.random.default_rng(seed)


def daily_pattern(total, days=14, peak_day=6, seed=1):
    """Distribute a total over days with a realistic build-up/peak/decay + noise."""
    r = _rng(seed)
    t = np.arange(days)
    shape = np.exp(-0.5 * ((t - peak_day) / 3.2) ** 2) + 0.15
    shape *= r.gamma(2.0, 0.5, days)
    shape /= shape.sum()
    return total * shape


def ensemble(weights: dict | None = None, n=20000):
    r = _rng(7)
    w = np.array([(weights or {}).get(k, dw) for k, _, _, _, dw, _, _ in MODELS], dtype=float)
    w = w / w.sum()
    idx = r.choice(len(MODELS), size=n, p=w)
    med = np.array([m[2] for m in MODELS])[idx]
    sig = np.array([m[3] for m in MODELS])[idx]
    draws = med * np.exp(r.normal(0, 1, n) * sig)
    exceed = {str(th): round(float((draws > th).mean()) * 100, 1) for th in (100, 200, 350, 500, 700)}
    days = [(ISSUE_DATE + dt.timedelta(days=i)).isoformat() for i in range(14)]
    series = []
    cum = {m[0]: 0.0 for m in MODELS}
    pats = {m[0]: daily_pattern(m[2], seed=i + 3) for i, m in enumerate(MODELS)}
    blend = sum(w[i] * pats[m[0]] for i, m in enumerate(MODELS))
    cb = 0.0
    for d in range(14):
        row = {"date": days[d]}
        for m in MODELS:
            cum[m[0]] += pats[m[0]][d]
            row[m[0]] = round(cum[m[0]], 1)
            row[m[0] + "_daily"] = round(pats[m[0]][d], 1)
        cb += blend[d]
        row["blend"] = round(cb, 1)
        row["blend_daily"] = round(blend[d], 1)
        series.append(row)
    hist, edges = np.histogram(np.clip(draws, 0, 1000), bins=25, range=(0, 1000))
    return {
        "issued": ISSUE_DATE.isoformat(),
        "region": "Eastern highlands / Upper Tana catchment (drives River Tana floods in Garissa)",
        "models": [{"key": k, "label": l, "total_mm": t, "weight": round(float(w[i]), 3), "color": c, "character": ch}
                   for i, (k, l, t, s, dw, c, ch) in enumerate(MODELS)],
        "blend_total_mm": round(float(blend.sum()), 1),
        "median_mm": round(float(np.median(draws)), 1),
        "p90_mm": round(float(np.percentile(draws, 90)), 1),
        "p97_mm": round(float(np.percentile(draws, 97)), 1),
        "exceedance_pct": exceed,
        "series": series,
        "histogram": [{"bin": f"{int(edges[i])}-{int(edges[i+1])}", "mid": float((edges[i] + edges[i + 1]) / 2),
                       "pct": round(float(h) / n * 100, 2)} for i, h in enumerate(hist)],
        "_blend_daily": blend,
    }


def _scs_runoff_mm(p_mm, cn):
    s = 25400.0 / cn - 254.0
    ia = 0.2 * s
    return 0.0 if p_mm <= ia else (p_mm - ia) ** 2 / (p_mm - ia + s)


def hydrology(rain_daily_mm, masinga_fill_pct=DEFAULT_MASINGA_FILL, local_rain_mm=None, hours=24 * 21):
    """Route catchment rainfall through Masinga and down the Tana to Garissa (hourly)."""
    days = len(rain_daily_mm)
    storage = MASINGA_CAP_MCM * masinga_fill_pct / 100.0
    cum_p, cn_base = 0.0, 62.0
    inflow_h = np.zeros(hours)
    spill_h = np.zeros(hours)
    fill = []
    for d in range(days):
        p = float(rain_daily_mm[d])
        cum_p += p
        cn = min(88.0, cn_base + 0.08 * cum_p)          # soils wet up as the season progresses
        q_mm = _scs_runoff_mm(p, cn) + 0.04 * p          # quick + slow (interflow) response
        vol_mcm = q_mm / 1000.0 * CATCHMENT_KM2          # mm over km2 -> MCM
        # turbine release ~ 0.35 MCM/h equivalent of 100 m3/s through the cascade
        release = 8.6
        storage += vol_mcm - release
        spill = 0.0
        if storage > MASINGA_CAP_MCM:
            spill = storage - MASINGA_CAP_MCM
            storage = MASINGA_CAP_MCM
        storage = max(storage, 0.2 * MASINGA_CAP_MCM)
        fill.append(round(storage / MASINGA_CAP_MCM * 100, 1))
        for h in range(24):
            i = d * 24 + h
            if i < hours:
                inflow_h[i] = release * 1e6 / 86400.0
                spill_h[i] = spill * 1e6 / 86400.0
    # local/intervening inflow (Thiba, Mutonga, Kathita tributaries + laghas below the dams)
    local = np.zeros(hours)
    lr = rain_daily_mm if local_rain_mm is None else local_rain_mm
    for d in range(min(days, hours // 24)):
        local[d * 24:(d + 1) * 24] = 4.5 * lr[d]          # m3/s per mm/day (indicative)
    upstream = inflow_h + spill_h + local
    lag = int(LAG_H)
    lagged = np.concatenate([np.full(lag, upstream[0]), upstream[:-lag]])
    # Muskingum attenuation
    dt_h = 1.0
    k, x = MUSK_K_H, MUSK_X
    den = k - k * x + 0.5 * dt_h
    c0 = (-k * x + 0.5 * dt_h) / den
    c1 = (k * x + 0.5 * dt_h) / den
    c2 = (k - k * x - 0.5 * dt_h) / den
    out = np.zeros(hours)
    out[0] = lagged[0]
    for t in range(1, hours):
        out[t] = c0 * lagged[t] + c1 * lagged[t - 1] + c2 * out[t - 1]
    q = BASEFLOW_M3S + np.maximum(out - inflow_h[0], 0) + inflow_h[0] * 0.6
    # floodplain storage attenuates flows above bankfull (~1,500 m3/s)
    q = np.where(q > BANKFULL_M3S, BANKFULL_M3S + (q - BANKFULL_M3S) * 0.5, q)
    stage = stage_from_q(q)
    res = []
    for t in range(0, hours, 6):
        ts = dt.datetime.combine(ISSUE_DATE, dt.time(6)) + dt.timedelta(hours=t)
        res.append({"time": ts.isoformat(timespec="minutes"), "hour": t, "discharge_m3s": round(float(q[t])),
                    "stage_m": round(float(stage[t]), 2)})
    peak_i = int(np.argmax(stage))
    peak_t = dt.datetime.combine(ISSUE_DATE, dt.time(6)) + dt.timedelta(hours=peak_i)
    level = ("EMERGENCY" if stage[peak_i] >= THRESHOLDS["emergency"] else "ALARM" if stage[peak_i] >= THRESHOLDS["alarm"]
             else "ALERT" if stage[peak_i] >= THRESHOLDS["alert"] else "WATCH")
    first_alert = next((r for r in res if r["stage_m"] >= THRESHOLDS["alert"]), None)
    return {"series": res, "masinga_fill_pct": fill, "peak_stage_m": round(float(stage[peak_i]), 2),
            "peak_discharge_m3s": round(float(q[peak_i])), "peak_time": peak_t.isoformat(timespec="minutes"),
            "level": level, "first_alert_time": first_alert["time"] if first_alert else None,
            "thresholds": THRESHOLDS, "spill_days": int(sum(1 for i in range(days) if spill_h[i * 24] > 0))}


def tana_scenarios(masinga_fill_pct=DEFAULT_MASINGA_FILL):
    """Run the hydrology for every model + the weighted blend."""
    ens = ensemble()
    out = {}
    for i, m in enumerate(MODELS):
        rain = daily_pattern(m[2], seed=i + 3)
        out[m[0]] = hydrology(rain, masinga_fill_pct)
    out["blend"] = hydrology(ens["_blend_daily"], masinga_fill_pct)
    out["extreme700"] = hydrology(daily_pattern(700, seed=99), masinga_fill_pct)
    return out


def ond_outlook(n=500):
    r = _rng(42)
    start = ISSUE_DATE
    days = 92
    dates = [start + dt.timedelta(days=i) for i in range(days)]
    result = {"dates": [d.isoformat() for d in dates], "scenarios": {}}
    for key, (label, factor, color) in SCENARIOS.items():
        sims = np.zeros((n, days))
        for s in range(n):
            wet_prev = False
            for i, d in enumerate(dates):
                mean_month = GARISSA_CLIM[d.month] * factor
                # wet-day frequency rises with scenario intensity
                p_wet = min(0.85, (0.16 if d.month != 11 else 0.26) * (factor ** 0.55))
                p = p_wet * (1.35 if wet_prev else 0.85)
                wet = r.random() < min(p, 0.95)
                if wet:
                    mean_wet = mean_month / (30 * p_wet)
                    sims[s, i] = r.gamma(0.75, mean_wet / 0.75)
                wet_prev = wet
        cum = np.cumsum(sims, axis=1)
        result["scenarios"][key] = {
            "label": label, "factor": factor, "color": color,
            "p10": np.round(np.percentile(cum, 10, axis=0), 1).tolist(),
            "p50": np.round(np.percentile(cum, 50, axis=0), 1).tolist(),
            "p90": np.round(np.percentile(cum, 90, axis=0), 1).tolist(),
            "daily_mean": np.round(sims.mean(axis=0), 2).tolist(),
            "total_median": round(float(np.median(cum[:, -1])), 0),
            "monthly_median": {m: round(float(np.median(sims[:, [i for i, d in enumerate(dates) if d.month == m]].sum(axis=1))), 0)
                               for m in (10, 11, 12)},
            "prob_gt_300": round(float((cum[:, -1] > 300).mean() * 100), 1),
        }
    result["climatology_total"] = sum(GARISSA_CLIM.values())
    return result


def subcounty_impacts():
    """Qualitative 3-month impact outlook per sub-county (rule-based on exposure data)."""
    return [
        {"name": "Garissa Township", "riverine": "Very High", "flash": "Very High", "health": "High",
         "notes": "Tana overbank at Bour-Algi, Korakora, Medina & Ziwani; lagha flash floods through Iftin, Bulla Iftin; 19,000 people were exposed in Nov 2023."},
        {"name": "Balambala", "riverine": "Very High", "flash": "Moderate", "health": "High",
         "notes": "Mbalambala, Saka and Sankuri farms first to flood (18-34 h after Kiambere release); Sankuri meander neck is the sharpest on the Garissa reach."},
        {"name": "Dadaab", "riverine": "Low", "flash": "Very High", "health": "Very High",
         "notes": "Ponding in Hagadera, Ifo, Dagahaley blocks (11,063 ha flooded Nov 2023, 27,655 people exposed); latrine collapse -> cholera risk."},
        {"name": "Fafi", "riverine": "Moderate", "flash": "High", "health": "High",
         "notes": "Water pans overflow and roads cut (Garissa-Bura-Hagadera); RVF risk in flooded depressions."},
        {"name": "Ijara", "riverine": "High", "flash": "High", "health": "High",
         "notes": "Masalani/Ijara lowlands and Tana floodplain near Kotile; Boni-forest fringe malaria; road access lost to Hulugho."},
        {"name": "Lagdera", "riverine": "Low", "flash": "High", "health": "High",
         "notes": "Lagh Dera flash floods around Modogashe & Shantabaq; RVF hotspot in livestock (1997/98, 2006/07)."},
    ]


def full_report(masinga_fill_pct=DEFAULT_MASINGA_FILL):
    ens = ensemble()
    ens.pop("_blend_daily", None)
    return {"ensemble": ens, "tana": tana_scenarios(masinga_fill_pct), "ond": ond_outlook(),
            "impacts": subcounty_impacts(),
            "disclaimer": "Decision-support scenarios generated by the CSG portal's Python models from stated model guidance "
                          "and KMD outlooks. Always confirm with official KMD, WRA and NDMA advisories."}


if __name__ == "__main__":
    import json
    r = full_report()
    print(json.dumps({k: r["tana"][k]["peak_stage_m"] for k in r["tana"]}, indent=1))
    print(r["ensemble"]["exceedance_pct"], r["ensemble"]["blend_total_mm"])
    print({k: v["total_median"] for k, v in r["ond"]["scenarios"].items()})
