import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bot, Send, X, Sparkles, Loader2 } from 'lucide-react'
import { mapBus, useApp, type MapAction } from '../lib/store'
import { backendAvailable, geo, postJSON } from '../lib/api'
import { LAYERS } from '../lib/layers'
import { t } from '../lib/i18n'
import { assessLocation, searchPlaces } from '../lib/risk'

type Msg = { role: 'user' | 'assistant'; content: string; engine?: string }

const SUGGEST = [
  'Am I at risk where I am now?',
  'Is Saka in a flood risk area?',
  'Show high-risk schools within 2 km of the Tana in Balambala',
  'Simulate a 6 m flood at Garissa',
  'Show laghas and the 2023 flood on satellite',
  'What does the El Niño outlook say?',
  'Which diseases follow the floods?',
  'What is the donor coordination policy?',
]

const KB: [string[], string][] = [
  [['csg', 'steering', 'mandate'], 'The County Steering Group (CSG) is Garissa’s multi-agency disaster-risk and early-warning forum, co-chaired by H.E. the Governor and the County Commissioner, with NDMA as secretariat. It validates early warnings, activates contingency plans, mobilises resources and coordinates sector working groups.'],
  [['policy', 'donor', 'partner', 'ddpc', 'cais'], 'The Garissa County Partnerships & Coordination Policy (Aug 2025) makes the DDPC the single entry point for partners, creates a County Coordination Committee and Technical Forum, a 7-step partner entry process and a GIS-enabled County Aid Information System. See the Partnerships policy page to download it.'],
  [['el nino', 'elnino', 'outlook', 'model', 'ecmwf', 'gfs'], 'Model guidance (1 Oct 2026): ECMWF and the US AI model show up to 350 mm in 14 days over the Upper Tana; GFS and AIFS about 100 mm. KMD expects above-average OND rain for Garissa with onset in the 1st–2nd week of October. Odds of extreme rain are judged above 50%.'],
  [['disease', 'cholera', 'malaria', 'rvf', 'dengue'], 'After floods: diarrhoea & cholera within 3–10 days, Rift Valley Fever and dengue 2–4 weeks later, malaria peaks 3–6 weeks after the rain. See the Health & WASH page for the risk curves and mitigation.'],
  [['contact', 'emergency', 'help', 'report'], 'Report emergencies to emergency@garissa.go.ke or call Kenya Red Cross 1199 (999/112 national).'],
]

