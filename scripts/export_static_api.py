"""Export static JSON snapshots of the Python models so the portal also works as a pure static site
(GitHub Pages, Google Drive preview, artifact hosting). Run after any model change:
    python scripts/export_static_api.py
"""
import json, sys, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app import forecast, health_model, agent  # noqa: E402

OUT = ROOT / "frontend" / "public" / "data" / "api"
OUT.mkdir(parents=True, exist_ok=True)


def w(name, obj):
    (OUT / name).write_text(json.dumps(obj, separators=(",", ":"), default=str))
    print(f"  {name:28s} {(OUT / name).stat().st_size / 1024:7.1f} KB")


print("Exporting static API snapshots ->", OUT)
w("forecast.json", forecast.full_report())
for s in ("elnino", "above", "normal"):
    w(f"health_{s}.json", health_model.disease_risk(s))
for fill in range(70, 101, 5):
    w(f"tana_fill_{fill}.json", forecast.tana_scenarios(float(fill)))
try:
    w("bulletin_en.json", agent.bulletin("en"))
except Exception as e:  # bulletin may need Gemini; offline template is used otherwise
    print("  bulletin skipped:", e)
w("health.json", {"status": "static", "time": dt.datetime.now().isoformat(timespec="seconds"), "gemini": False})
print("done")
