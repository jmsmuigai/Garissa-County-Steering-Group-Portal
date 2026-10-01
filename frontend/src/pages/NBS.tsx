import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { ExternalLink, Search } from 'lucide-react'
import { PageHero, Section, Stat, Figure, Pill, TranslatePage } from '../components/ui'
import SmartMap from '../components/SmartMap'
import { geo } from '../lib/api'
import { mapBus } from '../lib/store'

const FAMILY: Record<string, { short: string; color: string; what: string }> = {
  'Flood detention & retention basin (hafir)': { short: 'Hafirs & detention basins', color: '#0e7c86', what: 'Excavated basins that catch a lagha flood peak, cut downstream damage and store water for livestock into the dry season.' },
  'Sand dam / sub-surface dam': { short: 'Sand dams', color: '#c08a2e', what: 'A low wall across a seasonal sand river. Sand builds up behind it and stores water underground, safe from evaporation.' },
  'Off-channel water pan (diversion-fed)': { short: 'Off-channel water pans', color: '#3e7d3a', what: 'Pans filled by a diversion from a lagha, so the flood is shaved and the water is kept for people and herds.' },
  'Check dams, gully plugs & re-greening (land restoration)': { short: 'Check dams & re-greening', color: '#6a8f2a', what: 'Stone and brush lines that slow runoff, trap soil and let grass and acacia return on bare, gullied land.' },
  'Flood-spreading bunds & spate irrigation (Zai/half-moons)': { short: 'Spate irrigation & half-moons', color: '#a0522d', what: 'Bunds spread flash floods over fields so the water soaks in and grows sorghum, cowpeas and fodder.' },
  'Garissa Town flash-flood interception (detention basin + green corridor)': { short: 'Town green corridors', color: '#7a2614', what: 'Detention basins and planted corridors that intercept the laghas running through Garissa Town before they reach homes.' },
}
const PR: Record<string, string> = { 'Very High': '#c81d25', High: '#f28c28', Medium: '#2e9e4f' }

const OPEN = [
  ['GloFAS – Global Flood Awareness System', 'https://www.globalfloods.eu', 'Copernicus river discharge forecasts for the Tana, 30 days ahead.'],
  ['Copernicus Emergency Management Service', 'https://emergency.copernicus.eu', 'Rapid satellite flood maps when the county requests activation.'],
  ['NASA GPM IMERG', 'https://gpm.nasa.gov/data/imerg', 'Half-hourly satellite rainfall; shown live on the risk map.'],
  ['UNOSAT flood portal', 'https://unosat.org/products', 'Analysed flood extents for Kenya 2023–2024 used on the map.'],
  ['ICPAC – IGAD Climate Centre', 'https://www.icpac.net', 'Greater Horn of Africa seasonal outlooks (GHACOF).'],
  ['FEWS NET Kenya', 'https://fews.net/east-africa/kenya', 'Food-security outlooks for pastoral north-east Kenya.'],
  ['Digital Earth Africa', 'https://www.digitalearthafrica.org', 'Free water-observation and land-cover analysis-ready data.'],
  ['ESA WorldCover 10 m', 'https://esa-worldcover.org', 'Land cover layer on the risk map (2021).'],
  ['Kenya Meteorological Department', 'https://meteo.go.ke', 'Official forecasts and warnings for Kenya.'],
]

