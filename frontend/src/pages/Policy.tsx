import { Download, ExternalLink, Handshake, Scale, Eye, Users2, Link2, Target, Building2, CalendarDays, CheckCircle2, AlertTriangle, Database, MapPinned } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { Section, TranslatePage } from '../components/ui'

const PDF = './docs/Garissa_County_Partnerships_and_Coordination_Policy_2025.pdf'
const SRC = 'Garissa County Partnerships and Coordination Policy, Aug 2025 (Dept. of Resource Mobilization, Donor & Partner Coordination)'

const OBJECTIVES = [
  'Share objectives and clear expectations for predictable, transparent aid flows',
  'Institutionalise coordination structures with mandates, ToRs, calendars and a budget line',
  'Align with the CSG and UNHCR/DRS platforms in Dadaab under one county-led framework',
  'Adopt standard MoUs and joint work-planning templates for all partners',
  'Run a County Aid Information System with quarterly ledgers, ward maps and dashboards',
  'Align partner portfolios to the CIDP/ADP/MTEF with on-budget visibility and O&M planning',
  'Improve predictability and mutual accountability through an Annual Joint Review',
  'Broaden inclusion and localisation – CSOs and private sector at the table',
  'Coordinate the sourcing and management of external resources',
  'Align external resources with county development priorities',
  'Strengthen mutual accountability between county and partners, and among partners',
]
const PRINCIPLES = [
  { i: Target, t: 'Ownership', d: 'The county sets and drives its own development strategy.', c: '#0e7c86' },
  { i: Link2, t: 'Alignment', d: 'Partners align support with county priorities, policies and systems.', c: '#3e7d3a' },
  { i: Users2, t: 'Inclusive partnerships', d: 'Government, partners, civil society, private sector and affected communities all take part.', c: '#e8a33a' },
  { i: Eye, t: 'Transparency & mutual accountability', d: 'Open information, clear performance expectations and reciprocal oversight.', c: '#7a2614' },
  { i: Scale, t: 'Harmonisation', d: 'Partners coordinate, simplify procedures and share information to cut duplication.', c: '#5c6bc0' },
]
const SECTORS = [
  ['Education', 59], ['WASH', 55], ['Health', 38], ['Climate & environment', 38], ['Social protection', 31], ['Gender & protection', 24],
  ['Nutrition', 21], ['Governance & policy', 21], ['Livestock', 17], ['County infrastructure', 7], ['Crop production', 3],
].map(([s, v]) => ({ s, v }))
const FORMS = [
  { name: 'Bilateral', value: 45, fill: '#0e7c86' }, { name: 'Multilateral', value: 29, fill: '#e8a33a' },
  { name: 'NGO-led & other*', value: 23, fill: '#7a2614' }, { name: 'Public-private', value: 3, fill: '#3e7d3a' },
]
const THEMES = [['Health & nutrition', 19], ['Education', 19], ['WASH', 14], ['Child protection', 12], ['Livelihoods', 12], ['Disaster response & resilience', 9], ['Community engagement', 9], ['GBV & protection', 7]]
const STEPS = [
  ['Expression of interest', 'Letter of intent to DDPC: proposed areas, target wards and CIDP alignment.'],
  ['Pre-entry consultation', 'DDPC convenes departments, sub-county representatives and sector stakeholders to check fit and gaps.'],
  ['Due diligence & advisory review', 'Capacity and compliance check; advice on choosing downstream NGOs, CBOs and FBOs.'],
  ['Memorandum of Understanding', 'Roles, financial commitments, reporting and use of the County Aid Information System.'],
  ['Integration into coordination', 'Induction into the County Technical Forum, Sector Working Groups and joint work plans.'],
  ['Continuous reporting', 'Quarterly activity briefs, financial updates and evaluations to DDPC.'],
  ['Exit & close-out', 'Close-out report, lessons, sustainability and asset hand-over with O&M plan.'],
]
const QUARTERS = [
  ['Q1', 'Late June – early July', 'Endorse the annual Joint Work Plan; align with the ADP; resource mobilisation strategy; institutionalise structures.', '#0e7c86'],
  ['Q2', 'Late Sept – early Oct', 'Review CFSP priorities; coordinate multi-sector projects; capacity needs of sector teams.', '#e8a33a'],
  ['Q3', 'Late Jan – early Feb', 'Programme-based budget implementation; partner project status; M&E update; mid-term corrections.', '#3e7d3a'],
  ['Q4', 'Late March – early April', 'Year-end Development Cooperation Report; joint review; transition and exit plans; lessons for next cycle.', '#7a2614'],
]
const STATEMENTS = [
  ['Strengthened coordination structures', 'DDPC becomes the formal entry point; a legally anchored County Coordination Committee and secretariat with a ring-fenced budget; SWG calendars synced to ADP (1 Sept), CBROP/CFSP (Oct–Feb), PBB (30 Apr) and Appropriation (30 Jun).'],
  ['Monitoring & evaluation', 'A shared MEAL framework with common indicators, quarterly pause-and-reflect sessions, joint field visits and ward-level dashboards.'],
  ['Budgeting & planning', 'Division-of-labour frameworks and area-based approaches; joint priorities and cost-shares embedded in ADP, CFSP and PBB; county co-financing.'],
  ['Information management', 'A Data Sharing Protocol with quarterly CAIS submissions and a database of partner activities by location to avoid gaps and overlaps.'],
]
const PORTAL = [
  ['GIS-enabled information platform', 'Live county maps of assets, hazards and floods – the base layer for CAIS ward maps.'],
  ['Climate early-warning communication', 'The policy lists early-warning alerts among items to communicate; the portal pushes model outlooks, bulletins and gauge alerts.'],
  ['Public transparency', 'Open data downloads and community maps that anyone can query and print.'],
  ['Feedback channel', 'Citizen and partner reports go straight to emergency@garissa.go.ke.'],
  ['Inclusion', 'English, Kiswahili and Af-Soomaali so communities, RLOs and CBOs can take part.'],
]

