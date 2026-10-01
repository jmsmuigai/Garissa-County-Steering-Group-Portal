import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { PageHero, Section } from '../components/ui'

type Pic = { f: string; t: string; g: string; c?: string }
const PICS: Pic[] = [
  { f: 'field_bridge_aerial', t: 'Garissa bridge over a swollen River Tana', g: 'Floods on the ground', c: 'County field photo' },
  { f: 'field_tana_bridge_1', t: 'High water at the Tana bridge', g: 'Floods on the ground', c: 'County field photo' },
  { f: 'field_tana_bridge_2', t: 'Bridge approach under pressure', g: 'Floods on the ground', c: 'County field photo' },
  { f: 'field_flooded_bananas', t: 'Flooded banana plantation on a riverine farm', g: 'Floods on the ground', c: 'County field photo' },
  { f: 'field_submerged_crops', t: 'Submerged crops along the Tana', g: 'Floods on the ground', c: 'County field photo' },
  { f: 'field_waterlogged_farm', t: 'Waterlogged farm after the 2023 floods', g: 'Floods on the ground', c: 'County field photo' },
  { f: 'field_damaged_road', t: 'Road cut by flood water', g: 'Floods on the ground', c: 'County field photo' },
  { f: 'field_livestock_losses', t: 'Livestock losses after flooding', g: 'Floods on the ground', c: 'County field photo' },
  { f: 'field_river_gauge', t: 'River Tana staff gauge at Garissa', g: 'Floods on the ground', c: 'County field photo' },
  { f: 'field_newspaper', t: 'Press coverage of the floods', g: 'Floods on the ground', c: 'Newspaper clipping' },
  { f: 'dadaab_flooding', t: 'Flooding in the Dadaab camps', g: 'Floods on the ground' },
  { f: 'flood_impact_village', t: 'A village surrounded by water', g: 'Floods on the ground' },
  { f: 'field_banana_recovery', t: 'Banana farm recovering after the water drops', g: 'Recovery & solutions', c: 'County field photo' },
  { f: 'tana_harvest', t: 'Harvest on the Tana floodplain', g: 'Recovery & solutions' },
  { f: 'thriving_farm', t: 'A thriving irrigated farm', g: 'Recovery & solutions' },
  { f: 'lagha_tomatoes', t: 'Tomatoes grown with lagha water', g: 'Recovery & solutions' },
  { f: 'nbs_hero', t: 'Nature-based solutions in drylands', g: 'Recovery & solutions' },
  { f: 'rvf_vaccination', t: 'Livestock vaccination', g: 'Recovery & solutions' },
  { f: 'map_unosat_floods', t: 'UNOSAT flood extents 2023–2024', g: 'Maps', c: 'Garissa ICT & GIS' },
  { f: 'map_lagha_hazard', t: 'Lagha flash-flood hazard', g: 'Maps', c: 'Garissa ICT & GIS' },
  { f: 'map_town_flash_floods', t: 'Garissa Town flash floods', g: 'Maps', c: 'Garissa ICT & GIS' },
  { f: 'map_dadaab_2023', t: 'Dadaab camps flooding 2023', g: 'Maps', c: 'Garissa ICT & GIS' },
  { f: 'map_seven_forks_to_garissa', t: 'Seven Forks to Garissa', g: 'Maps', c: 'Garissa ICT & GIS' },
  { f: 'map_nbs_sites', t: 'Nature-based solution sites', g: 'Maps', c: 'Garissa ICT & GIS' },
  { f: 'inundation_heatmap', t: 'Inundation frequency heat map', g: 'Maps' },
  { f: 'kmd_october_2026_map', t: 'KMD October 2026 rainfall outlook', g: 'Forecasts & warnings', c: 'Kenya Meteorological Department' },
  { f: 'kmd_station_ledger', t: 'KMD station rainfall ledger', g: 'Forecasts & warnings', c: 'Kenya Meteorological Department' },
  { f: 'elnino_global_2026', t: 'El Niño 2026 global outlook', g: 'Forecasts & warnings' },
  { f: 'elnino_infographic', t: 'What El Niño means for East Africa', g: 'Forecasts & warnings' },
  { f: 'elnino_mechanism', t: 'How El Niño works', g: 'Forecasts & warnings' },
  { f: 'iod_infographic', t: 'The Indian Ocean Dipole', g: 'Forecasts & warnings' },
  { f: 'rainfall_anomaly', t: 'Rainfall anomaly outlook', g: 'Forecasts & warnings' },
  { f: 'krcs_flood_safety', t: 'Flood safety advice', g: 'Forecasts & warnings', c: 'Kenya Red Cross' },
  { f: 'cholera_advisory', t: 'Cholera prevention advisory', g: 'Forecasts & warnings' },
  { f: 'lagha_warning', t: 'Lagha crossing warning', g: 'Forecasts & warnings' },
  { f: 'masinga_spillway', t: 'Masinga dam spillway', g: 'River Tana & dams' },
  { f: 'seven_forks_cascade', t: 'Seven Forks cascade', g: 'River Tana & dams' },
  { f: 'dadaab_camp', t: 'Dadaab refugee complex', g: 'River Tana & dams' },
]
const GROUPS = Array.from(new Set(PICS.map((p) => p.g)))