// "Am I at risk?" runs in the browser on the portal's own GIS layers (GPS, coordinates or a place name)
const RISK_RE = /(am i|are we|is (it|this|my)|niko|tuko|ma ku|khatar|hatari|at risk|in danger|flood risk|risk area|my location|where i am|current location)/
function gpsFix(): Promise<[number, number]> {
  return new Promise((ok, no) => {
    if (!navigator.geolocation) return no(new Error('no-geo'))
    navigator.geolocation.getCurrentPosition((p) => ok([p.coords.latitude, p.coords.longitude]), (e) => no(e), { enableHighAccuracy: true, timeout: 15000 })
  })
}
async function riskIntent(q: string): Promise<{ reply: string; map_actions: MapAction[] } | null> {
  const s = q.toLowerCase()
  const coord = q.match(/(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/)
  if (!coord && !RISK_RE.test(s)) return null
  let lat: number, lon: number, where = ''
  if (coord) { lat = +coord[1]; lon = +coord[2]; if (Math.abs(lat) > 5) [lat, lon] = [lon, lat]; where = `${lat.toFixed(4)}, ${lon.toFixed(4)}` }
  else {
    const cleaned = s.replace(new RegExp(RISK_RE.source, 'g'), ' ').replace(/[^a-z\s'-]/g, ' ').replace(/\b(is|in|a|the|area|zone|of|for|my|where|now|i|am|at|risk|flood|high|danger|safe|there|place|village|town)\b/g, ' ').replace(/\s+/g, ' ').trim()
    const hits = cleaned.length > 2 ? await searchPlaces(cleaned) : []
    if (hits.length) { lat = hits[0].lat; lon = hits[0].lon; where = hits[0].name }
    else {
      try { [lat, lon] = await gpsFix(); where = 'your current location' }
      catch { return { reply: 'I could not read your location. Allow location access for this site in your browser or phone settings, or type a place name or coordinates, e.g. "Is -0.45, 39.65 at risk?".', map_actions: [] } }
    }
  }
  const r = await assessLocation(lat!, lon!)
  const lines = [`${where}: ${r.level} flood risk${r.subcounty ? ` (${r.subcounty})` : ''}${r.inCounty ? '' : ' – outside Garissa County'}.`, ...r.reasons.slice(0, 4).map((x) => '• ' + x)]
  if (r.schools[0]) lines.push(`Nearest school: ${r.schools[0].name} (${r.schools[0].km.toFixed(1)} km).`)
  if (r.health[0]) lines.push(`Nearest health facility: ${r.health[0].name} (${r.health[0].km.toFixed(1)} km).`)
  lines.push(r.advice[0] || '')
  return { reply: lines.filter(Boolean).join('\n'), map_actions: [{ type: 'assess', lat: lat!, lon: lon! }] }
}

async function offline(q: string): Promise<{ reply: string; map_actions: MapAction[] }> {
  const s = q.toLowerCase()
  const acts: MapAction[] = []
  const lines: string[] = []
  const bm = [['hybrid', 'google_hybrid'], ['satellite', 'google_satellite'], ['openstreetmap', 'osm'], ['osm', 'osm'], ['terrain', 'topo'], ['topo', 'topo'], ['dark', 'carto_dark']].find(([w]) => s.includes(w))
  if (bm) { acts.push({ type: 'basemap', id: bm[1] }); lines.push(`Basemap: ${bm[1].replace('_', ' ')}.`) }
  const dm = s.match(/(\d+(?:\.\d+)?)\s*km/)
  const dist = dm ? +dm[1] : null
  const assetMap: [string[], string, string][] = [[['school'], 'schools', 'schools.geojson'], [['health', 'hospital', 'clinic', 'dispensar'], 'health', 'health_facilities.geojson'], [['borehole'], 'boreholes', 'boreholes.geojson'], [['water pan'], 'water_pans', 'water_pans.geojson']]
  for (const [words, id, file] of assetMap) {
    if (!words.some((w) => s.includes(w))) continue
    const g = await geo(file)
    const high = s.includes('high')
    const feats = g.features.filter((f: any) => (dist === null || f.properties.dist_tana_km <= dist) && (!high || id !== 'schools' || f.properties.risk === 'HIGH') && f.properties.in_county !== false)
      .filter((f: any) => !['balambala', 'dadaab', 'fafi', 'ijara', 'lagdera'].some((sc) => s.includes(sc)) || ['balambala', 'dadaab', 'fafi', 'ijara', 'lagdera'].some((sc) => s.includes(sc) && String(f.properties.sub_county || f.properties.subcounty || f.properties.ward || '').toLowerCase().includes(sc)) || (s.includes('balambala') && f.geometry.coordinates[0] < 39.62))
      .map((f: any) => ({ name: f.properties.name || f.properties.village || id, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], dist_tana_km: f.properties.dist_tana_km }))
    acts.push({ type: 'layers', show: [id, ...(dist ? ['tana_buffers'] : [])] })
    const title = `${feats.length} ${id.replace('_', ' ')}${dist ? ` within ${dist} km of the Tana` : ''}`
    acts.push({ type: 'highlight', title, features: feats })
    lines.push(`Highlighted ${title}.`)
  }
  const st = s.match(/(\d(?:\.\d)?)\s*m\b/)
  if (s.includes('simulat') || (st && s.includes('flood'))) { const v = st ? +st[1] : 5; acts.push({ type: 'flood_stage', stage: Math.round(Math.min(7.5, Math.max(3, v)) * 2) / 2 }); lines.push(`Flood simulator set to ${v} m at the Garissa gauge.`) }
  const lay = LAYERS.filter((l) => [l.id.replace('_', ' '), ...l.label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4)].some((w) => s.includes(w)))
  const extra = [['lagha', 'laghas'], ['2023', 'flood_2023_viirs'], ['2024', 'flood_2024_tana'], ['camp', 'camps'], ['dam', 'dams'], ['nbs', 'nbs_sites'], ['meander', 'blindfolds'], ['blind', 'blindfolds']].filter(([w]) => s.includes(w)).map(([, id]) => id)
  const show = Array.from(new Set([...extra, ...lay.map((l) => l.id)])).filter((x) => !['schools', 'health', 'boreholes', 'water_pans'].includes(x))
  if (show.length && /show|display|map|open|onyesha|tus/.test(s)) { acts.push({ type: 'layers', show }); lines.push('Showing: ' + show.join(', ') + '.') }
  const places = await geo('places.geojson')
  const pl = places.features.find((f: any) => s.includes(f.properties.name.toLowerCase().split(' (')[0]))
  if (pl && !acts.some((a) => a.type === 'highlight')) { acts.push({ type: 'zoom', lat: pl.geometry.coordinates[1], lon: pl.geometry.coordinates[0], zoom: 13 }); lines.push(`Zoomed to ${pl.properties.name}.`) }
  if (!lines.length) {
    const hit = KB.find(([ws]) => ws.some((w) => s.includes(w)))
    lines.push(hit ? hit[1] : 'I can show map layers, find assets near the Tana, simulate flood stages and explain the El Niño and health outlooks. Try one of the suggestions.')
  }
  return { reply: lines.join('\n'), map_actions: acts }
}

export default function ChatBot() {
  const { lang } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  const send = async (text: string) => {
    if (!text.trim() || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: text }]
    setMsgs(next); setInput(''); setBusy(true)
    let res: any
    try {
      const local = await riskIntent(text)
      if (local) res = { ...local, engine: 'portal GIS' }
      else if (/make (a|me a|my) map|download (a )?map|community map/.test(text.toLowerCase())) res = { reply: 'Opening Community maps – choose what to map, filter it, then download a colour PNG, CSV or GeoJSON.', map_actions: [{ type: 'navigate', page: 'community' }], engine: 'portal' }
      else if (await backendAvailable()) res = await postJSON('/api/chat', { messages: next.map(({ role, content }) => ({ role, content })), lang })
      else res = { ...(await offline(text)), engine: 'browser' }
    } catch {
      res = { ...(await offline(text)), engine: 'browser' }
    }
    const acts: MapAction[] = res.map_actions || []
    const navAct = acts.find((a) => a.type === 'navigate') as any
    const mapActs = acts.filter((a) => a.type !== 'navigate')
    if (navAct) nav(navAct.page === 'home' ? '/' : `/${navAct.page}`)
    else if (mapActs.length && loc.pathname !== '/') nav('/')
    setTimeout(() => mapActs.forEach((a) => mapBus.emit(a)), loc.pathname === '/' ? 0 : 600)
    setMsgs([...next, { role: 'assistant', content: res.reply, engine: res.engine }])
    setBusy(false)
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label={t('chat.title', lang)} className="fixed bottom-4 right-4 z-[1200] flex items-center gap-2 rounded-full bg-tana p-3.5 font-semibold text-white shadow-2xl ring-4 ring-white/70 hover:bg-tana-deep sm:bottom-5 sm:right-5 sm:px-5">
          <Bot size={22} /> <span className="hidden sm:inline">{t('chat.title', lang)}</span>
        </button>
      )}
      {open && (
        <section className="fixed bottom-4 right-4 z-[1200] flex h-[min(640px,85vh)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10" aria-label="AI assistant">
          <header className="flex items-center gap-2 bg-night px-4 py-3 text-white">
            <Sparkles size={20} className="text-sand" />
            <div className="flex-1"><div className="font-display font-bold">{t('chat.title', lang)}</div><div className="text-xs text-white/65">Gemini-powered · acts on the map · EN / SW / SO</div></div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-white/10"><X size={18} /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-paper p-4 text-[15px]">
            <div className="rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm">{t('chat.hello', lang)}</div>
            {!msgs.length && <div className="flex flex-wrap gap-2">{SUGGEST.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-tana/40 bg-white px-3 py-1.5 text-left text-sm text-tana-deep hover:bg-tana-light">{s}</button>)}</div>}
            {msgs.map((m, i) => (
              <div key={i} className={`whitespace-pre-wrap rounded-2xl p-3 shadow-sm ${m.role === 'user' ? 'ml-8 rounded-tr-sm bg-tana text-white' : 'mr-4 rounded-tl-sm bg-white'}`}>
                {m.content}
                {m.engine && <div className="mt-1 text-[11px] text-muted">engine: {m.engine}</div>}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-muted"><Loader2 size={16} className="animate-spin" /> Working on the map…</div>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex gap-2 border-t p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('chat.placeholder', lang)} className="flex-1 rounded-xl border border-black/15 px-3 py-2 text-[15px] focus:border-tana focus:outline-none" aria-label="Message" />
            <button type="submit" disabled={busy} className="rounded-xl bg-tana px-3 text-white hover:bg-tana-deep disabled:opacity-50" aria-label="Send"><Send size={18} /></button>
          </form>
        </section>
      )}
    </>
  )
}
