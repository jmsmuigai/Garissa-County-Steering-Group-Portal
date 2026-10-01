// "Am I at risk?" - location flood-risk assessment computed in the browser from the portal's GIS layers.
import { geo } from './api'

type Pt = [number, number] // [lon, lat]

export function pointInGeom(pt: Pt, geom: any): boolean {
  if (!geom) return false
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []
  const [x, y] = pt
  return polys.some((poly: number[][][]) => {
    let inside = false
    const ring = poly[0]
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    if (!inside) return false
    for (let h = 1; h < poly.length; h++) {
      let inHole = false
      const r = poly[h]
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inHole = !inHole
      }
      if (inHole) return false
    }
    return true
  })
}

// equirectangular km distance (accurate enough at Garissa's latitude for < 100 km)
const KX = 111.32 * Math.cos((0.5 * Math.PI) / 180), KY = 110.57
export function kmBetween(a: Pt, b: Pt) {
  return Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY)
}
function segDist(p: Pt, a: Pt, b: Pt) {
  const ax = a[0] * KX, ay = a[1] * KY, bx = b[0] * KX, by = b[1] * KY, px = p[0] * KX, py = p[1] * KY
  const dx = bx - ax, dy = by - ay
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
export function distToLine(p: Pt, geom: any) {
  const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : []
  let d = Infinity
  for (const l of lines) for (let i = 1; i < l.length; i++) d = Math.min(d, segDist(p, l[i - 1], l[i]))
  return d
}

let lulcCtx: CanvasRenderingContext2D | null = null
const LULC_BOUNDS = { s: -2.0656, w: 38.6288, n: 1.0259, e: 41.5926 }
const LULC = { Savannah: '#a6d96a', Shrubland: '#b8a07e', 'Forest (riverine)': '#1b7837', Grassland: '#c2e699', Agriculture: '#f781bf', 'Bare land': '#e6c07b', 'Urban / built-up': '#e31a1c', Water: '#2c7fb8', Wetland: '#35978f' }
async function landCoverAt(lon: number, lat: number): Promise<string | null> {
  try {
    if (!lulcCtx) {
      const img = new Image()
      img.src = './overlays/lulc_2010.webp'
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      lulcCtx = c.getContext('2d', { willReadFrequently: true })!
      lulcCtx.drawImage(img, 0, 0)
    }
    const W = lulcCtx.canvas.width, H = lulcCtx.canvas.height
    const x = Math.round(((lon - LULC_BOUNDS.w) / (LULC_BOUNDS.e - LULC_BOUNDS.w)) * W)
    // web-mercator stretch is negligible at the equator; linear in latitude is fine here
    const y = Math.round(((LULC_BOUNDS.n - lat) / (LULC_BOUNDS.n - LULC_BOUNDS.s)) * H)
    if (x < 0 || y < 0 || x >= W || y >= H) return null
    const d = lulcCtx.getImageData(x, y, 1, 1).data
    if (d[3] < 100) return null
    let best = '', bd = 1e9
    for (const [k, hex] of Object.entries(LULC)) {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
      const dd = (r - d[0]) ** 2 + (g - d[1]) ** 2 + (b - d[2]) ** 2
      if (dd < bd) { bd = dd; best = k }
    }
    return best
  } catch { return null }
}

export type RiskResult = {
  lat: number; lon: number; inCounty: boolean; subcounty: string | null
  level: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[]; advice: string[]
  floods: { label: string; date: string }[]
  floodsAtStage: number | null
  distTana: number
  lagha: { km: number; hazard: string; cls: string; id: string; system: string } | null
  landCover: string | null
  schools: { name: string; km: number; lat: number; lon: number; risk?: string }[]
  health: { name: string; km: number; lat: number; lon: number; level?: string }[]
}

export async function assessLocation(lat: number, lon: number): Promise<RiskResult> {
  const p: Pt = [lon, lat]
  const [county, subs, tana, laghas, schools, health, sim, ...floodLayers] = await Promise.all([
    geo('county.geojson'), geo('subcounties.geojson'), geo('tana_river.geojson'), geo('laghas.geojson'), geo('schools.geojson'),
    geo('health_facilities.geojson'), geo('flood_sim_bands.geojson'),
    geo('flood_2023_viirs.geojson'), geo('flood_2023_town.geojson'), geo('flood_2023_dadaab.geojson'), geo('flood_2024_tana.geojson'),
  ])
  const inCounty = pointInGeom(p, county.features[0].geometry)
  let subcounty: string | null = subs.features.find((f: any) => pointInGeom(p, f.geometry))?.properties.name ?? null
  const floods = floodLayers.flatMap((fc: any) => fc.features.filter((f: any) => pointInGeom(p, f.geometry)).map((f: any) => ({ label: f.properties.label, date: f.properties.date })))
  const band = sim.features.slice().sort((a: any, b: any) => a.properties.stage_m - b.properties.stage_m).find((f: any) => pointInGeom(p, f.geometry))
  const floodsAtStage = band ? band.properties.stage_m : null
  const distTana = distToLine(p, tana.features[0].geometry)
  let lagha: RiskResult['lagha'] = null
  for (const f of laghas.features) {
    const d = distToLine(p, f.geometry)
    if (!lagha || d < lagha.km) lagha = { km: d, hazard: f.properties.ff_hazard, cls: f.properties.lagha_class, id: f.properties.id, system: f.properties.system }
  }
  const near = (fc: any, n: number) => fc.features.map((f: any) => ({ f, km: kmBetween(p, f.geometry.coordinates) })).sort((a: any, b: any) => a.km - b.km).slice(0, n)
  const sch = near(schools, 5).map(({ f, km }: any) => ({ name: f.properties.name, km: +km.toFixed(2), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], risk: f.properties.risk }))
  const hf = near(health, 5).map(({ f, km }: any) => ({ name: f.properties.name, km: +km.toFixed(2), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], level: f.properties.kephl_level }))
  if (!subcounty && inCounty) subcounty = null
  const landCover = await landCoverAt(lon, lat)

  const reasons: string[] = []
  let score = 0
  if (floods.length) { score += 3; reasons.push(`Inside ${floods.length} mapped historical flood extent${floods.length > 1 ? 's' : ''} (UNOSAT ${floods.map((f) => f.date.slice(0, 7)).join(', ')}).`) }
  if (floodsAtStage !== null) { score += floodsAtStage <= 5 ? 3 : floodsAtStage <= 6.2 ? 2 : 1; reasons.push(`The flood simulator wets this spot when the Tana at Garissa reaches about ${floodsAtStage.toFixed(1)} m.`) }
  if (distTana < 1) { score += 2; reasons.push(`Only ${distTana.toFixed(2)} km from the River Tana.`) } else if (distTana < 5) { score += 1; reasons.push(`${distTana.toFixed(1)} km from the River Tana.`) }
  if (lagha) {
    const hz = lagha.hazard
    if (lagha.km < 0.3 && (hz === 'Very High' || hz === 'High')) { score += 3; reasons.push(`${(lagha.km * 1000).toFixed(0)} m from a ${hz.toLowerCase()}-hazard lagha (${lagha.system}) – flash floods arrive within hours of a storm.`) }
    else if (lagha.km < 0.3) { score += 1; reasons.push(`${(lagha.km * 1000).toFixed(0)} m from a ${hz.toLowerCase()}-hazard lagha.`) }
    else if (lagha.km < 1 && (hz === 'Very High' || hz === 'High')) { score += 1; reasons.push(`${lagha.km.toFixed(2)} km from a ${hz.toLowerCase()}-hazard lagha.`) }
  }
  const level: RiskResult['level'] = score >= 4 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW'
  if (!reasons.length) reasons.push('Not inside any mapped flood extent, simulated floodplain or lagha corridor.')
  const advice = level === 'HIGH'
    ? ['Plan an evacuation route to higher ground now and agree a family meeting point.', 'Move livestock, seed, pumps and documents to safety before the Tana passes 4 m.', 'Never cross a flowing lagha; follow CSG and Red Cross (1199) alerts.']
    : level === 'MEDIUM'
      ? ['Keep a go-bag ready and watch the CSG alert level on this portal.', 'Clear drainage around your home; avoid sleeping in low-lying rooms during heavy storms.', 'Know your nearest school/health facility below for shelter and care.']
      : ['Low mapped flood exposure – but local ponding is still possible in heavy storms.', 'Store clean water safely and use mosquito nets during the rains.', 'Help neighbours in riverine and lagha areas.']
  return { lat, lon, inCounty, subcounty, level, reasons, advice, floods, floodsAtStage, distTana, lagha, landCover, schools: sch, health: hf }
}

