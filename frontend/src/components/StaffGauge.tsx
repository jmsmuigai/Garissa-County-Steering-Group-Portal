// River staff gauge - the portal's signature element. Modelled on the painted "E" staff gauges at the
// Garissa bridge (RGS 4G01): coloured CSG threshold bands, the simulated water level and the forecast peak.
import { levelFor, LEVEL_COLORS } from '../lib/store'

const BANDS = [
  { from: 0, to: 3, c: '#2e9e4f', l: 'Normal' },
  { from: 3, to: 4, c: '#f2c230', l: 'Watch' },
  { from: 4, to: 5, c: '#f28c28', l: 'Alert 4.0' },
  { from: 5, to: 6.2, c: '#e4572e', l: 'Alarm 5.0' },
  { from: 6.2, to: 8, c: '#c81d25', l: 'Emergency 6.2' },
]

export default function StaffGauge({ stage, forecast, height = 250, light = false }: { stage: number | null; forecast?: { stage: number; label: string; time?: string }; height?: number; light?: boolean }) {
  const H = height, top = 14, bottom = H - 26, max = 8
  const y = (m: number) => bottom - (m / max) * (bottom - top)
  const water = stage ?? null
  return (
    <figure className={`m-0 rounded-2xl p-3 shadow-xl ${light ? 'bg-white text-ink' : 'bg-night/90 text-white'}`} style={{ width: 190 }}>
      <figcaption className="mb-1 text-sm font-semibold leading-tight">River Tana gauge<br /><span className={`text-xs font-normal ${light ? 'text-muted' : 'text-white/65'}`}>Garissa bridge, RGS 4G01</span></figcaption>
      <svg width="166" height={H} role="img" aria-label={`Gauge: ${water !== null ? `simulated ${water} metres` : 'no simulation'}${forecast ? `, forecast peak ${forecast.stage} metres` : ''}`}>
        {/* water body behind the staff */}
        {water !== null && <rect x="0" y={y(water)} width="64" height={bottom - y(water)} fill="#29b6f6" opacity="0.45" />}
        {water !== null && <path d={`M0 ${y(water)} q8 -4 16 0 t16 0 t16 0 t16 0`} stroke="#4fc3f7" strokeWidth="2" fill="none" />}
        {/* staff with bands */}
        {BANDS.map((b) => <rect key={b.from} x="18" width="26" y={y(b.to)} height={y(b.from) - y(b.to)} fill={b.c} />)}
        {Array.from({ length: max * 10 + 1 }).map((_, i) => {
          const m = i / 10
          const major = i % 10 === 0, half = i % 5 === 0
          return <line key={i} x1={18} x2={18 + (major ? 26 : half ? 18 : 9)} y1={y(m)} y2={y(m)} stroke="#fff" strokeWidth={major ? 2 : 1} opacity={major ? 1 : 0.8} />
        })}
        {Array.from({ length: max + 1 }).map((_, m) => (
          <text key={m} x="50" y={y(m) + 4} fontSize="12" fontWeight="700" fill={light ? '#17222e' : '#fff'}>{m}</text>
        ))}
        {BANDS.slice(1).map((b) => (
          <text key={b.l} x="66" y={y(b.from) - 3} fontSize="10.5" fill={light ? '#55636f' : 'rgba(255,255,255,.75)'}>{b.l}</text>
        ))}
        {forecast && (
          <g>
            <line x1="10" x2="160" y1={y(forecast.stage)} y2={y(forecast.stage)} stroke="#ffea00" strokeWidth="2.5" strokeDasharray="5 4" />
            <polygon points={`6,${y(forecast.stage) - 6} 16,${y(forecast.stage)} 6,${y(forecast.stage) + 6}`} fill="#ffea00" />
          </g>
        )}
        <text x="0" y={H - 6} fontSize="10.5" fill={light ? '#55636f' : 'rgba(255,255,255,.7)'}>metres</text>
      </svg>
      <div className="mt-1 space-y-1 text-xs">
        {water !== null && <div className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#29b6f6]" />Simulated: <b>{water.toFixed(1)} m</b> <span className="rounded px-1 font-bold text-white" style={{ background: LEVEL_COLORS[levelFor(water)] }}>{levelFor(water)}</span></div>}
        {forecast && <div className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-[#ffea00]" />{forecast.label}: <b>{forecast.stage.toFixed(1)} m</b></div>}
      </div>
    </figure>
  )
}
