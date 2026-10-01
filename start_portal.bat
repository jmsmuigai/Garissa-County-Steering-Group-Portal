@echo off
REM Garissa CSG portal - Windows start
cd /d %~dp0
if not exist .env copy .env.example .env
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
pip install -q -r requirements.txt
if not exist frontend\dist\index.html (cd frontend && npm install && npm run build && cd ..)
start http://localhost:8080
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
