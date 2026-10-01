import { useEffect, useState } from 'react'
import { LocateFixed, Search, MousePointerClick, Loader2, School, Hospital, Share2 } from 'lucide-react'
import { assessLocation, searchPlaces, RISK_COLOR, type RiskResult } from '../lib/risk'

// "Am I at risk?" panel: GPS, typed coordinates/place, or tap-on-map -> flood exposure verdict + nearby help.
export default function RiskPanel({ request, onResult, onPick, picking, light = false }: {
  request: { lat: number; lon: number; n: number } | null; onResult: (r: RiskResult | null) => void; onPick?: () => void; picking?: boolean; light?: boolean
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ name: string; lat: number; lon: number; kind: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<RiskResult | null>(null)

  const run = async (lat: number, lon: number) => {
    setBusy(true); setErr(''); setHits([])
    try {
      const r = await assessLocation(lat, lon)
      setRes(r); onResult(r)
    } catch (e) { setErr('Could not assess this location.') }
    setBusy(false)
  }
  useEffect(() => { if (request) run(request.lat, request.lon) }, [request?.n])
  useEffect(() => {
    const id = setTimeout(async () => setHits(await searchPlaces(q)), 220)
    return () => clearTimeout(id)
  }, [q])

  const gps = () => {
    if (!navigator.geolocation) { setErr('This device has no location service.'); return }
    setBusy(true); setErr('')
    navigator.geolocation.getCurrentPosition(
      (p) => run(p.coords.latitude, p.coords.longitude),
      (e) => { setBusy(false); setErr(e.code === 1 ? 'Location permission was blocked. Allow location for this site in your browser or phone settings, or type a place or coordinates below.' : 'Could not get your position. Move outdoors or type a place below.') },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }
  const muted = light ? 'text-muted' : 'text-white/70'
  const box = light ? 'bg-paper' : 'bg-white/8'

  return (
    <div className="space-y-3 text-[15px]">
      <p className={`m-0 text-sm ${muted}`}>Find out if a place in Garissa falls inside past UNOSAT flood extents, the River Tana floodplain or a lagha flash-flood corridor – and where the nearest schools and health facilities are.</p>
      <button onClick={gps} className="flex w-full items-center justify-center gap-2 rounded-xl bg-tana px-3 py-2.5 font-semibold text-white hover:bg-tana-deep">
        <LocateFixed size={18} /> Use my current location (GPS)
      </button>
      <div className="relative">
        <Search size={16} className={`absolute left-3 top-3 ${muted}`} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Village, school, or -0.4532, 39.6461"
          className={`w-full rounded-xl border px-3 py-2.5 pl-9 text-[15px] ${light ? 'border-black/15 bg-white text-ink' : 'border-white/20 bg-white/10 text-white placeholder:text-white/50'}`} aria-label="Search place or coordinates" />
        {hits.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl bg-white text-ink shadow-2xl">
            {hits.map((h, i) => <li key={i}><button className="w-full px-3 py-2 text-left text-sm hover:bg-tana-light" onClick={() => { setQ(h.name); run(h.lat, h.lon) }}>{h.name} <span className="text-muted">· {h.kind}</span></button></li>)}
          </ul>
        )}
      </div>
      {onPick && <button onClick={onPick} className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${picking ? 'bg-sand text-night' : light ? 'bg-night/5 hover:bg-night/10' : 'bg-white/10 hover:bg-white/20'}`}>
        <MousePointerClick size={16} /> {picking ? 'Tap the map now…' : 'Or tap a point on the map'}</button>}
      {busy && <div className={`flex items-center gap-2 ${muted}`}><Loader2 size={16} className="animate-spin" /> Analysing flood, river and lagha layers…</div>}
      {err && <div className="rounded-lg bg-emergency/20 p-2 text-sm">{err}</div>}

      {res && !busy && (
        <div className="space-y-3">
          <div className="rounded-xl p-3 text-white" style={{ background: RISK_COLOR[res.level] }}>
            <div className="text-sm opacity-90">{res.inCounty ? `Garissa County${res.subcounty ? ` · ${res.subcounty}` : ''}` : 'Outside Garissa County – results are indicative'}</div>
            <div className="font-display text-2xl font-extrabold">{res.level === 'HIGH' ? 'High flood risk' : res.level === 'MEDIUM' ? 'Medium flood risk' : 'Low flood risk'}</div>
            <div className="text-xs opacity-90 tabular">{res.lat.toFixed(5)}, {res.lon.toFixed(5)}</div>
          </div>
          <ul className="m-0 space-y-1.5 pl-5 text-sm">{res.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <div className={`grid grid-cols-2 gap-2 text-sm`}>
            <div className={`rounded-lg p-2 ${box}`}><div className={muted}>To River Tana</div><b className="tabular">{res.distTana.toFixed(1)} km</b></div>
            <div className={`rounded-lg p-2 ${box}`}><div className={muted}>Nearest lagha</div><b className="tabular">{res.lagha ? `${res.lagha.km < 1 ? (res.lagha.km * 1000).toFixed(0) + ' m' : res.lagha.km.toFixed(1) + ' km'}` : 'n/a'}</b>{res.lagha && <span className={muted}> · {res.lagha.hazard}</span>}</div>
            <div className={`rounded-lg p-2 ${box}`}><div className={muted}>Past floods here</div><b>{res.floods.length ? res.floods.map((f) => f.date.slice(0, 7)).join(', ') : 'None mapped'}</b></div>
            <div className={`rounded-lg p-2 ${box}`}><div className={muted}>Land cover (2010)</div><b>{res.landCover || 'n/a'}</b></div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 font-semibold"><School size={16} className="text-[#ffd600]" /> Nearest schools</div>
            <ul className="m-0 list-none space-y-0.5 p-0 text-sm">{res.schools.map((s) => <li key={s.name + s.km}>{s.name} <span className={muted}>· {s.km} km{s.risk ? ` · ${s.risk.toLowerCase()} risk` : ''}</span></li>)}</ul>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 font-semibold"><Hospital size={16} className="text-[#ff4081]" /> Nearest health facilities</div>
            <ul className="m-0 list-none space-y-0.5 p-0 text-sm">{res.health.map((s) => <li key={s.name + s.km}>{s.name} <span className={muted}>· {s.km} km{s.level ? ` · ${s.level}` : ''}</span></li>)}</ul>
          </div>
          <div className={`rounded-xl p-3 text-sm ${box}`}>
            <div className="mb-1 font-semibold">What to do</div>
            <ul className="m-0 space-y-1 pl-5">{res.advice.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`https://www.google.com/maps/dir/?api=1&origin=${res.lat},${res.lon}&destination=${res.health[0]?.lat},${res.health[0]?.lon}`} target="_blank" rel="noreferrer" className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${light ? 'bg-night text-white' : 'bg-white/15 hover:bg-white/25'}`}>Directions to nearest clinic</a>
            <a href={`mailto:emergency@garissa.go.ke?subject=${encodeURIComponent('Flood report from ' + (res.subcounty || 'Garissa'))}&body=${encodeURIComponent(`Location: ${res.lat.toFixed(5)}, ${res.lon.toFixed(5)}\nhttps://www.google.com/maps?q=${res.lat},${res.lon}\nPortal risk level: ${res.level}\n\nDescribe the situation:`)}`} className="flex items-center gap-1 rounded-lg bg-emergency px-3 py-1.5 text-sm font-semibold text-white"><Share2 size={14} /> Report from here</a>
          </div>
          <p className={`m-0 text-xs ${muted}`}>Sources: UNOSAT flood extents (Nov 2023, Apr 2024), HydroSHEDS River Tana, NBSOS lagha hazard classification, LUC2010 land cover, county school & health registers. Indicative – always follow official CSG/KMD/NDMA alerts.</p>
        </div>
      )}
    </div>
  )
}