export const RISK_COLOR = { HIGH: '#c81d25', MEDIUM: '#f28c28', LOW: '#2e9e4f' }

// place search across the portal gazetteer + assets
export async function searchPlaces(q: string) {
  const s = q.trim().toLowerCase()
  if (s.length < 2) return []
  const m = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/)
  if (m) {
    let a = +m[1], b = +m[2]
    if (Math.abs(a) > 5 && Math.abs(b) <= 5) [a, b] = [b, a] // user typed lon,lat
    return [{ name: `Coordinates ${a.toFixed(5)}, ${b.toFixed(5)}`, lat: a, lon: b, kind: 'coordinates' }]
  }
  const out: { name: string; lat: number; lon: number; kind: string }[] = []
  for (const [file, kind, key] of [['places.geojson', 'Town / village', 'name'], ['schools.geojson', 'School', 'name'], ['health_facilities.geojson', 'Health facility', 'name'], ['water_pans.geojson', 'Water pan', 'name'], ['boreholes.geojson', 'Borehole', 'village']] as const) {
    const g = await geo(file)
    for (const f of g.features) {
      const n = String(f.properties[key] || '')
      if (n.toLowerCase().includes(s)) out.push({ name: n, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], kind })
      if (out.length > 30) break
    }
  }
  return out.slice(0, 12)
}