export default function NBS() {
  const [sites, setSites] = useState<any[]>([])
  const [fam, setFam] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => { geo('nbs_sites.geojson').then((g) => setSites(g.features.map((f: any) => f.properties))) }, [])

  const byFam = useMemo(() => Object.entries(FAMILY).map(([k, v]) => ({ k, name: v.short, color: v.color, n: sites.filter((s) => s.nbs_type === k).length })), [sites])
  const list = useMemo(() => sites.filter((s) => (!fam || s.nbs_type === fam) && (!q || JSON.stringify(s).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => ['Very High', 'High', 'Medium'].indexOf(a.priority) - ['Very High', 'High', 'Medium'].indexOf(b.priority)), [sites, fam, q])
  const storage = sites.reduce((a, s) => a + (s.runoff_elnino_m3 || 0), 0)

  const show = (s: any) => {
    mapBus.emit({ type: 'zoom', lat: s.lat, lon: s.lon, zoom: 13, name: s.site_id })
    mapBus.emit({ type: 'highlight', title: s.site_id, features: [{ name: `${s.site_id} – ${FAMILY[s.nbs_type]?.short}`, lat: s.lat, lon: s.lon }] })
    document.getElementById('nbs-map')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <PageHero img="./img/nbs_hero.jpg" tone="acacia" title="Turn the flood into the dry-season water supply" lead="76 nature-based solution sites screened by the county GIS team: hafirs, sand dams, water pans, check dams and green corridors placed where laghas carry the most water past settlements.">
        <a href="#sites" className="rounded-xl bg-sand px-5 py-3 font-semibold text-night">Browse the 76 sites</a>
      </PageHero>
      <TranslatePage targetId="nbs-body" />
      <div id="nbs-body">
        <Section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={`${sites.length || 76}`} label="Candidate NBS sites" color="#3e7d3a" />
            <Stat value={`${sites.filter((s) => s.priority === 'Very High').length || 18}`} label="Very high priority" color="#c81d25" />
            <Stat value={`${(storage / 1e9).toFixed(1)} bn m³`} label="El Niño runoff passing the sites" color="#0e7c86" note="upstream-catchment SCS-CN estimate" />
            <Stat value="KES 5–40 M" label="Indicative cost per site" color="#c08a2e" />
          </div>
        </Section>

        <Section title="Six families of solutions">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(FAMILY).map(([k, v]) => (
                <button key={k} onClick={() => setFam(fam === k ? '' : k)} className={`rounded-2xl p-5 text-left text-white shadow-sm transition ${fam && fam !== k ? 'opacity-50' : ''}`} style={{ background: v.color }}>
                  <h3 className="text-xl font-bold">{v.short}</h3>
                  <p className="mt-2 text-[15px] text-white/90" data-tr>{v.what}</p>
                </button>
              ))}
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="font-semibold">Sites by type</div>
              <div className="h-[330px]">
                <ResponsiveContainer>
                  <BarChart data={byFam} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 13 }} />
                    <Tooltip />
                    <Bar dataKey="n" name="Sites">{byFam.map((b) => <Cell key={b.k} fill={b.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Section>

        <Section id="sites" title="Site finder" lead="Filter by family or search a town, lagha system or site ID. Tap a site to fly to it on the map.">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="flex flex-1 items-center gap-2 rounded-xl bg-white px-4 py-2.5 ring-1 ring-black/10 sm:max-w-md">
              <Search size={18} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Hagadera, Lagh Dera, NBS-012" className="w-full bg-transparent outline-none" />
            </label>
            {fam && <button onClick={() => setFam('')} className="rounded-xl bg-paper px-4 py-2.5 font-semibold ring-1 ring-black/10">Clear: {FAMILY[fam].short}</button>}
            <span className="text-muted">{list.length} sites</span>
          </div>
          <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => (
              <button key={s.site_id} onClick={() => show(s)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 hover:ring-tana" style={{ borderLeft: `6px solid ${FAMILY[s.nbs_type]?.color}` }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-lg font-bold">{s.site_id} · {s.near_town}</span>
                  <Pill color={PR[s.priority] || '#555'}>{s.priority}</Pill>
                </div>
                <div className="mt-1 text-[15px] font-semibold" style={{ color: FAMILY[s.nbs_type]?.color }}>{FAMILY[s.nbs_type]?.short}</div>
                <div className="mt-1 text-sm text-muted">{s.system} · {s.lagha_class}</div>
                <div className="mt-2 text-sm">Protects {s.protects_txt}</div>
                <div className="mt-1 text-sm text-muted">Storage {s.design_storage_m3} m³ · {s.indicative_cost}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section id="nbs-map" title="Where the sites are">
          <SmartMap compact height="68vh" showGauge={false} initial={['county', 'subcounties', 'laghas', 'nbs_sites', 'nbs_storage', 'town_catchments', 'places']} />
        </Section>

        <Section title="How a site goes from map to ground">
          <ol className="grid gap-4 md:grid-cols-5">
            {[
              ['Screen', 'GIS ranks laghas by catchment, flood hazard, nearby people and assets.'],
              ['Verify', 'Ward team and community walk the site; check soils, ownership and grazing routes.'],
              ['Design', 'Engineers size storage from El Niño runoff; ESIA screening.'],
              ['Fund', 'CSG matches site to county budget, NDMA EDE or a partner under the partnerships policy.'],
              ['Build & keep', 'Cash-for-work construction; a water user committee maintains it.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-acacia font-display text-lg font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 text-lg font-bold">{t}</h3>
                <p className="mt-1 text-[15px] text-muted" data-tr>{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <Figure src="./img/map_nbs_sites.jpg" caption="NBS candidate sites – county map" credit="Garissa ICT & GIS" />
            <Figure src="./img/thriving_farm.jpg" caption="Flood water stored and used for farming" credit="Illustrative" />
            <Figure src="./img/lagha_tomatoes.jpg" caption="Lagha-fed tomato farming" credit="County field photo" />
          </div>
        </Section>

        <Section title="Open science we build on" lead="All free and open data. The portal links to them so partners can check our numbers.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {OPEN.map(([n, u, d]) => (
              <a key={n} href={u} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 hover:ring-tana">
                <ExternalLink size={18} className="mt-1 shrink-0 text-tana" />
                <span><span className="block font-semibold">{n}</span><span className="block text-[15px] text-muted">{d}</span></span>
              </a>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
