// Live situation for the browser: loads the CSG situation.json (server or static snapshot), then
// re-checks the same open sources directly (Open-Meteo rain, GloFAS River Tana flow) so the page is
// current even between the 3-hourly automatic updates. Mirrors backend/app/live.py.
import { backendAvailable, DATA } from './api'
import { levelFor } from './store'

export const RIVER_CELL = { lat: -0.475, lon: 39.575 }
export const GLOFAS_BIAS = 6.4
const RATING = { a: 0.1185, b: 0.507, bankfull: 1500 }

export function stageFromQ(qGlofas: number | null | undefined): number | null {
  if (qGlofas === null || qGlofas === undefined || Number.isNaN(qGlofas)) return null
  const q = qGlofas * GLOFAS_BIAS
  const sb = RATING.a * RATING.bankfull ** RATING.b
  const s = q <= RATING.bankfull ? RATING.a * q ** RATING.b : sb * (q / RATING.bankfull) ** 0.3
  return Math.round(s * 100) / 100
}

export const PLACES: Record<string, { name: string; lat: number; lon: number; zone: string }> = {
  garissa: { name: 'Garissa Town', lat: -0.4532, lon: 39.6461, zone: 'Garissa' },
  dadaab: { name: 'Dadaab', lat: 0.0573, lon: 40.3092, zone: 'Somalia border' },
  hulugho: { name: 'Hulugho', lat: -1.0833, lon: 41.0167, zone: 'Somalia border' },
  masalani: { name: 'Masalani (Ijara)', lat: -1.6963, lon: 40.1653, zone: 'Lower Tana' },
  bura: { name: 'Bura', lat: -1.1, lon: 39.95, zone: 'Lower Tana' },
  modogashe: { name: 'Modogashe', lat: 0.744, lon: 39.1844, zone: 'Lagh Dera' },
  embu: { name: 'Embu', lat: -0.5388, lon: 37.4596, zone: 'Seven Forks catchment' },
  meru: { name: 'Meru', lat: 0.0463, lon: 37.6559, zone: 'Seven Forks catchment' },
  nyeri: { name: 'Nyeri', lat: -0.4201, lon: 36.9476, zone: 'Seven Forks catchment' },
  masinga: { name: 'Masinga Dam', lat: -0.8869, lon: 37.5977, zone: 'Seven Forks catchment' },
  nanyuki: { name: 'Nanyuki', lat: 0.0167, lon: 37.0667, zone: "Ewaso Ng'iro" },
}

export type Situation = any

export async function loadSituation(): Promise<{ s: Situation; from: string }> {
  try {
    if (await backendAvailable()) {
      const r = await fetch('./api/live/situation')
      if (r.ok) { const s = await r.json(); if (s?.level) return { s, from: 'CSG server' } }
    }
  } catch { /* fall back */ }
  const r = await fetch(DATA('live/situation.json'), { cache: 'no-cache' })
  return { s: await r.json(), from: 'automatic update' }
}

const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10) // EAT

/** Fresh rain + river straight from the open sources; returns null pieces on failure (never throws). */
export async function liveCheck(): Promise<{ rain: any | null; river: any | null; checked: string; errors: string[] }> {
  const errors: string[] = []
  const keys = Object.keys(PLACES)
  const lat = keys.map((k) => PLACES[k].lat).join(','), lon = keys.map((k) => PLACES[k].lon).join(',')
  const t = today()
  let rain: any = null, river: any = null
  await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&past_days=21&forecast_days=10&timezone=Africa%2FNairobi`, { signal: AbortSignal.timeout(15000) })
      .then((r) => r.json()).then((j) => {
        const arr = Array.isArray(j) ? j : [j]
        const dates: string[] = arr[0].daily.time
        const series: Record<string, number[]> = {}
        keys.forEach((k, i) => { series[k] = arr[i].daily.precipitation_sum.map((v: number | null) => (v === null ? 0 : Math.round(v * 10) / 10)) })
        rain = { dates, series, today_index: Math.max(0, dates.indexOf(t)) }
      }).catch(() => errors.push('Open-Meteo rain')),
    fetch(`https://flood-api.open-meteo.com/v1/flood?latitude=${RIVER_CELL.lat}&longitude=${RIVER_CELL.lon}&daily=river_discharge,river_discharge_p75,river_discharge_max&past_days=60&forecast_days=30`, { signal: AbortSignal.timeout(15000) })
      .then((r) => r.json()).then((j) => {
        const d = j.daily
        river = d.time.map((date: string, i: number) => ({ date, q: d.river_discharge[i], p75: d.river_discharge_p75?.[i], max: d.river_discharge_max?.[i], stage: stageFromQ(d.river_discharge[i]), stage_wet: stageFromQ(d.river_discharge_max?.[i]), forecast: date > t }))
      }).catch(() => errors.push('GloFAS river flow')),
  ])
  return { rain, river, checked: new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }), errors }
}

