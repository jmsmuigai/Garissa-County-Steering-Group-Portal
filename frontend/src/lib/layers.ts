// Single source of truth for every map layer: file, styling, legend and hover attributes.
export type LayerDef = {
  id: string
  label: string
  group: 'Boundaries' | 'River Tana & floods' | 'Hazards' | 'Assets & services' | 'Upper Tana' | 'Nature-based solutions' | 'Terrain, land & people'
  file: string
  kind: 'polygon' | 'line' | 'point' | 'image' | 'wms' | 'tile'
  url?: string
  wmsLayer?: string
  opacity?: number
  gradient?: { colors: string[]; labels: string[]; title: string }
  on?: boolean
  color: string
  // dynamic styling by attribute
  styleBy?: { field: string; map: Record<string, string>; fallback?: string }
  radius?: number
  fillOpacity?: number
  weight?: number
  dash?: string
  tip: (p: any) => string
  cite?: string
  legend?: { label: string; color: string; shape?: 'dot' | 'line' | 'area' }[]
  // raster layers have no vector tooltip
  source: string
  minZoom?: number
}

const n = (v: any, d = 1) => (v === null || v === undefined || v === '' ? 'n/a' : typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : v)
const row = (k: string, v: any) => `${k}: <b>${n(v)}</b>`
const tip = (title: string, rows: string[]) => `<div style="font-weight:600;font-size:15px;margin-bottom:4px">${title}</div>${rows.join('<br/>')}`

const RISK4 = { 'Very High': '#c81d25', High: '#f28c28', Moderate: '#f2c230', Low: '#2e9e4f', Medium: '#f2c230' }

