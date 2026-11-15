import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import type { Map as LMap } from 'leaflet'
import { ResponsiveContainer, ComposedChart, Line, Bar, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine, ReferenceArea, Scatter } from 'recharts'
import { Siren, Waves, CloudRain, Satellite, RefreshCw, CheckCircle2, XCircle, Clock, Copy, Check, ExternalLink, Radio, Bot, Mountain, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Section, Pill } from '../components/ui'
import StaffGauge from '../components/StaffGauge'
import { geo } from '../lib/api'
import { LEVEL_COLORS, levelFor, useApp } from '../lib/store'
import { loadSituation, liveCheck, riverSummary, rainSummary, PLACES, GIBS, SAT_LAYERS } from '../lib/live'

const fmt = (iso: string, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-GB', o) : '')
const KIND: Record<string, [string, string]> = {
  event: ['Event', '#c81d25'], warning: ['Warning', '#e4572e'], forecast: ['Forecast', '#0e7c86'], analysis: ['Analysis', '#6a1b9a'],
  csg: ['CSG', '#142338'], report: ['Field report', '#3e7d3a'], response: ['Response', '#1565c0'],
}
const RES: Record<string, [string, string]> = { right: ['Right', '#2e9e4f'], 'on track': ['On track', '#0e7c86'], missed: ['Missed', '#c81d25'], partly: ['Partly', '#f28c28'] }
const CATCH = ['embu', 'meru', 'nyeri', 'masinga']
const yesterday = () => new Date(Date.now() + 3 * 3600e3 - 86400e3).toISOString().slice(0, 10)

export default function Situation() {
  const { lang } = useApp()
  const [s, setS] = useState<any>(null)
  const [from, setFrom] = useState('')
  const [live, setLive] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [axis, setAxis] = useState<'stage' | 'flow'>('stage')
  const [copied, setCopied] = useState(false)

  const refresh = async () => {
    setBusy(true)
    try { const r = await loadSituation(); setS(r.s); setFrom(r.from) } catch { /* keep */ }
    setLive(await liveCheck())
    setBusy(false)
  }
  useEffect(() => { refresh(); const t = setInterval(refresh, 10 * 60e3); return () => clearInterval(t) }, [])

  // merge: live data wins when available
  const riverSeries = live?.river || s?.river?.series || []
  const river = useMemo(() => (live?.river ? riverSummary(live.river) : s?.river), [live, s])
  const rain = live?.rain || (s ? { dates: s.rain.dates, series: s.rain.series, today_index: s.rain.today_index } : null)
  const places = useMemo(() => (rain ? Object.fromEntries(Object.keys(PLACES).map((k) => [k, rainSummary(rain, k)])) : {}), [rain])
  const official = s?.gauge_readings?.slice(-1)[0]
  const g: any = (places as any).garissa
  const flash = g ? ((g.last24 || 0) >= 40 || g.last72 >= 60 ? 'Flash floods likely' : (g.last24 || 0) >= 15 || g.last72 >= 30 ? 'Laghas flowing' : g.last72 >= 10 ? 'Local ponding' : 'Dry') : ''
  const riverLevel = official ? official.level : river ? levelFor(Math.max(river.indicative_stage_now || 0, river.peak_median?.stage || 0)) : 'WATCH'
  const LV = ['NORMAL', 'WATCH', 'ALERT', 'ALARM', 'EMERGENCY']
  const level = LV[Math.max(LV.indexOf(riverLevel), flash === 'Flash floods likely' || flash === 'Laghas flowing' ? 2 : flash === 'Local ponding' ? 1 : 0)]
  const color = LEVEL_COLORS[level]

  const headline = useMemo(() => {
    if (!g || !river) return s?.headline?.[lang] || ''
    const d = { en: `${level}: ${g.last72.toFixed(0)} mm fell on Garissa in the last 3 days (${g.max_day[0].toFixed(0)} mm on ${fmt(g.max_day[1])}). The River Tana is ${river.trend} – flow is ${river.ratio_to_baseline}× early October. Indicative Garissa gauge ~${river.indicative_stage_now} m now, ~${river.peak_median.stage} m by ${fmt(river.peak_median.date)} (wettest run ${river.peak_wettest.stage} m).`,
      sw: `${level}: Mvua ya mm ${g.last72.toFixed(0)} imenyesha Garissa siku 3 zilizopita. Mto Tana ${river.trend === 'rising' ? 'unazidi kupanda' : 'umetulia'} – kipimo cha Garissa kinakadiriwa mita ${river.indicative_stage_now} sasa na mita ${river.peak_median.stage} kufikia ${fmt(river.peak_median.date)}.`,
      so: `${level}: ${g.last72.toFixed(0)} mm roob ah ayaa ka da'ay Garissa 3dii maalmood ee la soo dhaafay. Webiga Tana ${river.trend === 'rising' ? 'wuu sii kacayaa' : 'wuu degan yahay'} – cabbirka Garissa qiyaastii ${river.indicative_stage_now} m hadda, ${river.peak_median.stage} m ilaa ${fmt(river.peak_median.date)}.` }
    return d[lang]
  }, [g, river, level, lang, s])

  const riverChart = useMemo(() => riverSeries.filter((_: any, i: number) => i >= riverSeries.length - 75).map((x: any) => ({
    d: fmt(x.date), date: x.date, obs: !x.forecast ? (axis === 'stage' ? x.stage : x.q) : null,
    fc: x.forecast ? (axis === 'stage' ? x.stage : x.q) : null,
    wet: x.forecast ? (axis === 'stage' ? x.stage_wet : x.max) : null,
    gauge: axis === 'stage' ? (s?.gauge_readings || []).find((r: any) => r.time.slice(0, 10) === x.date)?.stage_m ?? null : null,
  })), [riverSeries, axis, s])
  const todayLabel = fmt(new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10))

  const rainChart = useMemo(() => {
    if (!rain) return []
    return rain.dates.map((d: string, i: number) => ({
      d: fmt(d), garissa: rain.series.garissa[i], dadaab: rain.series.dadaab[i], bura: rain.series.bura[i],
      catchment: Math.round((CATCH.reduce((a, k) => a + (rain.series[k][i] || 0), 0) / CATCH.length) * 10) / 10, fc: i >= rain.today_index,
    }))
  }, [rain])

  const msg = `*Garissa County Steering Group – ${level}* (${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })})\n${headline}\n${(s?.actions || []).map((a: string) => `• ${a}`).join('\n')}\nLive: https://jmsmuigai.github.io/Garissa-County-Steering-Group-Portal/#/situation`
  const copy = async () => { try { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { /* blocked */ } }

  const health: [string, boolean | null, string][] = [
    ['Open-Meteo rainfall (live)', live ? !live.errors.includes('Open-Meteo rain') : null, live?.checked || ''],
    ['GloFAS River Tana flow (live)', live ? !live.errors.includes('GloFAS river flow') : null, live?.checked || ''],
    ['CSG situation file', s ? true : null, s ? `${from}, issued ${(s.issued || '').slice(0, 16).replace('T', ' ')} EAT` : ''],
    ['NASA satellite flood product', s ? !!s.satellite?.latest : null, s?.satellite?.latest ? `latest ${s.satellite.latest.date}` : ''],
    ['Official gauge readings (WRA 4G01)', s ? (s.gauge_readings?.length ? true : false) : null, s?.gauge_readings?.length ? `latest ${official?.time?.replace('T', ' ')}` : 'none logged yet – model estimate shown'],
  ]

  return (
    <>
      {/* ---------------------------------------------------------- status banner */}
      <section className="text-white" style={{ background: `linear-gradient(110deg, ${color} 0%, #7a2614 55%, #142338 100%)` }}>
        <div className="mx-auto max-w-[1500px] px-5 py-8">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 font-semibold"><Radio size={14} className="animate-pulse" /> Flood Situation Room · live</span>
            <span className="rounded-full bg-black/20 px-3 py-1">{live ? `Checked ${live.checked}` : 'Loading live data…'} · refreshes every 10 min</span>
            <button onClick={refresh} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 font-semibold hover:bg-white/30"><RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Refresh</button>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <h1 className="m-0 text-4xl font-extrabold leading-none md:text-6xl">{level}</h1>
            <span className="pb-1 text-lg font-semibold text-white/90">Garissa floods · River Tana {river?.trend || 'rising'}</span>
          </div>
          <p className="mt-3 max-w-4xl text-[17px] leading-relaxed text-white/95">{headline || 'Loading the latest situation…'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 font-semibold text-night">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy WhatsApp alert'}</button>
            <Link to="/report" className="rounded-lg bg-white/15 px-4 py-2 font-semibold hover:bg-white/25">Report flooding</Link>
            <a href="tel:1199" className="rounded-lg bg-white/15 px-4 py-2 font-semibold hover:bg-white/25">Kenya Red Cross 1199</a>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- key numbers */}
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile icon={<CloudRain />} c="#0e7c86" v={g ? `${g.last72.toFixed(0)} mm` : '…'} l="Rain on Garissa, last 3 days" n={g ? `${g.max_day[0].toFixed(0)} mm on ${fmt(g.max_day[1], { weekday: 'short', day: 'numeric', month: 'short' })} · ${flash}` : ''} />
          <Tile icon={<Mountain />} c="#3e7d3a" v={rain ? `${(CATCH.reduce((a, k) => a + (places as any)[k].last7d, 0) / 4).toFixed(0)} mm` : '…'} l="Seven Forks catchment, last 7 days" n={rain ? `next 10 days: ${(CATCH.reduce((a, k) => a + (places as any)[k].next10d, 0) / 4).toFixed(0)} mm forecast` : ''} />
          <Tile icon={<Waves />} c={LEVEL_COLORS[river?.indicative_level_now || 'WATCH']} v={river ? `${river.ratio_to_baseline}×` : '…'} l="River Tana flow vs early October" n={river ? `${river.trend}, ${river.pct_change_7d > 0 ? '+' : ''}${river.pct_change_7d}% in 7 days (GloFAS)` : ''} />
          <Tile icon={<Siren />} c={LEVEL_COLORS[river?.peak_median?.level || 'ALERT']} v={river?.first_alert_median ? fmt(river.first_alert_median, { weekday: 'short', day: 'numeric', month: 'short' }) : river ? 'Not in 30 days' : '…'} l="Tana reaches ALERT 4.0 m (median run)" n={river?.first_alert_wettest ? `wettest run: ${fmt(river.first_alert_wettest)} · peak ${river.peak_wettest.stage} m` : ''} />
        </div>
      </Section>

      {/* ---------------------------------------------------------- river monitor */}
      <Section title="River Tana monitor – Garissa" lead="Copernicus GloFAS river flow on the main channel at Garissa, past 45 days and 30-day ensemble forecast. Converted to an indicative gauge reading with the CSG rating curve; official WRA readings (dots) override the model.">
        <div className="grid gap-5 lg:grid-cols-[1fr_250px]">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {(['stage', 'flow'] as const).map((a) => <button key={a} onClick={() => setAxis(a)} className={`rounded-md px-3 py-1 text-[13px] font-semibold ${axis === a ? 'bg-night text-white' : 'bg-paper ring-1 ring-black/10'}`}>{a === 'stage' ? 'Gauge level (m)' : 'Flow (GloFAS m³/s)'}</button>)}
              <span className="ml-auto text-[12px] text-muted">{live?.river ? 'live from GloFAS' : 'from the last automatic update'}</span>
            </div>
            <div className="h-[340px]">
              <ResponsiveContainer>
                <ComposedChart data={riverChart} margin={{ left: -8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e7" />
                  <XAxis dataKey="d" tick={{ fontSize: 11 }} interval={6} />
                  <YAxis tick={{ fontSize: 11 }} domain={axis === 'stage' ? [0, 7] : [0, 'auto']} unit={axis === 'stage' ? ' m' : ''} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {axis === 'stage' && <>
                    <ReferenceArea y1={4} y2={5} fill={LEVEL_COLORS.ALERT} fillOpacity={0.08} />
                    <ReferenceArea y1={5} y2={6.2} fill={LEVEL_COLORS.ALARM} fillOpacity={0.08} />
                    <ReferenceArea y1={6.2} y2={7} fill={LEVEL_COLORS.EMERGENCY} fillOpacity={0.1} />
                    <ReferenceLine y={4} stroke={LEVEL_COLORS.ALERT} strokeDasharray="6 3" label={{ value: 'Alert 4.0', fontSize: 11, fill: LEVEL_COLORS.ALERT, position: 'insideTopLeft' }} />
                    <ReferenceLine y={5} stroke={LEVEL_COLORS.ALARM} strokeDasharray="6 3" label={{ value: 'Alarm 5.0', fontSize: 11, fill: LEVEL_COLORS.ALARM, position: 'insideTopLeft' }} />
                    <ReferenceLine y={6.2} stroke={LEVEL_COLORS.EMERGENCY} strokeDasharray="6 3" label={{ value: 'Emergency 6.2', fontSize: 11, fill: LEVEL_COLORS.EMERGENCY, position: 'insideTopLeft' }} />
                  </>}
                  <ReferenceLine x={todayLabel} stroke="#142338" label={{ value: 'today', fontSize: 11, position: 'top' }} />
                  <Area dataKey="wet" name="Wettest forecast member" stroke="#7a2614" fill="#7a261418" strokeDasharray="5 3" />
                  <Line dataKey="obs" name="Past (model reanalysis)" stroke="#0e7c86" strokeWidth={3} dot={false} />
                  <Line dataKey="fc" name="Forecast (median)" stroke="#e4572e" strokeWidth={3} dot={false} />
                  {axis === 'stage' && <Scatter dataKey="gauge" name="Official gauge reading" fill="#142338" />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="m-0 text-[12px] text-muted">GloFAS under-estimates the absolute Tana flow, so it is scaled to the early-October low-flow state (~2 m at Garissa). Treat levels as indicative; the trend is reliable. Log official readings through the CSG MCP tool <code>log_gauge_reading</code>.</p>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <StaffGauge stage={official ? official.stage_m : river?.indicative_stage_now ?? null} forecast={river ? { stage: river.peak_median.stage, label: 'Forecast peak (median)', time: fmt(river.peak_median.date) } : undefined} height={230} />
            <div className="text-center text-[13px]">
              <div className="font-semibold">{official ? `Official: ${official.stage_m} m` : `Indicative now: ${river?.indicative_stage_now ?? '…'} m`}</div>
              <div className="text-muted">{official ? `${official.time.replace('T', ' ')} · ${official.observer}` : 'no official reading logged yet'}</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- rainfall */}
      <Section title="Rainfall – what fell and what is coming" lead="Daily rain from the Open-Meteo best-match analysis (ECMWF, ICON, GFS) for Garissa, the Somalia border, the lower Tana and the Seven Forks catchment. Shaded days are forecast.">
        <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="h-[320px]">
              <ResponsiveContainer>
                <ComposedChart data={rainChart} margin={{ left: -10, right: 6, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e7" />
                  <XAxis dataKey="d" tick={{ fontSize: 11 }} interval={3} />
                  <YAxis tick={{ fontSize: 11 }} unit=" mm" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {rain && <ReferenceArea x1={rainChart[rain.today_index]?.d} x2={rainChart[rainChart.length - 1]?.d} fill="#e8c07d" fillOpacity={0.18} label={{ value: 'forecast', fontSize: 11, position: 'insideTop' }} />}
                  <Bar dataKey="garissa" name="Garissa" fill="#0e7c86" />
                  <Bar dataKey="dadaab" name="Dadaab" fill="#e4572e" />
                  <Bar dataKey="bura" name="Bura" fill="#c08a2e" />
                  <Line dataKey="catchment" name="Seven Forks catchment (avg)" stroke="#3e7d3a" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <table className="w-full min-w-[420px] text-[13px]">
              <thead><tr className="text-left text-muted"><th className="py-1">Place</th><th className="py-1 text-right">24 h</th><th className="py-1 text-right">3 days</th><th className="py-1 text-right">7 days</th><th className="py-1 text-right">Next 10 d</th></tr></thead>
              <tbody>
                {Object.entries(PLACES).map(([k, p]) => { const r: any = (places as any)[k]; return r ? (
                  <tr key={k} className="border-t border-black/5">
                    <td className="py-1"><span className="font-medium">{p.name}</span><span className="block text-[11px] text-muted">{p.zone}</span></td>
                    <td className="py-1 text-right"><Mm v={r.last24} /></td><td className="py-1 text-right"><Mm v={r.last72} /></td><td className="py-1 text-right"><Mm v={r.last7d} /></td><td className="py-1 text-right"><Mm v={r.next10d} /></td>
                  </tr>) : null })}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- satellite */}
      <Section title="Satellite watch" lead="Daily NASA MODIS and VIIRS imagery for any recent date, side by side with 1 October (before the rains). The CSG also measures surface water inside the county from the MODIS flood product every update.">
        <SatelliteViewer />
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-2 font-semibold"><Satellite size={18} className="text-tana" /> MODIS flood product inside Garissa County</div>
            <div className="mt-2 h-[200px]">
              <ResponsiveContainer>
                <ComposedChart data={(s?.satellite?.days || []).filter((d: any) => d.available).map((d: any) => ({ d: fmt(d.date), cloud: d.cloud_pct, water: (d.water_km2 || 0) + (d.flood_km2 || 0) }))} margin={{ left: -10, right: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e7" />
                  <XAxis dataKey="d" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="c" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="w" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="c" dataKey="cloud" name="Cloud cover %" fill="#b0bec5" />
                  <Line yAxisId="w" dataKey="water" name="Water / flood km²" stroke="#1565c0" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="m-0 mt-1 text-[13px]"><AlertTriangle size={14} className="mr-1 inline text-crest" />{s?.satellite?.note}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="font-semibold">See through the clouds – radar and analysed flood maps</div>
            <ul className="mt-2 space-y-2 text-[14px]">
              <li><a className="inline-flex items-center gap-1 font-semibold text-tana-deep underline" href="https://browser.dataspace.copernicus.eu/?zoom=10&lat=-0.45&lng=39.65&datasetId=S1_AWS_IW_VVVH" target="_blank" rel="noreferrer">Copernicus Browser – Sentinel-1 radar <ExternalLink size={13} /></a><span className="block text-muted">Radar sees through cloud and at night; open water shows black. New images every few days.</span></li>
              <li><a className="inline-flex items-center gap-1 font-semibold text-tana-deep underline" href="https://emergency.copernicus.eu/mapping/list-of-activations-rapid" target="_blank" rel="noreferrer">Copernicus EMS rapid mapping <ExternalLink size={13} /></a><span className="block text-muted">Analysed flood extents when Kenya activates the service (via NDOC).</span></li>
              <li><a className="inline-flex items-center gap-1 font-semibold text-tana-deep underline" href={`https://worldview.earthdata.nasa.gov/?v=38.4,-2.4,41.8,1.3&l=MODIS_Combined_Flood_3-Day,MODIS_Terra_CorrectedReflectance_Bands721&t=${yesterday()}`} target="_blank" rel="noreferrer">NASA Worldview – Garissa today <ExternalLink size={13} /></a><span className="block text-muted">MODIS flood product over the 7-2-1 false colour, pre-set to Garissa.</span></li>
              <li><a className="inline-flex items-center gap-1 font-semibold text-tana-deep underline" href="https://unosat.org/products" target="_blank" rel="noreferrer">UNOSAT flood products <ExternalLink size={13} /></a><span className="block text-muted">Source of the 2023 and 2024 flood extents on the risk map.</span></li>
            </ul>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- verification */}
      <Section title="How did the El Niño Watch forecast do?" lead="An honest check of the 4 October forecast against what has happened. Being clear about what we got wrong is what makes the next warning believable.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(s?.verification || []).map((v: any, i: number) => (
            <article key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5" style={{ borderLeft: `6px solid ${RES[v.result]?.[1] || '#555'}` }}>
              <div className="flex items-center gap-2">{v.result === 'missed' ? <XCircle size={18} style={{ color: RES.missed[1] }} /> : <CheckCircle2 size={18} style={{ color: RES[v.result]?.[1] }} />}<Pill color={RES[v.result]?.[1] || '#555'}>{RES[v.result]?.[0] || v.result}</Pill></div>
              <div className="mt-2 font-semibold">{v.claim}</div>
              <p className="mt-1 text-[14px] text-muted">{v.evidence}</p>
            </article>
          ))}
        </div>
        <p className="mt-3 text-[14px]"><b>In short:</b> the timing of the onset was about four weeks early, but the way the floods would unfold – mountains first, flash floods in Garissa before the river, and a River Tana flood season from November – is what is happening now. <Link to="/elnino" className="font-semibold text-tana-deep underline">See the original El Niño Watch</Link>.</p>
      </Section>

      {/* ---------------------------------------------------------- event log */}
      <Section title="Event log – Kenya Met, NDOC, Red Cross, NDMA, field reports" lead="Every entry links to its source. The CSG secretariat adds field reports and agency updates through the portal's MCP tool, so this page updates without a developer.">
        <ol className="m-0 list-none space-y-3 p-0">
          {(s?.events || []).map((e: any, i: number) => (
            <li key={i} className="grid gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 md:grid-cols-[130px_1fr]">
              <div><div className="font-display text-lg font-bold">{fmt(e.date, { day: 'numeric', month: 'short', year: 'numeric' })}</div><Pill color={(KIND[e.kind] || KIND.report)[1]}>{(KIND[e.kind] || KIND.report)[0]}</Pill></div>
              <div>
                <div className="font-semibold">{e.title}</div>
                {e.detail && <p className="m-0 mt-1 text-[14px] text-muted">{e.detail}</p>}
                <div className="mt-1 text-[12px]">Source: {e.url ? <a className="text-tana-deep underline" href={e.url} target="_blank" rel="noreferrer">{e.source}</a> : e.source}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ---------------------------------------------------------- actions */}
      <Section title="What to do now">
        <div className="grid gap-3 md:grid-cols-2">
          {(s?.actions || []).map((a: string, i: number) => <div key={i} className="flex gap-3 rounded-xl bg-white p-4 text-[15px] shadow-sm ring-1 ring-black/5"><ShieldCheck className="shrink-0 text-acacia" />{a}</div>)}
        </div>
        <p className="mt-3 text-[14px]">Check a specific home, school or farm with <Link className="font-semibold text-tana-deep underline" to="/">Am I at risk?</Link> on the risk map, or plan by gauge level on the <Link className="font-semibold text-tana-deep underline" to="/elnino">El Niño Watch</Link> flood-zone map.</p>
      </Section>

      {/* ---------------------------------------------------------- data health + MCP */}
      <Section title="Data feeds and automation">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="font-semibold">Feed status</div>
            <ul className="m-0 mt-2 list-none space-y-1.5 p-0 text-[14px]">
              {health.map(([n, ok, d]) => (
                <li key={n} className="flex items-start gap-2">{ok === null ? <Clock size={16} className="mt-0.5 text-muted" /> : ok ? <CheckCircle2 size={16} className="mt-0.5 text-acacia" /> : <XCircle size={16} className="mt-0.5 text-crest" />}<span><b>{n}</b>{d && <span className="text-muted"> – {d}</span>}</span></li>
              ))}
            </ul>
            <p className="m-0 mt-2 text-[12px] text-muted">If a live feed fails the page keeps the last good automatic update, so it never goes blank.</p>
          </div>
          <div className="rounded-2xl bg-night p-4 text-white shadow-sm">
            <div className="flex items-center gap-2 font-semibold"><Bot size={18} className="text-sand" /> Powered by the CSG MCP server</div>
            <p className="mt-2 text-[14px] text-white/85">Every 3 hours a GitHub Action re-fetches rain, River Tana and satellite data and republishes this page. The CSG MCP server gives Claude, Gemini or any MCP-capable assistant the same live tools: <code className="text-sand">get_situation</code>, <code className="text-sand">get_tana_flow</code>, <code className="text-sand">check_location</code>, <code className="text-sand">assets_at_risk</code>, <code className="text-sand">log_event</code>, <code className="text-sand">log_gauge_reading</code> and <code className="text-sand">community_message</code>.</p>
            <p className="mt-2 text-[13px] text-white/70">Secretariat: “Log today's WRA reading at Garissa, 3.9 m, observer Hassan” or “Add the Red Cross update about Bour-Algi” – the assistant writes it to the portal.</p>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-muted">Sources: {(s?.sources || []).map((x: any, i: number) => <span key={x.url}>{i ? ' · ' : ''}<a className="underline" href={x.url} target="_blank" rel="noreferrer">{x.name}</a></span>)}. Decision support only – follow official Kenya Met, WRA, NDMA and NDOC warnings.</p>
      </Section>
    </>
  )
}

function Tile({ icon, c, v, l, n }: { icon: React.ReactNode; c: string; v: string; l: string; n: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5" style={{ borderTop: `5px solid ${c}` }}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-muted"><span style={{ color: c }}>{icon}</span>{l}</div>
      <div className="mt-1 font-display text-3xl font-extrabold tabular" style={{ color: c }}>{v}</div>
      <div className="text-[13px] text-muted">{n}</div>
    </div>
  )
}
function Mm({ v }: { v: number | null }) {
  if (v === null || v === undefined) return <span className="text-muted">–</span>
  const c = v >= 100 ? '#6a1b9a' : v >= 50 ? '#c81d25' : v >= 25 ? '#f28c28' : v >= 10 ? '#f2c230' : v >= 2 ? '#90caf9' : '#eceff1'
  return <span className="inline-block min-w-[44px] rounded px-1.5 py-0.5 text-center font-semibold tabular" style={{ background: c, color: v >= 25 ? '#fff' : '#142338' }}>{Math.round(v)}</span>
}

// ------------------------------------------------------------------------------- satellite viewer
function Sync({ other, me }: { other: React.MutableRefObject<LMap | null>; me: React.MutableRefObject<LMap | null> }) {
  const map = useMap()
  useEffect(() => {
    me.current = map
    const h = () => { const o = other.current; if (o && (o.getCenter().distanceTo(map.getCenter()) > 50 || o.getZoom() !== map.getZoom())) o.setView(map.getCenter(), map.getZoom(), { animate: false }) }
    map.on('moveend', h)
    return () => { map.off('moveend', h) }
  }, [map])
  return null
}

function SatelliteViewer() {
  const [layer, setLayer] = useState(SAT_LAYERS[0])
  const [date, setDate] = useState(yesterday())
  const [flood, setFlood] = useState(true)
  const [county, setCounty] = useState<any>(null)
  const [tana, setTana] = useState<any>(null)
  const a = useRef<LMap | null>(null), b = useRef<LMap | null>(null)
  useEffect(() => { geo('county.geojson').then(setCounty); geo('tana_river.geojson').then(setTana) }, [])
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() + 3 * 3600e3 - (i + 1) * 86400e3).toISOString().slice(0, 10))
  const pane = (d: string, ref: any, other: any, label: string) => (
    <div className="relative overflow-hidden rounded-xl ring-1 ring-black/10">
      <div className="absolute left-2 top-2 z-[500] rounded-md bg-night/85 px-2 py-1 text-[12px] font-semibold text-white">{label}: {fmt(d, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      <MapContainer center={[-0.45, 39.75]} zoom={8} className="h-[380px] w-full" zoomControl={false} attributionControl={false}>
        <Sync me={ref} other={other} />
        <TileLayer key={layer.id + d} url={GIBS(layer.id, d, layer.ext, layer.level)} maxNativeZoom={9} maxZoom={12} />
        {flood && <TileLayer key={'fl' + d} url={GIBS('MODIS_Combined_Flood_3-Day', d, 'png', 9)} maxNativeZoom={9} maxZoom={12} opacity={0.9} />}
        {county && <GeoJSON data={county} style={{ color: '#ff1744', weight: 2, fillOpacity: 0 }} />}
        {tana && <GeoJSON data={tana} style={{ color: '#00e5ff', weight: 1.5 }} />}
      </MapContainer>
    </div>
  )
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {SAT_LAYERS.map((l) => <button key={l.id} onClick={() => setLayer(l)} className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${layer.id === l.id ? 'bg-night text-white' : 'bg-paper ring-1 ring-black/10'}`}>{l.label}</button>)}
        <label className="ml-auto flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={flood} onChange={(e) => setFlood(e.target.checked)} className="accent-tana" /> NASA flood detections</label>
        <select value={date} onChange={(e) => setDate(e.target.value)} className="sel max-w-[170px]" aria-label="Image date">{days.map((d) => <option key={d} value={d}>{fmt(d, { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}</select>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {pane('2026-10-01', a, b, 'Before')}
        {pane(date, b, a, 'Now')}
      </div>
      <p className="m-0 mt-2 text-[12px] text-muted">{layer.note} Flood detections: cyan = surface water, red = flood beyond normal water, grey = cloud (no data). Pan or zoom one map and the other follows. Imagery: NASA EOSDIS GIBS / LANCE.</p>
    </div>
  )
}
