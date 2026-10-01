import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine, BarChart, Bar, Cell, AreaChart, Area, ReferenceArea } from 'recharts'
import { CloudRain, Radio, Gauge, Quote, ExternalLink, FlaskConical } from 'lucide-react'
import { PageHero, Section, Figure, TranslatePage, Pill } from '../components/ui'
import { getJSON, liveModels, backendAvailable, DATA } from '../lib/api'
import { LEVEL_COLORS } from '../lib/store'
import StaffGauge from '../components/StaffGauge'

const RISK_C: Record<string, string> = { 'Very High': '#c81d25', High: '#f28c28', Moderate: '#f2c230', Low: '#2e9e4f' }

export default function ElNino() {
  const [fc, setFc] = useState<any>(null)
  const [live, setLive] = useState<any>(null)
  const [liveG, setLiveG] = useState<any>(null)
  const [fill, setFill] = useState(90)
  const [tana, setTana] = useState<any>(null)
  useEffect(() => {
    getJSON('/api/forecast').then((d) => { setFc(d); setTana(d.tana) })
    liveModels(-0.53, 37.45).then(setLive).catch(() => setLive({ dates: [], models: [] }))
    liveModels(-0.4532, 39.6461).then(setLiveG).catch(() => setLiveG({ dates: [], models: [] }))
  }, [])
  useEffect(() => {
    if (!fc) return
    ;(async () => {
      if (await backendAvailable()) { const r = await fetch(`./api/forecast/tana?masinga_fill_pct=${fill}`); if (r.ok) { setTana(await r.json()); return } }
      const r = await fetch(DATA(`api/tana_fill_${fill}.json`)); if (r.ok) setTana(await r.json())
    })()
  }, [fill, fc])

  const tanaSeries = useMemo(() => {
    if (!tana) return []
    return tana.blend.series.map((r: any, i: number) => ({
      t: r.time.slice(5, 13).replace('T', ' '), blend: r.stage_m, ecmwf: tana.ecmwf.series[i].stage_m, usai: tana.usai.series[i].stage_m,
      gfs: tana.gfs.series[i].stage_m, aifs: tana.aifs.series[i].stage_m, kmd: tana.kmd.series[i].stage_m, x700: tana.extreme700.series[i].stage_m,
    }))
  }, [tana])
  const ond = useMemo(() => {
    if (!fc) return []
    const o = fc.ond
    return o.dates.map((d: string, i: number) => ({
      d: d.slice(5), normal: o.scenarios.normal.p50[i], above: o.scenarios.above.p50[i], elnino: o.scenarios.elnino.p50[i],
      band: [o.scenarios.elnino.p10[i], o.scenarios.elnino.p90[i]], bandA: [o.scenarios.above.p10[i], o.scenarios.above.p90[i]],
    }))
  }, [fc])
  const liveRows = (L: any) => L?.dates?.map((d: string, i: number) => Object.fromEntries([['d', d.slice(5)], ...L.models.map((m: any) => [m.label, m.cum[i]])])) || []
  const COLORS = ['#e53935', '#00897b', '#1e88e5', '#fb8c00', '#6d4c41']

  return (
    <>
      <PageHero img="./img/elnino_global_2026.jpg" title="El Niño early warning" lead="The Pacific is warm and the Indian Ocean dipole is positive – the same mix that flooded Garissa in 1997 and 2023. Here is what every major model says, run through Python models of the Upper Tana and the River Tana at Garissa." tone="crest" />
      <TranslatePage targetId="en-body" />
      <div id="en-body">
        <Section title="What is El Niño, and why does it flood Garissa?">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div className="prose-csg text-lg">
              <p data-tr>El Niño is the warm phase of the El Niño–Southern Oscillation. When the central and eastern Pacific warm up, the global Walker circulation shifts and East Africa's October–December "short rains" become much heavier. When this coincides with a positive Indian Ocean Dipole – warm water off the Kenyan coast, cool water near Indonesia – moist air piles up over Kenya.</p>
              <p data-tr>Garissa floods in two ways. Heavy rain on Mt Kenya and the Aberdares fills the Seven Forks dams; when Masinga spills, a flood wave reaches Garissa 36–48 hours later and the Tana bursts its banks. Separately, intense local storms turn dry laghas into torrents within hours, cutting roads and flooding Garissa Town, Dadaab and Modogashe.</p>
              <p data-tr>In 1997/98 this produced one of the largest Rift Valley fever epidemics ever recorded, centred on Garissa. In November 2023 UNOSAT mapped about 244,000 hectares of flood water across the county.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Figure src="./img/elnino_mechanism.jpg" caption="How El Niño shifts rainfall over East Africa" credit="CSG illustration" />
              <Figure src="./img/iod_infographic.jpg" caption="Positive vs negative Indian Ocean Dipole" credit="CSG illustration" />
              <div className="sm:col-span-2"><Figure src="./img/kmd_october_2026_map.jpg" caption="KMD October 2026 rainfall forecast – above average for Garissa and the coast" credit="Kenya Meteorological Department" /></div>
            </div>
          </div>
        </Section>

        <Section title="The model showdown" lead="14-day rainfall guidance for the Eastern highlands (Upper Tana catchment) issued 1 October 2026. The Upper Tana is what drives River Tana floods in Garissa.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {(fc?.ensemble.models || []).map((m: any) => (
              <div key={m.key} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5" style={{ borderTop: `6px solid ${m.color}` }}>
                <div className="text-sm font-semibold text-muted">{m.label}</div>
                <div className="mt-1 font-display text-4xl font-extrabold tabular" style={{ color: m.color }}>{m.total_mm}<span className="text-lg"> mm</span></div>
                <div className="mt-1 text-[15px]">{m.character}</div>
                <div className="mt-2 text-xs text-muted">Ensemble weight {Math.round(m.weight * 100)}%</div>
              </div>
            ))}
          </div>
          <figure className="m-0 mt-6 flex gap-4 rounded-2xl bg-night p-6 text-white">
            <Quote className="shrink-0 text-sand" size={36} />
            <div>
              <p className="m-0 text-lg" data-tr>"Looking ahead, the European model is hyper-aggressive together with the US AI model, predicting catastrophic flooding rains of up to 350 mm in the next two weeks. The American model and the AI-enhanced European model are more modest at up to 100 mm in the Eastern highlands and coastal Kenya. My hunch is that the European model and the US AI are correct – we are in a monster El Niño season. Odds of extreme rain are greater than 50%; even totals of 700 mm in the next two weeks are possible, and the 100 mm in the American model may be exceeded in a single day at the demo farm."</p>
              <figcaption className="mt-3 text-sand">Field assessment, Director of ICT & GIS, County Government of Garissa – 1 October 2026</figcaption>
            </div>
          </figure>
        </Section>

        <Section>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Cumulative rain by model – next 14 days (mm)" icon={<CloudRain />}>
              <ResponsiveContainer>
                <LineChart data={fc?.ensemble.series || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e6" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {(fc?.ensemble.models || []).map((m: any) => <Line key={m.key} dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2.5} dot={false} />)}
                  <Line dataKey="blend" name="Weighted blend" stroke="#142338" strokeWidth={3.5} strokeDasharray="6 4" dot={false} />
                  <ReferenceLine y={100} stroke="#1e88e5" strokeDasharray="2 4" label={{ value: '100 mm', fontSize: 11, position: 'insideTopLeft' }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Chance of exceeding each 14-day total (Monte-Carlo, 20,000 runs)" icon={<FlaskConical />}>
              <ResponsiveContainer>
                <BarChart data={fc ? Object.entries(fc.ensemble.exceedance_pct).map(([k, v]) => ({ k: `> ${k} mm`, v })) : []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e6" />
                  <XAxis dataKey="k" tick={{ fontSize: 13 }} />
                  <YAxis unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="v" radius={[6, 6, 0, 0]} label={{ position: 'top', formatter: (v: any) => `${v}%`, fontSize: 13, fontWeight: 700 }}>
                    {[0, 1, 2, 3, 4].map((i) => <Cell key={i} fill={['#f2c230', '#f28c28', '#e4572e', '#c81d25', '#7a2614'][i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </Section>

        <Section title="Live model runs (auto-updating)" lead="Pulled directly from Open-Meteo each time this page opens: the latest ECMWF, AI-ECMWF (AIFS), GFS, ICON and UK Met Office runs.">
          <div className="grid gap-6 lg:grid-cols-2">
            {[['Upper Tana (Embu) – cumulative rain, mm', live], ['Garissa Town – cumulative rain, mm', liveG]].map(([title, L]: any) => (
              <ChartCard key={title} title={title} icon={<Radio />}>
                {L && L.models.length ? (
                  <ResponsiveContainer>
                    <LineChart data={liveRows(L)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e6" />
                      <XAxis dataKey="d" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      {L.models.map((m: any, i: number) => <Line key={m.model} dataKey={m.label} stroke={COLORS[i % 5]} strokeWidth={2.5} dot={false} />)}
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="flex h-full items-center justify-center p-6 text-center text-muted">{L ? 'Live model feed is not reachable from this network. The Python ensemble above still works offline.' : 'Loading live runs…'}</div>}
              </ChartCard>
            ))}
          </div>
        </Section>

        <Section title="What it means for the River Tana at Garissa" lead="Python hydrology: SCS curve-number runoff on the 7,300 km² Masinga catchment → Masinga storage and spill → Muskingum routing with a 40-hour lag → compound rating curve at the Garissa gauge.">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <ChartCard title="Forecast river stage at Garissa (m)" icon={<Gauge />} tall>
              <div className="mb-2 flex flex-wrap items-center gap-3 text-[15px]">
                <label htmlFor="fill" className="font-semibold">Masinga Dam starting level: {fill}% full</label>
                <input id="fill" type="range" min={70} max={100} step={5} value={fill} onChange={(e) => setFill(+e.target.value)} className="w-48 accent-[#0e7c86]" />
                <span className="text-sm text-muted">Get the current level from KenGen and set it here.</span>
              </div>
              <ResponsiveContainer height="88%">
                <LineChart data={tanaSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e6" />
                  <ReferenceArea y1={4} y2={5} fill="#f28c28" fillOpacity={0.08} />
                  <ReferenceArea y1={5} y2={6.2} fill="#e4572e" fillOpacity={0.1} />
                  <ReferenceArea y1={6.2} y2={9} fill="#c81d25" fillOpacity={0.1} />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} interval={7} />
                  <YAxis domain={[1, 8]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={4} stroke="#f28c28" label={{ value: 'Alert 4.0', fontSize: 11, position: 'right' }} />
                  <ReferenceLine y={5} stroke="#e4572e" label={{ value: 'Alarm 5.0', fontSize: 11, position: 'right' }} />
                  <ReferenceLine y={6.2} stroke="#c81d25" label={{ value: 'Emergency 6.2', fontSize: 11, position: 'right' }} />
                  <Line dataKey="usai" name="US AI (350 mm)" stroke="#8e24aa" strokeWidth={2.5} dot={false} />
                  <Line dataKey="ecmwf" name="ECMWF (350 mm)" stroke="#e53935" strokeWidth={2.5} dot={false} />
                  <Line dataKey="blend" name="Weighted blend" stroke="#142338" strokeWidth={3} strokeDasharray="6 4" dot={false} />
                  <Line dataKey="gfs" name="GFS (100 mm)" stroke="#1e88e5" strokeWidth={2} dot={false} />
                  <Line dataKey="x700" name="Extreme 700 mm" stroke="#7a2614" strokeWidth={2} strokeDasharray="2 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <div className="flex flex-col gap-3">
              {tana && <StaffGauge light stage={tana.usai.peak_stage_m} forecast={{ stage: tana.ecmwf.peak_stage_m, label: 'ECMWF peak' }} height={280} />}
              {tana && ['usai', 'ecmwf', 'blend', 'gfs', 'extreme700'].map((k) => (
                <div key={k} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-black/5" style={{ width: 190 }}>
                  <span className="font-semibold">{{ usai: 'US AI', ecmwf: 'ECMWF', blend: 'Blend', gfs: 'GFS', extreme700: '700 mm' }[k]}</span>
                  <span className="tabular">{tana[k].peak_stage_m} m</span>
                  <span className="rounded px-1.5 text-xs font-bold text-white" style={{ background: LEVEL_COLORS[tana[k].level] }}>{tana[k].level}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="The next three months for Garissa" lead="Stochastic daily-rainfall model (500 runs per scenario) scaled to Garissa Met Station climatology: normal October–December totals are about 180 mm.">
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <ChartCard title="Cumulative rain at Garissa, Oct–Dec 2026 (median and 10–90% range, mm)" icon={<CloudRain />} tall>
              <ResponsiveContainer>
                <AreaChart data={ond}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e6" />
                  <XAxis dataKey="d" tick={{ fontSize: 11 }} interval={9} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => (Array.isArray(v) ? `${v[0]}–${v[1]} mm` : `${v} mm`)} />
                  <Legend />
                  <Area dataKey="band" name="El Niño 10–90%" stroke="none" fill="#d32f2f" fillOpacity={0.15} />
                  <Area dataKey="bandA" name="Above-average 10–90%" stroke="none" fill="#ffb300" fillOpacity={0.18} />
                  <Area dataKey="elnino" name="Strong El Niño (median)" stroke="#d32f2f" strokeWidth={3} fill="none" />
                  <Area dataKey="above" name="KMD above-average (median)" stroke="#ffb300" strokeWidth={3} fill="none" />
                  <Area dataKey="normal" name="Normal (median)" stroke="#90a4ae" strokeWidth={2.5} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h3 className="text-lg font-bold">Median monthly totals (mm)</h3>
              <table className="mt-3 w-full text-[15px]">
                <thead><tr className="text-left text-muted"><th className="py-1">Scenario</th><th>Oct</th><th>Nov</th><th>Dec</th><th>P(&gt;300)</th></tr></thead>
                <tbody>{fc && Object.entries(fc.ond.scenarios).map(([k, s]: any) => (
                  <tr key={k} className="border-t border-black/5"><td className="py-2"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: s.color }} />{s.label}</td>
                    <td className="tabular">{s.monthly_median['10']}</td><td className="tabular">{s.monthly_median['11']}</td><td className="tabular">{s.monthly_median['12']}</td><td className="tabular">{s.prob_gt_300}%</td></tr>
                ))}</tbody>
              </table>
              <p className="mt-4 text-sm text-muted">KMD expects onset in the 1st–2nd week of October and cessation in the 1st–2nd week of December, with warmer-than-average temperatures (max 23–39 °C).</p>
            </div>
          </div>
        </Section>

        <Section title="How each sub-county is likely to be affected">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(fc?.impacts || []).map((s: any) => (
              <div key={s.name} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <h3 className="text-xl font-bold">{s.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <Pill color={RISK_C[s.riverine]}>River {s.riverine}</Pill>
                  <Pill color={RISK_C[s.flash]}>Flash {s.flash}</Pill>
                  <Pill color={RISK_C[s.health]}>Health {s.health}</Pill>
                </div>
                <p className="mt-3 text-[15px] text-muted" data-tr>{s.notes}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Official sources">
          <div className="flex flex-wrap gap-3">
            {[['KMD forecasts', 'https://meteo.go.ke'], ['ICPAC (IGAD) outlook', 'https://www.icpac.net'], ['NOAA ENSO status', 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/'], ['GloFAS flood forecasts', 'https://global-flood.emergency.copernicus.eu'], ['FEWS NET Kenya', 'https://fews.net/east-africa/kenya'], ['Open-Meteo models', 'https://open-meteo.com']].map(([t, u]) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold shadow-sm ring-1 ring-black/5 hover:ring-tana">{t} <ExternalLink size={15} /></a>
            ))}
          </div>
          <p className="mt-6 max-w-4xl text-sm text-muted">{fc?.disclaimer} Model totals for ECMWF, US AI, GFS and AIFS are the 14-day values stated in the CSG model review of 1 Oct 2026; KMD statements are from KMD/FCST/04-2026/MO/10 (30 Sep 2026) and MET/GAR/WKLY/FCST/16 (28 Sep 2026).</p>
        </Section>
      </div>
    </>
  )
}

function ChartCard({ title, icon, children, tall }: { title: string; icon: React.ReactNode; children: React.ReactNode; tall?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-bold"><span className="text-tana">{icon}</span>{title}</h3>
      <div className={tall ? 'h-[440px]' : 'h-[340px]'}>{children}</div>
    </div>
  )
}
