import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Map, MapPinned, Info, Handshake, CloudRain, Waves, HeartPulse, Trees, Images, Siren, Menu, X, Languages, Phone } from 'lucide-react'
import { useApp } from '../lib/store'
import { LANGS, t } from '../lib/i18n'

export const NAV = [
  { to: '/', key: 'nav.home', icon: Map },
  { to: '/about', key: 'nav.about', icon: Info },
  { to: '/elnino', key: 'nav.elnino', icon: CloudRain },
  { to: '/tana', key: 'nav.tana', icon: Waves },
  { to: '/health', key: 'nav.health', icon: HeartPulse },
  { to: '/nbs', key: 'nav.nbs', icon: Trees },
  { to: '/community', key: 'nav.community', icon: MapPinned },
  { to: '/policy', key: 'nav.policy', icon: Handshake },
  { to: '/gallery', key: 'nav.gallery', icon: Images },
  { to: '/report', key: 'nav.report', icon: Siren },
]

// Partner marks: drop official logo files into public/logos/<id>.png to replace the text badges.
const PARTNERS = [
  { id: 'national-government', name: 'National Government', sub: 'County Commissioner', color: '#006600' },
  { id: 'ndma', name: 'NDMA', sub: 'CSG Secretariat', color: '#0d47a1' },
  { id: 'kenya-red-cross', name: 'Kenya Red Cross', sub: 'Hotline 1199', color: '#c81d25' },
  { id: 'kmd', name: 'KMD', sub: 'Meteorology', color: '#00838f' },
  { id: 'unhcr', name: 'UNHCR', sub: 'Dadaab', color: '#0072bc' },
  { id: 'partners', name: 'WFP · UNICEF · WHO', sub: 'Development partners', color: '#6a1b9a' },
]

function PartnerMark({ p }: { p: (typeof PARTNERS)[number] }) {
  const [img, setImg] = useState(true)
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-xl bg-white/8 py-1 pl-1 pr-3" title={p.name}>
      {img ? (
        <img src={`./logos/${p.id}.png`} alt="" className="h-9 w-9 rounded-full bg-white object-contain p-0.5" onError={() => setImg(false)} />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: p.color }}>
          {p.name.split(' ').map((w) => w[0]).join('').slice(0, 3)}
        </span>
      )}
      <span className="leading-tight"><span className="block text-[13px] font-semibold">{p.name}</span><span className="block text-[11px] text-white/65">{p.sub}</span></span>
    </div>
  )
}

export default function Header() {
  const { lang, setLang } = useApp()
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-[1000] bg-night text-white shadow-lg">
      <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-2.5">
        <NavLink to="/" className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label="Home">
          <img src="./img/garissa_logo.png" alt="County Government of Garissa coat of arms" className="h-11 w-11 shrink-0 drop-shadow sm:h-[62px] sm:w-[62px]" />
          <div className="leading-tight">
            <div className="hidden text-[13px] text-sand sm:block">County Government of Garissa</div>
            <div className="font-display text-[1.15rem] font-bold sm:text-[1.35rem]"><span className="sm:hidden">Garissa CSG</span><span className="hidden sm:inline">{t('site.title', lang)}</span></div>
            <div className="hidden text-[13px] text-white/70 sm:block">{t('site.subtitle', lang)}</div>
          </div>
        </NavLink>
        <div className="ml-auto hidden items-center gap-2 overflow-x-auto xl:flex" aria-label={t('site.partners', lang)}>
          {PARTNERS.map((p) => <PartnerMark key={p.id} p={p} />)}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 xl:ml-3">
          <div className="flex items-center rounded-xl bg-white/10 p-1" role="group" aria-label="Language">
            <Languages size={18} className="mx-1.5 hidden text-sand sm:block" />
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => setLang(l.id)} title={l.label} aria-pressed={lang === l.id}
                className={`rounded-lg px-2 py-1 text-sm font-semibold sm:px-2.5 ${lang === l.id ? 'bg-sand text-night' : 'text-white hover:bg-white/10'}`}>{l.short}</button>
            ))}
          </div>
          <button className="rounded-lg p-2 hover:bg-white/10 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      <nav className={`border-t border-white/10 bg-night-2 ${open ? 'block' : 'hidden'} lg:block`}>
        <ul className="mx-auto flex max-w-[1500px] flex-col gap-1 px-3 py-1.5 lg:flex-row lg:flex-wrap lg:items-center">
          {NAV.map(({ to, key, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} onClick={() => setOpen(false)}
                className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-medium transition ${
                  to === '/report' ? 'bg-emergency text-white hover:brightness-110' : isActive ? 'bg-tana text-white' : 'text-white/85 hover:bg-white/10'}`}>
                <Icon size={18} /> {t(key, lang)}
              </NavLink>
            </li>
          ))}
          <li className="lg:ml-auto"><a href="tel:1199" className="flex items-center gap-2 px-3 py-2 text-[15px] font-semibold text-sand"><Phone size={17} /> Red Cross 1199</a></li>
        </ul>
      </nav>
    </header>
  )
}
