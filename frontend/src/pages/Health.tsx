import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { ShieldCheck, Bug, Droplet, Hospital } from 'lucide-react'
import { PageHero, Section, Stat, Figure, Pill, TranslatePage } from '../components/ui'
import SmartMap from '../components/SmartMap'
import { getJSON, geo } from '../lib/api'

const LV: Record<string, string> = { 'Very High': '#c81d25', High: '#e4572e', Moderate: '#f2a03d', Low: '#2e9e4f' }
const SCEN = [
  { k: 'elnino', label: 'El Niño (×3.2)' },
  { k: 'above', label: 'Above normal (×1.6)' },
  { k: 'normal', label: 'Normal OND' },
]

export default function Health() {
  const [scn, setScn] = useState('elnino')
  const [d, setD] = useState<any>(null)
  const [sel, setSel] = useState<string[]>(['awd', 'cholera', 'malaria', 'rvf'])
  const [hf, setHf] = useState<{ total: number; near: number; inFlood: number } | null>(null)

  useEffect(() => { getJSON(`/api/health-risk?scenario=${scn}`).then(setD).catch(() => setD(null)) }, [scn])
  useEffect(() => {
    geo('health_facilities.geojson').then((g) => {
      const p = g.features.map((f: any) => f.properties).filter((x: any) => x.in_county !== false)
      setHf({ total: p.length, near: p.filter((x: any) => x.dist_tana_km <= 2).length, inFlood: p.filter((x: any) => x.dist_tana_km <= 5).length })
    })
  }, [])

  const data = useMemo(() => {
    if (!d) return []
    return d.dates.map((dt: string, i: number) => {
      const r: any = { date: dt.slice(5), rain: d.rain[i] }
      d.diseases.forEach((x: any) => { r[x.key] = x.series[i] })
      return r
    })
  }, [d])

  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  return (
    <>
      <PageHero img="./img/healthcare_impact.jpg" tone="crest" title="Floodwater carries disease for weeks after it recedes" lead="Cholera, diarrhoea, malaria, dengue and Rift Valley fever follow El Niño rains in a predictable order. This page turns the rainfall outlook into a disease-risk calendar so health and WASH teams can pre-position before cases climb.">
        <a href="#risk" className="rounded-xl bg-sand px-5 py-3 font-semibold text-night">See the risk calendar</a>
      </PageHero>
      <TranslatePage targetId="health-body" />
      <div id="health-body">
        <Section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={hf ? `${hf.total}` : '…'} label="Health facilities mapped" color="#0e7c86" note="MoH KMHFL & county data" />
            <Stat value={hf ? `${hf.near}` : '…'} label="Within 2 km of the Tana" color="#c81d25" note="likely cut off or flooded at ALARM" />
            <Stat value={hf ? `${hf.inFlood}` : '…'} label="Within 5 km of the Tana" color="#e4572e" />
            <Stat value="1997/98" label="Worst RVF outbreak" color="#7a2614" note="~89,000 infections in NE Kenya after El Niño" />
          </div>
        </Section>

        <Section id="risk" title="Disease risk calendar, Oct – Dec 2026" lead="Python lag-kernel model: each disease responds to rainfall after its own documented delay (2–7 days for diarrhoea, 3–6 weeks for malaria and RVF). Risk is a 0–100 index, not a case count.">
          <div className="mb-4 flex flex-wrap gap-2">
            {SCEN.map((s) => (
              <button key={s.k} onClick={() => setScn(s.k)} className={`rounded-xl px-4 py-2 font-semibold ${scn === s.k ? 'bg-crest text-white' : 'bg-white ring-1 ring-black/10'}`}>{s.label}</button>
            ))}
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="h-[400px]">
              <ResponsiveContainer>
                <ComposedChart data={data} margin={{ left: 0, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e7" />
                  <XAxis dataKey="date" interval={9} tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="r" domain={[0, 100]} tick={{ fontSize: 12 }} label={{ value: 'Risk index', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                  <YAxis yAxisId="mm" orientation="right" tick={{ fontSize: 12 }} unit=" mm" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="mm" dataKey="rain" name="Daily rain (mm)" fill="#9ccfd3" />
                  {d?.diseases.filter((x: any) => sel.includes(x.key)).map((x: any) => (
                    <Line key={x.key} yAxisId="r" dataKey={x.key} name={x.name} stroke={x.color} dot={false} strokeWidth={3} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {d?.diseases.map((x: any) => (
                <button key={x.key} onClick={() => toggle(x.key)} aria-pressed={sel.includes(x.key)}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-2 transition"
                  style={sel.includes(x.key) ? { background: x.color, color: '#fff', borderColor: x.color, ['--tw-ring-color' as any]: x.color } : { ['--tw-ring-color' as any]: x.color }}>{x.name}</button>
              ))}
            </div>
          </div>
          {!d && <p className="mt-3 text-muted">Loading the risk model…</p>}
        </Section>

        <Section title="What to expect and what to do" lead="Peak dates come from the selected scenario. Mitigation follows MoH, WHO and Kenya Red Cross guidance.">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {d?.diseases.map((x: any) => (
              <article key={x.key} className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5" style={{ borderLeft: `6px solid ${x.color}` }}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold">{x.name}</h3>
                  <Pill color={LV[x.level] || '#555'}>{x.level}</Pill>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[15px]">
                  <div><dt className="text-muted">Peak risk</dt><dd className="font-display text-2xl font-bold tabular" style={{ color: x.color }}>{x.peak_risk}</dd></div>
                  <div><dt className="text-muted">Around</dt><dd className="font-display text-2xl font-bold tabular">{x.peak_date.slice(5)}</dd></div>
                  <div><dt className="text-muted">Lag after rain</dt><dd className="font-semibold">{x.lag_days} days</dd></div>
                  <div><dt className="text-muted">Cause</dt><dd className="font-semibold">{x.agent}</dd></div>
                </dl>
                <p className="mt-3 text-[15px]" data-tr><span className="font-semibold">Hotspots: </span>{x.hotspots}</p>
                <ul className="mt-3 space-y-1.5 text-[15px]">
                  {x.mitigation.map((m: string) => <li key={m} className="flex gap-2" data-tr><ShieldCheck size={18} className="mt-0.5 shrink-0 text-acacia" />{m}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Health facilities and water points at risk" lead="Facilities, boreholes and water pans against past flood extents and the River Tana buffers. Click any point for its name and distance to the river.">
          <SmartMap compact height="68vh" showGauge={false} initial={['county', 'subcounties', 'tana', 'tana_buffers', 'flood_2023_viirs', 'flood_2024_tana', 'health', 'boreholes', 'water_pans', 'camps']} />
        </Section>

        <Section title="Evidence behind the model">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4 text-lg">
              <p className="flex gap-3" data-tr><Bug className="mt-1 shrink-0 text-crest" /> 1997/98 El Niño: Rift Valley fever killed an estimated 478 people in north-eastern Kenya and Somalia; Garissa was the epicentre (WHO, CDC MMWR 1998).</p>
              <p className="flex gap-3" data-tr><Droplet className="mt-1 shrink-0 text-tana" /> 2023/24 short rains: cholera and AWD outbreaks were reported in Garissa, Dadaab camps and Tana River as latrines collapsed and shallow wells were contaminated (MoH / WHO situation reports).</p>
              <p className="flex gap-3" data-tr><Hospital className="mt-1 shrink-0 text-acacia" /> Flooded facilities lose cold chain, staff access and supplies; pre-positioning ORS, cholera kits, RDTs, ACTs and LLINs before the peak is the most cost-effective action.</p>
              <div className="rounded-2xl bg-paper p-4 text-[15px] text-muted ring-1 ring-black/5">
                <div className="font-semibold text-ink">Method</div>
                <pre className="mt-2 whitespace-pre-wrap font-sans">{d?.method || 'risk(t) = 1 − exp(−Σ w(k)·R(t−k)/S)'}</pre>
              </div>
            </div>
            <div className="grid gap-4">
              <Figure src="./img/cholera_advisory.jpg" caption="Cholera prevention advisory" credit="MoH / county health" />
              <Figure src="./img/rvf_vaccination.jpg" caption="Livestock vaccination against Rift Valley fever" credit="Illustrative" />
            </div>
          </div>
          <ul className="mt-8 list-disc space-y-1 pl-6 text-muted">
            <li>Anyamba A. et al. (2009) Prediction of a Rift Valley fever outbreak. <i>PNAS</i> 106(3):955–959.</li>
            <li>WHO Kenya cholera situation reports, 2023–2024; Kenya MoH Disease Surveillance & Response Unit.</li>
            <li>Kovats R.S. et al. (2003) El Niño and health. <i>The Lancet</i> 362:1481–1489.</li>
            <li>Kenya Master Health Facility List (KMHFL) for facility locations.</li>
          </ul>
        </Section>
      </div>
    </>
  )
}