export const LAYERS: LayerDef[] = [
  {
    id: 'county', label: 'Garissa County boundary', group: 'Boundaries', file: 'county.geojson', kind: 'polygon', on: true,
    color: '#ff1744', weight: 4, fillOpacity: 0, source: 'geoBoundaries (CC-BY 4.0)',
    tip: (p) => tip('Garissa County (007)', [row('Area km²', p.area_km2), row('HQ', p.capital)]),
    legend: [{ label: 'County boundary', color: '#ff1744', shape: 'line' }],
  },
  {
    id: 'subcounties', label: 'Sub-counties (constituencies)', group: 'Boundaries', file: 'subcounties.geojson', kind: 'polygon', on: true,
    color: '#ffffff', weight: 1.6, dash: '6 6', fillOpacity: 0.02, source: 'geoBoundaries ADM2',
    tip: (p) => tip(p.name, [row('Area km²', p.area_km2), p.note]),
    legend: [{ label: 'Sub-county boundary', color: '#ffffff', shape: 'line' }],
  },
  {
    id: 'places', label: 'Towns & villages', group: 'Boundaries', file: 'places.geojson', kind: 'point', on: true,
    color: '#ffffff', radius: 4, source: 'CSG gazetteer',
    tip: (p) => tip(p.name, [p.kind, row('Distance to Tana (km)', p.dist_tana_km)]),
  },
  {
    id: 'tana', label: 'River Tana (main stem)', group: 'River Tana & floods', file: 'tana_river.geojson', kind: 'line', on: true,
    color: '#00b8d4', weight: 4.5, source: 'HydroSHEDS',
    tip: (p) => tip('River Tana', [row('Traced length (km)', p.length_km), p.note]),
    legend: [{ label: 'River Tana', color: '#00b8d4', shape: 'line' }],
  },
  {
    id: 'tana_buffers', label: 'Tana asset buffers 0.5–5 km', group: 'River Tana & floods', file: 'tana_buffers.geojson', kind: 'polygon', on: false,
    color: '#00e5ff', fillOpacity: 0.22, weight: 0.6, source: 'CSG GIS (UTM 37S buffers)',
    styleBy: { field: 'buffer_km', map: { '0.5': '#ff1744', '1': '#ff9100', '2': '#ffd600', '5': '#00e5ff' } },
    tip: (p) => tip(p.label, ['Assets inside are listed in the buffer panel']),
    legend: [{ label: '0.5 km', color: '#ff1744', shape: 'area' }, { label: '1 km', color: '#ff9100', shape: 'area' }, { label: '2 km', color: '#ffd600', shape: 'area' }, { label: '5 km', color: '#00e5ff', shape: 'area' }],
  },
  {
    id: 'flood_sim', label: 'Flood simulation (gauge stage)', group: 'River Tana & floods', file: 'flood_sim_bands.geojson', kind: 'polygon', on: false,
    color: '#1e88e5', fillOpacity: 0.45, weight: 1, source: 'CSG flood simulator (historical-envelope model)',
    tip: (p) => tip(`Simulated flood at ${p.stage_m} m`, [row('Level', p.level), row('Area km²', p.area_km2), row('Spread from channel (km)', p.width_km)]),
    legend: [{ label: 'Simulated inundation', color: '#1e88e5', shape: 'area' }],
  },
  {
    id: 'flood_2023_viirs', label: 'Nov 2023 El Niño flood (VIIRS)', group: 'River Tana & floods', file: 'flood_2023_viirs.geojson', kind: 'polygon', on: true,
    color: '#7c4dff', fillOpacity: 0.4, weight: 0.5, source: 'UNOSAT / NOAA VIIRS',
    tip: (p) => tip(p.label, [row('Area (ha)', p.area_ha), row('People exposed', p.pop_exposed_worldpop)]),
    legend: [{ label: 'Flood Nov 2023 (VIIRS)', color: '#7c4dff', shape: 'area' }],
  },
  {
    id: 'flood_2023_town', label: 'Nov 2023 flood – Garissa Town', group: 'River Tana & floods', file: 'flood_2023_town.geojson', kind: 'polygon', on: false,
    color: '#2962ff', fillOpacity: 0.5, weight: 0.5, source: 'UNOSAT Sentinel-2',
    tip: (p) => tip(p.label, [row('Area (ha)', p.area_ha), row('People exposed', p.pop_exposed_worldpop)]),
    legend: [{ label: 'Flood Nov 2023 – town', color: '#2962ff', shape: 'area' }],
  },
  {
    id: 'flood_2023_dadaab', label: 'Nov 2023 flood – Dadaab', group: 'River Tana & floods', file: 'flood_2023_dadaab.geojson', kind: 'polygon', on: false,
    color: '#00bfa5', fillOpacity: 0.5, weight: 0.5, source: 'UNOSAT Landsat-8/Sentinel-2',
    tip: (p) => tip(p.label, [row('Area (ha)', p.area_ha), row('People exposed', p.pop_exposed_worldpop)]),
    legend: [{ label: 'Flood Nov 2023 – Dadaab', color: '#00bfa5', shape: 'area' }],
  },
  {
    id: 'flood_2024_tana', label: 'Apr 2024 Tana flood', group: 'River Tana & floods', file: 'flood_2024_tana.geojson', kind: 'polygon', on: false,
    color: '#ff4081', fillOpacity: 0.45, weight: 0.5, source: 'UNOSAT Sentinel-2',
    tip: (p) => tip(p.label, [row('Area (ha)', p.area_ha), row('People exposed', p.pop_exposed_worldpop)]),
    legend: [{ label: 'Flood Apr 2024', color: '#ff4081', shape: 'area' }],
  },
  {
    id: 'structures_2024', label: 'Flood-affected structures (May 2024)', group: 'River Tana & floods', file: 'structures_2024.geojson', kind: 'point', on: false,
    color: '#ff6d00', radius: 2.5, source: 'UNOSAT PlanetScope 05-May-2024', minZoom: 9,
    tip: (p) => tip('Flood-affected structure', [p.event]),
    legend: [{ label: 'Affected structure 2024', color: '#ff6d00', shape: 'dot' }],
  },
  {
    id: 'blindfolds', label: 'Tana "blind-folds" (meander necks)', group: 'River Tana & floods', file: 'tana_blindfolds.geojson', kind: 'point', on: true,
    color: '#d500f9', radius: 9, source: 'CSG sinuosity analysis',
    styleBy: { field: 'risk', map: { 'Very High': '#d500f9', High: '#ea80fc', Moderate: '#f3c4fb' } },
    tip: (p) => tip(p.name, [row('Sinuosity', p.sinuosity), row('Overtopping risk', p.risk), p.explain]),
    legend: [{ label: 'Meander neck / avulsion hotspot', color: '#d500f9', shape: 'dot' }],
  },
  {
    id: 'laghas', label: 'Laghas & flash-flood hazard', group: 'Hazards', file: 'laghas.geojson', kind: 'line', on: false,
    color: '#e8c07d', weight: 2, source: 'NBSOS lagha classification',
    styleBy: { field: 'ff_hazard', map: RISK4 },
    tip: (p) => tip(`Lagha ${p.id}`, [p.lagha_class, row('Flash-flood hazard', p.ff_hazard), row('Upstream area km²', p.upstream_km2), row('System', p.system), row('Nearest town', p.near_town)]),
    legend: [{ label: 'Very high hazard', color: '#c81d25', shape: 'line' }, { label: 'High', color: '#f28c28', shape: 'line' }, { label: 'Moderate', color: '#f2c230', shape: 'line' }, { label: 'Low', color: '#2e9e4f', shape: 'line' }],
  },
  {
    id: 'farm_zones', label: 'Tana farm & inundation zones', group: 'Hazards', file: 'farm_zones.geojson', kind: 'polygon', on: false,
    color: '#76ff03', fillOpacity: 0.35, weight: 1, source: 'GARISSADRM',
    styleBy: { field: 'zone_type', map: { flood_inundation: '#2979ff', agricultural_impact: '#76ff03' } },
    tip: (p) => tip(p.name, [row('Zone', p.zone_type?.replace('_', ' ')), row('Risk', p.risk), p.description]),
    legend: [{ label: 'Farm inundation zone', color: '#2979ff', shape: 'area' }, { label: 'Agricultural impact zone', color: '#76ff03', shape: 'area' }],
  },
  {
    id: 'town_catchments', label: 'Garissa Town lagha catchments', group: 'Hazards', file: 'town_catchments.geojson', kind: 'polygon', on: false,
    color: '#ffab40', fillOpacity: 0.12, weight: 1.5, dash: '4 4', source: 'NBSOS',
    tip: (p) => tip(`Catchment ${p.site_ref}`, [row('Area km²', p.area_km2)]),
    legend: [{ label: 'Town catchment', color: '#ffab40', shape: 'area' }],
  },
  {
    id: 'schools', label: 'Schools', group: 'Assets & services', file: 'schools.geojson', kind: 'point', on: true,
    color: '#ffd600', radius: 5.5, source: 'GARISSADRM schools (enriched)',
    styleBy: { field: 'risk', map: { HIGH: '#ff1744', MEDIUM: '#ffab00', LOW: '#00e676' } },
    tip: (p) => tip(p.name, [row('Type', p.type), row('Level', p.level), row('Sub-county', p.sub_county), row('Pupils', p.pupils), row('Flood risk', p.risk), row('Distance to Tana (km)', p.dist_tana_km)]),
    legend: [{ label: 'School – high flood risk', color: '#ff1744', shape: 'dot' }, { label: 'School – medium', color: '#ffab00', shape: 'dot' }, { label: 'School – low', color: '#00e676', shape: 'dot' }],
  },
  {
    id: 'health', label: 'Health facilities', group: 'Assets & services', file: 'health_facilities.geojson', kind: 'point', on: true,
    color: '#ff4081', radius: 6.5, source: 'GARISSADRM health facilities',
    tip: (p) => tip(p.name, [row('KEPH level', p.kephl_level), row('Service', p.service), row('Staff', p.staff), row('Patients/day', p.patients_per_day), row('Water on site', p.water_on_site), row('Flood exposure', p.flood_exposure), row('Distance to Tana (km)', p.dist_tana_km)]),
    legend: [{ label: 'Health facility', color: '#ff4081', shape: 'dot' }],
  },
  {
    id: 'boreholes', label: 'Boreholes', group: 'Assets & services', file: 'boreholes.geojson', kind: 'point', on: false,
    color: '#2979ff', radius: 5, source: 'County Water Dept. borehole inventory',
    styleBy: { field: 'functional', map: { Yes: '#2979ff', Fun: '#2979ff', No: '#90a4ae', Non: '#90a4ae', Par: '#80d8ff' }, fallback: '#2979ff' },
    tip: (p) => tip(p.village || 'Borehole', [row('Ward', p.ward), row('Functional', p.functional), row('Households served', p.households_served), row('Depth (m)', p.depth_m), row('Yield (m³/h)', p.yield_m3h), row('Camels/day', p.camels_day), row('Distance to Tana (km)', p.dist_tana_km)]),
    legend: [{ label: 'Borehole – working', color: '#2979ff', shape: 'dot' }, { label: 'Borehole – not working', color: '#90a4ae', shape: 'dot' }],
  },
  {
    id: 'water_pans', label: 'Water pans', group: 'Assets & services', file: 'water_pans.geojson', kind: 'point', on: false,
    color: '#18ffff', radius: 4.5, source: 'County water pan inventory / NBSOS',
    styleBy: { field: 'flood_exposure', map: RISK4 },
    tip: (p) => tip(p.name || 'Water pan', [row('Sub-county', p.subcounty), row('Ward', p.ward), row('Flood exposure', p.flood_exposure), row('Nearest lagha (km)', p.nearest_lagha_km), row('Flooded 2023', p.flooded_2023 ? 'Yes' : 'No')]),
    legend: [{ label: 'Water pan (colour = flood exposure)', color: '#18ffff', shape: 'dot' }],
  },
  {
    id: 'camps', label: 'Dadaab refugee camps', group: 'Assets & services', file: 'refugee_camps.geojson', kind: 'polygon', on: false,
    color: '#ffd740', fillOpacity: 0.35, weight: 0.8, source: 'UNHCR camp blocks',
    styleBy: { field: 'camp', map: { Hagadera: '#ffd740', Ifo: '#ffab40', Dagahaley: '#ff6e40' } },
    tip: (p) => tip(`${p.camp} – block ${p.block}`, [row('Population', p.population), row('Type', p.type)]),
    legend: [{ label: 'Hagadera', color: '#ffd740', shape: 'area' }, { label: 'Ifo', color: '#ffab40', shape: 'area' }, { label: 'Dagahaley', color: '#ff6e40', shape: 'area' }],
  },
  {
    id: 'met_stations', label: 'KMD observation stations', group: 'Assets & services', file: 'met_stations.geojson', kind: 'point', on: false,
    color: '#b388ff', radius: 6, source: 'KMD Garissa observation network ledger',
    tip: (p) => tip(p.name, [row('KMD number', p.kmd_number), row('Opened', p.opened), row('Distance to Tana (km)', p.dist_tana_km)]),
    legend: [{ label: 'KMD rain station', color: '#b388ff', shape: 'dot' }],
  },
  {
    id: 'dams', label: 'Seven Forks dams', group: 'Upper Tana', file: 'seven_forks_dams.geojson', kind: 'point', on: true,
    color: '#00e5ff', radius: 9, source: 'KenGen (approx.)',
    tip: (p) => tip(p.name, [row('Storage (million m³)', p.storage_mcm), row('Capacity (MW)', p.capacity_mw), row('Commissioned', p.commissioned), p.note]),
    legend: [{ label: 'Seven Forks dam', color: '#00e5ff', shape: 'dot' }],
  },
  {
    id: 'catchment', label: 'Seven Forks catchment (indicative)', group: 'Upper Tana', file: 'seven_forks_catchment.geojson', kind: 'polygon', on: true,
    color: '#64dd17', fillOpacity: 0.15, weight: 2, dash: '8 6', source: 'Derived from HydroSHEDS',
    tip: (p) => tip(p.name, [row('Area km²', p.area_km2), p.note]),
    legend: [{ label: 'Upper Tana catchment', color: '#64dd17', shape: 'area' }],
  },
  {
    id: 'upper_tana', label: 'Upper Tana tributaries', group: 'Upper Tana', file: 'upper_tana_rivers.geojson', kind: 'line', on: false,
    color: '#4fc3f7', weight: 1.5, source: 'HydroSHEDS',
    tip: (p) => tip('Upper Tana tributary', [row('Stream order', p.strahler)]),
  },
  {
    id: 'travel', label: 'Flood travel-time markers', group: 'Upper Tana', file: 'tana_travel_markers.geojson', kind: 'point', on: true,
    color: '#ffffff', radius: 6, source: 'CSG hydrology',
    tip: (p) => tip(p.name, [row('Travel time from Kiambere', p.travel_range), row('River km from Masinga', p.river_km)]),
    legend: [{ label: 'Flood travel-time point', color: '#ffffff', shape: 'dot' }],
  },
  {
    id: 'nbs_sites', label: 'NbS candidate sites', group: 'Nature-based solutions', file: 'nbs_sites.geojson', kind: 'point', on: false,
    color: '#00c853', radius: 7, source: 'NBSOS opportunity scan',
    styleBy: { field: 'priority', map: { 'Very High': '#00c853', High: '#64dd17', Medium: '#c6ff00' } },
    tip: (p) => tip(`${p.site_id}: ${p.nbs_type}`, [row('Priority', p.priority), row('Lagha system', p.system), row('Flash-flood hazard', p.ff_hazard), row('Near', p.near_town), row('Upstream area km²', p.upstream_km2)]),
    legend: [{ label: 'NbS site – very high priority', color: '#00c853', shape: 'dot' }, { label: 'NbS site – high', color: '#64dd17', shape: 'dot' }, { label: 'NbS site – medium', color: '#c6ff00', shape: 'dot' }],
  },
  {
    id: 'nbs_storage', label: 'NbS storage areas', group: 'Nature-based solutions', file: 'nbs_storage.geojson', kind: 'polygon', on: false,
    color: '#1de9b6', fillOpacity: 0.4, weight: 1, source: 'NBSOS',
    tip: (p) => tip(`${p.site_id} storage area`, [p.nbs_type]),
    legend: [{ label: 'NbS storage area', color: '#1de9b6', shape: 'area' }],
  },
  // ------------------------------------------------------------- rasters (terrain, land use, population, live rain)
  {
    id: 'elevation', label: 'Elevation + hillshade (SRTM 30 m)', group: 'Terrain, land & people', file: '', kind: 'image', url: './overlays/elevation_hillshade.webp', opacity: 0.8,
    color: '#a8d47a', source: 'NASA SRTM via NBSOS pipeline', tip: () => '',
    gradient: { title: 'Elevation (m above sea level)', colors: ['#0b6e4f', '#3aa66a', '#a8d47a', '#f1e38b', '#e7b35a', '#c9793a', '#9c4a2a'], labels: ['4', '250', '≈500'] },
  },
  {
    id: 'lulc', label: 'Land use / land cover 2010 (LUC2010)', group: 'Terrain, land & people', file: '', kind: 'image', url: './overlays/lulc_2010.webp', opacity: 0.75,
    color: '#a6d96a', source: 'RCMRD / Kenya Forest Service LUC2010', tip: () => '',
    legend: [{ label: 'Savannah 47%', color: '#a6d96a', shape: 'area' }, { label: 'Shrubland 47%', color: '#b8a07e', shape: 'area' }, { label: 'Forest (riverine) 3%', color: '#1b7837', shape: 'area' }, { label: 'Grassland 2%', color: '#c2e699', shape: 'area' }, { label: 'Bare land 0.8%', color: '#e6c07b', shape: 'area' }, { label: 'Agriculture 0.1%', color: '#f781bf', shape: 'area' }],
  },
  {
    id: 'worldcover', label: 'ESA WorldCover 2021 (10 m, live)', group: 'Terrain, land & people', file: '', kind: 'wms', url: 'https://services.terrascope.be/wms/v2', wmsLayer: 'WORLDCOVER_2021_MAP', opacity: 0.75,
    color: '#ffbb22', source: 'ESA WorldCover 2021 (CC-BY 4.0)', tip: () => '',
    legend: [{ label: 'Tree cover', color: '#006400', shape: 'area' }, { label: 'Shrubland', color: '#ffbb22', shape: 'area' }, { label: 'Grassland', color: '#ffff4c', shape: 'area' }, { label: 'Cropland', color: '#f096ff', shape: 'area' }, { label: 'Built-up', color: '#fa0000', shape: 'area' }, { label: 'Bare / sparse', color: '#b4b4b4', shape: 'area' }, { label: 'Water', color: '#0064c8', shape: 'area' }, { label: 'Herbaceous wetland', color: '#0096a0', shape: 'area' }],
  },
  {
    id: 'population', label: 'Population density 2019 (WorldPop)', group: 'Terrain, land & people', file: '', kind: 'image', url: './overlays/population_2019.webp', opacity: 0.8,
    color: '#fd8d3c', source: 'WorldPop 2019 (census-adjusted)', tip: () => '',
    gradient: { title: 'People per km²', colors: ['#ffffcc', '#fd8d3c', '#e31a1c', '#800026', '#3f007d'], labels: ['1', '100', '10,000'] },
  },
  {
    id: 'hillshade', label: 'World hillshade (Esri, live tiles)', group: 'Terrain, land & people', file: '', kind: 'tile', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', opacity: 0.45,
    color: '#888888', source: 'Esri World Hillshade', tip: () => '',
  },
  {
    id: 'imerg', label: 'NASA IMERG rain rate (live, 30-min)', group: 'Terrain, land & people', file: '', kind: 'tile', url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png', opacity: 0.75,
    color: '#0288d1', source: 'NASA GPM IMERG via GIBS', tip: () => '',
    gradient: { title: 'Rain rate (mm/h)', colors: ['#b3e5fc', '#0288d1', '#7b1fa2', '#e91e63'], labels: ['0.1', '5', '>30'] },
  },
]