/** Recompute the river summary from a series (same rules as the server). */
export function riverSummary(series: any[]) {
  const t = today()
  let ri = 0
  series.forEach((x: any, i: number) => { if (x.date <= t) ri = i })
  const now = series[ri], wk = series[Math.max(0, ri - 7)]
  const base = series.slice(0, 10).reduce((a: number, x: any) => a + (x.q || 0), 0) / Math.min(10, series.length)
  const fut = series.slice(ri)
  const pm = fut.reduce((a: any, x: any) => ((x.q || 0) > (a.q || 0) ? x : a), fut[0])
  const pw = fut.reduce((a: any, x: any) => ((x.max || 0) > (a.max || 0) ? x : a), fut[0])
  const firstAlert = fut.find((x: any) => (x.stage || 0) >= 4)?.date || null
  const firstAlertWet = fut.find((x: any) => (x.stage_wet || 0) >= 4)?.date || null
  return {
    q_now: now.q, q_7days_ago: wk.q, ratio_to_baseline: base ? Math.round((now.q / base) * 10) / 10 : null,
    trend: now.q > wk.q * 1.08 ? 'rising' : now.q < wk.q * 0.92 ? 'falling' : 'steady',
    pct_change_7d: wk.q ? Math.round((100 * (now.q - wk.q)) / wk.q) : null,
    indicative_stage_now: now.stage, indicative_level_now: levelFor(now.stage || 0),
    peak_median: { date: pm.date, q: pm.q, stage: pm.stage, level: levelFor(pm.stage || 0) },
    peak_wettest: { date: pw.date, q: pw.max, stage: pw.stage_wet, level: levelFor(pw.stage_wet || 0) },
    first_alert_median: firstAlert, first_alert_wettest: firstAlertWet,
  }
}

export function rainSummary(rain: { dates: string[]; series: Record<string, number[]>; today_index: number }, key: string) {
  const s = rain.series[key] || [], ti = rain.today_index
  const sum = (a: number, b: number) => Math.round(s.slice(Math.max(0, a), b).reduce((x, y) => x + (y || 0), 0) * 10) / 10
  let maxV = 0, maxD = ''
  s.slice(0, ti).forEach((v, i) => { if (v > maxV) { maxV = v; maxD = rain.dates[i] } })
  return { last24: s[ti - 1] ?? null, last72: sum(ti - 3, ti), last7d: sum(ti - 7, ti), last21d: sum(0, ti), next3d: sum(ti, ti + 3), next10d: sum(ti, ti + 10), max_day: [maxV, maxD] }
}

// NASA GIBS imagery for a date (WMTS, Web Mercator)
export const GIBS = (layer: string, date: string, ext: 'jpg' | 'png', level = 9) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`

export const SAT_LAYERS: { id: string; label: string; ext: 'jpg' | 'png'; level: number; overlay?: boolean; note: string }[] = [
  { id: 'MODIS_Terra_CorrectedReflectance_Bands721', label: 'MODIS flood false-colour (7-2-1)', ext: 'jpg', level: 9, note: 'Water shows dark blue to black, wet soil dark, vegetation green, clouds cyan.' },
  { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', label: 'MODIS true colour (Terra)', ext: 'jpg', level: 9, note: 'What a camera would see – brown floodwater, white cloud.' },
  { id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor', label: 'VIIRS true colour (NOAA-20)', ext: 'jpg', level: 9, note: 'Afternoon pass; often catches gaps in the morning cloud.' },
  { id: 'MODIS_Aqua_CorrectedReflectance_Bands721', label: 'MODIS flood false-colour (Aqua)', ext: 'jpg', level: 9, note: 'Afternoon pass of the 7-2-1 composite.' },
]
