// Gemini straight from the browser, for when the portal runs as a static site (GitHub Pages)
// without the Python server. The key is pasted by the user in the assistant's settings and kept
// only in that browser's localStorage - it is never written into the website files or the repo.
import type { MapAction } from './store'
import { LAYERS, BASEMAPS } from './layers'

const KEY = 'csg_gemini_key'
const MODEL = 'csg_gemini_model'

// Optional site-wide key from public/portal-config.json (placeholder: empty until the county adds one).
let site = { key: '', model: '' }
export const siteConfigReady: Promise<void> = fetch('./portal-config.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : {}))
  .then((c: any) => { site = { key: String(c?.geminiApiKey || '').trim(), model: String(c?.geminiModel || '') } })
  .catch(() => { /* no config file: AI stays off until a key is pasted */ })

/** Key pasted on this device wins; otherwise the site-wide key (if the county has added one). */
export function getGeminiKey(): string {
  let local = ''
  try { local = localStorage.getItem(KEY) || '' } catch { /* storage blocked */ }
  return local || site.key
}
export function hasDeviceKey(): boolean {
  try { return !!localStorage.getItem(KEY) } catch { return false }
}
export function hasSiteKey(): boolean { return !!site.key }
export function setGeminiKey(k: string) {
  try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY) } catch { /* storage blocked */ }
}
export function getGeminiModel(): string {
  try { return localStorage.getItem(MODEL) || site.model || 'gemini-2.5-flash' } catch { return site.model || 'gemini-2.5-flash' }
}
export function setGeminiModel(m: string) {
  try { localStorage.setItem(MODEL, m) } catch { /* storage blocked */ }
}

async function call(prompt: string, system: string, json = true, model = getGeminiModel()): Promise<string> {
  const key = getGeminiKey()
  if (!key) throw new Error('no-key')
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, ...(json ? { responseMimeType: 'application/json' } : {}) },
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error?.message || `Gemini error ${r.status}`)
  return j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''
}

export async function testGemini(): Promise<string> {
  const t = await call('Reply with the single word: ready', 'You are a test.', false)
  return t.trim()
}

const LANG = { en: 'English', sw: 'Kiswahili', so: 'Somali (Af-Soomaali)' } as const

export async function geminiChat(history: { role: string; content: string }[], lang: 'en' | 'sw' | 'so', context: string): Promise<{ reply: string; map_actions: MapAction[] }> {
  const system = `You are the CSG GeoAI assistant of the Garissa County Steering Group portal (Kenya).
Answer in ${LANG[lang]}; be brief, concrete and kind. Never invent numbers: use the CONTEXT below or say you don't know.
River Tana gauge at Garissa (RGS 4G01) thresholds: ALERT 4.0 m, ALARM 5.0 m, EMERGENCY 6.2 m. Emergencies: Kenya Red Cross 1199, 999/112, emergency@garissa.go.ke.
Forecasts are scenarios; point people to official KMD/NDMA advisories.
You can drive the map. Return JSON: {"reply": string, "map_actions": [ ... ]} where each action is one of:
{"type":"layers","show":[ids],"hide":[ids]} | {"type":"basemap","id":id} | {"type":"zoom","lat":n,"lon":n,"zoom":n} |
{"type":"flood_stage","stage":3.0-7.5} | {"type":"circle","lat":n,"lon":n,"radius_km":n} | {"type":"navigate","page":"home|about|policy|elnino|tana|health|nbs|community|gallery|report"}
Layer ids: ${LAYERS.map((l) => `${l.id} (${l.label})`).join('; ')}.
Basemap ids: ${BASEMAPS.map((b) => `${b.id} (${b.label})`).join('; ')}.
Use an empty list when no map change is needed.
CONTEXT:
${context}`
  const convo = history.slice(-8).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
  const raw = await call(convo, system)
  try {
    const j = JSON.parse(raw)
    return { reply: String(j.reply || ''), map_actions: Array.isArray(j.map_actions) ? j.map_actions : [] }
  } catch {
    return { reply: raw, map_actions: [] }
  }
}

export async function geminiTranslate(text: string, target: 'sw' | 'so' | 'en'): Promise<string> {
  return (await call(text, `Translate the user's text into ${LANG[target]} for residents of Garissa County, Kenya. Keep numbers, names and units unchanged. Return only the translation.`, false)).trim()
}
