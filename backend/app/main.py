"""Garissa CSG Smart Early-Warning Portal - FastAPI backend.

Run:  uvicorn app.main:app --port 8080   (from the backend/ folder)   or   ./start_portal.command
Serves the built React portal (frontend/dist) and the API under /api.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import smtplib
import sqlite3
import threading
import time
from email.message import EmailMessage
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except Exception:
    pass

from . import agent, forecast, health_model, knowledge, weather  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("csg")

app = FastAPI(title="Garissa CSG Smart Early-Warning Portal API", version="2.0.0",
              description="Directorate of ICT & GIS, County Government of Garissa")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DB = ROOT / "backend" / "data" / "csg_portal.db"
DB.parent.mkdir(parents=True, exist_ok=True)
EMERGENCY_EMAIL = os.getenv("EMERGENCY_EMAIL", "emergency@garissa.go.ke")


def db():
    c = sqlite3.connect(DB)
    c.execute("""create table if not exists feedback(id integer primary key autoincrement, created text, kind text, name text,
                 phone text, email text, location text, lat real, lon real, subcounty text, urgency text, message text,
                 lang text, emailed integer)""")
    c.execute("create table if not exists updates(id integer primary key autoincrement, created text, source text, status text)")
    return c


# ------------------------------------------------------------------------------------------ models
class ChatIn(BaseModel):
    messages: list[dict]
    lang: str = "en"


class TranslateIn(BaseModel):
    text: str
    target: str = Field("sw", pattern="^(en|sw|so)$")


class FeedbackIn(BaseModel):
    kind: str = "Emergency report"
    name: str = ""
    phone: str = ""
    email: str = ""
    location: str = ""
    lat: float | None = None
    lon: float | None = None
    subcounty: str = ""
    urgency: str = "High"
    message: str
    lang: str = "en"


# ------------------------------------------------------------------------------------------ API
@app.get("/api/health")
def health():
    return {"status": "ok", "time": dt.datetime.now().isoformat(timespec="seconds"),
            "gemini": bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")),
            "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.5-pro"),
            "openweather": bool(os.getenv("OPENWEATHER_API_KEY")),
            "smtp": bool(os.getenv("SMTP_HOST"))}


@app.get("/api/forecast")
def api_forecast(masinga_fill_pct: float = forecast.DEFAULT_MASINGA_FILL):
    return forecast.full_report(max(20.0, min(100.0, masinga_fill_pct)))


@app.get("/api/forecast/tana")
def api_tana(masinga_fill_pct: float = forecast.DEFAULT_MASINGA_FILL, total_mm: float | None = None):
    if total_mm is not None:
        return forecast.hydrology(forecast.daily_pattern(total_mm, seed=5), masinga_fill_pct)
    return forecast.tana_scenarios(masinga_fill_pct)


@app.get("/api/health-risk")
def api_health_risk(scenario: str = "elnino"):
    if scenario not in ("normal", "above", "elnino"):
        raise HTTPException(400, "scenario must be normal|above|elnino")
    return health_model.disease_risk(scenario)


@app.get("/api/weather")
def api_weather():
    return weather.summary()


@app.get("/api/weather/{point}")
def api_weather_point(point: str):
    if point not in weather.POINTS:
        raise HTTPException(404, "unknown point")
    return weather.open_meteo_point(point)


@app.post("/api/chat")
def api_chat(body: ChatIn):
    return agent.chat(body.messages, body.lang)


@app.post("/api/translate")
def api_translate(body: TranslateIn):
    return agent.translate(body.text, body.target)


@app.get("/api/bulletin")
def api_bulletin(lang: str = "en"):
    return agent.bulletin(lang)


@app.get("/api/knowledge")
def api_knowledge():
    return knowledge.KNOWLEDGE


def _send_email(fb: FeedbackIn, fid: int) -> bool:
    host = os.getenv("SMTP_HOST")
    if not host:
        return False
    msg = EmailMessage()
    msg["Subject"] = f"[CSG Portal #{fid}] {fb.urgency.upper()} - {fb.kind} - {fb.location or fb.subcounty}"
    msg["From"] = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "csg-portal@garissa.go.ke"))
    msg["To"] = EMERGENCY_EMAIL
    if fb.email:
        msg["Reply-To"] = fb.email
    body = "\n".join(f"{k}: {v}" for k, v in fb.model_dump().items())
    if fb.lat and fb.lon:
        body += f"\nMap: https://www.google.com/maps?q={fb.lat},{fb.lon}"
    msg.set_content(body)
    try:
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=20) as s:
            s.starttls()
            if os.getenv("SMTP_USER"):
                s.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD", ""))
            s.send_message(msg)
        return True
    except Exception as e:
        log.warning("SMTP failed: %s", e)
        return False


@app.post("/api/feedback")
def api_feedback(fb: FeedbackIn):
    c = db()
    cur = c.execute("insert into feedback(created,kind,name,phone,email,location,lat,lon,subcounty,urgency,message,lang,emailed) "
                    "values(?,?,?,?,?,?,?,?,?,?,?,?,0)",
                    (dt.datetime.now().isoformat(timespec="seconds"), fb.kind, fb.name, fb.phone, fb.email, fb.location,
                     fb.lat, fb.lon, fb.subcounty, fb.urgency, fb.message, fb.lang))
    fid = cur.lastrowid
    c.commit()
    sent = _send_email(fb, fid)
    if sent:
        c.execute("update feedback set emailed=1 where id=?", (fid,))
        c.commit()
    return {"id": fid, "stored": True, "emailed": sent, "to": EMERGENCY_EMAIL,
            "message": "Report received and emailed to the CSG emergency desk." if sent else
            "Report saved on the CSG server. Email relay not configured - please also send via your mail app."}


@app.get("/api/feedback")
def api_feedback_list(request: Request):
    token = os.getenv("ADMIN_TOKEN")
    if not token or request.headers.get("x-admin-token") != token:
        raise HTTPException(403, "Admin token required (set ADMIN_TOKEN in .env and send x-admin-token header)")
    c = db()
    rows = c.execute("select * from feedback order by id desc limit 500").fetchall()
    cols = [d[0] for d in c.execute("select * from feedback limit 0").description]
    return [dict(zip(cols, r)) for r in rows]


@app.get("/api/updates")
def api_updates():
    c = db()
    rows = c.execute("select created,source,status from updates order by id desc limit 20").fetchall()
    return [{"time": r[0], "source": r[1], "status": r[2]} for r in rows]


# ------------------------------------------------------------------------------------------ auto-update
def _auto_update_loop():
    """Refresh live feeds every 3 hours so the portal always shows the latest information."""
    while True:
        try:
            weather.CACHE.clear()
            weather.summary()
            status = "ok"
        except Exception as e:
            status = f"error: {e}"
        try:
            c = db()
            c.execute("insert into updates(created,source,status) values(?,?,?)",
                      (dt.datetime.now().isoformat(timespec="seconds"), "Open-Meteo / OpenWeather", status))
            c.commit()
        except Exception:
            pass
        time.sleep(3 * 3600)


@app.on_event("startup")
def _startup():
    if os.getenv("DISABLE_AUTO_UPDATE") != "1":
        threading.Thread(target=_auto_update_loop, daemon=True).start()
    log.info("Gemini enabled: %s | model: %s", bool(os.getenv("GEMINI_API_KEY")), os.getenv("GEMINI_MODEL", "gemini-2.5-pro"))


# ------------------------------------------------------------------------------------------ static frontend
DIST = ROOT / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")
    for sub in ("data", "img"):
        if (DIST / sub).exists():
            app.mount(f"/{sub}", StaticFiles(directory=DIST / sub), name=sub)

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        f = DIST / full_path
        if full_path and f.is_file():
            return FileResponse(f)
        return FileResponse(DIST / "index.html")
else:
    @app.get("/")
    def root():
        return JSONResponse({"message": "Frontend not built yet. Run: cd frontend && npm install && npm run build"})
