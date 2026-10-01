import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileJson, FileSpreadsheet, Image as ImageIcon, Wand2, Sparkles, MapPinned, Filter } from 'lucide-react'
import { PageHero, Section } from '../components/ui'
import { geo } from '../lib/api'
import { pointInGeom } from '../lib/risk'

// ------------------------------------------------------------------ datasets
type Rec = { id: string; name: string; lat: number; lon: number; sub: string; dist: number; flooded: boolean; risk: 'HIGH' | 'MEDIUM' | 'LOW'; attrs: Record<string, any> }
type DS = { id: string; label: string; file: string; noun: string; name: (p: any, i: number) => string; fields: string[]; cite: string }

const DATASETS: DS[] = [
  { id: 'schools', label: 'Schools', noun: 'schools', file: 'schools.geojson', name: (p) => p.name, fields: ['type', 'level', 'pupils'], cite: 'Ministry of Education / county schools register' },
  { id: 'health', label: 'Health facilities', noun: 'health facilities', file: 'health_facilities.geojson', name: (p) => p.name, fields: ['kephl_level', 'service', 'flood_exposure'], cite: 'KMHFL & county health survey' },
  { id: 'boreholes', label: 'Boreholes', noun: 'boreholes', file: 'boreholes.geojson', name: (p) => p.village || 'Borehole', fields: ['functional', 'households_served', 'flood_exposure'], cite: 'County Water Department borehole census' },
  { id: 'water_pans', label: 'Water pans', noun: 'water pans', file: 'water_pans.geojson', name: (p) => p.name, fields: ['ward', 'flood_exposure'], cite: 'County Water Department / NBSOS' },
  { id: 'nbs', label: 'Nature-based solution sites', noun: 'NBS sites', file: 'nbs_sites.geojson', name: (p) => `${p.site_id} ${p.near_town}`, fields: ['nbs_type', 'priority', 'ff_hazard'], cite: 'Garissa ICT & GIS NBS screening' },
  { id: 'structures', label: 'Flood-affected structures (May 2024)', noun: 'flooded structures', file: 'structures_2024.geojson', name: (_p, i) => `Structure ${i + 1}`, fields: ['event'], cite: 'UNOSAT PlanetScope damage assessment, May 2024' },
  { id: 'places', label: 'Towns & villages', noun: 'towns', file: 'places.geojson', name: (p) => p.name, fields: ['kind'], cite: 'County gazetteer' },
]
const FLOODS = ['flood_2023_viirs.geojson', 'flood_2023_town.geojson', 'flood_2023_dadaab.geojson', 'flood_2024_tana.geojson']
const SUBS = ['Garissa Township', 'Balambala', 'Lagdera', 'Dadaab', 'Fafi', 'Ijara']
const RISK_C = { HIGH: '#d7191c', MEDIUM: '#f39c12', LOW: '#1a9850' }
const PALETTE = ['#0e7c86', '#e4572e', '#6a1b9a', '#f2a03d', '#3e7d3a', '#1565c0', '#ad1457', '#795548', '#00897b', '#5d4037']

