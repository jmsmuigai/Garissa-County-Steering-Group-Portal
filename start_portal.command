#!/bin/bash
# Garissa CSG portal - one-click start (macOS: double-click; Linux: bash start_portal.command)
cd "$(dirname "$0")"
set -e
echo "== Garissa County Steering Group portal =="
[ -f .env ] || { cp .env.example .env; echo "Created .env - add your GEMINI_API_KEY to enable the AI assistant."; }
if [ ! -d .venv ]; then python3 -m venv .venv; fi
source .venv/bin/activate
pip install -q -r requirements.txt
if [ ! -f frontend/dist/index.html ]; then
  if command -v npm >/dev/null; then (cd frontend && npm install && npm run build); else echo "Node.js not found - install from https://nodejs.org to build the site."; exit 1; fi
fi
python scripts/export_static_api.py >/dev/null || true
PORT=${PORT:-8080}
( sleep 3; open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null ) &
cd backend && exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