export const LAYER_BY_ID = Object.fromEntries(LAYERS.map((l) => [l.id, l]))

export const BASEMAPS = [
  { id: 'google_hybrid', label: 'Google Hybrid', url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', sub: ['0', '1', '2', '3'], attr: 'Imagery © Google' },
  { id: 'google_satellite', label: 'Google Satellite', url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', sub: ['0', '1', '2', '3'], attr: 'Imagery © Google' },
  { id: 'google_roads', label: 'Google Streets', url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', sub: ['0', '1', '2', '3'], attr: 'Map © Google' },
  { id: 'osm', label: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', sub: [], attr: '© OpenStreetMap contributors' },
  { id: 'esri_imagery', label: 'Esri World Imagery', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', sub: [], attr: 'Imagery © Esri, Maxar, Earthstar' },
  { id: 'topo', label: 'OpenTopoMap terrain', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', sub: ['a', 'b', 'c'], attr: '© OpenTopoMap (CC-BY-SA), SRTM' },
  { id: 'carto_dark', label: 'Carto dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', sub: ['a', 'b', 'c', 'd'], attr: '© OpenStreetMap © CARTO' },
  { id: 'carto_light', label: 'Carto light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', sub: ['a', 'b', 'c', 'd'], attr: '© OpenStreetMap © CARTO' },
]

export function colorFor(def: LayerDef, props: any) {
  if (def.styleBy) {
    const v = props?.[def.styleBy.field]
    return def.styleBy.map[String(v)] || def.styleBy.fallback || def.color
  }
  return def.color
}
