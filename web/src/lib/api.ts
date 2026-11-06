import type { AckAction, AgentEvent, Alert, CarSnapshot, FairPrice, Friend, GateResult, Quote, Scenario, Settings, Shop, StepSpec, Trigger } from '../types'

async function j<T>(r: Promise<Response>): Promise<T> {
  const res = await r
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}
const post = (url: string, body: unknown, method = 'POST') =>
  fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  health: () => j<{ ok: boolean; mode: string }>(fetch('/api/health')),
  car: () => j<CarSnapshot>(fetch('/api/car')),
  setScenario: (name: Scenario) => j<CarSnapshot>(post('/api/car/scenario', { name })),
  diagnose: (words: string, delay_ms = 600) => j<{ events: AgentEvent[] }>(post('/api/diagnose', { words, delay_ms })),
  didIt: (step: string, delay_ms = 600) => j<{ events: AgentEvent[] }>(post('/api/did-it', { step, delay_ms })),
  gate: (spec: StepSpec) => j<GateResult>(post('/api/gate', spec)),
  render: (spec: StepSpec) => j<{ svg: string }>(post('/api/render', spec)),
  friends: () => j<Friend[]>(fetch('/api/friends')),
  addFriend: (f: { name: string; relation: string; phone: string }) => j<Friend>(post('/api/friends', f)),
  removeFriend: (id: string) => fetch(`/api/friends/${id}`, { method: 'DELETE' }),
  settings: () => j<Settings>(fetch('/api/settings')),
  setSettings: (s: Settings) => j<Settings>(post('/api/settings', s, 'PUT')),
  alert: (trigger: Trigger, include_location = true, auto = false) => j<Alert>(post('/api/alerts', { trigger, include_location, auto })),
  cancelAlert: () => j<{ cancelled: boolean }>(post('/api/alerts/cancel', {})),
  alerts: () => j<Alert[]>(fetch('/api/alerts')),
  ack: (id: string, by: string, action: AckAction) => j<Alert>(post(`/api/alerts/${id}/ack`, { by, action })),
  shops: () => j<Shop[]>(fetch('/api/shops')),
  fairPrice: (dtc = 'P0301') => j<FairPrice>(fetch(`/api/fair-price?dtc=${dtc}`)),
  draft: (shop_ids: string[]) => j<{ draft: string }>(post('/api/quotes/draft', { shop_ids })),
  send: (shop_ids: string[]) => j<{ sent: number }>(post('/api/quotes/send', { shop_ids, approved: true })),
  inbox: () => j<Quote[]>(fetch('/api/inbox')),
  /** subscribe to every backend event; returns an unsubscribe function */
  events: (onEvent: (e: AgentEvent) => void) => {
    const es = new EventSource('/api/events')
    es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)) } catch { /* ignore */ } }
    return () => es.close()
  },
}
