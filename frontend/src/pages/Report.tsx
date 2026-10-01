import { useState } from 'react'
import { Crosshair, Send, Phone, Mail, CheckCircle2, Loader2 } from 'lucide-react'
import { Section } from '../components/ui'
import { useApp } from '../lib/store'
import { t } from '../lib/i18n'
import { backendAvailable, postJSON } from '../lib/api'

const KINDS = ['Flooding / rising river', 'Lagha flash flood', 'People or livestock trapped', 'Disease outbreak', 'Damaged road or bridge', 'Water point damaged', 'Displacement / shelter need', 'Feedback on this portal']
const SUBS = ['Garissa Township', 'Balambala', 'Lagdera', 'Dadaab', 'Fafi', 'Ijara', 'Hulugho', 'Not sure']
const EMAIL = 'emergency@garissa.go.ke'

export default function Report() {
  const { lang } = useApp()
  const [f, setF] = useState({ kind: KINDS[0], name: '', phone: '', email: '', location: '', subcounty: '', urgency: 'High', message: '', lat: null as number | null, lon: null as number | null })
  const [gps, setGps] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [note, setNote] = useState('')
  const set = (k: string, v: any) => setF((o) => ({ ...o, [k]: v }))

  const locate = () => {
    if (!navigator.geolocation) { setGps('This device cannot share its location. Type the village or landmark instead.'); return }
    setGps('Finding you…')
    navigator.geolocation.getCurrentPosition(
      (p) => { set('lat', +p.coords.latitude.toFixed(5)); set('lon', +p.coords.longitude.toFixed(5)); setGps(`Location added: ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)} (±${Math.round(p.coords.accuracy)} m)`) },
      (e) => setGps(e.code === 1 ? 'Location is blocked. Allow location for this site in your browser or phone settings, or type the place name.' : 'Could not get a GPS fix. Try outdoors or type the place name.'),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const mailto = () => {
    const body = `${f.kind} (${f.urgency})\nPlace: ${f.location} ${f.subcounty}\n${f.lat ? `GPS: ${f.lat}, ${f.lon} https://maps.google.com/?q=${f.lat},${f.lon}\n` : ''}\n${f.message}\n\nFrom: ${f.name} ${f.phone} ${f.email}`
    return `mailto:${EMAIL}?subject=${encodeURIComponent(`[CSG] ${f.kind} – ${f.location || f.subcounty}`)}&body=${encodeURIComponent(body)}`
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('busy')
    if (await backendAvailable()) {
      try {
        const r = await postJSON('/api/feedback', { ...f, lang })
        setNote(`${r.message} Reference #${r.id}.`)
        setState('done')
        return
      } catch { /* fall back */ }
    }
    setNote('The portal server is offline, so your mail app will open with the report filled in. Press send there.')
    window.location.href = mailto()
    setState('done')
  }

  return (
    <div className="bg-gradient-to-b from-[#fde8e6] to-paper">
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div>
            <h1 className="text-4xl font-extrabold text-night md:text-5xl">{t('report.title', lang)}</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted">{t('report.lead', lang)}</p>
            {state === 'done' ? (
              <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <CheckCircle2 className="text-acacia" size={40} />
                <p className="mt-3 text-lg">{note}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href={mailto()} className="btn-dl bg-tana text-white"><Mail size={18} /> Also send by email</a>
                  <button onClick={() => { setState('idle'); set('message', '') }} className="btn-dl bg-paper ring-1 ring-black/10">Send another report</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 grid gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 md:grid-cols-2">
                <L label="What is happening?" wide group>
                  <div className="flex flex-wrap gap-2">
                    {KINDS.map((k) => <button type="button" key={k} onClick={() => set('kind', k)} className={`rounded-full px-3.5 py-1.5 text-[15px] font-medium ${f.kind === k ? 'bg-crest text-white' : 'bg-paper ring-1 ring-black/10'}`}>{k}</button>)}
                  </div>
                </L>
                <L label="How urgent?" wide group>
                  <div className="flex gap-2">
                    {[['Life-threatening', '#c81d25'], ['High', '#e4572e'], ['Medium', '#f2a03d'], ['Information', '#2e9e4f']].map(([u, c]) => (
                      <button type="button" key={u} onClick={() => set('urgency', u)} className="rounded-lg px-3 py-2 text-[15px] font-semibold" style={f.urgency === u ? { background: c, color: '#fff' } : { boxShadow: `inset 0 0 0 2px ${c}`, color: c }}>{u}</button>
                    ))}
                  </div>
                </L>
                <L label="Village, ward or landmark"><input required value={f.location} onChange={(e) => set('location', e.target.value)} className="sel" placeholder="e.g. Saka, near the mosque" /></L>
                <L label="Sub-county"><select value={f.subcounty} onChange={(e) => set('subcounty', e.target.value)} className="sel"><option value="">Choose…</option>{SUBS.map((s) => <option key={s}>{s}</option>)}</select></L>
                <div className="md:col-span-2">
                  <button type="button" onClick={locate} className="btn-dl bg-night text-white"><Crosshair size={18} /> Add my GPS location</button>
                  {gps && <p className="mt-2 text-[15px] text-muted">{gps}</p>}
                </div>
                <L label="Describe what you see" wide><textarea required rows={5} value={f.message} onChange={(e) => set('message', e.target.value)} className="sel" placeholder="How many people or homes, water depth, roads cut, what help is needed…" /></L>
                <L label="Your name (optional)"><input value={f.name} onChange={(e) => set('name', e.target.value)} className="sel" /></L>
                <L label="Phone (so the desk can call back)"><input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} className="sel" placeholder="07…" /></L>
                <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                  <button disabled={state === 'busy'} className="btn-dl bg-emergency px-6 py-3 text-lg text-white">{state === 'busy' ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />} {t('btn.send', lang)}</button>
                  <span className="text-sm text-muted">Sent to {EMAIL}. Your phone number is only used by the CSG emergency desk.</span>
                </div>
              </form>
            )}
          </div>
          <aside className="space-y-4">
            <a href="tel:1199" className="flex items-center gap-4 rounded-2xl bg-emergency p-5 text-white shadow-md"><Phone size={34} /><span><span className="block font-display text-3xl font-extrabold">1199</span><span>Kenya Red Cross – free, 24 h</span></span></a>
            <a href="tel:999" className="flex items-center gap-4 rounded-2xl bg-night p-5 text-white"><Phone size={30} /><span><span className="block font-display text-2xl font-extrabold">999 / 112</span><span>Police & ambulance</span></span></a>
            <a href={`mailto:${EMAIL}`} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"><Mail size={28} className="text-tana" /><span><span className="block font-semibold">{EMAIL}</span><span className="text-muted">CSG emergency desk</span></span></a>
            <img src="./img/krcs_flood_safety.jpg" alt="Kenya Red Cross flood safety advice" className="w-full rounded-2xl shadow-sm" />
          </aside>
        </div>
      </Section>
    </div>
  )
}

function L({ label, children, wide, group }: { label: string; children: React.ReactNode; wide?: boolean; group?: boolean }) {
  const cls = `block ${wide ? 'md:col-span-2' : ''}`
  const inner = <><span className="mb-1.5 block font-semibold">{label}</span>{children}</>
  return group ? <div role="group" aria-label={label} className={cls}>{inner}</div> : <label className={cls}>{inner}</label>
}
