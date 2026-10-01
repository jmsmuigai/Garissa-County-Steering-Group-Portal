// API client with graceful fallbacks:
//   1. live Python backend (/api/...)
//   2. static snapshots shipped in /data/api (so the portal also works as a static site)
//   3. direct browser calls to Open-Meteo for live weather
export const DATA = (name: string) => `./data/${name}`

const STATIC: Record<string, string> = {
  '/api/forecast': 'api/forecast.json',
  '/api/health-risk?scenario=elnino': 'api/health_elnino.json',
  '/api/health-risk?scenario=above': 'api/health_above.json',
  '/api/health-risk?scenario=normal': 'api/health_normal.json',
  '/api/bulletin?lang=en': 'api/bulletin_en.json',
  '/api/health': 'api/health.json',
}

let backendUp: boolean | null = null

export async function backendAvailable(): Promise<boolean> {
  if (backendUp !== null) return backendUp
  try {
    const r = await fetch('./api/health', { signal: AbortSignal.timeout(2500) })
    backendUp = r.ok && (r.headers.get('content-type') || '').includes('json')
  } catch {
    backendUp = false
  }
  return backendUp
}

export async function getJSON<T = any>(path: string): Promise<T> {
  if (await backendAvailable()) {
    try {
      const r = await fetch('.' + path)
      if (r.ok) return r.json()
    } catch { /* fall through */ }
  }
  const s = STATIC[path]
  if (s) {
    const r = await fetch(DATA(s))
    if (r.ok) return r.json()
  }
  throw new Error(`Unavailable: ${path}`)
}

export async function postJSON<T = any>(path: string, body: unknown): Promise<T> {
  const r = await fetch('.' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

const geoCache: Record<string, Promise<any>> = {}
export function geo(name: string) {
  if (!geoCache[name]) geoCache[name] = fetch(DATA(name)).then((r) => r.json())
  return geoCache[name]
}

// ---------------------------------------------------------------- live weather
export type DailyWx = { date: string; rain_mm: number; rain_prob?: number; tmax: number; tmin: number; code?: number }
export async function weatherFor(lat: number, lon: number, key: string): Promise<{ current?: any; daily: DailyWx[]; source: string }> {
  if (await backendAvailable()) {
    try {
      const r = await fetch(`./api/weather/${key}`)
      if (r.ok) return r.json()
    } catch { /* noop */ }
  }
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=Africa%2FNairobi&forecast_days=16&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,weather_code&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code,cloud_cover`
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) })
  const j = await r.json()
  const d = j.daily
  return {
    current: j.current,
    source: 'Open-Meteo (live)',
    daily: d.time.map((t: string, i: number) => ({ date: t, rain_mm: d.precipitation_sum[i], rain_prob: d.precipitation_probability_max[i], tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i], code: d.weather_code[i] })),
  }
}

const OM_MODELS: [string, string][] = [
  ['ecmwf_ifs025', 'ECMWF IFS (European)'],
  ['ecmwf_aifs025_single', 'ECMWF AIFS (AI-European)'],
  ['gfs_seamless', 'NOAA GFS (American)'],
  ['icon_seamless', 'DWD ICON (German)'],
  ['ukmo_seamless', 'UK Met Office'],
]
export async function liveModels(lat = -0.53, lon = 37.45): Promise<{ dates: string[]; models: { model: string; label: string; cum: number[]; total: number }[] }> {
  const out: any[] = []
  let dates: string[] = []
  await Promise.all(
    OM_MODELS.map(async ([m, label]) => {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=Africa%2FNairobi&forecast_days=14&daily=precipitation_sum&models=${m}`, { signal: AbortSignal.timeout(8000) })
        if (!r.ok) return
        const j = await r.json()
        const vals: number[] = (j.daily?.precipitation_sum || []).filter((v: any) => v !== null)
        if (!vals.length) return
        dates = dates.length ? dates : j.daily.time.slice(0, vals.length)
        let c = 0
        const cum = vals.map((v) => +(c += v).toFixed(1))
        out.push({ model: m, label, cum, total: +c.toFixed(1) })
      } catch { /* model unavailable */ }
    }),
  )
  out.sort((a, b) => OM_MODELS.findIndex((x) => x[0] === a.model) - OM_MODELS.findIndex((x) => x[0] === b.model))
  return { dates, models: out }
}

export const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 80: 'Showers', 81: 'Heavy showers', 82: 'Violent showers', 95: 'Thunderstorm', 96: 'Thunderstorm & hail', 99: 'Severe thunderstorm',
}
