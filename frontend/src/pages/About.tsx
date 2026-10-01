import { Link } from 'react-router-dom'
import { Users, Landmark, Megaphone, ClipboardCheck, HandCoins, Network, FileBarChart, ArrowRight } from 'lucide-react'
import { PageHero, Section, Stat, Figure, TranslatePage } from '../components/ui'
import { LEVEL_COLORS } from '../lib/store'

const MANDATE = [
  { icon: Megaphone, t: 'Early warning', d: 'Validate and share NDMA monthly bulletins and KMD seasonal, monthly and weekly forecasts with every sector and community.' },
  { icon: ClipboardCheck, t: 'Preparedness & contingency', d: 'Approve flood and drought contingency plans and trigger response scenarios when gauge, rainfall or nutrition thresholds are crossed.' },
  { icon: HandCoins, t: 'Resource mobilisation', d: 'Mobilise and allocate the County Emergency Fund, Drought Contingency Fund and partner pipelines so help arrives early.' },
  { icon: Network, t: 'Sector coordination', d: 'Steer Health & Nutrition, WASH, Education, Agriculture & Livestock, Peace & Security and Infrastructure working groups.' },
  { icon: FileBarChart, t: 'Assessment & reporting', d: 'Commission rapid assessments, track response, and report to the National Disaster Operations Centre and the County Assembly.' },
]

const SCEN = [
  ['WATCH', '< 4.0 m', 'Normal season; monitoring of KMD forecasts and Seven Forks levels.', 'Daily monitoring; community messaging on safety; pre-position stocks.'],
  ['ALERT', '4.0 m', 'Moderate case: ~3,000 households (~18,000 people) displaced along riverine farms and low-lying Garissa Township.', 'Activate sector working groups; move pumps & livestock; open evacuation sites.'],
  ['ALARM', '5.0 m', 'Riverine farms flooded; Bour-Algi, Korakora, Sankuri, Saka villages at risk.', 'Evacuate riverine farms; boats and NFIs deployed; WASH & health surge.'],
  ['EMERGENCY', '≥ 6.2 m', 'Worst case: > 8,000 households / 48,000+ people displaced; bridge approaches and town wards submerged.', 'Full CSG activation; national & partner surge; continuous briefings.'],
]

