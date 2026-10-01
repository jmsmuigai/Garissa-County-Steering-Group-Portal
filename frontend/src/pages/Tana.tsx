import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from 'recharts'
import { Clock, Droplets, Zap, MapPin } from 'lucide-react'
import { PageHero, Section, Stat, Figure } from '../components/ui'
import SmartMap from '../components/SmartMap'
import StaffGauge from '../components/StaffGauge'
import { getJSON, backendAvailable, DATA, geo } from '../lib/api'
import { LEVEL_COLORS } from '../lib/store'

const SCN: { k: string; label: string; color: string }[] = [
  { k: 'ecmwf', label: 'ECMWF', color: '#7a2614' },
  { k: 'usai', label: 'US AI', color: '#c81d25' },
  { k: 'blend', label: 'CSG blend', color: '#0e7c86' },
  { k: 'gfs', label: 'GFS', color: '#3e7d3a' },
  { k: 'extreme700', label: 'Director 700 mm', color: '#6a1b9a' },
]

export default function Tana() {
  const [dams, setDams] = useState<any[]>([])
  const [marks, setMarks] = useState<any[]>([])
  const [tana, setTana] = useState<any>(null)
  const [fill, setFill] = useState(90)
  const [scn, setScn] = useState('ecmwf')

  useEffect(() => {
    geo('seven_forks_dams.geojson').then((g) => setDams(g.features.map((f: any) => f.properties).sort((a: any, b: any) => a.order - b.order)))
    geo('tana_travel_markers.geojson').then((g) => setMarks(g.features.map((f: any) => f.properties)))
    getJSON('/api/forecast').then((d) => setTana(d.tana)).catch(() => {})
  }, [])
  useEffect(() => {
    ;(async () => {
      try {
        if (await backendAvailable()) { const r = await fetch(`./api/forecast/tana?masinga_fill_pct=${fill}`); if (r.ok) { setTana(await r.json()); return } }
        const r = await fetch(DATA(`api/tana_fill_${fill}.json`)); if (r.ok) setTana(await r.json())
      } catch { /* keep last */ }
    })()
  }, [fill])

  const chart = useMemo(() => {
    if (!tana?.blend) return []
    return tana.blend.series.map((p: any, i: number) => {
      const row: any = { t: p.time.slice(5, 13).replace('T', ' ') + 'h' }
      SCN.forEach((s) => { if (tana[s.k]) row[s.k] = tana[s.k].series[i]?.stage_m })
      return row
    })
  }, [tana])
  const cur = tana?.[scn]
  const maxH = 120

  return (
    <>
      <PageHero img="./img/masinga_spillway.jpg" tone="tana" title="When Masinga spills, Garissa has about 42 hours" lead="The River Tana is Garissa's lifeline and its biggest flood threat. Five Seven Forks dams sit upstream; when the cascade fills, a flood wave reaches Garissa farms in 36–48 hours and the Tana Delta in 4–5 days.">
        <a href="#travel" className="rounded-xl bg-sand px-5 py-3 font-semibold text-night">See flood travel times</a>
        <a href="#forecast" className="rounded-xl bg-white/15 px-5 py-3 font-semibold hover:bg-white/25">Gauge forecast</a>
      </PageHero>

      <Section title="The Seven Forks cascade" lead="Indicative storage and turbine capacity from KenGen published figures. Masinga is the regulating reservoir: once it reaches full supply level (~1,056.5 m) inflows pass straight downstream.">
        <div className="relative overflow-x-auto rounded-3xl bg-gradient-to-b from-[#dff1f2] to-[#f6f8f7] p-6 ring-1 ring-black/5">
          <div className="flex min-w-[860px] items-end gap-4">
            {dams.map((d, i) => {
              const h = 70 + Math.sqrt(d.storage_mcm) * 4
              const pct = i === 0 ? Math.min(100, fill) : 96
              return (
                <div key={d.name} className="flex flex-1 flex-col items-center" style={{ marginTop: i * 18 }}>
                  <div className="relative w-full overflow-hidden rounded-t-xl rounded-b-md bg-white ring-2 ring-night/20" style={{ height: h }}>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-tana-deep to-tana transition-all duration-700" style={{ height: `${pct}%` }} />
                    {pct >= 99 && <div className="absolute inset-x-0 top-0 animate-pulse bg-emergency py-0.5 text-center text-xs font-bold text-white">SPILLING</div>}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white drop-shadow">
                      <span className="font-display text-2xl font-extrabold tabular">{d.storage_mcm.toLocaleString()}</span>
                      <span className="text-xs">MCM</span>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <div className="font-display text-lg font-bold">{d.name}</div>
                    <div className="flex items-center justify-center gap-1 text-sm text-muted"><Zap size={14} /> {d.capacity_mw} MW · {d.commissioned}</div>
                  </div>
                </div>
              )
            })}
            <div className="flex flex-col items-center pb-10 text-tana-deep">
              <Droplets size={40} />
              <span className="mt-1 font-semibold">to Garissa</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5">
            <label htmlFor="fill" className="font-semibold">Masinga fill at start of season</label>
            <input id="fill" type="range" min={70} max={100} step={5} value={fill} onChange={(e) => setFill(+e.target.value)} className="w-56 accent-tana" />
            <span className="font-display text-2xl font-bold tabular text-tana-deep">{fill}%</span>
            <span className="text-muted">A fuller reservoir leaves less room to absorb El Niño runoff, so the wave arrives sooner and higher.</span>
          </div>
        </div>
      </Section>

      <Section id="travel" title="Flood wave travel time" lead="Hours after a release or spill at Kiambere (the last dam) for the wave front to arrive. Ranges reflect flow volume and floodplain storage; use the lower bound for warnings.">
        <div className="rounded-3xl bg-night p-6 text-white">
          <div className="relative mx-4 h-28">
            <div className="absolute left-0 right-0 top-[52px] h-2 rounded-full bg-gradient-to-r from-tana via-sand to-crest" />
            {marks.map((m, i) => {
              const garissa = m.name.startsWith('Garissa')
              const up = i % 2 === 0
              return (
                <div key={m.name} className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: `${(m.travel_h / maxH) * 100}%`, top: up ? 0 : 44 }}>
                  {up && <span className={`mb-1 whitespace-nowrap font-display font-bold tabular ${garissa ? 'text-xl text-sand' : 'text-base'}`}>{m.travel_h} h</span>}
                  <span className={`h-5 w-5 rounded-full border-4 border-night ${garissa ? 'scale-150 bg-sand' : 'bg-white'}`} style={up ? { marginTop: 4 } : {}} />
                  {!up && <span className={`mt-1 whitespace-nowrap font-display font-bold tabular ${garissa ? 'text-xl text-sand' : 'text-base'}`}>{m.travel_h} h</span>}
                </div>
              )
            })}
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {marks.map((m) => {
              const garissa = m.name.startsWith('Garissa')
              return (
                <li key={m.name} className={`rounded-xl p-3 ${garissa ? 'bg-sand text-night' : 'bg-white/8'}`}>
                  <div className="font-display text-2xl font-extrabold tabular">{m.travel_range}</div>
                  <div className="font-semibold leading-tight">{m.name}</div>
                  <div className={`text-sm ${garissa ? 'text-night/70' : 'text-white/60'}`}>{m.river_km} river-km below Masinga</div>
                </li>
              )
            })}
          </ol>
          <p className="mt-4 flex items-center gap-2 text-white/80"><Clock size={18} className="text-sand" /> Rule of thumb for the CSG: when KenGen announces a Masinga spill, riverine farms in Balambala, Garissa Township and Fafi have one and a half to two days to move people, livestock and pumps.</p>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <Figure src="./img/map_seven_forks_to_garissa.jpg" caption="Seven Forks to Garissa flood routing map" credit="Garissa ICT & GIS" />
          <Figure src="./img/seven_forks_cascade.jpg" caption="Seven Forks hydropower cascade" credit="Illustrative" />
          <Figure src="./img/field_river_gauge.jpg" caption="River Tana staff gauge at Garissa (RGS 4G01)" credit="County field photo" />
        </div>
      </Section>

      <Section id="forecast" title="River Tana gauge forecast at Garissa" lead="Python hydrology chain: model rainfall → SCS-CN runoff on the 7,300 km² Masinga catchment → reservoir routing → Muskingum routing (K 30 h) → Garissa rating curve.">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="h-[380px]">
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ left: 0, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e7" />
                  <XAxis dataKey="t" interval={7} tick={{ fontSize: 12 }} />
                  <YAxis unit=" m" domain={[0, 8]} tick={{ fontSize: 13 }} />
                  <Tooltip formatter={(v: any) => `${v} m`} />
                  <Legend />
                  <ReferenceLine y={4} stroke={LEVEL_COLORS.ALERT} strokeDasharray="6 3" label={{ value: 'Alert 4.0', fill: LEVEL_COLORS.ALERT, fontSize: 12, position: 'insideTopLeft' }} />
                  <ReferenceLine y={5} stroke={LEVEL_COLORS.ALARM} strokeDasharray="6 3" label={{ value: 'Alarm 5.0', fill: LEVEL_COLORS.ALARM, fontSize: 12, position: 'insideTopLeft' }} />
                  <ReferenceLine y={6.2} stroke={LEVEL_COLORS.EMERGENCY} strokeDasharray="6 3" label={{ value: 'Emergency 6.2', fill: LEVEL_COLORS.EMERGENCY, fontSize: 12, position: 'insideTopLeft' }} />
                  {SCN.map((s) => <Line key={s.k} dataKey={s.k} name={s.label} stroke={s.color} dot={false} strokeWidth={scn === s.k ? 4 : 2} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SCN.map((s) => (
                <button key={s.k} onClick={() => setScn(s.k)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${scn === s.k ? 'text-white' : 'bg-paper text-ink'}`} style={scn === s.k ? { background: s.color } : {}}>{s.label}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            {cur && <StaffGauge stage={cur.series[0]?.stage_m ?? null} forecast={{ stage: cur.peak_stage_m, label: `${SCN.find((s) => s.k === scn)?.label} peak`, time: cur.peak_time?.replace('T', ' ') }} light />}
            {cur && (
              <div className="grid w-full gap-3">
                <Stat value={`${cur.peak_stage_m} m`} label="Peak gauge" color={LEVEL_COLORS[cur.level] || '#0e7c86'} note={cur.level} />
                <Stat value={`${cur.peak_discharge_m3s.toLocaleString()} m³/s`} label="Peak discharge" />
                <Stat value={`${cur.spill_days} days`} label="Masinga spilling" color="#7a2614" note={cur.first_alert_time ? `First ALERT ${cur.first_alert_time.replace('T', ' ')}` : 'Stays below ALERT'} />
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="The Tana's blind folds" lead="Sharp meanders where the river can jump its bank, cut a new channel and surprise riverine farms. Toggle the 'River Tana blind folds' layer to see all 12 hotspots and the 0.5–5 km buffers with the assets inside.">
        <SmartMap compact height="70vh" focus="all" showGauge={false} initial={['county', 'tana', 'upper_tana', 'catchment', 'dams', 'travel', 'blindfolds', 'tana_buffers']} />
        <p className="mt-3 flex items-center gap-2 text-muted"><MapPin size={18} /> Need to know if your farm is inside a buffer? Use <Link to="/" className="font-semibold text-tana-deep underline">Am I at risk?</Link> on the risk map.</p>
      </Section>

      <Section title="Sources">
        <ul className="list-disc space-y-1 pl-6 text-muted">
          <li>KenGen Seven Forks cascade fact sheets (storage, MW, full supply levels) – indicative values.</li>
          <li>Water Resources Authority gauge RGS 4G01 (Garissa) – thresholds used by the CSG contingency plan.</li>
          <li>HydroSHEDS / HydroRIVERS river network (Lehner & Grill 2013) – used to trace the 708 km Masinga→Delta channel.</li>
          <li>Travel times calibrated against 1997/98, 2006, 2018 and 2023 flood records reported by NDMA and the Kenya Red Cross.</li>
          <li>Global Flood Awareness System (GloFAS, Copernicus) for independent discharge checks: <a className="underline" href="https://www.globalfloods.eu" target="_blank" rel="noreferrer">globalfloods.eu</a>.</li>
        </ul>
      </Section>
    </>
  )
}
