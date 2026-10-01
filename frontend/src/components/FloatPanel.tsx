import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GripHorizontal, Minus, Plus, X } from 'lucide-react'

// A small floating window over the map: drag it by its title bar, fold it to its title, or close it.
// On phones (< 640 px) it docks as a bottom sheet instead of floating.
export default function FloatPanel({ title, children, initial, width = 280, onClose, dark = true, maxH = '60vh', z = 700, collapsedByDefault = false, className = '', mobileDock = 'sheet' }: {
  title: ReactNode; children: ReactNode; initial: { left?: number; top?: number; right?: number; bottom?: number }; width?: number
  onClose?: () => void; dark?: boolean; maxH?: string; z?: number; collapsedByDefault?: boolean; className?: string; mobileDock?: 'sheet' | 'corner'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [folded, setFolded] = useState(collapsedByDefault)
  const [mobile, setMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  useEffect(() => {
    const r = () => setMobile(window.innerWidth < 640)
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  const down = (e: React.PointerEvent) => {
    if (mobile || (e.target as HTMLElement).closest('button')) return
    const el = ref.current!, parent = el.offsetParent as HTMLElement
    const r = el.getBoundingClientRect(), pr = parent.getBoundingClientRect()
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    setPos({ x: r.left - pr.left, y: r.top - pr.top })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return
    const el = ref.current!, parent = el.offsetParent as HTMLElement
    const pr = parent.getBoundingClientRect()
    const x = Math.max(0, Math.min(pr.width - 60, e.clientX - pr.left - drag.current.dx))
    const y = Math.max(0, Math.min(pr.height - 36, e.clientY - pr.top - drag.current.dy))
    setPos({ x, y })
  }
  const up = () => { drag.current = null }

  const style: React.CSSProperties = mobile
    ? { zIndex: z }
    : pos ? { left: pos.x, top: pos.y, width, zIndex: z } : { ...initial, width, zIndex: z }

  return (
    <div ref={ref} style={style}
      className={`absolute flex flex-col overflow-hidden rounded-xl shadow-2xl ring-1 backdrop-blur ${dark ? 'bg-night/92 text-white ring-white/10' : 'bg-white/95 text-ink ring-black/10'} ${mobile ? (mobileDock === 'corner' ? 'bottom-11 left-2 w-[190px]' : 'inset-x-2 bottom-2') : ''} ${className}`}>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={() => setFolded(!folded)}
        className={`flex select-none items-center gap-1.5 px-2.5 py-1.5 ${mobile ? '' : 'cursor-move'} ${dark ? 'bg-white/5' : 'bg-black/[.03]'}`} title="Drag to move · double-click to fold">
        {!mobile && <GripHorizontal size={14} className="shrink-0 opacity-50" />}
        <div className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</div>
        <button onClick={() => setFolded(!folded)} aria-label={folded ? 'Expand' : 'Fold'} className="rounded p-0.5 opacity-70 hover:bg-white/15 hover:opacity-100">{folded ? <Plus size={14} /> : <Minus size={14} />}</button>
        {onClose && <button onClick={onClose} aria-label="Close" className="rounded p-0.5 opacity-70 hover:bg-white/15 hover:opacity-100"><X size={14} /></button>}
      </div>
      {!folded && <div className="scroll-thin overflow-y-auto px-3 pb-3 pt-2 text-[13px] leading-snug" style={{ maxHeight: mobile ? '55vh' : maxH }}>{children}</div>}
    </div>
  )
}