// polygon parts with bbox for fast point-in-polygon
type Part = { bbox: number[]; geom: any }
function parts(fc: any): Part[] {
  const out: Part[] = []
  for (const f of fc.features) {
    const g = f.geometry
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const p of polys) {
      let x0 = 999, y0 = 999, x1 = -999, y1 = -999
      for (const [x, y] of p[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
      out.push({ bbox: [x0, y0, x1, y1], geom: { type: 'Polygon', coordinates: p } })
    }
  }
  return out
}
const inParts = (pt: [number, number], ps: Part[]) => ps.some((p) => pt[0] >= p.bbox[0] && pt[0] <= p.bbox[2] && pt[1] >= p.bbox[1] && pt[1] <= p.bbox[3] && pointInGeom(pt, p.geom))

let base: Promise<any> | null = null
function loadBase() {
  if (!base) base = Promise.all([geo('county.geojson'), geo('subcounties.geojson'), geo('tana_river.geojson'), geo('laghas.geojson'), geo('tana_buffers.geojson'), ...FLOODS.map(geo)]).then(([county, subs, tana, laghas, buffers, ...floods]) => ({
    county, subs, tana, laghas, buffers, floods, floodParts: floods.flatMap(parts), subParts: subs.features.map((f: any) => ({ name: f.properties.name, ps: parts({ features: [f] }) })),
  }))
  return base
}
const dsCache: Record<string, Promise<Rec[]>> = {}
function loadDS(ds: DS): Promise<Rec[]> {
  if (!dsCache[ds.id]) dsCache[ds.id] = Promise.all([geo(ds.file), loadBase()]).then(([fc, b]) =>
    fc.features.filter((f: any) => f.geometry?.type === 'Point').map((f: any, i: number) => {
      const p = f.properties, [lon, lat] = f.geometry.coordinates
      const sub = b.subParts.find((s: any) => inParts([lon, lat], s.ps))?.name || 'Outside county'
      const flooded = ds.id === 'structures' || p.flooded_2023 || p.flooded_2024 || inParts([lon, lat], b.floodParts)
      const dist = p.dist_tana_km ?? NaN
      const laghaRisk = p.nearest_lagha_km != null && p.nearest_lagha_km <= 0.25 && /High/.test(p.nearest_lagha_hazard || '')
      const risk = flooded || dist <= 1 || laghaRisk ? 'HIGH' : dist <= 5 || (p.nearest_lagha_km ?? 9) <= 0.5 ? 'MEDIUM' : 'LOW'
      const attrs: Record<string, any> = {}
      ds.fields.forEach((k) => { attrs[k] = p[k] ?? '' })
      return { id: `${ds.id}-${i}`, name: ds.name(p, i), lat: +lat.toFixed(5), lon: +lon.toFixed(5), sub, dist: isNaN(dist) ? NaN : +(+dist).toFixed(2), flooded: !!flooded, risk, attrs }
    }))
  return dsCache[ds.id]
}

// ------------------------------------------------------------------ plain-language query
function parseQuery(q: string) {
  const s = q.toLowerCase()
  const r: Partial<Q> = {}
  if (/school/.test(s)) r.ds = 'schools'
  else if (/hospital|clinic|health|dispensar/.test(s)) r.ds = 'health'
  else if (/borehole|well/.test(s)) r.ds = 'boreholes'
  else if (/pan/.test(s)) r.ds = 'water_pans'
  else if (/nbs|sand dam|hafir|nature/.test(s)) r.ds = 'nbs'
  else if (/structure|house|building|home/.test(s)) r.ds = 'structures'
  else if (/town|village|place/.test(s)) r.ds = 'places'
  const sub = SUBS.find((x) => s.includes(x.toLowerCase().split(' ')[0]))
  if (sub) r.sub = sub
  const km = s.match(/(\d+(?:\.\d+)?)\s*km/)
  if (km) r.maxKm = Math.min(150, +km[1])
  if (/flood(ed)?\b|inundat|under water/.test(s) && !/risk/.test(s)) r.onlyFlooded = true
  if (/high[- ]risk|at risk|danger/.test(s)) r.risk = 'HIGH'
  return r
}

type Q = { ds: string; sub: string; maxKm: number; onlyFlooded: boolean; risk: string; text: string }
type Style = { title: string; size: 'a4' | 'square' | 'phone'; raster: 'none' | 'elevation' | 'lulc' | 'population'; floods: boolean; laghas: boolean; buffers: boolean; colorBy: string; labels: boolean; theme: 'light' | 'night' }
const SIZES = { a4: [2000, 1414], square: [1600, 1600], phone: [1350, 2000] }
const RECIPES: { t: string; q: string }[] = [
  { t: 'Schools inside past flood extents', q: 'flooded schools' },
  { t: 'Health facilities within 2 km of the Tana', q: 'health facilities within 2 km' },
  { t: 'High-risk boreholes in Garissa Township', q: 'high risk boreholes in Garissa Township' },
  { t: 'Water pans in Fafi', q: 'water pans in Fafi' },
  { t: 'Very high priority NBS sites in Dadaab', q: 'nbs sites in Dadaab' },
  { t: 'Structures flooded in May 2024', q: 'flooded structures' },
]

export default function Community() {
  const [q, setQ] = useState<Q>({ ds: 'schools', sub: '', maxKm: 150, onlyFlooded: false, risk: '', text: '' })
  const [nl, setNl] = useState('')
  const [recs, setRecs] = useState<Rec[]>([])
  const [b, setB] = useState<any>(null)
  const [busy, setBusy] = useState(true)
  const [st, setSt] = useState<Style>({ title: '', size: 'a4', raster: 'elevation', floods: true, laghas: false, buffers: true, colorBy: 'risk', labels: true, theme: 'light' })
  const cv = useRef<HTMLCanvasElement>(null)
  const ds = DATASETS.find((d) => d.id === q.ds)!

  useEffect(() => { loadBase().then(setB) }, [])
  useEffect(() => { setBusy(true); loadDS(ds).then((r) => { setRecs(r); setBusy(false) }) }, [ds])

  const res = useMemo(() => recs.filter((r) =>
    (!q.sub || r.sub === q.sub) && (q.maxKm >= 150 || r.dist <= q.maxKm) && (!q.onlyFlooded || r.flooded) && (!q.risk || r.risk === q.risk) &&
    (!q.text || (r.name + JSON.stringify(r.attrs)).toLowerCase().includes(q.text.toLowerCase()))), [recs, q])

  const describe = `${res.length} ${ds.noun}${q.onlyFlooded ? ' inside past flood extents' : ''}${q.risk ? ` at ${q.risk.toLowerCase()} flood risk` : ''}${q.maxKm < 150 ? ` within ${q.maxKm} km of the River Tana` : ''}${q.sub ? ` · ${q.sub}` : ' · Garissa County'}`
  const title = st.title || `${ds.label}${q.sub ? ` – ${q.sub}` : ' – Garissa County'}`

  // ----------------------------------------------------------- draw map composition
  useEffect(() => {
    if (!b || !cv.current) return
    let cancelled = false
    ;(async () => {
      const [W, H] = SIZES[st.size]
      const c = cv.current!
      c.width = W; c.height = H
      const ctx = c.getContext('2d')!
      const dark = st.theme === 'night'
      const ink = dark ? '#f6f8f7' : '#142338', paper = dark ? '#142338' : '#ffffff', sea = dark ? '#0e1a2b' : '#eef4f3'
      const s = W / 2000
      ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H)

      const headH = 190 * s, footH = 120 * s, pad = 40 * s
      // header band
      const grd = ctx.createLinearGradient(0, 0, W, 0)
      grd.addColorStop(0, '#142338'); grd.addColorStop(0.6, '#0e7c86'); grd.addColorStop(1, '#3e7d3a')
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, headH)
      ctx.fillStyle = '#e8c07d'; ctx.fillRect(0, headH - 8 * s, W, 8 * s)
      try {
        const logo = new Image(); logo.src = './img/garissa_logo.png'; await logo.decode()
        ctx.drawImage(logo, pad, 25 * s, 135 * s, 135 * s)
      } catch { /* logo optional */ }
      ctx.fillStyle = '#e8c07d'; ctx.font = `600 ${26 * s}px Lexend, sans-serif`
      ctx.fillText('County Government of Garissa · County Steering Group', pad + 160 * s, 60 * s)
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.min(58, 2600 / Math.max(20, title.length)) * s}px "Bricolage Grotesque", Lexend, sans-serif`
      ctx.fillText(title, pad + 160 * s, 122 * s, W - 2 * pad - 170 * s)
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `400 ${26 * s}px Lexend, sans-serif`
      ctx.fillText(describe, pad + 160 * s, 162 * s, W - 2 * pad - 170 * s)

      // map frame
      const mx = pad, my = headH + pad, mw = W - 2 * pad, mh = H - headH - footH - 2 * pad
      ctx.fillStyle = sea; ctx.fillRect(mx, my, mw, mh)
      // extent
      let ext: number[]
      const subF = q.sub ? b.subs.features.find((f: any) => f.properties.name === q.sub) : null
      const bboxOf = (g: any) => { const e = [999, 999, -999, -999]; const walk = (a: any) => { if (typeof a[0] === 'number') { e[0] = Math.min(e[0], a[0]); e[1] = Math.min(e[1], a[1]); e[2] = Math.max(e[2], a[0]); e[3] = Math.max(e[3], a[1]) } else a.forEach(walk) }; walk(g.coordinates); return e }
      ext = subF ? bboxOf(subF.geometry) : bboxOf(b.county.features[0].geometry)
      const kx = Math.cos((((ext[1] + ext[3]) / 2) * Math.PI) / 180)
      const gw = (ext[2] - ext[0]) * kx, gh = ext[3] - ext[1]
      const sc = Math.min(mw / gw, mh / gh) * 0.92
      const ox = mx + (mw - gw * sc) / 2, oy = my + (mh - gh * sc) / 2
      const P = (lon: number, lat: number): [number, number] => [ox + (lon - ext[0]) * kx * sc, oy + (ext[3] - lat) * sc]
      const path = (g: any) => {
        const rings = g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []
        ctx.beginPath()
        for (const r of rings) r.forEach(([x, y]: number[], i: number) => { const [px, py] = P(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py) })
      }
      ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip()
      // county fill + raster clipped to county
      const countyG = b.county.features[0].geometry
      path(countyG); ctx.fillStyle = dark ? '#1d3150' : '#fbf6ea'; ctx.fill()
      if (st.raster !== 'none') {
        try {
          const img = new Image(); img.src = `./overlays/${{ elevation: 'elevation_hillshade', lulc: 'lulc_2010', population: 'population_2019' }[st.raster]}.webp`; await img.decode()
          ctx.save(); path(countyG); ctx.clip()
          const [x0, y0] = P(38.6288, 1.0259), [x1, y1] = P(41.5926, -2.0656)
          ctx.globalAlpha = 0.85; ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0); ctx.restore()
        } catch { /* raster optional */ }
      }
      if (cancelled) return
      if (st.buffers) {
        const ring = b.buffers.features.find((f: any) => +f.properties.buffer_km === 2)
        if (ring) { path(ring.geometry); ctx.fillStyle = 'rgba(255,193,7,.22)'; ctx.fill('evenodd'); ctx.strokeStyle = '#f2a03d'; ctx.lineWidth = 2 * s; ctx.setLineDash([10 * s, 6 * s]); ctx.stroke(); ctx.setLineDash([]) }
      }
      if (st.floods) b.floods.forEach((fc: any) => fc.features.forEach((f: any) => { path(f.geometry); ctx.fillStyle = 'rgba(30,136,229,.55)'; ctx.fill('evenodd') }))
      if (st.laghas) {
        const LC: Record<string, string> = { 'Very High': '#c81d25', High: '#f28c28', Moderate: '#f2c230', Low: '#2e9e4f' }
        b.laghas.features.forEach((f: any) => { path(f.geometry); ctx.strokeStyle = LC[f.properties.ff_hazard] || '#c9a35a'; ctx.lineWidth = 1.6 * s; ctx.stroke() })
      }
      // subcounties
      b.subs.features.forEach((f: any) => { path(f.geometry); ctx.strokeStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(20,35,56,.55)'; ctx.lineWidth = 2 * s; ctx.setLineDash([12 * s, 6 * s]); ctx.stroke(); ctx.setLineDash([]) })
      // tana
      b.tana.features.forEach((f: any) => { path(f.geometry); ctx.strokeStyle = '#0d47a1'; ctx.lineWidth = 6 * s; ctx.lineJoin = 'round'; ctx.stroke(); ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 2.5 * s; ctx.stroke() })
      // county boundary
      path(countyG); ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 5 * s; ctx.stroke()
      // subcounty labels
      ctx.textAlign = 'center'
      b.subs.features.forEach((f: any) => {
        const e = bboxOf(f.geometry); const [x, y] = P((e[0] + e[2]) / 2, (e[1] + e[3]) / 2)
        ctx.font = `700 ${(q.sub ? 30 : 24) * s}px Lexend, sans-serif`; ctx.lineWidth = 6 * s; ctx.strokeStyle = paper; ctx.strokeText(f.properties.name, x, y); ctx.fillStyle = dark ? '#e8c07d' : '#7a2614'; ctx.fillText(f.properties.name, x, y)
      })
      // points
      const cats = st.colorBy === 'risk' ? ['HIGH', 'MEDIUM', 'LOW'] : Array.from(new Set(res.map((r) => String(r.attrs[st.colorBy] ?? '')))).slice(0, 10)
      const colorOf = (r: Rec) => st.colorBy === 'risk' ? RISK_C[r.risk] : PALETTE[Math.max(0, cats.indexOf(String(r.attrs[st.colorBy] ?? ''))) % PALETTE.length]
      const rad = (res.length > 1000 ? 5 : res.length > 200 ? 8 : 12) * s
      res.forEach((r) => { const [x, y] = P(r.lon, r.lat); ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fillStyle = colorOf(r); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, rad / 4); ctx.stroke() })
      if (st.labels && res.length <= 30) {
        ctx.textAlign = 'left'; ctx.font = `600 ${20 * s}px Lexend, sans-serif`
        const boxes: number[][] = []
        res.forEach((r) => {
          const [x, y] = P(r.lon, r.lat)
          const tw = ctx.measureText(r.name).width, th = 22 * s
          // try right, left, above, below - skip the label if every slot collides
          const slots = [[x + rad + 4 * s, y + 6 * s], [x - rad - 4 * s - tw, y + 6 * s], [x - tw / 2, y - rad - 6 * s], [x - tw / 2, y + rad + th]]
          const ok = slots.find(([lx, ly]) => !boxes.some((b) => lx < b[2] && lx + tw > b[0] && ly - th < b[3] && ly > b[1]))
          if (!ok) return
          boxes.push([ok[0], ok[1] - th, ok[0] + tw, ok[1] + 4 * s])
          ctx.lineWidth = 5 * s; ctx.strokeStyle = paper; ctx.strokeText(r.name, ok[0], ok[1]); ctx.fillStyle = ink; ctx.fillText(r.name, ok[0], ok[1])
        })
      }
      ctx.restore()
      ctx.strokeStyle = ink; ctx.lineWidth = 2 * s; ctx.strokeRect(mx, my, mw, mh)

      // north arrow
      const nx = mx + mw - 70 * s, ny = my + 40 * s
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(nx, ny + 45 * s, 52 * s, 0, 7); ctx.fill()
      ctx.beginPath(); ctx.moveTo(nx, ny + 5 * s); ctx.lineTo(nx + 22 * s, ny + 70 * s); ctx.lineTo(nx, ny + 55 * s); ctx.closePath(); ctx.fillStyle = '#c81d25'; ctx.fill()
      ctx.beginPath(); ctx.moveTo(nx, ny + 5 * s); ctx.lineTo(nx - 22 * s, ny + 70 * s); ctx.lineTo(nx, ny + 55 * s); ctx.closePath(); ctx.fillStyle = '#142338'; ctx.fill()
      ctx.fillStyle = '#142338'; ctx.textAlign = 'center'; ctx.font = `800 ${26 * s}px Lexend, sans-serif`; ctx.fillText('N', nx, ny + 95 * s)
      // scale bar
      const kmPx = sc / 110.57
      const nice = [5, 10, 20, 25, 50, 100].find((k) => k * kmPx > mw * 0.12) || 100
      const sx = mx + mw - nice * kmPx - 40 * s, sy = my + mh - 40 * s
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(sx - 15 * s, sy - 40 * s, nice * kmPx + 30 * s, 60 * s)
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#142338'; ctx.fillRect(sx + (i * nice * kmPx) / 4, sy, (nice * kmPx) / 4, 10 * s) }
      ctx.strokeStyle = '#142338'; ctx.lineWidth = 1.5 * s; ctx.strokeRect(sx, sy, nice * kmPx, 10 * s)
      ctx.fillStyle = '#142338'; ctx.font = `600 ${20 * s}px Lexend, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('0', sx - 6 * s, sy - 8 * s); ctx.textAlign = 'right'; ctx.fillText(`${nice} km`, sx + nice * kmPx + 10 * s, sy - 8 * s)

      // legend
      const items: [string, string, 'dot' | 'area' | 'line'][] = cats.map((k) => [st.colorBy === 'risk' ? `${k[0]}${k.slice(1).toLowerCase()} flood risk` : k || '(blank)', st.colorBy === 'risk' ? RISK_C[k as 'HIGH'] : PALETTE[cats.indexOf(k) % PALETTE.length], 'dot'])
      items.push(['River Tana', '#1565c0', 'line'], ['County boundary', '#ff1744', 'line'])
      if (st.floods) items.push(['Past flood extent 2023–24 (UNOSAT)', 'rgba(30,136,229,.7)', 'area'])
      if (st.buffers) items.push(['2 km River Tana buffer', 'rgba(255,193,7,.6)', 'area'])
      if (st.laghas) items.push(['Lagha (colour = flash-flood hazard)', '#f28c28', 'line'])
      const lh = 36 * s, lw = 470 * s, lhH = 60 * s + items.length * lh
      const lx = mx + 20 * s, ly = my + mh - lhH - 20 * s
      ctx.fillStyle = 'rgba(255,255,255,.93)'; ctx.fillRect(lx, ly, lw, lhH); ctx.strokeStyle = '#142338'; ctx.lineWidth = 1.5 * s; ctx.strokeRect(lx, ly, lw, lhH)
      ctx.fillStyle = '#142338'; ctx.textAlign = 'left'; ctx.font = `800 ${24 * s}px Lexend, sans-serif`; ctx.fillText('Legend', lx + 18 * s, ly + 38 * s)
      ctx.font = `400 ${20 * s}px Lexend, sans-serif`
      items.forEach(([t, col, kind], i) => {
        const y = ly + 70 * s + i * lh
        ctx.fillStyle = col; ctx.strokeStyle = col
        if (kind === 'dot') { ctx.beginPath(); ctx.arc(lx + 32 * s, y - 7 * s, 10 * s, 0, 7); ctx.fill() }
        else if (kind === 'area') ctx.fillRect(lx + 18 * s, y - 18 * s, 28 * s, 20 * s)
        else { ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(lx + 16 * s, y - 8 * s); ctx.lineTo(lx + 48 * s, y - 8 * s); ctx.stroke() }
        ctx.fillStyle = '#142338'; ctx.fillText(t.slice(0, 42), lx + 62 * s, y, lw - 75 * s)
      })

      // footer
      ctx.fillStyle = dark ? '#0e1a2b' : '#f6f8f7'; ctx.fillRect(0, H - footH, W, footH)
      ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.font = `400 ${19 * s}px Lexend, sans-serif`
      const today = new Date().toISOString().slice(0, 10)
      ctx.fillText(`Data: ${ds.cite}; UNOSAT flood extents 2023–24; geoBoundaries; HydroSHEDS; ${st.raster === 'elevation' ? 'NASA SRTM' : st.raster === 'lulc' ? 'RCMRD LUC2010' : st.raster === 'population' ? 'WorldPop 2019' : ''}. WGS 84.`, pad, H - footH + 42 * s, W - 2 * pad)
      ctx.fillText(`Made ${today} with the Garissa CSG portal · Directorate of ICT & GIS · james.mukoma@garissa.go.ke · Indicative – verify on the ground before decisions.`, pad, H - footH + 80 * s, W - 2 * pad)
    })()
    return () => { cancelled = true }
  }, [b, res, st, q.sub, ds, title, describe])

  // ----------------------------------------------------------- downloads
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const save = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) }
  const png = () => cv.current?.toBlob((bl) => bl && save(bl, `${slug}.png`), 'image/png')
  const csv = () => {
    const cols = ['name', 'subcounty', 'lat', 'lon', 'dist_tana_km', 'in_past_flood', 'flood_risk', ...ds.fields]
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = res.map((r) => [r.name, r.sub, r.lat, r.lon, isNaN(r.dist) ? '' : r.dist, r.flooded ? 'yes' : 'no', r.risk, ...ds.fields.map((f) => r.attrs[f])].map(esc).join(','))
    save(new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' }), `${slug}.csv`)
  }
  const gj = () => save(new Blob([JSON.stringify({ type: 'FeatureCollection', name: title, features: res.map((r) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: { name: r.name, subcounty: r.sub, dist_tana_km: r.dist, in_past_flood: r.flooded, flood_risk: r.risk, ...r.attrs } })) })], { type: 'application/geo+json' }), `${slug}.geojson`)

  const ask = (text: string) => {
    const p = parseQuery(text)
    setQ((o) => ({ ...o, sub: '', maxKm: 150, onlyFlooded: false, risk: '', text: '', ...p }))
    setNl(text)
    setSt((s) => ({ ...s, title: '' }))
  }
  const counts = useMemo(() => ({ HIGH: res.filter((r) => r.risk === 'HIGH').length, MEDIUM: res.filter((r) => r.risk === 'MEDIUM').length, LOW: res.filter((r) => r.risk === 'LOW').length }), [res])

  return (
    <>
      <PageHero img="./img/map_unosat_floods.jpg" tone="night" title="Ask the map a question, take the answer home" lead="Pick what you care about – schools, clinics, boreholes, water pans – filter by sub-county, distance to the Tana or past floods, then download a ready-to-print colour map, a spreadsheet or GIS data.">
        <a href="#composer" className="rounded-xl bg-sand px-5 py-3 font-semibold text-night">Start a map</a>
      </PageHero>

      <Section id="composer">
        <form onSubmit={(e) => { e.preventDefault(); ask(nl) }} className="flex flex-col gap-3 rounded-2xl bg-night p-4 text-white sm:flex-row sm:items-center">
          <Wand2 className="hidden shrink-0 text-sand sm:block" />
          <input value={nl} onChange={(e) => setNl(e.target.value)} placeholder="Type a question, e.g. “schools within 2 km of the Tana in Fafi”" className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-lg outline-none placeholder:text-white/55 focus:bg-white/15" />
          <button className="rounded-xl bg-sand px-5 py-3 font-semibold text-night">Make my map</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {RECIPES.map((r) => <button key={r.t} onClick={() => ask(r.q)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[15px] font-medium ring-1 ring-black/10 hover:ring-tana"><Sparkles size={15} className="text-tana" />{r.t}</button>)}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-36 lg:self-start">
            <h3 className="flex items-center gap-2 text-xl font-bold"><Filter size={20} className="text-tana" /> Query</h3>
            <Field label="What to map">
              <select value={q.ds} onChange={(e) => setQ({ ...q, ds: e.target.value })} className="sel">{DATASETS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select>
            </Field>
            <Field label="Sub-county">
              <select value={q.sub} onChange={(e) => setQ({ ...q, sub: e.target.value })} className="sel"><option value="">Whole county</option>{SUBS.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label={`Distance to River Tana: ${q.maxKm >= 150 ? 'any' : `≤ ${q.maxKm} km`}`}>
              <input type="range" min={0.5} max={150} step={0.5} value={q.maxKm} onChange={(e) => setQ({ ...q, maxKm: +e.target.value })} className="w-full accent-tana" />
            </Field>
            <Field group label="Flood risk class">
              <div className="flex flex-wrap gap-1.5">
                {['', 'HIGH', 'MEDIUM', 'LOW'].map((k) => <button key={k} type="button" onClick={() => setQ({ ...q, risk: k })} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${q.risk === k ? 'text-white' : 'bg-paper'}`} style={q.risk === k ? { background: k ? RISK_C[k as 'HIGH'] : '#142338' } : {}}>{k ? k[0] + k.slice(1).toLowerCase() : 'All'}</button>)}
              </div>
            </Field>
            <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={q.onlyFlooded} onChange={(e) => setQ({ ...q, onlyFlooded: e.target.checked })} className="h-5 w-5 accent-tana" /> Only inside past flood extents</label>
            <Field label="Name contains">
              <input value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} className="sel" placeholder="e.g. Primary, Bura, Level 4" />
            </Field>
            <hr className="border-black/10" />
            <h3 className="flex items-center gap-2 text-xl font-bold"><MapPinned size={20} className="text-tana" /> Map style</h3>
            <Field label="Map title"><input value={st.title} onChange={(e) => setSt({ ...st, title: e.target.value })} placeholder={title} className="sel" /></Field>
            <Field label="Background">
              <select value={st.raster} onChange={(e) => setSt({ ...st, raster: e.target.value as Style['raster'] })} className="sel">
                <option value="elevation">Elevation & hillshade</option><option value="lulc">Land use / land cover</option><option value="population">Population density</option><option value="none">Plain</option>
              </select>
            </Field>
            <Field label="Colour points by">
              <select value={st.colorBy} onChange={(e) => setSt({ ...st, colorBy: e.target.value })} className="sel"><option value="risk">Flood risk class</option>{ds.fields.map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}</select>
            </Field>
            <div className="grid grid-cols-2 gap-2 text-[15px]">
              {([['floods', 'Past floods'], ['buffers', '2 km Tana buffer'], ['laghas', 'Laghas'], ['labels', 'Name labels']] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={st[k]} onChange={(e) => setSt({ ...st, [k]: e.target.checked })} className="h-4 w-4 accent-tana" />{l}</label>
              ))}
            </div>
            <Field group label="Paper">
              <div className="flex flex-wrap gap-1.5">
                {([['a4', 'A4 landscape'], ['square', 'Social square'], ['phone', 'Phone poster']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setSt({ ...st, size: k })} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${st.size === k ? 'bg-night text-white' : 'bg-paper'}`}>{l}</button>)}
                <button type="button" onClick={() => setSt({ ...st, theme: st.theme === 'light' ? 'night' : 'light' })} className="rounded-lg bg-paper px-3 py-1.5 text-sm font-semibold">{st.theme === 'light' ? 'Dark theme' : 'Light theme'}</button>
              </div>
            </Field>
          </aside>

          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-auto">
                <div className="font-display text-2xl font-bold">{busy ? 'Loading…' : describe}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-sm">
                  {(['HIGH', 'MEDIUM', 'LOW'] as const).map((k) => <span key={k} className="rounded-full px-2.5 py-0.5 font-semibold text-white" style={{ background: RISK_C[k] }}>{counts[k]} {k.toLowerCase()} risk</span>)}
                </div>
              </div>
              <button onClick={png} className="btn-dl bg-tana text-white"><ImageIcon size={18} /> Map (PNG)</button>
              <button onClick={csv} className="btn-dl bg-acacia text-white"><FileSpreadsheet size={18} /> Table (CSV)</button>
              <button onClick={gj} className="btn-dl bg-night text-white"><FileJson size={18} /> GIS (GeoJSON)</button>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/10">
              <canvas ref={cv} className="mx-auto block h-auto max-h-[80vh] w-auto max-w-full" aria-label={`Map preview: ${title}`} />
            </div>
            <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead className="sticky top-0 bg-night text-white"><tr><th className="p-3">Name</th><th className="p-3">Sub-county</th><th className="p-3">To Tana</th><th className="p-3">Past flood</th><th className="p-3">Risk</th>{ds.fields.map((f) => <th key={f} className="p-3 capitalize">{f.replace(/_/g, ' ')}</th>)}</tr></thead>
                <tbody>
                  {res.slice(0, 200).map((r) => (
                    <tr key={r.id} className="border-t border-black/5">
                      <td className="p-3 font-medium">{r.name}</td><td className="p-3">{r.sub}</td><td className="p-3 tabular">{isNaN(r.dist) ? '–' : `${r.dist} km`}</td>
                      <td className="p-3">{r.flooded ? 'Yes' : 'No'}</td>
                      <td className="p-3"><span className="rounded px-2 py-0.5 text-sm font-bold text-white" style={{ background: RISK_C[r.risk] }}>{r.risk}</span></td>
                      {ds.fields.map((f) => <td key={f} className="p-3">{String(r.attrs[f] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {res.length > 200 && <p className="p-3 text-sm text-muted">Showing 200 of {res.length}. Download the CSV for the full list.</p>}
              {!busy && !res.length && <p className="p-5 text-muted">Nothing matches. Widen the distance, choose the whole county or clear the risk filter.</p>}
            </div>
            <p className="text-sm text-muted">Risk class: <b>High</b> = inside a 2023/24 UNOSAT flood extent, within 1 km of the Tana, or within 250 m of a high-hazard lagha; <b>Medium</b> = within 5 km of the Tana or 500 m of a lagha; <b>Low</b> = otherwise. Screening only – confirm with ward teams.</p>
          </div>
        </div>
      </Section>

      <Section title="Published county maps" lead="High-resolution maps prepared by the Directorate of ICT & GIS for CSG meetings. Free to download and share.">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[['map_unosat_floods', 'UNOSAT flood extents 2023–2024'], ['map_lagha_hazard', 'Lagha flash-flood hazard'], ['map_town_flash_floods', 'Garissa Town flash floods'], ['map_dadaab_2023', 'Dadaab camps flooding 2023'], ['map_seven_forks_to_garissa', 'Seven Forks to Garissa'], ['map_nbs_sites', 'Nature-based solution sites']].map(([f, t]) => (
            <figure key={f} className="m-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <img src={`./img/${f}.jpg`} alt={t} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-2 p-3"><span className="font-semibold">{t}</span><a href={`./img/${f}.jpg`} download className="inline-flex items-center gap-1 rounded-lg bg-paper px-3 py-1.5 text-sm font-semibold hover:bg-sand"><Download size={16} /> JPG</a></figcaption>
            </figure>
          ))}
        </div>
      </Section>
    </>
  )
}

function Field({ label, children, group }: { label: string; children: React.ReactNode; group?: boolean }) {
  const inner = <><span className="mb-1.5 block text-[15px] font-semibold text-muted">{label}</span>{children}</>
  return group ? <div role="group" aria-label={label}>{inner}</div> : <label className="block">{inner}</label>
}