export default function Policy() {
  return (
    <>
      <section className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(120deg,#2f7d32 0%,#0e7c86 55%,#142338 100%)' }}>
        <div className="mx-auto grid max-w-[1500px] items-center gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr] md:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm"><Handshake size={16} /> County Government of Garissa · August 2025</div>
            <h1 className="mt-4 text-4xl font-extrabold md:text-[3.3rem]">Partnerships & Coordination Policy</h1>
            <p className="mt-5 max-w-2xl text-lg text-white/90 md:text-xl">One of the first donor-coordination policies in Kenya's arid lands. It makes every partner enter through one door, plan with the county, report into one system and leave behind assets that keep working.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={PDF} download="Garissa_County_Partnerships_and_Coordination_Policy_2025.pdf" className="inline-flex items-center gap-2 rounded-xl bg-sand px-5 py-3 text-lg font-bold text-night shadow-lg hover:brightness-95"><Download size={20} /> Download the policy (PDF, 1 MB)</a>
              <a href={PDF} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 font-semibold hover:bg-white/25"><ExternalLink size={18} /> Read online</a>
            </div>
          </div>
          <a href={PDF} target="_blank" rel="noreferrer" className="mx-auto block w-56 rotate-2 overflow-hidden rounded-xl shadow-2xl ring-4 ring-white/30 transition hover:rotate-0 md:w-72">
            <img src="./img/policy_cover.jpg" alt="Cover of the Garissa County Partnerships and Coordination Policy" />
          </a>
        </div>
      </section>
      <TranslatePage targetId="policy-body" />

      <div id="policy-body">
        <Section>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['KSh 2.7 bn', 'spent by development partners in FY 2023/24', '#0e7c86'],
              ['KSh 1.0 bn', 'conditional partner grants in FY 2024/25 – 10.13% of the county envelope', '#e8a33a'],
              ['14 years', 'average time a partner has worked in Garissa (2 to 33 years)', '#3e7d3a'],
              ['KSh 20 M', 'financing gap: KSh 38 M to implement, KSh 18 M allocated', '#7a2614'],
            ].map(([v, l, c]) => (
              <div key={l} className="rounded-2xl p-5 text-white shadow-sm" style={{ background: c }}>
                <div className="font-display text-4xl font-extrabold tabular">{v}</div>
                <p className="mt-2 text-[15px] text-white/90" data-tr>{l}</p>
              </div>
            ))}
          </div>
          <blockquote className="mt-8 rounded-2xl border-l-8 border-tana bg-white p-6 text-xl shadow-sm ring-1 ring-black/5">
            <span className="font-display font-bold text-tana-deep">Policy goal: </span>
            <span data-tr>institutionalise a legally anchored, well-resourced, inclusive and data-driven coordination system that aligns all external assistance with county priorities, uses county systems, makes external flows predictable and transparent, and makes results last.</span>
          </blockquote>
        </Section>

        <Section title="Five guiding principles">
          <div className="grid gap-4 md:grid-cols-5">
            {PRINCIPLES.map(({ i: I, t, d, c }) => (
              <div key={t} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5" style={{ borderTop: `6px solid ${c}` }}>
                <I size={30} style={{ color: c }} />
                <h3 className="mt-3 text-lg font-bold">{t}</h3>
                <p className="mt-1 text-[15px] text-muted" data-tr>{d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="What partners do in Garissa today" lead="Findings from the 2024 donor mapping study (Garissa University with UNICEF) used in the policy.">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h3 className="text-lg font-bold">Share of partners working in each sector</h3>
              <div className="mt-3 h-[360px]">
                <ResponsiveContainer>
                  <BarChart data={SECTORS} layout="vertical" margin={{ left: 40, right: 30 }}>
                    <XAxis type="number" unit="%" domain={[0, 60]} />
                    <YAxis type="category" dataKey="s" width={150} tick={{ fontSize: 13 }} />
                    <Tooltip formatter={(v: any) => [`${v}% of partners`, 'Share']} />
                    <Bar dataKey="v" radius={[0, 6, 6, 0]} label={{ position: 'right', formatter: (v: any) => `${v}%`, fontSize: 12 }}>
                      {SECTORS.map((_, i) => <Cell key={i} fill={['#0e7c86', '#1e88e5', '#c62828', '#3e7d3a', '#8e24aa', '#ef6c00', '#00897b', '#5c6bc0', '#a1887f', '#546e7a', '#f9a825'][i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h3 className="text-lg font-bold">Form of partnership</h3>
              <div className="h-[300px]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={FORMS} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2} label={({ value }) => `${value}%`} />
                    <Legend />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-muted">* Remainder after the stated bilateral (45%), multilateral (29%) and PPP (3%) shares.</p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h3 className="text-lg font-bold">Themes of past partner initiatives</h3>
            <div className="mt-3 flex h-10 w-full overflow-hidden rounded-xl">
              {THEMES.map(([t, v], i) => <div key={t as string} title={`${t}: ${v}%`} style={{ width: `${(v as number) / 1.01}%`, background: ['#c62828', '#1e88e5', '#00acc1', '#8e24aa', '#3e7d3a', '#ef6c00', '#e8a33a', '#7a2614'][i] }} />)}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {THEMES.map(([t, v], i) => <span key={t as string} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: ['#c62828', '#1e88e5', '#00acc1', '#8e24aa', '#3e7d3a', '#ef6c00', '#e8a33a', '#7a2614'][i] }} />{t} {v}%</span>)}
            </div>
          </div>
        </Section>

        <Section title="Why a policy was needed">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['No front door', 'Entry and exit procedures were undefined, so some partners worked without registering or syncing with the county.'],
              ['The CSG has no legal anchor', 'It meets irregularly, depends on goodwill, has a thin secretariat and no budget for real-time data or GIS mapping.'],
              ['Data in silos', 'No aid register, no shared reporting protocol and little real-time data on external flows.'],
              ['Uneven geography', 'Dadaab and Garissa Township wards host many projects while Liboi, Bura and Hulugho are under-served.'],
              ['Duplication & hidden costs', 'Same beneficiaries targeted twice; donated assets left without operation and maintenance budgets.'],
              ['Few incentives to coordinate', 'Most partnerships are bilateral (45%) – only 29% pool resources across actors.'],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-3 rounded-2xl bg-crest-light p-5">
                <AlertTriangle className="shrink-0 text-crest" />
                <div><h3 className="text-lg font-bold text-crest">{t}</h3><p className="mt-1 text-[15px]" data-tr>{d}</p></div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Eleven policy objectives">
          <ol className="grid gap-3 p-0 md:grid-cols-2">
            {OBJECTIVES.map((o, i) => (
              <li key={o} className="flex list-none items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display font-bold text-white" style={{ background: ['#0e7c86', '#3e7d3a', '#e8a33a', '#7a2614', '#5c6bc0', '#00897b', '#ef6c00', '#8e24aa', '#1e88e5', '#c62828', '#6d4c41'][i] }}>{i + 1}</span>
                <span className="pt-1" data-tr>{o}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="The new coordination architecture">
          <div className="rounded-3xl bg-night p-6 text-white md:p-10">
            <div className="mx-auto max-w-4xl space-y-3">
              <Tier color="#7a2614" title="County Coordination Committee (CCC)" sub="Highest policy advisory body · the Governor, County Commissioner, CECMs for partnerships and finance, County Secretary, Chief Officer DDPC (secretary), UNRCO, UNHCR, Kenya Red Cross, private sector, INGOs, CBOs/CSOs" />
              <Arrow />
              <Tier color="#0e7c86" title="County Technical Forum" sub="Chaired by the Director, DDPC · directors of Finance, Water, Education, Health, Agriculture & Livestock, Climate Change, Gender, Peace, refugee-inclusion focal point, partners, academia, faith and private sector · compiles joint work plans for CCC approval" />
              <Arrow />
              <div className="grid gap-3 md:grid-cols-3">
                <Tier color="#3e7d3a" title="Sector Working Groups" sub="Chaired by Chief Officers; county sectoral plans, joint sector work plans and MoUs" />
                <Tier color="#e8a33a" dark title="Joint Implementation Committees" sub="Oversee large multi-partner projects, risks and accountability" />
                <Tier color="#5c6bc0" title="Sub-county, ward & village committees" sub="Area-based coordination incl. Dadaab (GISEDP, Shirika Plan)" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4"><Building2 className="shrink-0 text-sand" /><div><b>DDPC – the single entry point</b><p className="m-0 text-sm text-white/80">Custodian of the policy: partner register, MoUs, quarterly meetings, CAIS and capacity building.</p></div></div>
                <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4"><Users2 className="shrink-0 text-sand" /><div><b>County Steering Group</b><p className="m-0 text-sm text-white/80">Coordinates national-government projects and drought/flood early warning & contingency – now plugged into the new structure.</p></div></div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Seven steps for a partner to enter Garissa">
          <ol className="relative grid gap-4 p-0 lg:grid-cols-7">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="list-none rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full font-display text-xl font-bold text-white" style={{ background: `hsl(${185 - i * 22} 70% ${34 + i * 2}%)` }}>{i + 1}</div>
                <h3 className="mt-3 text-[1.05rem] font-bold leading-snug">{t}</h3>
                <p className="mt-1 text-sm text-muted" data-tr>{d}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Quarterly coordination calendar" lead="County Coordination Committee meetings, synchronised with the county planning and budget cycle. Quorum: simple majority; in person or virtual.">
          <div className="grid gap-4 md:grid-cols-4">
            {QUARTERS.map(([q, w, a, c]) => (
              <div key={q} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: c }}><CalendarDays size={18} /><b className="font-display text-xl">{q}</b><span className="ml-auto text-sm">{w}</span></div>
                <p className="p-4 text-[15px]" data-tr>{a}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Four policy statements">
          <div className="grid gap-4 md:grid-cols-2">
            {STATEMENTS.map(([t, d], i) => (
              <div key={t} className="rounded-2xl p-6" style={{ background: ['#d6eff0', '#dcebd5', '#f7ead0', '#f4e1da'][i] }}>
                <h3 className="text-xl font-bold" style={{ color: ['#0a5961', '#2f5f2c', '#8a5a12', '#7a2614'][i] }}>{t}</h3>
                <p className="mt-2 text-[15px]" data-tr>{d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="How this portal delivers on the policy">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            <ul className="m-0 space-y-3 p-0">
              {PORTAL.map(([t, d]) => (
                <li key={t} className="flex list-none gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                  <CheckCircle2 className="shrink-0 text-acacia" />
                  <div><b>{t}</b><p className="m-0 text-[15px] text-muted" data-tr>{d}</p></div>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h3 className="flex items-center gap-2 text-xl font-bold"><Database className="text-tana" /> Funding the policy</h3>
              <p className="mt-2 text-muted">Indicative implementation cost and county allocation (KSh millions).</p>
              <div className="mt-4 space-y-3">
                <Bar2 label="Total cost" v={38} max={38} c="#142338" />
                <Bar2 label="County allocation" v={18} max={38} c="#0e7c86" />
                <Bar2 label="Gap to mobilise" v={20} max={38} c="#c81d25" />
              </div>
              <p className="mt-4 text-[15px]">A pooled Coordination Fund – from donors, foundations, private-sector CSR and PPPs – will finance joint reviews, CAIS operations and sector working group meetings, with quarterly fund statements.</p>
              <a href={PDF} download className="mt-4 inline-flex items-center gap-2 rounded-xl bg-tana px-4 py-2.5 font-semibold text-white hover:bg-tana-deep"><Download size={18} /> Download full policy</a>
              <a href="#/community" className="ml-2 mt-4 inline-flex items-center gap-2 rounded-xl bg-night/5 px-4 py-2.5 font-semibold hover:bg-night/10"><MapPinned size={18} /> Partner maps</a>
            </div>
          </div>
          <p className="mt-6 text-sm text-muted">Source: {SRC}. Figures quoted from the policy's situation analysis and implementation framework.</p>
        </Section>
      </div>
    </>
  )
}

function Tier({ color, title, sub, dark }: { color: string; title: string; sub: string; dark?: boolean }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: color, color: dark ? '#142338' : '#fff' }}>
      <div className="font-display text-lg font-bold">{title}</div>
      <p className="m-0 mt-1 text-sm opacity-90">{sub}</p>
    </div>
  )
}
function Arrow() { return <div className="mx-auto h-6 w-0.5 bg-white/40" /> }
function Bar2({ label, v, max, c }: { label: string; v: number; max: number; c: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><b className="tabular">KSh {v} M</b></div>
      <div className="h-4 rounded-full bg-black/5"><div className="h-4 rounded-full" style={{ width: `${(v / max) * 100}%`, background: c }} /></div>
    </div>
  )
}
