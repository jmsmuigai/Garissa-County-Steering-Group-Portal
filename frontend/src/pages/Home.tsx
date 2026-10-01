import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CloudRain, Waves, School, ShieldAlert, ArrowUpRight, Thermometer, Droplets, FileText, Siren, Map } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import SmartMap from '../components/SmartMap'
import RiskPanel from '../components/RiskPanel'
import { getJSON, weatherFor, DATA, WMO } from '../lib/api'
import { useApp, LEVEL_COLORS, mapBus } from '../lib/store'
import { t } from '../lib/i18n'
import { Section } from '../components/ui'

export default function Home() {
  const { lang } = useApp()
  const [fc, setFc] = useState<any>(null)
  const [wx, setWx] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [bulletin, setBulletin] = useState<any>(null)
  useEffect(() => {
    getJSON('/api/forecast').then(setFc).catch(() => {})
    getJSON('/api/bulletin?lang=en').then(setBulletin).catch(() => {})
    fetch(DATA('stats.json')).then((r) => r.json()).then(setStats)
    weatherFor(-0.4532, 39.6461, 'garissa').then(setWx).catch(() => setWx({ error: true }))
  }, [])

  const blend = fc?.tana?.blend, ec = fc?.tana?.ecmwf, ai = fc?.tana?.usai
  const worst = ai || ec
  const lvl = worst?.level || 'WATCH'

  return (
    <>
      {/* alert ribbon */}
      <div className="text-white" style={{ background: `linear-gradient(90deg, ${LEVEL_COLORS[lvl] || '#f28c28'}, #7a2614)` }}>
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 text-[15px]">
          <span className="flex items-center gap-2 font-display text-lg font-bold"><Siren size={20} /> El Niño flood watch</span>
          <span className="hidden md:inline">ECMWF & US-AI models: up to <b>350 mm</b> over the Upper Tana in 14 days · KMD: above-average OND rain, onset 1st–2nd week of October</span>
          {worst && <span>River Tana scenario peak <b>{worst.peak_stage_m} m</b> ({worst.level})</span>}
          <Link to="/elnino" className="ml-auto rounded-lg bg-white/20 px-3 py-1 font-semibold hover:bg-white/30">See the outlook</Link>
        </div>
      </div>

      <SmartMap height="calc(100svh - 130px)" forecastPeak={worst ? { stage: worst.peak_stage_m, label: 'US-AI scenario peak' } : undefined} />

      {/* today at a glance */}
      <Section>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Card icon={<Waves />} color="#0e7c86" title={t('home.forecastPeak', lang)}>
            {fc ? (
              <>
                <div className="flex items-end gap-3">
                  <span className="font-display text-4xl font-extrabold tabular" style={{ color: LEVEL_COLORS[worst.level] }}>{worst.peak_stage_m} m</span>
                  <span className="mb-1 rounded px-2 py-0.5 text-sm font-bold text-white" style={{ background: LEVEL_COLORS[worst.level] }}>{worst.level}</span>
                </div>
                <p className="mt-2 text-[15px] text-muted">Garissa gauge if the US-AI rain verifies; ECMWF {ec.peak_stage_m} m, weighted blend {blend.peak_stage_m} m. Alert 4.0 · alarm 5.0 · emergency 6.2 m.</p>
              </>
            ) : <Skeleton />}
          </Card>
          <Card icon={<CloudRain />} color="#7a2614" title="Chance of extreme rain (14 days)">
            {fc ? (
              <>
                <div className="font-display text-4xl font-extrabold tabular text-crest">{fc.ensemble.exceedance_pct['200']}%</div>
                <p className="mt-2 text-[15px] text-muted">probability of more than 200 mm over the Upper Tana; {fc.ensemble.exceedance_pct['350']}% for 350 mm and {fc.ensemble.exceedance_pct['700']}% for 700 mm (5-model weighted ensemble).</p>
              </>
            ) : <Skeleton />}
          </Card>
          <Card icon={<Thermometer />} color="#e8a33a" title="Garissa weather now">
            {wx && !wx.error ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-4xl font-extrabold tabular text-ink">{Math.round(wx.current?.temperature_2m ?? wx.daily[0].tmax)}°C</span>
                  <span className="text-muted">{WMO[wx.current?.weather_code] || ''}</span>
                </div>
                <div className="mt-2 h-[86px]">
                  <ResponsiveContainer>
                    <BarChart data={wx.daily.slice(0, 10).map((d: any) => ({ d: d.date.slice(5), r: d.rain_mm }))}>
                      <XAxis dataKey="d" tick={{ fontSize: 10 }} interval={1} />
                      <YAxis hide />
                      <Tooltip formatter={(v: any) => [`${v} mm`, 'Rain']} />
                      <Bar dataKey="r" radius={[4, 4, 0, 0]}>{wx.daily.slice(0, 10).map((d: any, i: number) => <Cell key={i} fill={d.rain_mm > 20 ? '#c81d25' : d.rain_mm > 5 ? '#0e7c86' : '#90caf9'} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="m-0 text-xs text-muted">{wx.source} · next 10 days rain (mm)</p>
              </>
            ) : wx?.error ? <p className="text-muted">Live weather is offline. Open the El Niño page for model outlooks or check <a className="underline" href="https://meteo.go.ke" target="_blank" rel="noreferrer">meteo.go.ke</a>.</p> : <Skeleton />}
          </Card>
          <Card icon={<School />} color="#3e7d3a" title="Assets within 2 km of the Tana">
            {stats ? (
              <>
                <div className="font-display text-4xl font-extrabold tabular text-acacia">{stats.buffers['2'].schools + stats.buffers['2'].health}</div>
                <p className="mt-2 text-[15px] text-muted">{stats.buffers['2'].schools} schools and {stats.buffers['2'].health} health facilities, plus {stats.buffers['2'].boreholes} boreholes. In Nov 2023 floods exposed ~{(stats.pop_exposed_2023_town + stats.pop_exposed_2023_dadaab).toLocaleString()} people in Garissa Town and Dadaab.</p>
              </>
            ) : <Skeleton />}
          </Card>
        </div>
      </Section>

      {/* am I at risk + safety */}
      <section className="bg-night text-white">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="flex items-center gap-3 text-3xl font-bold"><ShieldAlert className="text-sand" size={32} /> Am I at risk?</h2>
            <p className="mt-3 max-w-xl text-lg text-white/80">Share your location or type a village, school or coordinates. The portal checks past UNOSAT flood extents, the River Tana floodplain model and lagha flash-flood corridors, then shows the nearest schools and clinics.</p>
            <div className="mt-6 max-w-xl rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <RiskPanel request={null} onResult={(r) => { if (r) { mapBus.emit({ type: 'assess', lat: r.lat, lon: r.lon }); } }} />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold">{t('safe.title', lang)}</h2>
            <ol className="mt-6 space-y-4 p-0">
              {['safe.1', 'safe.2', 'safe.3', 'safe.4'].map((k, i) => (
                <li key={k} className="flex list-none gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand font-display text-xl font-bold text-night">{i + 1}</span>
                  <span className="text-lg">{t(k, lang)}</span>
                </li>
              ))}
            </ol>
            <img src="./img/krcs_flood_safety.jpg" alt="Kenya Red Cross flood safety poster: what to do and what not to do" className="mt-6 w-full max-w-sm rounded-2xl" loading="lazy" />
          </div>
        </div>
      </section>

      {/* bulletins */}
      <Section title="Latest bulletins" lead="Official KMD products received by the CSG, and the portal's automatic situation bulletin generated from today's model runs.">
        <div className="grid gap-5 lg:grid-cols-3">
          <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 lg:col-span-1">
            <div className="flex items-center gap-2 text-sm text-muted"><FileText size={16} /> KMD Garissa · issued 28 Sep 2026</div>
            <h3 className="mt-2 text-xl font-bold">Weekly forecast 29 Sep – 5 Oct</h3>
            <p className="mt-2 text-[15px]">Light morning rain in a few places in Garissa Township and Dadaab; afternoon showers likely in Ijara, Hulugho, Fafi, Masalani, Bura and Dadaab. Max 33–35 °C, min 21–24 °C, moderate to strong south-easterly winds.</p>
          </article>
          <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-2 text-sm text-muted"><FileText size={16} /> KMD national · issued 30 Sep 2026</div>
            <h3 className="mt-2 text-xl font-bold">October 2026 and OND outlook</h3>
            <p className="mt-2 text-[15px]">Above-average rainfall with higher probabilities over parts of Garissa, Tana River and the coast in October; above-average OND rain for Garissa and the whole Upper Tana. Onset 1st–2nd week of October, cessation early December. Warmer than average.</p>
          </article>
          <article className="rounded-2xl bg-sand-light p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-2 text-sm text-muted"><Droplets size={16} /> CSG portal · auto-generated {bulletin?.engine && bulletin.engine !== 'template' ? `by ${bulletin.engine}` : ''}</div>
            <h3 className="mt-2 text-xl font-bold">Situation bulletin</h3>
            <pre className="mt-2 whitespace-pre-wrap font-body text-[15px]">{bulletin?.text || 'Loading…'}</pre>
          </article>
        </div>
      </Section>

      {/* explore */}
      <Section title="Explore the portal">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['/elnino', 'El Niño early warning', 'Model showdown, Python forecasts and the 3-month outlook.', './img/elnino_global_2026.jpg'],
            ['/tana', 'River Tana & Seven Forks', 'How the dams fill and spill, and how long the water takes to reach Garissa.', './img/masinga_spillway.jpg'],
            ['/health', 'Health & WASH', 'Cholera, malaria, Rift Valley fever and dengue risk after floods.', './img/rvf_vaccination.jpg'],
            ['/community', 'Community maps', 'Query the data and download colourful maps for your ward.', './img/map_lagha_hazard.jpg'],
            ['/nbs', 'Nature-based solutions', '76 candidate sites that turn floodwater into dry-season water.', './img/nbs_hero.jpg'],
            ['/policy', 'Partnerships policy', 'How donors and partners coordinate in Garissa – download the policy.', './img/policy_cover.jpg'],
            ['/about', 'About the CSG', 'Who we are, our mandate and how coordination works.', './img/dadaab_camp.jpg'],
            ['/report', 'Report an emergency', 'Send a geo-tagged report to emergency@garissa.go.ke.', './img/field_damaged_road.jpg'],
          ].map(([to, title, text, img]) => (
            <Link key={to} to={to} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 hover:ring-tana">
              <img src={img} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover transition group-hover:scale-[1.03]" />
              <div className="p-4">
                <div className="flex items-center justify-between font-display text-lg font-bold">{title}<ArrowUpRight size={18} className="text-tana" /></div>
                <p className="mt-1 text-[15px] text-muted">{text}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-8 flex justify-center"><Link to="/community" className="inline-flex items-center gap-2 rounded-xl bg-tana px-5 py-3 font-semibold text-white hover:bg-tana-deep"><Map size={18} /> Make a map for my community</Link></div>
      </Section>
    </>
  )
}

function Card({ icon, color, title, children }: { icon: React.ReactNode; color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-3 flex items-center gap-2 font-semibold" style={{ color }}><span className="rounded-lg p-1.5" style={{ background: color + '1a' }}>{icon}</span>{title}</div>
      {children}
    </div>
  )
}
function Skeleton() { return <div className="h-24 animate-pulse rounded-xl bg-black/5" /> }
