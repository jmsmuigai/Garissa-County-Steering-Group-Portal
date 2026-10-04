import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine, Area } from 'recharts'
import { CloudRain, CloudSun, Waves, Siren, Mountain, Wind, Copy, Check, ExternalLink, KeyRound, Tractor, School, Hospital, Droplets, Home as HomeIcon, X, Radio, MapPinned } from 'lucide-react'
import { Section, Pill } from '../components/ui'
import SmartMap from '../components/SmartMap'
import ElNino from './ElNino'
import { backendAvailable, DATA } from '../lib/api'
import { LEVEL_COLORS, levelFor, mapBus, useApp } from '../lib/store'
import { getOwmKey, setOwmKey, siteConfigReady } from '../lib/gemini'

// ------------------------------------------------------------------ helpers
const LAGHA = { dry: ['Dry', '#9e9e9e'], wet: ['Wet ground', '#64b5f6'], flowing: ['Laghas flowing', '#ff9800'], flash: ['Flash flood', '#d50000'], flood: ['Flooding', '#d50000'] } as Record<string, [string, string]>
const fmt = (iso: string, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', o)
const BURST = new Date('2026-10-12T00:00:00+03:00')
const MODEL_LIVE: [string, string, string][] = [
  ['ecmwf_ifs025', 'ECMWF', '#d32f2f'], ['ecmwf_aifs025_single', 'ECMWF-AIFS', '#00897b'], ['gfs_seamless', 'GFS', '#1e88e5'], ['icon_seamless', 'ICON', '#f9a825'],
]
const POINTS: { name: string; zone: string; lat: number; lon: number }[] = [
  { name: 'Garissa Town', zone: 'Garissa', lat: -0.4532, lon: 39.6461 },
  { name: 'Dadaab', zone: 'Somalia border', lat: 0.0573, lon: 40.3092 },
  { name: 'Hulugho', zone: 'Somalia border', lat: -1.0833, lon: 41.0167 },
  { name: 'Masalani (Ijara)', zone: 'Lower Tana', lat: -1.6963, lon: 40.1653 },
  { name: 'Embu', zone: 'Seven Forks catchment', lat: -0.5388, lon: 37.4596 },
  { name: 'Meru', zone: 'Seven Forks catchment', lat: 0.0463, lon: 37.6559 },
  { name: 'Nyeri', zone: 'Seven Forks catchment', lat: -0.4201, lon: 36.9476 },
  { name: 'Masinga Dam', zone: 'Seven Forks catchment', lat: -0.8869, lon: 37.5977 },
  { name: 'Nanyuki', zone: "Ewaso Ng'iro → Lagh Dera", lat: 0.0167, lon: 37.0667 },
]
const WINDY_OVERLAYS: [string, string][] = [['rainAccu', 'Rain total'], ['rain', 'Rain & thunder'], ['efiRain', 'Extreme rain index'], ['clouds', 'Clouds'], ['satellite', 'Satellite']]
const WINDY_MODELS: [string, string][] = [['ecmwf', 'ECMWF'], ['gfs', 'GFS'], ['icon', 'ICON']]
const FOCUS: [string, number[], string[]][] = [
  ['Seven Forks catchment', [36.6, -1.35, 38.6, 0.6], ['catchment', 'upper_tana', 'dams', 'tana']],
  ['Garissa riverine farms', [39.15, -1.25, 40.25, 0.25], ['farm_zones', 'flood_sim', 'flood_2023_viirs', 'flood_2024_tana']],
  ["Ewaso Ng'iro → Lagh Dera", [36.9, -0.4, 41.2, 1.5], ['ewaso', 'major_laghas']],
  ['Somalia border', [39.8, -2.0, 41.3, 0.7], ['border_zone', 'major_laghas', 'camps']],
]

type W = any

export default function Watch() {
  const { lang } = useApp()
  const [w, setW] = useState<W>(null)
  const [fill, setFill] = useState(90)
  const [zone, setZone] = useState('catchment')
  const [stage, setStage] = useState(4.0)
  const [overlay, setOverlay] = useState('rainAccu')
  const [model, setModel] = useState('ecmwf')
  const [live, setLive] = useState<{ when: string; rows: { p: (typeof POINTS)[number]; tot: Record<string, number | null> }[] } | null>(null)
  const [liveErr, setLiveErr] = useState('')
  const [owm, setOwm] = useState<any>(null)
  const [owmIn, setOwmIn] = useState('')
  const [owmMsg, setOwmMsg] = useState('')
  const [msgLang, setMsgLang] = useState<'en' | 'sw' | 'so'>(lang)
  const [copied, setCopied] = useState(false)
  const [zoomImg, setZoomImg] = useState<any>(null)

  // python simulation (live server, else static snapshot)
  useEffect(() => {
    ;(async () => {
      try {
        if (await backendAvailable()) { const r = await fetch(`./api/watch?masinga_fill_pct=${fill}`); if (r.ok) { setW(await r.json()); return } }
      } catch { /* static fallback */ }
      const r = await fetch(DATA(`api/watch_${fill}.json`)); if (r.ok) setW(await r.json())
    })()
  }, [fill])

  // live multi-model rainfall for catchment points (Open-Meteo, no key)
  useEffect(() => {
    const lat = POINTS.map((p) => p.lat).join(','), lon = POINTS.map((p) => p.lon).join(',')
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&forecast_days=16&timezone=Africa%2FNairobi&models=${MODEL_LIVE.map((m) => m[0]).join(',')}`, { signal: AbortSignal.timeout(12000) })
      .then((r) => r.json())
      .then((j) => {
        const arr = Array.isArray(j) ? j : [j]
        setLive({
          when: new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
          rows: POINTS.map((p, i) => {
            const d = arr[i]?.daily || {}
            const tot: Record<string, number | null> = {}
            MODEL_LIVE.forEach(([m]) => { const v = (d[`precipitation_sum_${m}`] || []).filter((x: any) => x !== null); tot[m] = v.length ? Math.round(v.reduce((a: number, b: number) => a + b, 0)) : null })
            return { p, tot }
          }),
        })
      })
      .catch(() => setLiveErr('Live model data could not be reached from this network. The chart readings below still apply.'))
  }, [])

  // OpenWeather current conditions (only if a key is set)
  const loadOwm = async () => {
    await siteConfigReady
    const k = getOwmKey()
    if (!k) { setOwm(null); return false }
    const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=-0.4532&lon=39.6461&units=metric&appid=${k}`)
    const j = await r.json()
    if (!r.ok) throw new Error(j?.message || `OpenWeather error ${r.status}`)
    setOwm(j)
    return true
  }
  useEffect(() => { loadOwm().catch(() => {}) }, [])

  const daysToBurst = Math.ceil((BURST.getTime() - Date.now()) / 86400000)

  // daily calendar rows
  const cal = useMemo(() => {
    if (!w) return []
    const tana = w.tana.ecmwf.series as any[]
    return w.dates.map((d: string, i: number) => {
      const st = Math.max(...tana.filter((r) => r.time.startsWith(d)).map((r) => r.stage_m), 0)
      return {
        d, i,
        catch: w.zones.catchment.daily.blend[i], catchHi: w.zones.catchment.daily.ecmwf[i],
        gar: w.zones.garissa.daily.blend[i], garHi: w.zones.garissa.daily.ecmwf[i],
        border: w.zones.border.daily.ecmwf[i],
        lagha: w.laghas.garissa_ecmwf[i], laghaB: w.laghas.border_ecmwf[i], stage: st,
      }
    })
  }, [w])

  const rainChart = useMemo(() => {
    if (!w) return []
    const z = w.zones[zone]
    let cum = 0
    return w.dates.map((d: string, i: number) => ({ d: fmt(d, { day: 'numeric', month: 'short' }), blend: z.daily.blend[i], ecmwf: z.daily.ecmwf[i], gfs: z.daily.gfs[i], cum: +(cum += z.daily.blend[i]).toFixed(0) }))
  }, [w, zone])

  const riverChart = useMemo(() => {
    if (!w) return []
    const ext = w.tana_extended.ecmwf.series as any[]
    const two = w.tana.ecmwf.series as any[], bl = w.tana.blend.series as any[]
    const byT = (arr: any[]) => Object.fromEntries(arr.map((r) => [r.time, r.stage_m]))
    const a = byT(two), b = byT(bl)
    const fillE = w.tana_extended.ecmwf.masinga_fill_pct as number[]
    return ext.filter((_, i) => i % 2 === 0).map((r) => {
      const day = Math.floor(r.hour / 24)
      return { t: fmt(r.time.slice(0, 10), { day: 'numeric', month: 'short' }), ecmwf: a[r.time] ?? null, blend: b[r.time] ?? null, cont: r.stage_m, fill: fillE[day] ?? null }
    })
  }, [w])

  const ladder = useMemo(() => {
    if (!w) return []
    const two = w.tana.ecmwf, cont = w.tana_extended.ecmwf
    return [
      { k: 'Next two weeks (all models)', s: `${w.tana.blend.peak_stage_m}–${two.peak_stage_m} m`, v: two.peak_stage_m, when: `peak around ${fmt(two.peak_time.slice(0, 10))}`, note: `Masinga fills to about ${two.masinga_fill_pct[15]?.toFixed(0)}% – the dams are absorbing the first burst.` },
      { k: 'If the El Niño burst continues to end-October (ECMWF pattern)', s: `${cont.peak_stage_m} m`, v: cont.peak_stage_m, when: `Masinga full ~${cont.masinga_full_date ? fmt(cont.masinga_full_date) : 'late Oct'}, river peak ~${fmt(cont.peak_time.slice(0, 10))}`, note: 'Once Masinga spills, every extra storm on Mt Kenya reaches Garissa 36–48 hours later.' },
      { k: "Director's extreme scenario (700 mm, like 1997/98)", s: `${w.extreme700.peak_stage_m} m`, v: w.extreme700.peak_stage_m, when: 'if 700 mm falls on the catchment', note: 'Comparable to November 2023: farms under water for weeks, bridge approaches cut.' },
    ]
  }, [w])

  const expo = (s: number) => {
    if (!w) return null
    const keys = Object.keys(w.exposure_by_stage).map(Number).sort((a, b) => a - b)
    const k = Math.max(...keys.filter((x) => x <= s), keys[0])
    return w.exposure_by_stage[k.toFixed(1)] || w.exposure_by_stage[String(k)]
  }
  const impact = (s: number) => (w?.farm_impact || []).filter((f: any) => f.stage_m <= s).slice(-1)[0] || w?.farm_impact?.[0]

  const msgText = w ? `*El Niño Watch – Garissa County Steering Group* (${fmt(w.issued, { day: 'numeric', month: 'long', year: 'numeric' })})\n` + w.community[msgLang].map((x: string) => `• ${x}`).join('\n') + `\nMore: https://jmsmuigai.github.io/Garissa-County-Steering-Group-Portal/#/elnino` : ''
  const copyMsg = async () => { try { await navigator.clipboard.writeText(msgText); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { /* clipboard blocked */ } }

  const setStageMap = (s: number) => { setStage(s); mapBus.emit({ type: 'flood_stage', stage: s }) }
  const focus = (bbox: number[], show: string[]) => { mapBus.emit({ type: 'layers', show }); mapBus.emit({ type: 'zoom', bbox }) }

  const windy = `https://embed.windy.com/embed2.html?lat=0.0&lon=39.0&detailLat=-0.453&detailLon=39.646&width=900&height=520&zoom=6&level=surface&overlay=${overlay}&product=${model}&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-night text-white">
        <img src="./img/watch/ecmwf_hres_15d.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-night via-night/90 to-night/40" />
        <div className="relative mx-auto grid max-w-[1500px] gap-8 px-5 py-10 lg:grid-cols-[1.3fr_1fr] lg:py-14">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emergency px-3 py-1 font-semibold"><Radio size={14} className="animate-pulse" /> El Niño Watch · active</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Issued {w ? fmt(w.issued, { day: 'numeric', month: 'long', year: 'numeric' }) : '4 October 2026'} · model runs of 3–4 Oct</span>
            </div>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">El Niño Watch</h1>
            <p className="mt-3 max-w-2xl text-lg text-white/85">
              Rains start on Mt Kenya and the Seven Forks catchment <b className="text-sand">this week</b>. The main El Niño burst arrives <b className="text-sand">12–18 October</b>. Here is when the first rains and first floods are likely in Garissa, from five forecast models and the CSG's own Python flood simulation.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href="#calendar" className="rounded-lg bg-sand px-4 py-2 font-semibold text-night">16-day flood calendar</a>
              <a href="#live" className="rounded-lg bg-white/12 px-4 py-2 font-semibold hover:bg-white/20">Live maps</a>
              <a href="#farms" className="rounded-lg bg-white/12 px-4 py-2 font-semibold hover:bg-white/20">What it means for farms</a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-center">
            <Big n={daysToBurst > 0 ? `${daysToBurst} days` : 'Now'} l={daysToBurst > 0 ? 'until the main burst (12 Oct)' : 'main El Niño burst under way'} c="#e8c07d" />
            <Big n="200–300 mm" l="ECMWF, Mt Kenya & Seven Forks catchment (15 days)" c="#ff8a65" />
            <Big n="60–80 mm" l="ECMWF at Garissa; GFS only 5–15 mm" c="#4fc3f7" />
            <Big n={w ? `${w.tana.ecmwf.masinga_fill_pct[15].toFixed(0)}%` : '…'} l="Masinga full by 19 Oct (ECMWF simulation)" c="#81c784" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- this week */}
      <Section title="This week on the weather" lead="Kenya weekly forecast for 5–11 October 2026 and the week-2 extension, from the Kenya Weather Patterns Dynamics agrometeorology bulletin (ICON, GFS, ECMWF), checked against the charts below.">
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-2"><Pill color="#f9a825">Week 1</Pill><span className="font-semibold">5–11 October · onset</span></div>
            <p className="mt-3 text-[15px]">El Niño-enhanced rain starts this week. <b>Moderate to heavy</b> rain over western Kenya, the central highlands (Kiambu, Murang'a, Nyeri, Kirinyaga, <b>Embu, Tharaka Nithi, Meru</b>) and the coast; moderate to heavy in Mandera, northern Wajir and eastern Marsabit; isolated showers in Tana River and Kitui.</p>
            <p className="mt-2 rounded-lg bg-sand-light p-3 text-[14px]"><b>Garissa:</b> mostly sunny, hot and dry (max 28–41 °C). But the Seven Forks catchment starts wetting up – the river begins to rise slowly.</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5" style={{ borderTop: '5px solid #c81d25' }}>
            <div className="flex items-center gap-2"><Pill color="#c81d25">Week 2</Pill><span className="font-semibold">12–18 October · main burst</span></div>
            <p className="mt-3 text-[15px]">GFS and ECMWF agree the <b>El Niño burst arrives</b>: heavy to very heavy rain spreading Coast → Eastern → Central → Western. <b>50–150 mm</b> in many areas, <b>200–300 mm</b> on the coast and the Somalia border. Flooded farms, washed-away roads and bridges, and landslides on Mt Kenya are likely where totals pass 400 mm.</p>
            <p className="mt-2 rounded-lg bg-crest-light p-3 text-[14px]"><b>Garissa:</b> first real storms around 13–16 Oct; laghas can flow. AI models bring a tropical low into southern Somalia – watch Dadaab, Hulugho, Liboi and Ijara.</p>
          </article>
        </div>
      </Section>

      {/* ---------------------------------------------------------- calendar */}
      <Section id="calendar" title="16-day flood calendar for Garissa" lead="Each day shows rain on the Seven Forks catchment (what makes the Tana rise), rain in Garissa (what makes laghas run), the lagha state and the simulated River Tana level at the Garissa gauge.">
        {!w && <p className="text-muted">Loading the simulation…</p>}
        <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {cal.map((c: any) => {
            const today = new Date().toISOString().slice(0, 10) === c.d
            const heavy = c.catch >= 15 || c.garHi >= 15
            const bg = c.lagha === 'flash' ? '#fde0dc' : heavy ? '#fff1e0' : c.catch >= 5 ? '#e3f2fd' : '#f6f8f7'
            return (
              <div key={c.d} className={`w-[124px] shrink-0 rounded-xl p-2.5 ring-1 ${today ? 'ring-2 ring-tana' : 'ring-black/8'}`} style={{ background: bg }}>
                <div className="flex items-center justify-between text-[12px] font-semibold"><span>{fmt(c.d, { weekday: 'short' })}</span><span className="text-muted">{fmt(c.d, { day: 'numeric', month: 'short' })}</span></div>
                <div className="mt-1.5 flex items-center gap-1 text-[12px]" title="Seven Forks catchment rain (blend / ECMWF)"><Mountain size={14} className="text-acacia" /><b className="tabular">{c.catch.toFixed(0)}</b><span className="text-muted">–{c.catchHi.toFixed(0)} mm</span></div>
                <div className="flex items-center gap-1 text-[12px]" title="Garissa rain (blend / ECMWF)"><CloudRain size={14} className="text-tana" /><b className="tabular">{c.gar.toFixed(0)}</b><span className="text-muted">–{c.garHi.toFixed(0)} mm</span></div>
                <div className="mt-1.5 rounded px-1.5 py-0.5 text-center text-[11px] font-semibold text-white" style={{ background: LAGHA[c.lagha][1] }}>{LAGHA[c.lagha][0]}</div>
                <div className="mt-1.5 flex items-center gap-1 text-[12px]" title="River Tana at Garissa, ECMWF simulation"><Waves size={14} style={{ color: LEVEL_COLORS[levelFor(c.stage)] }} /><b className="tabular">{c.stage.toFixed(1)} m</b><span className="text-muted">Tana</span></div>
                {today && <div className="mt-1 text-center text-[10px] font-bold uppercase text-tana">today</div>}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[13px] text-muted">Rain: blend of five models – ECMWF (wettest). Lagha state uses the ECMWF Garissa rain with storm days. Normal Tana level at Garissa in early October is about 2 m; ALERT is 4.0 m.</p>
      </Section>

      {/* ---------------------------------------------------------- milestones */}
      <Section title="When to expect the first rains and the first floods">
        <ol className="relative m-0 list-none border-l-4 border-sand/60 p-0 pl-6">
          {(w?.milestones || []).map((m: any, i: number) => (
            <li key={i} className="relative mb-5">
              <span className="absolute -left-[35px] top-1 flex h-6 w-6 items-center justify-center rounded-full text-white ring-4 ring-paper" style={{ background: m.scenario === 'continues' ? '#c81d25' : m.scenario === 'wet' ? '#f28c28' : '#0e7c86' }}>
                {m.icon === 'river' || m.icon === 'peak' ? <Waves size={13} /> : m.icon === 'dam' ? <Droplets size={13} /> : m.icon === 'lagha' || m.icon === 'flash' ? <Siren size={13} /> : <CloudRain size={13} />}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-xl font-bold">{fmt(m.date, { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                <span className="rounded px-1.5 text-[11px] font-semibold text-white" style={{ background: m.scenario === 'continues' ? '#c81d25' : m.scenario === 'wet' ? '#f28c28' : '#0e7c86' }}>{m.scenario === 'continues' ? 'if the burst continues' : m.scenario === 'wet' ? 'wettest model (ECMWF)' : 'all models'}</span>
              </div>
              <div className="text-[16px] font-semibold">{m.title}</div>
              <div className="text-[14px] text-muted">{m.who}</div>
            </li>
          ))}
        </ol>
        <div className="mt-2 rounded-2xl bg-night p-5 text-white">
          <b className="text-sand">The short story.</b> The rain comes first to the mountains, the floods come to Garissa later. Over the next two weeks the Seven Forks dams soak up most of the first burst, so the River Tana at Garissa rises but should stay inside its banks. The danger in Garissa itself is <b>flash floods in laghas</b> during the storms of 13–16 October and on the <b>Somalia border</b> if the tropical low comes inland. If the heavy pattern keeps going after 18 October – as in 1997 and 2023 – Masinga spills and the Tana flood season at Garissa follows from early November.
        </div>
      </Section>

      {/* ---------------------------------------------------------- simulation */}
      <Section title="The simulation" lead="Python model on the CSG server: chart rainfall → SCS runoff on the catchment → Masinga storage and spill → tributaries below the dams → 40-hour routing → Garissa rating curve. Calibrated so that the Oct–Nov 2023 rains reproduce a 6–7 m Garissa flood.">
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-semibold">Daily rain</span>
              {Object.entries(w?.zones || {}).map(([k, z]: any) => <button key={k} onClick={() => setZone(k)} className={`rounded-md px-2 py-1 text-[12px] font-semibold ${zone === k ? 'bg-tana text-white' : 'bg-paper ring-1 ring-black/10'}`}>{z.label.split(' (')[0].split(',')[0]}</button>)}
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer>
                <ComposedChart data={rainChart} margin={{ left: -10, right: 6, top: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e7" />
                  <XAxis dataKey="d" tick={{ fontSize: 11 }} interval={1} />
                  <YAxis yAxisId="d" tick={{ fontSize: 11 }} unit=" mm" />
                  <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="d" dataKey="blend" name="Blend (mm/day)" fill="#0e7c86" />
                  <Line yAxisId="d" dataKey="ecmwf" name="ECMWF" stroke="#d32f2f" dot={false} strokeWidth={2} />
                  <Line yAxisId="d" dataKey="gfs" name="GFS" stroke="#1e88e5" dot={false} strokeWidth={2} strokeDasharray="4 3" />
                  <Area yAxisId="c" dataKey="cum" name="Blend total (mm)" fill="#e8c07d33" stroke="#c08a2e" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {w && <p className="m-0 text-[13px] text-muted">{w.zones[zone].label}: week 1 ≈ {w.zones[zone].week1} mm, week 2 ≈ {w.zones[zone].week2} mm (blend). 15-day totals – {Object.entries(w.zones[zone].totals).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' · ')} mm.</p>}
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-semibold">River Tana at Garissa</span>
              <span className="ml-auto text-[12px] text-muted">Masinga at start:</span>
              {[80, 90, 95].map((f) => <button key={f} onClick={() => setFill(f)} className={`rounded-md px-2 py-1 text-[12px] font-semibold ${fill === f ? 'bg-night text-white' : 'bg-paper ring-1 ring-black/10'}`}>{f}%</button>)}
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer>
                <ComposedChart data={riverChart} margin={{ left: -10, right: 6, top: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e7" />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} interval={11} />
                  <YAxis yAxisId="s" domain={[0, 7]} tick={{ fontSize: 11 }} unit=" m" />
                  <YAxis yAxisId="f" orientation="right" domain={[60, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine yAxisId="s" y={4} stroke={LEVEL_COLORS.ALERT} strokeDasharray="6 3" label={{ value: 'Alert 4.0 m', fontSize: 11, fill: LEVEL_COLORS.ALERT, position: 'insideTopLeft' }} />
                  <ReferenceLine yAxisId="s" y={5} stroke={LEVEL_COLORS.ALARM} strokeDasharray="6 3" label={{ value: 'Alarm 5.0 m', fontSize: 11, fill: LEVEL_COLORS.ALARM, position: 'insideTopLeft' }} />
                  <ReferenceLine yAxisId="s" y={6.2} stroke={LEVEL_COLORS.EMERGENCY} strokeDasharray="6 3" label={{ value: 'Emergency 6.2 m', fontSize: 11, fill: LEVEL_COLORS.EMERGENCY, position: 'insideTopLeft' }} />
                  <Line yAxisId="s" dataKey="blend" name="Next 2 weeks – blend" stroke="#0e7c86" dot={false} strokeWidth={2} />
                  <Line yAxisId="s" dataKey="ecmwf" name="Next 2 weeks – ECMWF" stroke="#d32f2f" dot={false} strokeWidth={2.5} />
                  <Line yAxisId="s" dataKey="cont" name="If the burst continues" stroke="#7a2614" dot={false} strokeWidth={2} strokeDasharray="6 3" />
                  <Line yAxisId="f" dataKey="fill" name="Masinga fill % (continues)" stroke="#3e7d3a" dot={false} strokeWidth={1.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* scenario ladder */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {ladder.map((s) => {
            const lv = levelFor(s.v), e = expo(s.v), im = impact(s.v)
            return (
              <article key={s.k} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <RiverGlyph stage={s.v} />
                <div className="p-4">
                  <div className="text-[13px] font-semibold text-muted">{s.k}</div>
                  <div className="flex items-baseline gap-2"><span className="font-display text-3xl font-extrabold tabular" style={{ color: LEVEL_COLORS[lv] }}>{s.s}</span><Pill color={LEVEL_COLORS[lv]}>{lv}</Pill></div>
                  <div className="text-[13px] text-muted">{s.when}</div>
                  <p className="mt-2 text-[14px]">{s.note}</p>
                  {im && <p className="mt-1 text-[14px]"><Tractor size={15} className="mr-1 inline text-acacia" />{im.text}</p>}
                  {e && s.v >= 3.0 && <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
                    <Exp i={<School size={14} />} n={e.schools} l="schools" /><Exp i={<Hospital size={14} />} n={e.health} l="clinics" /><Exp i={<Droplets size={14} />} n={e.boreholes} l="boreholes" /><Exp i={<HomeIcon size={14} />} n={e.structures} l="houses*" />
                  </div>}
                </div>
              </article>
            )
          })}
        </div>
        <p className="mt-2 text-[12px] text-muted">Exposure = assets inside the simulated flood band for that gauge level (UNOSAT 2023/2024 envelopes). *Houses = buildings mapped by UNOSAT in May 2024.</p>
      </Section>

      {/* ---------------------------------------------------------- farm map */}
      <Section id="farms" title="Flood zones, laghas and the catchment on one map" lead="Pick a place to focus, then slide the river level to see which farms, schools and clinics go under water. Red outlines are past UNOSAT flood extents (Nov 2023, Apr–May 2024).">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {FOCUS.map(([l, b, s]) => <button key={l} onClick={() => focus(b, s)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold ring-1 ring-black/10 hover:ring-tana"><MapPinned size={14} className="text-tana" />{l}</button>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <SmartMap compact height="64vh" focus="all" showGauge={false} initial={['county', 'tana', 'catchment', 'upper_tana', 'dams', 'major_laghas', 'ewaso', 'border_zone', 'flood_2023_viirs', 'flood_2024_tana', 'farm_zones', 'imerg']} />
          <aside className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="font-semibold">River Tana level at Garissa</div>
            <div className="font-display text-4xl font-extrabold tabular" style={{ color: LEVEL_COLORS[levelFor(stage)] }}>{stage.toFixed(1)} m</div>
            <Pill color={LEVEL_COLORS[levelFor(stage)]}>{levelFor(stage)}</Pill>
            <input type="range" min={3} max={7.5} step={0.5} value={stage} onChange={(e) => setStageMap(+e.target.value)} className="mt-3 w-full accent-tana" aria-label="River level" />
            <div className="flex justify-between text-[11px] text-muted"><span>3.0</span><span>4 alert</span><span>5 alarm</span><span>6.2</span><span>7.5</span></div>
            {impact(stage) && <p className="mt-3 text-[14px]">{impact(stage).text}</p>}
            {expo(stage) && <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
              <Kv k="Flooded area" v={`${expo(stage).area_km2} km²`} /><Kv k="Farm area" v={`${expo(stage).farm_km2} km²`} />
              <Kv k="Schools" v={expo(stage).schools} /><Kv k="Health facilities" v={expo(stage).health} />
              <Kv k="Boreholes" v={expo(stage).boreholes} /><Kv k="Buildings" v={expo(stage).structures} />
            </div>}
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {['field_flooded_bananas', 'field_submerged_crops', 'field_waterlogged_farm'].map((f) => <img key={f} src={`./img/${f}.jpg`} alt="Flooded riverine farm in Garissa" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />)}
            </div>
            <p className="mt-1 text-[11px] text-muted">Garissa riverine farms in past floods (county field photos).</p>
          </aside>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Info icon={<Mountain className="text-acacia" />} t="Seven Forks catchment" d="Embu, Meru, Nyeri, Murang'a and Tharaka-Nithi drain into Masinga, Kamburu, Gitaru, Kindaruma and Kiambere. ECMWF puts 200–300 mm here in 15 days. When Masinga spills, Garissa has 36–48 hours." />
          <Info icon={<Wind className="text-tana" />} t="Ewaso Ng'iro → Lagh Dera" d="Rain on Mt Kenya's northern slopes (Nanyuki–Isiolo) runs down the Ewaso Ng'iro, through the Lorian swamp and into Lagh Dera across Garissa county towards Somalia. Flow reaches Habaswein and Modogashe 5–8 days after heavy rain upstream." />
          <Info icon={<Siren className="text-crest" />} t="The Somalia border" d="Most laghas here drain towards Somalia, not into Kenya. The risk on the border is local: very heavy storms from the tropical low that the AI models bring into southern Somalia, and water that lies for days on the flat ground around Dadaab, Hulugho, Liboi and Ijara." />
        </div>
      </Section>

      {/* ---------------------------------------------------------- live maps */}
      <Section id="live" title="Live maps and live model data" lead="These update on their own every time the page opens – no refresh needed from the county.">
        <div className="overflow-hidden rounded-2xl bg-night shadow-md">
          <div className="flex flex-wrap items-center gap-1.5 p-3 text-white">
            <span className="mr-1 text-[13px] font-semibold text-sand">Model</span>
            {WINDY_MODELS.map(([k, l]) => <button key={k} onClick={() => setModel(k)} className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${model === k ? 'bg-sand text-night' : 'bg-white/10 hover:bg-white/20'}`}>{l}</button>)}
            <span className="ml-3 mr-1 text-[13px] font-semibold text-sand">Show</span>
            {WINDY_OVERLAYS.map(([k, l]) => <button key={k} onClick={() => setOverlay(k)} className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${overlay === k ? 'bg-sand text-night' : 'bg-white/10 hover:bg-white/20'}`}>{l}</button>)}
            <a href={`https://www.windy.com/-${overlay}?${model},-0.45,39.65,6`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12px] text-white/75 hover:text-white">Open full screen <ExternalLink size={12} /></a>
          </div>
          <iframe key={windy} title="Live rainfall forecast map (Windy)" src={windy} className="block h-[520px] w-full border-0" loading="lazy" />
        </div>
        <p className="mt-1 text-[12px] text-muted">Live forecast map © Windy.com with ECMWF, NOAA GFS and DWD ICON data. Drag the timeline at the bottom to step through the coming days.</p>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-2"><span className="font-semibold">Live 16-day rain totals by place</span><span className="ml-auto text-[11px] text-muted">{live ? `Open-Meteo · fetched ${live.when}` : liveErr ? '' : 'loading…'}</span></div>
            {liveErr && <p className="text-[13px] text-muted">{liveErr}</p>}
            {live && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[460px] text-[13px]">
                  <thead><tr className="text-left text-muted"><th className="py-1">Place</th>{MODEL_LIVE.map(([m, l, c]) => <th key={m} className="py-1 text-right" style={{ color: c }}>{l}</th>)}</tr></thead>
                  <tbody>
                    {live.rows.map((r) => (
                      <tr key={r.p.name} className="border-t border-black/5">
                        <td className="py-1"><span className="font-medium">{r.p.name}</span><span className="block text-[11px] text-muted">{r.p.zone}</span></td>
                        {MODEL_LIVE.map(([m]) => <td key={m} className="py-1 text-right"><RainCell v={r.tot[m]} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="font-semibold">NOAA GFS week-1 and week-2 rain (live from NOAA CPC)</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[['week1_totp', 'Week 1 total'], ['week2_totp', 'Week 2 total']].map(([f, l]) => (
                <figure key={f} className="m-0">
                  <img src={`https://www.cpc.ncep.noaa.gov/products/african_desk/cpc_intl/eafrica/${f}.png`} alt={`NOAA GFS ${l} precipitation, East Africa`} className="w-full rounded-lg bg-paper" loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = f === 'week1_totp' ? './img/watch/noaa_gfs_week1.jpg' : './img/watch/noaa_gfs_week2.jpg' }} />
                  <figcaption className="text-[11px] text-muted">{l} – NOAA CPC African Desk</figcaption>
                </figure>
              ))}
            </div>
            {owm ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-tana-light p-3 text-[13px]">
                <CloudSun className="text-tana" />
                <span><b>Garissa now (OpenWeather):</b> {Math.round(owm.main?.temp)} °C, humidity {owm.main?.humidity}%, {owm.weather?.[0]?.description}{owm.rain?.['1h'] ? `, rain ${owm.rain['1h']} mm/h` : ''}</span>
              </div>
            ) : <p className="mt-3 text-[12px] text-muted">Add an OpenWeather key (below) to show current Garissa conditions and live OpenWeather rain/cloud layers on the map.</p>}
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- charts gallery */}
      <Section title="What each model says" lead="The original charts circulated on 3–4 October 2026, with what they mean for Garissa and the Seven Forks catchment. Tap a chart to enlarge it.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(w?.models || []).map((m: any) => (
            <article key={m.key} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5" style={{ borderTop: `5px solid ${m.color}` }}>
              <button onClick={() => setZoomImg({ src: `./img/${m.img}`, t: `${m.label} – ${m.run}` })} className="block"><img src={`./img/${m.img}`} alt={`${m.label} rainfall chart`} className="aspect-[4/3] w-full object-cover object-top" loading="lazy" /></button>
              <div className="flex-1 p-4">
                <div className="font-display text-lg font-bold">{m.label}</div>
                <div className="text-[12px] text-muted">{m.run}</div>
                <p className="mt-2 text-[14px]">{m.says}</p>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  <span className="rounded bg-paper px-1.5 py-0.5">Catchment {m.mm.catchment} mm</span>
                  <span className="rounded bg-paper px-1.5 py-0.5">Garissa {m.mm.garissa} mm</span>
                  <span className="rounded bg-paper px-1.5 py-0.5">Border {m.mm.border} mm</span>
                </div>
              </div>
            </article>
          ))}
          {[['ai_gfs_region.jpg', 'AI-GFS (region)', 'Tropical low moving from the Indian Ocean into southern Somalia, south Ethiopia and eastern Kenya over two weeks.'],
            ['ecmwf_aifs_region.jpg', 'ECMWF-AIFS (region)', 'Same tropical-low landfall signal: heavy rain belt along the equator into Somalia and eastern Kenya.'],
            ['noaa_gfs_week2.jpg', 'NOAA GFS week 2 (12–18 Oct)', 'Heavy rain along the Kenya–Somalia coast (200–500 mm offshore near Lamu/Kismayo), 30–90 mm across Kenya.'],
            ['aicon_7d.jpg', 'AI-enhanced ICON (7 days)', 'Moderate to heavy thunderstorms on the central highlands and Lake Victoria basin this week.']].map(([f, l, d]) => (
            <article key={f} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <button onClick={() => setZoomImg({ src: `./img/watch/${f}`, t: l })} className="block"><img src={`./img/watch/${f}`} alt={`${l} chart`} className="aspect-[4/3] w-full object-cover object-top" loading="lazy" /></button>
              <div className="p-4"><div className="font-display text-lg font-bold">{l}</div><p className="mt-1 text-[14px]">{d}</p></div>
            </article>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-muted">Charts shared by Kenya Weather Patterns Dynamics Agrometeorology; data © ECMWF, NOAA, DWD; map rendering Meteologix/weather.us (GIScience Heidelberg, OpenStreetMap). Zone values are CSG readings of the charts. Get the latest originals:
          {' '}<a className="underline" href="https://meteologix.com/ke/model-charts/euro/accumulated-precipitation.html" target="_blank" rel="noreferrer">Meteologix ECMWF Kenya</a> ·
          {' '}<a className="underline" href="https://www.cpc.ncep.noaa.gov/products/international/africa/africa.shtml" target="_blank" rel="noreferrer">NOAA CPC African Desk</a> ·
          {' '}<a className="underline" href="https://www.tropicaltidbits.com/analysis/models/" target="_blank" rel="noreferrer">Tropical Tidbits models</a> ·
          {' '}<a className="underline" href="https://meteo.go.ke" target="_blank" rel="noreferrer">KMD</a> · <a className="underline" href="https://www.icpac.net" target="_blank" rel="noreferrer">ICPAC</a></p>
      </Section>

      {/* ---------------------------------------------------------- community */}
      <Section title="Messages for the community" lead="Short, plain messages for chiefs, ward administrators, radio and WhatsApp groups.">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(['en', 'sw', 'so'] as const).map((l) => <button key={l} onClick={() => setMsgLang(l)} className={`rounded-md px-3 py-1 text-[13px] font-semibold ${msgLang === l ? 'bg-night text-white' : 'bg-paper ring-1 ring-black/10'}`}>{l === 'en' ? 'English' : l === 'sw' ? 'Kiswahili' : 'Af-Soomaali'}</button>)}
            <button onClick={copyMsg} className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-acacia px-3 py-1.5 text-[13px] font-semibold text-white">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy WhatsApp message'}</button>
          </div>
          <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
            {(w?.community?.[msgLang] || []).map((x: string, i: number) => (
              <li key={i} className="flex gap-3 rounded-xl bg-paper p-3 text-[15px]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand font-bold text-night">{i + 1}</span>{x}</li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ---------------------------------------------------------- live data setup */}
      <Section title="Switch on more live data" lead="The page already works with free live sources (Windy, Open-Meteo, NASA, NOAA). Two optional keys add more.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-2 font-semibold"><KeyRound size={18} className="text-tana" /> OpenWeather (live rain & cloud layers, current conditions)</div>
            <ol className="mt-2 space-y-1 pl-5 text-[14px]">
              <li>Create a free account: <a className="underline" href="https://home.openweathermap.org/users/sign_up" target="_blank" rel="noreferrer">home.openweathermap.org/users/sign_up</a></li>
              <li>Copy your key: <a className="underline" href="https://home.openweathermap.org/api_keys" target="_blank" rel="noreferrer">home.openweathermap.org/api_keys</a> (new keys take up to 2 hours to start working)</li>
              <li>Paste it here for this device, or ask ICT to add it for everyone (step 4).</li>
              <li>For everyone: open <a className="underline" href="https://github.com/jmsmuigai/Garissa-County-Steering-Group-Portal/edit/main/docs/portal-config.json" target="_blank" rel="noreferrer">docs/portal-config.json on GitHub</a>, paste between the quotes of <code>openWeatherApiKey</code>, press <i>Commit changes</i>. The site updates in about a minute.</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <input id="owm-key" type="password" autoComplete="off" value={owmIn} onChange={(e) => setOwmIn(e.target.value)} placeholder={getOwmKey() ? '•••••• (key active)' : 'Paste OpenWeather key – optional'} className="sel max-w-xs flex-1" />
              <button onClick={async () => { if (owmIn.trim()) setOwmKey(owmIn); setOwmMsg('Testing…'); try { const ok = await loadOwm(); setOwmMsg(ok ? 'Connected. Turn on the OpenWeather layers in Map layers → El Niño Watch.' : 'Paste a key first.'); setOwmIn('') } catch (e: any) { setOwmKey(''); setOwmMsg(`OpenWeather refused the key: ${e?.message || e}`) } }} className="btn-dl bg-tana text-white">Save & test</button>
            </div>
            {owmMsg && <p className="mt-2 text-[13px] text-muted">{owmMsg}</p>}
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-2 font-semibold"><KeyRound size={18} className="text-crest" /> Gemini (AI assistant, translation)</div>
            <ol className="mt-2 space-y-1 pl-5 text-[14px]">
              <li>Get a key (sign in with your personal Gmail, in a private window if you see "permission denied"): <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> → <i>Create API key → in new project</i>.</li>
              <li>Restrict it: <a className="underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">console.cloud.google.com/apis/credentials</a> → the key → Website restrictions <code>https://jmsmuigai.github.io/*</code>, API restriction <i>Generative Language API</i>.</li>
              <li>For everyone: <a className="underline" href="https://github.com/jmsmuigai/Garissa-County-Steering-Group-Portal/edit/main/docs/portal-config.json" target="_blank" rel="noreferrer">edit docs/portal-config.json</a> → paste into <code>geminiApiKey</code> → <i>Commit changes</i>.</li>
              <li>Or just for this device: open the assistant (bottom right) → key icon → paste → <i>Save & test</i>.</li>
            </ol>
          </div>
        </div>
      </Section>

      <Section title="Sources">
        <ul className="list-disc space-y-1 pl-6 text-[14px] text-muted">
          <li>Kenya Weather Patterns Dynamics Agrometeorology – Kenya weekly weather forecast 05–11 Oct 2026 and week-2 extension (ICON, GFS, ECMWF).</li>
          <li>ECMWF IFS HRES and ECMWF-AIFS; NOAA GFS and NOAA CPC African Desk week-1/week-2 totals; DWD ICON; US AI-GFS – charts of 3 Oct 2026.</li>
          <li>Live: <a className="underline" href="https://www.windy.com" target="_blank" rel="noreferrer">Windy.com</a>, <a className="underline" href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a> (ECMWF, AIFS, GFS, ICON), NASA GPM IMERG via GIBS, OpenWeather (when a key is added).</li>
          <li>Flood evidence: UNOSAT flood extents Nov 2023 and Apr–May 2024; county field photos; WRA gauge 4G01 thresholds; KenGen Seven Forks figures.</li>
          <li>Simulation: CSG Python model (backend/app/watch.py and forecast.py) – decision support only. Follow official <a className="underline" href="https://meteo.go.ke" target="_blank" rel="noreferrer">KMD</a>, WRA and <a className="underline" href="https://www.ndma.go.ke" target="_blank" rel="noreferrer">NDMA</a> warnings.</li>
        </ul>
      </Section>

      {/* ---------------------------------------------------------- deeper analysis (1 Oct issue) */}
      <div className="border-t-4 border-sand/60 bg-white/40">
        <Section title="Deeper analysis" lead="Seasonal background, the 1 October model showdown, Python ensemble odds, live model runs and the three-month outlook."><span /></Section>
        <ElNino embedded />
      </div>

      {zoomImg && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={zoomImg.t} onClick={() => setZoomImg(null)}>
          <figure className="m-0 max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <img src={zoomImg.src} alt={zoomImg.t} className="max-h-[85vh] w-auto rounded-lg" />
            <figcaption className="mt-2 text-white">{zoomImg.t}</figcaption>
          </figure>
          <button aria-label="Close" onClick={() => setZoomImg(null)} className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white"><X /></button>
        </div>
      )}
    </>
  )
}

function Big({ n, l, c }: { n: string; l: string; c: string }) {
  return <div className="rounded-xl bg-white/8 p-3 ring-1 ring-white/10"><div className="font-display text-2xl font-extrabold tabular" style={{ color: c }}>{n}</div><div className="text-[12px] leading-snug text-white/75">{l}</div></div>
}
function Exp({ i, n, l }: { i: React.ReactNode; n: number; l: string }) {
  return <div className="rounded-lg bg-paper py-1"><div className="flex items-center justify-center gap-1 font-bold tabular">{i}{n}</div><div className="text-muted">{l}</div></div>
}
function Kv({ k, v }: { k: string; v: any }) {
  return <div className="rounded-lg bg-paper px-2 py-1"><div className="text-[11px] text-muted">{k}</div><div className="font-display text-lg font-bold tabular">{v}</div></div>
}
function Info({ icon, t, d }: { icon: React.ReactNode; t: string; d: string }) {
  return <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"><div className="flex items-center gap-2 font-semibold">{icon}{t}</div><p className="mt-1 text-[14px] text-muted">{d}</p></div>
}
function RainCell({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted">–</span>
  const c = v >= 200 ? '#6a1b9a' : v >= 100 ? '#c81d25' : v >= 50 ? '#f28c28' : v >= 20 ? '#f2c230' : v >= 5 ? '#64b5f6' : '#cfd8dc'
  return <span className="inline-block min-w-[46px] rounded px-1.5 py-0.5 text-center font-semibold tabular" style={{ background: c, color: v >= 50 ? '#fff' : '#142338' }}>{v}</span>
}

// cross-section of the Tana at Garissa: bank, farm terrace and water level for a gauge stage
function RiverGlyph({ stage }: { stage: number }) {
  const H = 90, y = (m: number) => H - 8 - (m / 8) * (H - 16)
  const lv = levelFor(stage)
  return (
    <svg viewBox={`0 0 300 ${H}`} className="block w-full bg-[#eaf4f4]" role="img" aria-label={`River level ${stage} metres`}>
      <path d={`M0 ${y(6.5)} L60 ${y(6.5)} L90 ${y(4.2)} L120 ${y(0)} L180 ${y(0)} L210 ${y(4.2)} L240 ${y(5.2)} L300 ${y(5.4)} L300 ${H} L0 ${H} Z`} fill="#c8a875" />
      <rect x="0" y={y(stage)} width="300" height={H - y(stage)} fill={LEVEL_COLORS[lv]} opacity="0.35" />
      <path d={`M0 ${y(stage)} L300 ${y(stage)}`} stroke={LEVEL_COLORS[lv]} strokeWidth="2" />
      <path d={`M0 ${y(6.5)} L60 ${y(6.5)} L90 ${y(4.2)} L120 ${y(0)} L180 ${y(0)} L210 ${y(4.2)} L240 ${y(5.2)} L300 ${y(5.4)}`} fill="none" stroke="#7a5a2a" strokeWidth="1.5" />
      <text x="248" y={y(5.4) - 4} fontSize="9" fill="#3e7d3a">farms</text>
      <text x="6" y={y(6.5) - 4} fontSize="9" fill="#7a2614">town side</text>
      <text x="126" y={Math.min(H - 4, y(stage) + 12)} fontSize="10" fontWeight="700" fill="#142338">{stage.toFixed(1)} m</text>
    </svg>
  )
}
