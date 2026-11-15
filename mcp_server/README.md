# Garissa CSG MCP server

Gives any MCP-capable assistant (Claude Desktop, Claude Code, Gemini CLI, Cursor …) live access to the
Garissa County Steering Group flood situation – and lets the CSG secretariat update the portal by chatting.

## Install (once)

```bash
cd Garissa-County-Steering-Group-Portal
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install mcp httpx numpy shapely pillow
```

## Connect it

**Claude Desktop** – Settings → Developer → *Edit Config*, add (use your own folder path):

```json
{
  "mcpServers": {
    "garissa-csg": {
      "command": "/Users/james/garissa_local_workdir/Garissa-County-Steering-Group-Portal/.venv/bin/python",
      "args": ["/Users/james/garissa_local_workdir/Garissa-County-Steering-Group-Portal/mcp_server/csg_mcp_server.py"]
    }
  }
}
```

**Claude Code** – `claude mcp add garissa-csg -- python mcp_server/csg_mcp_server.py`

**Gemini CLI** – add the same `command`/`args` under `mcpServers` in `~/.gemini/settings.json`.

**Remote (county server)** – `python mcp_server/csg_mcp_server.py --http --port 8765` then point clients at
`http://<server>:8765/mcp`. Put it behind HTTPS and an access token before exposing it to the internet.

## Tools

| Tool | What it does |
|---|---|
| `get_situation` | Alert level, headline (EN/SW/SO), actions, rain, River Tana, satellite (`refresh=true` re-fetches) |
| `get_tana_flow` | GloFAS flow at Garissa, trend, indicative gauge now, forecast peak, daily table |
| `get_rainfall` | Observed (21 days) and forecast (10 days) rain for Garissa, Dadaab, Hulugho, Masalani, Bura, Modogashe, Embu, Meru, Nyeri, Masinga, Nanyuki |
| `check_location` | Risk at a lat/lon: past flood extents, gauge level that floods it, distance to Tana/laghas, nearest schools/clinics |
| `assets_at_risk` | Schools, clinics, boreholes, buildings, farm area flooded at a gauge level |
| `list_events` / `log_event` | Read / add agency updates and field reports (shown in the portal's event log) |
| `log_gauge_reading` | Record an official WRA reading at Garissa (RGS 4G01); overrides the model on the portal |
| `community_message` | Ready WhatsApp/radio alert in English, Kiswahili or Somali |
| `refresh_live_data` | Re-fetch everything and rewrite `situation.json` |

## Example requests

- “What is the flood situation in Garissa right now? Give me the Kiswahili message for chiefs.”
- “Log the WRA reading at Garissa: 3.9 m at 08:00 today, observer Hassan Abdi.”
- “Add an event: Kenya Red Cross evacuated 120 households at Bour-Algi today, source KRCS Garissa branch.”
- “Is the school at -0.452, 39.66 at risk if the Tana reaches 5 m?”

After logging events or gauge readings, commit `frontend/public/data/live/*.json` and `docs/data/live/*.json`
(or let the GitHub Action pick them up) so the public site shows them.
