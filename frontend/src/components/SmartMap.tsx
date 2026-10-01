import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, useMap } from 'react-leaflet'
import {
  Layers, Map as MapIcon, Crosshair, ShieldAlert, Maximize2, Minimize2, Waves, CircleDot, X, ChevronDown, ChevronUp, Play, Pause, LocateFixed, Info,
} from 'lucide-react'
import { BASEMAPS, LAYERS, LAYER_BY_ID, colorFor, type LayerDef } from '../lib/layers'
import { geo, DATA } from '../lib/api'
import { mapBus, levelFor, LEVEL_COLORS, useApp, type MapAction } from '../lib/store'
import { t } from '../lib/i18n'
import StaffGauge from './StaffGauge'
import RiskPanel from './RiskPanel'
import type { RiskResult } from '../lib/risk'

type Highlight = { title: string; features: { name: string; lat: number; lon: number; [k: string]: any }[] } | null
const GARISSA_BOUNDS: L.LatLngBoundsExpression = [[-2.05, 38.6], [1.0, 41.6]]
const ASSET_IDS = ['schools', 'health', 'boreholes', 'water_pans']

function hav(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

type EngineProps = {
  visible: Set<string>; basemap: string; stage: number; bufferKm: number; waveHour: number | null
  highlight: Highlight; circle: { lat: number; lon: number; r: number } | null; bufferTool: boolean
  onCoord: (c: [number, number]) => void; onMapClick: (lat: number, lon: number) => void; fitKey: number; focus: 'garissa' | 'upper' | 'all'
  onZoom: (z: number) => void
  me: RiskResult | null
}

function Engine(p: EngineProps) {
  const map = useMap()
  const base = useRef<L.TileLayer | null>(null)
  const layers = useRef<Record<string, L.Layer>>({})
  const you = useRef<L.LayerGroup>(L.layerGroup())
  const hl = useRef<L.LayerGroup>(L.layerGroup())
  const circ = useRef<L.LayerGroup>(L.layerGroup())
  const wave = useRef<L.LayerGroup>(L.layerGroup())
  const labels = useRef<L.LayerGroup>(L.layerGroup())
  const tanaCoords = useRef<[number, number][]>([])
  const travel = useRef<any[]>([])
  const [zoom, setZoom] = useState(map.getZoom())

  // ---- basemap
  useEffect(() => {
    const b = BASEMAPS.find((x) => x.id === p.basemap) || BASEMAPS[0]
    const tl = L.tileLayer(b.url, { subdomains: b.sub.length ? b.sub : 'abc', attribution: b.attr, maxZoom: 20, crossOrigin: true } as any)
    tl.addTo(map)
    tl.bringToBack()
    const old = base.current
    base.current = tl
    if (old) setTimeout(() => map.removeLayer(old), 300)
  }, [p.basemap, map])

  // ---- static groups
  useEffect(() => {
    (map.getPane('rasters') || map.createPane('rasters')).style.zIndex = '350'
    you.current.addTo(map); hl.current.addTo(map); circ.current.addTo(map); wave.current.addTo(map); labels.current.addTo(map)
    const scale = L.control.scale({ position: 'bottomleft', imperial: true, maxWidth: 160 }).addTo(map)
    const zoom = L.control.zoom({ position: 'topright' }).addTo(map)
    map.on('mousemove', (e: L.LeafletMouseEvent) => p.onCoord([e.latlng.lat, e.latlng.lng]))
    map.on('zoomend', () => { setZoom(map.getZoom()); p.onZoom(map.getZoom()) })
    geo('tana_river.geojson').then((g) => { tanaCoords.current = g.features[0].geometry.coordinates })
    geo('tana_travel_markers.geojson').then((g) => { travel.current = g.features })
    geo('subcounties.geojson').then((g) => {
      labels.current.clearLayers()
      g.features.forEach((f: any) => {
        const b = L.geoJSON(f).getBounds().getCenter()
        L.marker(b, { opacity: 0, interactive: false, icon: L.divIcon({ className: '', html: '' }) })
          .bindTooltip(f.properties.name, { permanent: true, direction: 'center', className: 'csg-label' }).addTo(labels.current)
      })
    })
    return () => { scale.remove(); zoom.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  useEffect(() => {
    const fn = (e: L.LeafletMouseEvent) => p.onMapClick(e.latlng.lat, e.latlng.lng)
    map.on('click', fn)
    map.getContainer().style.cursor = p.bufferTool ? 'crosshair' : ''
    return () => { map.off('click', fn) }
  }, [map, p.bufferTool, p.onMapClick])

  // ---- fit
  useEffect(() => {
    if (p.focus === 'upper') map.fitBounds([[-1.1, 36.6], [0.3, 38.4]])
    else if (p.focus === 'all') map.fitBounds([[-2.6, 36.6], [1.0, 41.6]])
    else map.fitBounds(GARISSA_BOUNDS)
  }, [p.fitKey, p.focus, map])

  // ---- thematic layers
  useEffect(() => {
    let cancelled = false
    LAYERS.forEach(async (def) => {
      const want = p.visible.has(def.id) && (!def.minZoom || zoom >= def.minZoom)
      const have = layers.current[def.id]
      if (!want) { if (have) { map.removeLayer(have); delete layers.current[def.id] } return }
      const needsRebuild = def.id === 'flood_sim' || def.id === 'tana_buffers'
      if (have && !needsRebuild) return
      if (have) { map.removeLayer(have); delete layers.current[def.id] }
      const g = def.file ? await geo(def.file) : null
      if (cancelled || !p.visible.has(def.id)) return
      const lyr = buildLayer(def, g, p.stage, p.bufferKm)
      if (layers.current[def.id]) map.removeLayer(layers.current[def.id])
      layers.current[def.id] = lyr
      lyr.addTo(map)
      // z-order: polygons back, points front, county boundary on top of polygons
      const anyL = lyr as any
      if (def.kind === 'polygon') anyL.bringToBack?.()
      if (def.id === 'county') anyL.bringToFront?.()
      if (def.kind === 'point') anyL.bringToFront?.()
    })
    return () => { cancelled = true }
  }, [p.visible, p.stage, p.bufferKm, zoom, map])

  useEffect(() => {
    labels.current.eachLayer(() => {})
    if (p.visible.has('subcounties')) labels.current.addTo(map)
    else map.removeLayer(labels.current)
  }, [p.visible, map])

  // ---- highlight
  useEffect(() => {
    hl.current.clearLayers()
    if (!p.highlight) return
    p.highlight.features.forEach((f) => {
      L.marker([f.lat, f.lon], { icon: L.divIcon({ className: '', html: '<div class="hl-marker"></div>', iconSize: [18, 18] }) })
        .bindTooltip(`<b>${f.name}</b>${f.dist_tana_km !== undefined && f.dist_tana_km !== null ? `<br/>${f.dist_tana_km} km from Tana` : ''}${f.subcounty ? `<br/>${f.subcounty}` : ''}${f.dist_km !== undefined ? `<br/>${f.dist_km} km from point` : ''}`, { className: 'csg-tip' })
        .addTo(hl.current)
    })
    if (p.highlight.features.length && !p.circle) {
      const b = L.latLngBounds(p.highlight.features.map((f) => [f.lat, f.lon] as [number, number]))
      map.fitBounds(b.pad(0.4), { maxZoom: 12 })
    }
  }, [p.highlight, map])

  // ---- "am I at risk" marker
  useEffect(() => {
    you.current.clearLayers()
    if (!p.me) return
    const c = p.me.level === 'HIGH' ? '#c81d25' : p.me.level === 'MEDIUM' ? '#f28c28' : '#2e9e4f'
    L.circle([p.me.lat, p.me.lon], { radius: 1000, color: c, weight: 2, fillOpacity: 0.08, dashArray: '4 6' }).addTo(you.current)
    L.circleMarker([p.me.lat, p.me.lon], { radius: 11, color: '#fff', weight: 4, fillColor: c, fillOpacity: 1 })
      .bindTooltip(`<b>You are here</b><br/>Flood risk: <b>${p.me.level}</b>`, { permanent: true, direction: 'top', offset: [0, -10], className: 'csg-tip' }).addTo(you.current)
    p.me.schools.forEach((x) => L.circleMarker([x.lat, x.lon], { radius: 8, color: '#142338', weight: 2, fillColor: '#ffd600', fillOpacity: 1 }).bindTooltip(`School: <b>${x.name}</b><br/>${x.km} km away`, { className: 'csg-tip' }).addTo(you.current))
    p.me.health.forEach((x) => L.circleMarker([x.lat, x.lon], { radius: 8, color: '#142338', weight: 2, fillColor: '#ff4081', fillOpacity: 1 }).bindTooltip(`Health: <b>${x.name}</b><br/>${x.km} km away`, { className: 'csg-tip' }).addTo(you.current))
    const pts: [number, number][] = [[p.me.lat, p.me.lon], ...p.me.schools.slice(0, 3).map((x) => [x.lat, x.lon] as [number, number]), ...p.me.health.slice(0, 3).map((x) => [x.lat, x.lon] as [number, number])]
    map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 14 })
  }, [p.me, map])

  // ---- buffer circle
  useEffect(() => {
    circ.current.clearLayers()
    if (!p.circle) return
    L.circle([p.circle.lat, p.circle.lon], { radius: p.circle.r * 1000, color: '#ffea00', weight: 3, fillColor: '#ffea00', fillOpacity: 0.12, dashArray: '6 6' }).addTo(circ.current)
    L.circleMarker([p.circle.lat, p.circle.lon], { radius: 5, color: '#142338', fillColor: '#ffea00', fillOpacity: 1, weight: 2 }).addTo(circ.current)
    map.fitBounds(L.latLng(p.circle.lat, p.circle.lon).toBounds(p.circle.r * 2600), { maxZoom: 13 })
  }, [p.circle, map])

  // ---- flood wave
  useEffect(() => {
    wave.current.clearLayers()
    if (p.waveHour === null || !tanaCoords.current.length || !travel.current.length) return
    const tm = travel.current
    const cs = tanaCoords.current
    const idxOf = (pt: [number, number]) => {
      let bi = 0, bd = 1e9
      cs.forEach((c, i) => { const d = (c[0] - pt[0]) ** 2 + (c[1] - pt[1]) ** 2; if (d < bd) { bd = d; bi = i } })
      return bi
    }
    let a = tm[0], b = tm[tm.length - 1]
    for (let i = 0; i < tm.length - 1; i++) if (p.waveHour >= tm[i].properties.travel_h && p.waveHour <= tm[i + 1].properties.travel_h) { a = tm[i]; b = tm[i + 1] }
    const ia = idxOf(a.geometry.coordinates), ib = idxOf(b.geometry.coordinates)
    const frac = Math.min(1, Math.max(0, (p.waveHour - a.properties.travel_h) / Math.max(1, b.properties.travel_h - a.properties.travel_h)))
    const k = Math.round(ia + (ib - ia) * frac)
    const c = cs[Math.min(cs.length - 1, Math.max(0, k))]
    // wetted reach behind the wave front
    L.polyline(cs.slice(0, k + 1).map((x) => [x[1], x[0]] as [number, number]), { color: '#00e5ff', weight: 9, opacity: 0.55 }).addTo(wave.current)
    L.marker([c[1], c[0]], { icon: L.divIcon({ className: '', html: '<div class="wave-marker"></div>', iconSize: [22, 22] }) })
      .bindTooltip(`Flood wave front: +${p.waveHour} h after Kiambere release`, { permanent: true, direction: 'top', className: 'csg-tip', offset: [0, -12] })
      .addTo(wave.current)
  }, [p.waveHour, map])

  return null
}

const OVERLAY_BOUNDS: L.LatLngBoundsExpression = [[-2.0656, 38.6288], [1.0259, 41.5926]]

function buildLayer(def: LayerDef, g: any, stage: number, bufferKm: number): L.Layer {
  if (def.kind === 'image') return L.imageOverlay(def.url!, OVERLAY_BOUNDS, { opacity: def.opacity ?? 0.75, pane: 'rasters', interactive: false })
  if (def.kind === 'wms') return L.tileLayer.wms(def.url!, { layers: def.wmsLayer!, format: 'image/png', transparent: true, opacity: def.opacity ?? 0.75, pane: 'rasters', attribution: def.source } as any)
  if (def.kind === 'tile') return L.tileLayer(def.url!, { opacity: def.opacity ?? 0.6, pane: 'rasters', maxNativeZoom: def.id === 'imerg' ? 6 : 13, maxZoom: 20, attribution: def.source } as any)
  let data = g
  if (def.id === 'flood_sim') data = { ...g, features: g.features.filter((f: any) => Math.abs(f.properties.stage_m - stage) < 0.01) }
  if (def.id === 'tana_buffers') data = { ...g, features: g.features.filter((f: any) => f.properties.buffer_km <= bufferKm) }
  return L.geoJSON(data, {
    style: (f: any) => {
      const c = def.id === 'flood_sim' ? (stage >= 6.2 ? '#c81d25' : stage >= 5 ? '#e4572e' : stage >= 4 ? '#1565c0' : '#42a5f5') : colorFor(def, f?.properties)
      return { color: def.kind === 'polygon' && def.fillOpacity && def.fillOpacity > 0.3 ? c : c, weight: def.weight ?? 2, fillColor: c, fillOpacity: def.fillOpacity ?? 0.2, dashArray: def.dash, opacity: 0.95 }
    },
    pointToLayer: (f: any, latlng) =>
      L.circleMarker(latlng, { radius: def.radius ?? 6, color: '#142338', weight: 1.4, fillColor: colorFor(def, f.properties), fillOpacity: 0.95 }),
    onEachFeature: (f: any, lyr) => {
      lyr.bindTooltip(def.tip(f.properties || {}) + `<div style="opacity:.65;font-size:11px;margin-top:4px">${def.label}</div>`, { className: 'csg-tip', sticky: def.kind !== 'point', direction: 'top', offset: [0, -6] })
      if (def.kind !== 'point') {
        lyr.on('mouseover', (e: any) => e.target.setStyle?.({ weight: (def.weight ?? 2) + 2.5 }))
        lyr.on('mouseout', (e: any) => e.target.setStyle?.({ weight: def.weight ?? 2 }))
      }
    },
  })
}

// ---------------------------------------------------------------------------------- UI
export default function SmartMap({ height = '78vh', initial, focus = 'garissa', showGauge = true, compact = false, forecastPeak }: {
  height?: string; initial?: string[]; focus?: 'garissa' | 'upper' | 'all'; showGauge?: boolean; compact?: boolean; forecastPeak?: { stage: number; label: string; time?: string }
}) {
  const { lang } = useApp()
  const [visible, setVisible] = useState<Set<string>>(new Set(initial || LAYERS.filter((l) => l.on).map((l) => l.id)))
  const [basemap, setBasemap] = useState('google_hybrid')
  const [stage, setStage] = useState(5.0)
  const [bufferKm, setBufferKm] = useState(2)
  const [waveHour, setWaveHour] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [highlight, setHighlight] = useState<Highlight>(null)
  const [circle, setCircle] = useState<{ lat: number; lon: number; r: number } | null>(null)
  const [bufferTool, setBufferTool] = useState(false)
  const [radius, setRadius] = useState(5)
  const [coord, setCoord] = useState<[number, number]>([-0.45, 39.65])
  const [panel, setPanel] = useState<'layers' | 'analysis' | 'risk' | null>(compact || (typeof window !== 'undefined' && window.innerWidth < 900) ? null : 'layers')
  const [me, setMe] = useState<RiskResult | null>(null)
  const [pickMode, setPickMode] = useState(false)
  const [assessReq, setAssessReq] = useState<{ lat: number; lon: number; n: number } | null>(null)
  const [legendOpen, setLegendOpen] = useState(typeof window !== 'undefined' && window.innerWidth > 640)
  const [baseOpen, setBaseOpen] = useState(false)
  const [full, setFull] = useState(false)
  const [fitKey, setFitKey] = useState(0)
  const [stats, setStats] = useState<any>(null)
  const [assets, setAssets] = useState<Record<string, any[]>>({})
  const [zoom, setZoom] = useState(7)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => { fetch(DATA('stats.json')).then((r) => r.json()).then(setStats) }, [])
  useEffect(() => {
    ASSET_IDS.forEach((id) => geo(LAYER_BY_ID[id].file).then((g) => setAssets((a) => ({ ...a, [id]: g.features }))))
  }, [])

  // chatbot -> map
  useEffect(() => mapBus.on((a: MapAction) => {
    if (a.type === 'layers') setVisible((v) => { const n = new Set(v); a.show?.forEach((x) => n.add(x)); a.hide?.forEach((x) => n.delete(x)); return n })
    if (a.type === 'basemap') setBasemap(a.id)
    if (a.type === 'highlight') { setHighlight({ title: a.title, features: a.features }); setCircle(null) }
    if (a.type === 'assess') { setPanel('risk'); setAssessReq({ lat: a.lat, lon: a.lon, n: Date.now() }) }
    if (a.type === 'flood_stage') { setStage(a.stage); setVisible((v) => new Set([...v, 'flood_sim'])) }
    if (a.type === 'circle') { setCircle({ lat: a.lat, lon: a.lon, r: a.radius_km }) }
    if (a.type === 'zoom') {
      const m = (window as any).__csgMap as L.Map | undefined
      if (!m) return
      if (a.bbox) m.fitBounds([[a.bbox[1], a.bbox[0]], [a.bbox[3], a.bbox[2]]])
      else if (a.lat !== undefined && a.lon !== undefined) m.flyTo([a.lat, a.lon], a.zoom || 12)
    }
  }), [])

  // wave animation
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setWaveHour((h) => { const n = (h ?? 0) + 2; if (n > 108) { setPlaying(false); return 108 } return n }), 160)
    return () => clearInterval(id)
  }, [playing])

  const toggle = (id: string) => setVisible((v) => { const n = new Set(v); n.has(id) ? n.delete(id) : n.add(id); return n })

  const bufferResult = useMemo(() => {
    if (!circle) return null
    const out: { name: string; type: string; lat: number; lon: number; dist_km: number }[] = []
    ASSET_IDS.forEach((id) => (assets[id] || []).forEach((f) => {
      const [lon, lat] = f.geometry.coordinates
      const d = hav(circle.lat, circle.lon, lat, lon)
      if (d <= circle.r) out.push({ name: f.properties.name || f.properties.village || LAYER_BY_ID[id].label, type: id, lat, lon, dist_km: +d.toFixed(2) })
    }))
    return out.sort((a, b) => a.dist_km - b.dist_km)
  }, [circle, assets])

  const onMapClick = useMemo(() => (lat: number, lon: number) => {
    if (pickMode) { setPickMode(false); setPanel('risk'); setAssessReq({ lat, lon, n: Date.now() }); return }
    if (!bufferTool) return
    setCircle({ lat, lon, r: radius })
    setHighlight(null)
    setBufferTool(false)
  }, [bufferTool, radius, pickMode])

  useEffect(() => { if (circle) setCircle((c) => (c ? { ...c, r: radius } : c)) }, [radius])

  const legendItems = LAYERS.filter((l) => visible.has(l.id) && l.legend).flatMap((l) => l.legend!.map((x) => ({ ...x, key: l.id + x.label })))
  const groups = Array.from(new Set(LAYERS.map((l) => l.group)))
  const bufCounts = stats?.buffers?.[String(bufferKm)]
  const simLevel = levelFor(stage)

  // on phones, bring the whole map into view when a panel opens (the sheet sits at the map's bottom edge)
  useEffect(() => {
    if (panel && window.innerWidth < 900 && wrap.current) {
      const r = wrap.current.getBoundingClientRect()
      if (r.bottom > window.innerHeight + 4 || r.top < 0) wrap.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [panel])

  const toggleFull = () => {
    const el = wrap.current
    if (!el) return
    if (!document.fullscreenElement) { el.requestFullscreen?.(); setFull(true) } else { document.exitFullscreen?.(); setFull(false) }
    setTimeout(() => (window as any).__csgMap?.invalidateSize(), 300)
  }

  return (
    <div ref={wrap} className="relative overflow-hidden bg-night" style={{ height: full ? '100vh' : height }}>
      <MapContainer center={[-0.45, 39.9]} zoom={7} zoomControl={false} className="h-full w-full" ref={(m) => { if (m) (window as any).__csgMap = m }} preferCanvas>
        <Engine visible={visible} basemap={basemap} stage={stage} bufferKm={bufferKm} waveHour={waveHour} highlight={highlight} circle={circle}
          bufferTool={bufferTool || pickMode} me={me} onCoord={setCoord} onMapClick={onMapClick} fitKey={fitKey} focus={focus} onZoom={setZoom} />
      </MapContainer>

      {/* map title */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-xl bg-night/85 px-5 py-2 text-center text-white shadow-lg backdrop-blur max-w-[70vw] max-sm:hidden">
        <div className="font-display text-lg font-bold leading-tight">{t('home.mapTitle', lang)}</div>
        <div className="text-xs text-white/70">WGS 84 · Garissa CSG GIS · data: UNOSAT, HydroSHEDS, KMD, NBSOS, County departments</div>
      </div>

      {/* left toolbar */}
      <div className="absolute left-3 top-3 z-[600] flex flex-col gap-2">
        <button onClick={() => setPanel(panel === 'risk' ? null : 'risk')} aria-label="Am I at risk? Check my location"
          className={`flex h-11 items-center gap-2 rounded-xl px-3 font-semibold shadow-lg ${panel === 'risk' ? 'bg-white text-night' : 'bg-sand text-night hover:brightness-95'}`}>
          <ShieldAlert size={20} /><span className="max-sm:hidden">Am I at risk?</span></button>
        <ToolBtn active={panel === 'layers'} onClick={() => setPanel(panel === 'layers' ? null : 'layers')} label={t('home.layers', lang)}><Layers size={20} /></ToolBtn>
        <ToolBtn active={panel === 'analysis'} onClick={() => setPanel(panel === 'analysis' ? null : 'analysis')} label="Flood & buffer tools"><Waves size={20} /></ToolBtn>
        <ToolBtn onClick={() => { setFitKey((k) => k + 1); setHighlight(null); setCircle(null) }} label={t('home.reset', lang)}><Crosshair size={20} /></ToolBtn>
        <ToolBtn onClick={toggleFull} label="Full screen">{full ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</ToolBtn>
        <ToolBtn onClick={() => navigator.geolocation?.getCurrentPosition((pos) => (window as any).__csgMap?.flyTo([pos.coords.latitude, pos.coords.longitude], 13))} label="My location"><LocateFixed size={20} /></ToolBtn>
      </div>

      {/* side panel */}
      {panel && (
        <div className="scroll-thin absolute left-16 top-[60px] bottom-12 z-[700] w-[350px] max-w-[calc(100vw-90px)] overflow-y-auto rounded-2xl bg-night/95 p-4 text-white shadow-2xl backdrop-blur max-sm:inset-x-2 max-sm:bottom-2 max-sm:top-auto max-sm:max-h-[62vh] max-sm:w-auto max-sm:max-w-none">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">{panel === 'layers' ? t('home.layers', lang) : panel === 'risk' ? 'Am I at risk?' : 'Flood & buffer tools'}</h3>
            <button onClick={() => setPanel(null)} className="rounded-full p-1 hover:bg-white/10" aria-label="Close panel"><X size={18} /></button>
          </div>
          {panel === 'risk' && <RiskPanel request={assessReq} onResult={(r) => { setMe(r); if (r) setVisible((v) => new Set([...v, 'flood_2023_viirs', 'laghas'])) }} onPick={() => { setPickMode(true); if (window.innerWidth < 640) setPanel(null) }} picking={pickMode} />}
          {panel === 'layers' && groups.map((g) => (
            <fieldset key={g} className="mb-3 border-0 p-0">
              <legend className="mb-1 text-sm font-semibold text-sand">{g}</legend>
              {LAYERS.filter((l) => l.group === g).map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-[15px] hover:bg-white/8">
                  <input type="checkbox" className="h-[18px] w-[18px] accent-[#00b8d4]" checked={visible.has(l.id)} onChange={() => toggle(l.id)} />
                  <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/40" style={{ background: l.styleBy ? Object.values(l.styleBy.map)[0] : l.color }} />
                  <span className="leading-tight">{l.label}{l.minZoom && zoom < l.minZoom && visible.has(l.id) ? <span className="text-xs text-white/60"> (zoom in)</span> : null}</span>
                </label>
              ))}
            </fieldset>
          ))}
          {panel === 'analysis' && (
            <div className="space-y-5 text-[15px]">
              <section>
                <div className="mb-1 flex items-center justify-between font-semibold"><span>{t('home.simulate', lang)}</span>
                  <span className="rounded-md px-2 py-0.5 text-sm font-bold" style={{ background: LEVEL_COLORS[simLevel] }}>{stage.toFixed(1)} m · {simLevel}</span></div>
                <p className="mb-2 text-sm text-white/70">Drag to raise the River Tana at the Garissa gauge (RGS 4G01) and see the floodplain fill, based on the 2023 & 2024 UNOSAT flood envelopes.</p>
                <input type="range" min={3} max={7.5} step={0.5} value={stage} onChange={(e) => { setStage(+e.target.value); setVisible((v) => new Set([...v, 'flood_sim'])) }} className="w-full accent-[#00b8d4]" aria-label="Gauge stage" />
                <div className="flex justify-between text-xs text-white/60"><span>3.0</span><span>4.0 alert</span><span>5.0 alarm</span><span>6.2 emergency</span><span>7.5</span></div>
              </section>
              <section>
                <div className="mb-1 font-semibold">{t('home.wave', lang)}</div>
                <p className="mb-2 text-sm text-white/70">Watch a Kiambere Dam spill travel down the Tana: Garissa in 36–48 h, Tana Delta in 96–120 h.</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (waveHour === null || waveHour >= 108) setWaveHour(0); setPlaying(!playing); setVisible((v) => new Set([...v, 'travel', 'tana'])); setFitKey((k) => k); (window as any).__csgMap?.fitBounds([[-2.6, 37.5], [0.4, 40.6]]) }}
                    className="flex items-center gap-1.5 rounded-lg bg-tana px-3 py-1.5 font-semibold hover:bg-tana-deep">{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? t('btn.pause', lang) : t('btn.play', lang)}</button>
                  <input type="range" min={0} max={108} step={2} value={waveHour ?? 0} onChange={(e) => { setPlaying(false); setWaveHour(+e.target.value) }} className="flex-1 accent-[#00e5ff]" aria-label="Hours after release" />
                  <span className="w-14 text-right tabular text-sm">{waveHour ?? 0} h</span>
                </div>
                {waveHour !== null && <button onClick={() => { setWaveHour(null); setPlaying(false) }} className="mt-1 text-xs text-white/60 underline">Clear wave</button>}
              </section>
              <section>
                <div className="mb-1 font-semibold">{t('home.buffer', lang)}</div>
                <div className="mb-2 flex gap-1.5">
                  {[0.5, 1, 2, 5].map((k) => (
                    <button key={k} onClick={() => { setBufferKm(k); setVisible((v) => new Set([...v, 'tana_buffers'])) }}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold ${bufferKm === k ? 'bg-sand text-night' : 'bg-white/10 hover:bg-white/20'}`}>{k} km</button>
                  ))}
                </div>
                {bufCounts && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[['Schools', bufCounts.schools], ['Health facilities', bufCounts.health], ['Boreholes', bufCounts.boreholes], ['Water pans', bufCounts.water_pans]].map(([k, v]) => (
                      <div key={k as string} className="rounded-lg bg-white/8 px-2.5 py-1.5"><div className="font-display text-xl font-bold tabular">{v}</div><div className="text-white/70">{k} within {bufferKm} km</div></div>
                    ))}
                  </div>
                )}
                <button onClick={() => {
                  const want = ASSET_IDS
                  const feats: any[] = []
                  want.forEach((id) => (assets[id] || []).forEach((f) => { if (f.properties.dist_tana_km <= bufferKm && f.properties.in_county !== false) feats.push({ name: f.properties.name || f.properties.village || id, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], dist_tana_km: f.properties.dist_tana_km }) }))
                  setHighlight({ title: `${feats.length} assets within ${bufferKm} km of the River Tana`, features: feats }); setCircle(null)
                }} className="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-sm font-semibold hover:bg-white/20">Highlight these assets on the map</button>
              </section>
              <section>
                <div className="mb-1 font-semibold">{t('home.bufferTool', lang)}</div>
                <div className="flex items-center gap-2">
                  <input type="range" min={1} max={25} value={radius} onChange={(e) => setRadius(+e.target.value)} className="flex-1 accent-[#ffea00]" aria-label="Radius km" />
                  <span className="w-14 text-right tabular text-sm">{radius} km</span>
                </div>
                <button onClick={() => setBufferTool(true)} className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-sm font-semibold ${bufferTool ? 'bg-sand text-night' : 'bg-white/10 hover:bg-white/20'}`}>
                  <CircleDot size={16} />{bufferTool ? t('home.clickMap', lang) : 'Place buffer on map'}</button>
                {bufferResult && <div className="mt-2 text-sm text-white/80">{bufferResult.length} assets inside the {radius} km circle. {Object.entries(bufferResult.reduce((a: any, x) => { a[x.type] = (a[x.type] || 0) + 1; return a }, {})).map(([k, v]) => `${LAYER_BY_ID[k].label}: ${v}`).join(' · ')}</div>}
              </section>
            </div>
          )}
        </div>
      )}

      {/* basemap switcher + compass */}
      <div className="absolute right-3 top-[100px] z-[600] flex flex-col items-end gap-2">
        <div className="relative">
          <button onClick={() => setBaseOpen(!baseOpen)} className="flex items-center gap-2 rounded-xl bg-night/90 px-3 py-2 text-sm font-semibold text-white shadow-lg hover:bg-night" aria-expanded={baseOpen}>
            <MapIcon size={18} /> {BASEMAPS.find((b) => b.id === basemap)?.label}
          </button>
          {baseOpen && (
            <div className="absolute right-0 mt-1 w-56 overflow-hidden rounded-xl bg-white shadow-2xl">
              {BASEMAPS.map((b) => (
                <button key={b.id} onClick={() => { setBasemap(b.id); setBaseOpen(false) }} className={`block w-full px-3 py-2 text-left text-[15px] hover:bg-tana-light ${b.id === basemap ? 'bg-tana text-white hover:bg-tana' : 'text-ink'}`}>{b.label}</button>
              ))}
            </div>
          )}
        </div>
        <Compass />
      </div>

      {/* legend */}
      <div className="absolute bottom-10 right-3 z-[600] w-[250px] max-w-[60vw] rounded-2xl bg-white/95 text-ink shadow-xl backdrop-blur max-sm:bottom-9 max-sm:w-[190px]">
        <button onClick={() => setLegendOpen(!legendOpen)} className="flex w-full items-center justify-between px-4 py-2.5 font-display font-bold">
          {t('home.legend', lang)} {legendOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
        {legendOpen && (
          <ul className="scroll-thin max-h-[34vh] overflow-y-auto px-4 pb-3 text-[13.5px]">
            {legendItems.map((it) => (
              <li key={it.key} className="flex items-center gap-2 py-0.5">
                {it.shape === 'line' ? <span className="inline-block h-1 w-6 rounded" style={{ background: it.color, outline: it.color === '#ffffff' ? '1px solid #999' : '' }} />
                  : it.shape === 'area' ? <span className="inline-block h-3.5 w-6 rounded" style={{ background: it.color, opacity: 0.75 }} />
                  : <span className="inline-block h-3.5 w-3.5 rounded-full border border-night/60" style={{ background: it.color }} />}
                <span>{it.label}</span>
              </li>
            ))}
            {LAYERS.filter((l) => visible.has(l.id) && l.gradient).map((l) => (
              <li key={l.id + 'g'} className="py-1">
                <div className="font-medium">{l.gradient!.title}</div>
                <div className="h-2.5 rounded" style={{ background: `linear-gradient(90deg,${l.gradient!.colors.join(',')})` }} />
                <div className="flex justify-between text-xs text-muted">{l.gradient!.labels.map((x) => <span key={x}>{x}</span>)}</div>
              </li>
            ))}
            {!legendItems.length && !LAYERS.some((l) => visible.has(l.id) && l.gradient) && <li className="text-muted">Switch on a layer to see its legend.</li>}
          </ul>
        )}
      </div>

      {/* coordinates */}
      <div className="absolute bottom-2 left-1/2 z-[600] -translate-x-1/2 rounded-lg bg-night/85 px-3 py-1 text-xs text-white tabular">
        Lat {coord[0].toFixed(4)}°, Lon {coord[1].toFixed(4)}° · zoom {zoom}
      </div>

      {/* staff gauge (signature) */}
      {showGauge && (
        <div className="absolute bottom-10 left-16 z-[550] max-md:hidden">
          <StaffGauge stage={visible.has('flood_sim') ? stage : null} forecast={forecastPeak} />
        </div>
      )}

      {/* highlight results */}
      {(highlight || (circle && bufferResult)) && (
        <div className="absolute right-3 top-[190px] z-[650] w-[300px] max-w-[70vw] rounded-2xl bg-night/95 p-3 text-white shadow-2xl max-sm:top-auto max-sm:bottom-40">
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold leading-snug">{highlight ? highlight.title : `${bufferResult!.length} assets within ${circle!.r} km`}</div>
            <button onClick={() => { setHighlight(null); setCircle(null) }} aria-label="Clear results" className="rounded-full p-1 hover:bg-white/10"><X size={16} /></button>
          </div>
          <ul className="scroll-thin mt-2 max-h-56 overflow-y-auto text-sm">
            {(highlight ? highlight.features : bufferResult!).slice(0, 80).map((f: any, i: number) => (
              <li key={i}><button className="w-full rounded px-1 py-0.5 text-left hover:bg-white/10" onClick={() => (window as any).__csgMap?.flyTo([f.lat, f.lon], 14)}>
                {f.name}<span className="text-white/60">{f.dist_tana_km !== undefined && f.dist_tana_km !== null ? ` · ${f.dist_tana_km} km to Tana` : f.dist_km !== undefined ? ` · ${f.dist_km} km` : ''}</span></button></li>
            ))}
          </ul>
        </div>
      )}

      {pickMode && <div className="absolute left-1/2 top-20 z-[700] -translate-x-1/2 rounded-full bg-sand px-4 py-2 font-semibold text-night shadow-lg">Tap the map at your location</div>}
      {bufferTool && <div className="absolute left-1/2 top-20 z-[700] -translate-x-1/2 rounded-full bg-sand px-4 py-2 font-semibold text-night shadow-lg"><Info size={16} className="mr-1 inline" />{t('home.clickMap', lang)}</div>}
    </div>
  )
}

function ToolBtn({ children, onClick, label, active }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-lg transition ${active ? 'bg-sand text-night' : 'bg-night/90 text-white hover:bg-tana'}`}>
      {children}
    </button>
  )
}

function Compass() {
  return (
    <div className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-night/85 shadow-lg" title="North arrow – map is north-up">
      <svg viewBox="0 0 100 100" width="66" height="66" aria-label="Compass rose, north up">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
        {[0, 90, 180, 270].map((a) => <line key={a} x1="50" y1="8" x2="50" y2="16" stroke="#fff" strokeWidth="2" transform={`rotate(${a} 50 50)`} />)}
        <polygon points="50,14 58,50 50,46 42,50" fill="#ff1744" />
        <polygon points="50,86 58,50 50,54 42,50" fill="#fff" />
        <polygon points="86,50 50,56 54,50 50,44" fill="rgba(255,255,255,.55)" />
        <polygon points="14,50 50,56 46,50 50,44" fill="rgba(255,255,255,.55)" />
        <text x="50" y="11" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" dy="-1">N</text>
      </svg>
    </div>
  )
}