export default function Gallery() {
  const [g, setG] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const list = PICS.filter((p) => !g || p.g === g)
  useEffect(() => {
    if (open === null) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') setOpen((o) => (o === null ? o : (o + 1) % list.length))
      if (e.key === 'ArrowLeft') setOpen((o) => (o === null ? o : (o - 1 + list.length) % list.length))
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, list.length])
  const cur = open !== null ? list[open] : null

  return (
    <>
      <PageHero img="./img/field_flooded_bananas.jpg" tone="tana" title="What the water leaves behind" lead="Field photos from county teams, maps from the Directorate of ICT & GIS and the forecasts the CSG works from." />
      <Section>
        <div className="mb-6 flex flex-wrap gap-2">
          {['', ...GROUPS].map((x) => <button key={x} onClick={() => setG(x)} className={`rounded-full px-4 py-2 font-semibold ${g === x ? 'bg-tana text-white' : 'bg-white ring-1 ring-black/10'}`}>{x || 'Everything'}</button>)}
        </div>
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {list.map((p, i) => (
            <button key={p.f} onClick={() => setOpen(i)} className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/5">
              <img src={`./img/${p.f}.jpg`} alt={p.t} loading="lazy" className="w-full transition group-hover:scale-[1.02]" />
              <span className="block p-3"><span className="block font-semibold">{p.t}</span>{p.c && <span className="text-sm text-muted">{p.c}</span>}</span>
            </button>
          ))}
        </div>
      </Section>
      {cur && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={cur.t} onClick={() => setOpen(null)}>
          <figure className="m-0 max-h-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <img src={`./img/${cur.f}.jpg`} alt={cur.t} className="max-h-[80vh] w-auto rounded-xl" />
            <figcaption className="mt-3 flex flex-wrap items-center gap-3 text-white">
              <span className="text-lg font-semibold">{cur.t}</span>{cur.c && <span className="text-white/60">{cur.c}</span>}
              <a href={`./img/${cur.f}.jpg`} download className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 font-semibold hover:bg-white/25"><Download size={16} /> Download</a>
            </figcaption>
          </figure>
          <button aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white" onClick={() => setOpen(null)}><X /></button>
          <button aria-label="Previous" className="absolute left-3 top-1/2 rounded-full bg-white/15 p-2 text-white" onClick={(e) => { e.stopPropagation(); setOpen((open! - 1 + list.length) % list.length) }}><ChevronLeft /></button>
          <button aria-label="Next" className="absolute right-3 top-1/2 rounded-full bg-white/15 p-2 text-white" onClick={(e) => { e.stopPropagation(); setOpen((open! + 1) % list.length) }}><ChevronRight /></button>
        </div>
      )}
    </>
  )
}
