import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, Download } from 'lucide-react'
import { useApp } from '../lib/store'
import { t } from '../lib/i18n'
import { NAV } from './Header'

export default function Footer() {
  const { lang } = useApp()
  return (
    <footer className="mt-16 bg-night text-white">
      <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg,#0e7c86 0 25%,#e8c07d 25% 50%,#3e7d3a 50% 75%,#7a2614 75% 100%)' }} />
      <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <img src="./img/garissa_logo.png" alt="" className="h-16 w-16" />
            <div className="font-display text-xl font-bold leading-tight">Garissa County<br />Steering Group</div>
          </div>
          <p className="mt-4 max-w-md text-white/75">Multi-agency early warning, preparedness and coordination for floods, El Niño and drought in Garissa County – co-chaired by H.E. the Governor and the County Commissioner, with NDMA as secretariat.</p>
          <a href="./docs/Garissa_County_Partnerships_and_Coordination_Policy_2025.pdf" download className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">
            <Download size={16} /> Partnerships & Coordination Policy (PDF)
          </a>
        </div>
        <nav aria-label="Footer">
          <h3 className="mb-3 text-lg font-bold text-sand">Portal</h3>
          <ul className="grid grid-cols-2 gap-y-1.5 text-white/80">
            {NAV.map((n) => <li key={n.to}><Link className="hover:text-white hover:underline" to={n.to}>{t(n.key, lang)}</Link></li>)}
          </ul>
        </nav>
        <div>
          <h3 className="mb-3 text-lg font-bold text-sand">{t('footer.contact', lang)}</h3>
          <ul className="space-y-2.5 text-white/85">
            <li className="flex gap-2"><Mail size={18} className="mt-1 shrink-0 text-sand" /><span>Emergencies & feedback:<br /><a className="font-semibold underline" href="mailto:emergency@garissa.go.ke">emergency@garissa.go.ke</a></span></li>
            <li className="flex gap-2"><Phone size={18} className="mt-1 shrink-0 text-sand" /><span>Kenya Red Cross toll-free <a className="font-semibold" href="tel:1199">1199</a> · National emergency <a className="font-semibold" href="tel:999">999</a> / <a className="font-semibold" href="tel:112">112</a></span></li>
            <li className="flex gap-2"><MapPin size={18} className="mt-1 shrink-0 text-sand" /><span>County HQ, Garissa Town · <a className="underline" href="https://garissa.go.ke" target="_blank" rel="noreferrer">garissa.go.ke</a></span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-1 px-5 py-5 text-[15px] md:flex-row md:items-center md:justify-between">
          <p className="m-0 font-semibold">{t('footer.powered', lang)}</p>
          <p className="m-0 text-white/75">Contact: <a className="font-semibold text-sand underline" href="mailto:james.mukoma@garissa.go.ke">james.mukoma@garissa.go.ke</a></p>
        </div>
        <p className="mx-auto max-w-[1500px] px-5 pb-5 text-xs text-white/50">Forecast products here are decision-support scenarios. Always follow official advisories from KMD, WRA, NDMA and the County Government. © {new Date().getFullYear()} County Government of Garissa.</p>
      </div>
    </footer>
  )
}