export default function About() {
  return (
    <>
      <PageHero img="./img/dadaab_camp.jpg" title="One table for every agency" lead="The Garissa County Steering Group brings county and national government, NDMA, the Kenya Red Cross, the UN, NGOs and communities together to see risk early and act together." tone="night">
        <Link to="/policy" className="rounded-xl bg-sand px-5 py-3 font-semibold text-night hover:brightness-95">Read the partnerships policy</Link>
        <Link to="/" className="rounded-xl bg-white/15 px-5 py-3 font-semibold hover:bg-white/25">Open the risk map</Link>
      </PageHero>
      <TranslatePage targetId="about-body" />
      <div id="about-body">
        <Section title="What is the CSG?">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
            <div className="prose-csg text-lg">
              <p data-tr>The County Steering Group is Garissa's apex forum for disaster risk management, early warning and humanitarian coordination. It was set up under the National Drought Management Authority's coordination framework and is co-chaired by H.E. the Governor of Garissa County and the County Commissioner, who represents the National Government.</p>
              <p data-tr>NDMA's Garissa office is the secretariat, working with the County Directorate of Special Programmes and Disaster Management and the Directorate of ICT & GIS. The CSG meets monthly and convenes immediately when floods or drought escalate, supported by Sub-County Steering Groups closer to communities.</p>
              <p data-tr>Until now the CSG communicated through PDFs, WhatsApp images of weather tables and paper attendance sheets – often 24 to 72 hours behind a dam spill or KMD alert. This portal replaces that with live maps, model-based forecasts, a trilingual AI assistant and two-way reporting, so riverine farms and the Dadaab camps get the warning while there is still time to move.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 self-start">
              <Stat value="44,800 km²" label="County area" color="#0e7c86" note="Arid & semi-arid (zones V–VI)" />
              <Stat value="~275 mm" label="Mean annual rain" color="#7a2614" note="yet severe El Niño floods" />
              <Stat value="395 km" label="River Tana reach" color="#3e7d3a" note="along the western boundary" />
              <Stat value="6" label="Sub-counties mapped" color="#e8a33a" note="+ administrative sub-counties" />
            </div>
          </div>
        </Section>

        <Section title="Our mandate" lead="Five jobs the CSG does for Garissa.">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {MANDATE.map(({ icon: I, t, d }) => (
              <div key={t} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <I className="text-tana" size={30} />
                <h3 className="mt-3 text-xl font-bold">{t}</h3>
                <p className="mt-2 text-[15px] text-muted" data-tr>{d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="How the CSG is organised">
          <div className="rounded-3xl bg-night p-6 text-white md:p-10">
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
              <div className="grid w-full gap-3 sm:grid-cols-2">
                <Node icon={<Landmark />} title="H.E. the Governor" sub="Co-chair · County Government" color="#7a2614" />
                <Node icon={<Landmark />} title="County Commissioner" sub="Co-chair · National Government" color="#006600" />
              </div>
              <Line />
              <Node icon={<Users />} title="CSG Secretariat – NDMA Garissa" sub="with Special Programmes / Disaster Management & ICT-GIS" color="#0e7c86" wide />
              <Line />
              <div className="grid w-full gap-2 sm:grid-cols-3">
                {['Health & Nutrition', 'WASH', 'Education', 'Agriculture & Livestock', 'Peace & Security', 'Roads & Infrastructure'].map((s) => (
                  <div key={s} className="rounded-xl bg-white/10 px-3 py-2.5 font-semibold">{s}</div>
                ))}
              </div>
              <Line />
              <Node icon={<Users />} title="Sub-County Steering Groups & ward committees" sub="Garissa Township · Balambala · Lagdera · Dadaab · Fafi · Ijara · Hulugho · Bura East · Liboi" color="#e8c07d" dark wide />
            </div>
            <p className="mx-auto mt-6 max-w-3xl text-center text-white/75">Members include Kenya Red Cross, KMD, Water Resources Authority, county departments, UNHCR, WFP, UNICEF, WHO, FAO, NGOs, refugee-led organisations, the private sector and community representatives.</p>
          </div>
        </Section>

        <Section title="Flood response scenarios" lead="The CSG activates its plans on the River Tana gauge at Garissa (RGS 4G01). The same thresholds drive the portal's alert colours.">
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
              <thead><tr className="bg-night text-white"><th className="p-3">Level</th><th className="p-3">Gauge</th><th className="p-3">What it means</th><th className="p-3">CSG action</th></tr></thead>
              <tbody>
                {SCEN.map(([l, g, m, a]) => (
                  <tr key={l} className="border-t border-black/5">
                    <td className="p-3"><span className="rounded-md px-2.5 py-1 font-bold text-white" style={{ background: LEVEL_COLORS[l] }}>{l}</span></td>
                    <td className="p-3 font-display text-lg font-bold tabular">{g}</td>
                    <td className="p-3" data-tr>{m}</td>
                    <td className="p-3" data-tr>{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Where the policy takes the CSG next">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr]">
            <Figure src="./img/field_bridge_aerial.jpg" caption="Garissa bridge over the River Tana during high flows" credit="County field photo" />
            <div className="prose-csg text-lg">
              <p data-tr>The Garissa County Partnerships and Coordination Policy (August 2025) recognises the CSG's proven convening power in droughts and floods – and its weaknesses: no legal anchoring, irregular meetings, a thin secretariat and no shared data or GIS mapping.</p>
              <p data-tr>The policy creates a County Coordination Committee and Technical Forum, ties sector working groups to the budget calendar and calls for a GIS-enabled County Aid Information System with ward maps and dashboards. This portal is the first building block: open maps, shared data and a single place for early-warning communication.</p>
              <Link to="/policy" className="mt-2 inline-flex items-center gap-2 font-semibold text-tana-deep hover:underline">Explore the policy <ArrowRight size={18} /></Link>
            </div>
          </div>
        </Section>
      </div>
    </>
  )
}

function Node({ icon, title, sub, color, wide, dark }: { icon: React.ReactNode; title: string; sub: string; color: string; wide?: boolean; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left ${wide ? 'w-full' : ''}`} style={{ background: color, color: dark ? '#142338' : '#fff' }}>
      <span className="shrink-0">{icon}</span>
      <span><span className="block font-display text-lg font-bold leading-tight">{title}</span><span className="block text-sm opacity-85">{sub}</span></span>
    </div>
  )
}
function Line() { return <div className="h-6 w-0.5 bg-white/40" /> }
