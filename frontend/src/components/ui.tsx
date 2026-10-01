import { useState, type ReactNode } from 'react'
import { Languages, Loader2 } from 'lucide-react'
import { backendAvailable, postJSON } from '../lib/api'
import { useApp } from '../lib/store'
import { t } from '../lib/i18n'

export function PageHero({ img, title, lead, children, tone = 'night' }: { img: string; title: string; lead: string; children?: ReactNode; tone?: 'night' | 'tana' | 'crest' | 'acacia' }) {
  const tones = { night: 'from-night/95 via-night/75', tana: 'from-tana-deep/95 via-tana-deep/70', crest: 'from-crest/95 via-crest/70', acacia: 'from-[#21451f]/95 via-[#21451f]/70' }
  return (
    <section className="relative overflow-hidden text-white">
      <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className={`absolute inset-0 bg-gradient-to-r ${tones[tone]} to-transparent`} />
      <div className="relative mx-auto max-w-[1500px] px-5 py-16 md:py-24">
        <h1 className="max-w-3xl text-4xl font-extrabold md:text-[3.4rem]">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg text-white/90 md:text-xl">{lead}</p>
        {children && <div className="mt-7 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  )
}

export function Section({ id, title, lead, children, className = '' }: { id?: string; title?: string; lead?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-[1500px] px-5 py-12 ${className}`}>
      {title && <h2 className="text-3xl font-bold text-night md:text-[2.3rem]">{title}</h2>}
      {lead && <p className="mt-3 max-w-3xl text-lg text-muted">{lead}</p>}
      <div className={title || lead ? 'mt-8' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ value, label, color = '#0e7c86', note }: { value: string; label: string; color?: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5" style={{ borderTop: `5px solid ${color}` }}>
      <div className="font-display text-3xl font-extrabold tabular" style={{ color }}>{value}</div>
      <div className="mt-1 font-medium text-ink">{label}</div>
      {note && <div className="mt-1 text-sm text-muted">{note}</div>}
    </div>
  )
}

export function Figure({ src, caption, credit }: { src: string; caption: string; credit?: string }) {
  return (
    <figure className="m-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <img src={src} alt={caption} loading="lazy" className="aspect-[16/10] w-full object-cover" />
      <figcaption className="p-3 text-sm text-muted"><span className="text-ink">{caption}</span>{credit && <span> · {credit}</span>}</figcaption>
    </figure>
  )
}

// AI translation of the page body (Gemini) - static UI labels are already trilingual.
export function TranslatePage({ targetId }: { targetId: string }) {
  const { lang } = useApp()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  if (lang === 'en') return null
  const run = async () => {
    if (!(await backendAvailable())) { setMsg('AI translation needs the CSG server running with a Gemini API key.'); return }
    setBusy(true)
    const nodes = Array.from(document.querySelectorAll(`#${targetId} [data-tr]`)) as HTMLElement[]
    for (const n of nodes) {
      try {
        const r = await postJSON('/api/translate', { text: n.innerText, target: lang })
        if (r.text && r.engine !== 'none') n.innerText = r.text
        else { setMsg(r.note || 'Translation unavailable.'); break }
      } catch { setMsg('Translation service unavailable.'); break }
    }
    setBusy(false)
  }
  return (
    <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-5 pt-5">
      <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-sand px-4 py-2 font-semibold text-night hover:brightness-95 disabled:opacity-60">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Languages size={18} />} {t('btn.translate', lang)}
      </button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  )
}

export function Pill({ children, color }: { children: ReactNode; color: string }) {
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold text-white" style={{ background: color }}>{children}</span>
}
