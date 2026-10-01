import { createContext, useContext } from 'react'
import type { Lang } from './i18n'

export type MapAction =
  | { type: 'layers'; show?: string[]; hide?: string[] }
  | { type: 'basemap'; id: string }
  | { type: 'zoom'; lat?: number; lon?: number; zoom?: number; bbox?: number[]; name?: string }
  | { type: 'highlight'; title: string; features: { name: string; lat: number; lon: number; [k: string]: any }[] }
  | { type: 'circle'; lat: number; lon: number; radius_km: number; label?: string }
  | { type: 'flood_stage'; stage: number }
  | { type: 'navigate'; page: string }
  | { type: 'assess'; lat: number; lon: number }

// tiny event bus so the chatbot (anywhere) can drive the map (home page)
type Listener = (a: MapAction) => void
const listeners = new Set<Listener>()
let queue: MapAction[] = []
export const mapBus = {
  emit(a: MapAction) {
    if (listeners.size) listeners.forEach((l) => l(a))
    else queue.push(a)
  },
  on(l: Listener) {
    listeners.add(l)
    const q = queue
    queue = []
    q.forEach((a) => l(a))
    return () => { listeners.delete(l) }
  },
}

export type AppCtx = { lang: Lang; setLang: (l: Lang) => void }
export const AppContext = createContext<AppCtx>({ lang: 'en', setLang: () => {} })
export const useApp = () => useContext(AppContext)

export const LEVEL_COLORS: Record<string, string> = {
  NORMAL: '#2e9e4f', WATCH: '#f2c230', ALERT: '#f28c28', ALARM: '#e4572e', EMERGENCY: '#c81d25',
  Normal: '#2e9e4f', Alert: '#f28c28', Alarm: '#e4572e', Emergency: '#c81d25',
}

export function levelFor(stage: number) {
  if (stage >= 6.2) return 'EMERGENCY'
  if (stage >= 5) return 'ALARM'
  if (stage >= 4) return 'ALERT'
  if (stage >= 3) return 'WATCH'
  return 'NORMAL'
}
