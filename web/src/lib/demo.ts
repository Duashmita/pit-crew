/* in-browser backend for the hosted static demo (VITE_DEMO=1): the simulated car, the rulebook's calls, alerts, shops and
   quotes all run here with the same contract as the python backend. claude's words are the recorded fixtures; chat is canned. */
import type { AckAction, AgentEvent, Alert, Call, CarEvent, CarSnapshot, CarStatus, ChatImage, ChatMessage, ChatResponse, Cite, Dtc, FairPrice, Friend, GateResult, MisfireCounts, Quote, Scenario, Settings, Shop, StepSpec, TriageResult, Trigger } from '../types'
import beforeSwap from '../demo/diagnose_before_swap.json'
import afterSwap from '../demo/diagnose_after_swap.json'
import shopsData from '../demo/shops.json'
import fairPriceData from '../demo/fair_price.json'
import templates from '../demo/quote_templates.json'
import friendsData from '../demo/friends.json'

type Sc = { running: boolean; cyl: '1' | '2' | null; rpm: number; coolant: number; events: Omit<CarEvent, 'at'>[]; mil?: boolean; dtcs?: Dtc[]; warnings?: string[]; battery_v?: number }
const SCENARIOS: Record<Scenario, Sc> = {
  misfire_before_swap: { running: true, cyl: '1', rpm: 740, coolant: 92, events: [] },
  misfire_after_swap: { running: true, cyl: '2', rpm: 740, coolant: 92, events: [] },
  stall: { running: false, cyl: '1', rpm: 740, coolant: 92, events: [{ type: 'engine_stall', speed_kph: 45 }] },
  crash: { running: false, cyl: '1', rpm: 740, coolant: 92, events: [{ type: 'airbag_deployed' }] },
  ok: { running: true, cyl: null, rpm: 800, coolant: 90, events: [] },
  overheating: { running: true, cyl: null, rpm: 800, coolant: 118, events: [], mil: true, dtcs: [{ code: 'P0217', desc: 'engine coolant over temperature' }], warnings: ['temperature'] },
  gas_cap: { running: true, cyl: null, rpm: 800, coolant: 90, events: [], mil: true, dtcs: [{ code: 'P0457', desc: 'evaporative system leak, fuel cap loose or off' }] },
  flat_tire: { running: true, cyl: null, rpm: 800, coolant: 90, events: [], warnings: ['tire_pressure'] },
  weak_battery: { running: true, cyl: null, rpm: 800, coolant: 90, events: [], battery_v: 11.6, dtcs: [{ code: 'P0562', desc: 'system voltage low' }], warnings: ['charging'] },
}
type Rec = { type: string; text?: string; tool?: string; args?: Record<string, unknown>; causes?: { cause: string; evidence: string[]; confidence: number }[]; summary?: string; spec?: StepSpec }
const RULEBOOK: Cite = { label: 'Pit Crew rulebook, triage/triage.pl', url: 'https://github.com/Duashmita/pit-crew/blob/main/triage/triage.pl', source_id: 'triage/triage.pl' }
const RAM: Cite = { label: "Ram 1500 owner's manual, malfunction indicator light (flashing)", url: 'https://www.manualslib.com/manual/826356/Ram-1500.html?page=300', source_id: 'sources/ram-1500-malfunction-indicator-lamp.md' }
const LOCATION = { lat: 37.8044, lng: -122.2712, label: 'Elm St & 3rd Ave (synthetic)' }
const now = () => new Date().toISOString().slice(0, 19)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const wait = async (ms: number) => { if (ms > 0) await sleep(ms) }

// state
const car = { scenario: 'misfire_before_swap' as Scenario, running: true, events: [] as CarEvent[] }
let friends: Friend[] = friendsData as Friend[]
let settings: Settings = { share_location: true }
const alerts: Alert[] = []
let quotes: Quote[] = []
let lastTriage: TriageResult | null = null
let lastWords = ''
let pending: ReturnType<typeof setTimeout> | null = null
const subs = new Set<(e: AgentEvent) => void>()
const publish = (e: AgentEvent) => subs.forEach((f) => f(e))

// the car
const sc = () => SCENARIOS[car.scenario]
const dtcs = (): Dtc[] => sc().dtcs ?? (sc().cyl ? [{ code: `P030${sc().cyl}`, desc: `cylinder ${sc().cyl} misfire detected` }] : [])
const counts = (): MisfireCounts => ({ '1': sc().cyl === '1' ? 12 : 0, '2': sc().cyl === '2' ? 11 : 0, '3': 0, '4': 0 })
const status = (): CarStatus => ({
  mil_on: sc().mil ?? sc().cyl !== null, dtc_count: dtcs().length, rpm: car.running ? sc().rpm + (sc().cyl ? Math.round(Math.random() * 60 - 30) : 0) : 0,
  speed_kph: 0, coolant_c: sc().coolant, engine_running: car.running, scenario: car.scenario, warnings: sc().warnings ?? [], battery_v: sc().battery_v ?? 12.6,
})
const snapshot = (): CarSnapshot => ({ status: status(), dtcs: dtcs(), misfire_counts: counts(), events: car.events })
const toolResult = (tool: string): unknown => (({ get_status: status, read_dtcs: dtcs, misfire_counts: counts, events: () => car.events, freeze_frame: () => ({ code: dtcs()[0]?.code ?? null, rpm: sc().rpm, speed_kph: 0, coolant_c: sc().coolant, load_pct: 22 }) } as Record<string, () => unknown>)[tool]?.() ?? {})

// the rulebook (the prolog rules, ported): strictest call wins, unknown counts as unsafe
const result = (call: Call, rule: string, why: string, cite: Cite, unknowns: string[] = []): TriageResult => ({ call, rule, why, cite, unknowns })
function triage(words: string): TriageResult {
  const st = status(), ev = car.events.map((e) => e.type), misfire = dtcs().some((d) => /^P030[1-4]$/.test(d.code))
  const flashing = /blink|flash/i.test(words) ? 'yes' : /steady|solid/i.test(words) ? 'no' : 'unknown'
  if (ev.includes('airbag_deployed')) return result('stop_now', 'airbag_deployed', 'The airbag deployed. Stop, check yourself and anyone with you, and call for help before anything else.', RULEBOOK)
  if (ev.includes('engine_stall')) return result('stop_now', 'engine_stall', 'The engine stalled while driving. Pull over where it is safe and do not try to drive on.', RULEBOOK)
  if (st.coolant_c >= 110) return result('stop_now', 'overheating', 'The engine is overheating. Stop as soon as it is safe, switch off and let it cool before opening anything.', RULEBOOK)
  if (st.mil_on && misfire && flashing !== 'no') return result('stop_now', 'mil_flashing_misfire', 'The check-engine light is flashing and the car reports a misfire. A flashing light means unburned fuel is reaching the catalytic converter, which can be damaged quickly, and power loss can follow. Stop as soon as it is safe and do not keep driving.', RAM, flashing === 'unknown' ? ['is the light flashing or steady?'] : [])
  if (st.warnings?.includes('tire_pressure')) return result('short_trip_only', 'tire_pressure', 'A tire is low. Drive slowly to the nearest safe place to check it; do not take the freeway.', RULEBOOK)
  if (st.mil_on) return result('ok_to_drive', 'mil_steady', 'The check-engine light is on but steady and nothing else is wrong. The car can be driven; have the code read soon.', RULEBOOK)
  if (st.warnings?.length) return result('short_trip_only', st.warnings[0], 'A warning is on. Short trips only until it is checked.', RULEBOOK)
  return result('ok_to_drive', 'no_warnings', 'No warning lights and no stored codes.', RULEBOOK)
}
const gate = (spec: StepSpec): GateResult => {
  const required = spec.parts.some((p) => /coil|plug|connector/i.test(p)) ? ['engine_off', 'engine_cool'] : spec.parts.some((p) => /injector|fuel/i.test(p)) ? ['engine_off', 'no_flame'] : spec.parts.some((p) => /battery/i.test(p)) ? ['key_out', 'negative_first'] : []
  const missing = required.filter((r) => !spec.precautions.includes(r))
  return { approved: missing.length === 0, missing, required }
}

// claude's recorded words, replayed against the live car model
function script(): Rec[] {
  if (car.scenario === 'misfire_before_swap') return beforeSwap as Rec[]
  if (car.scenario === 'misfire_after_swap') return afterSwap as Rec[]
  const d = dtcs()[0]
  const what = d ? `${d.code} (${d.desc})` : sc().warnings?.length ? `a ${sc().warnings![0].replace('_', ' ')} warning` : 'nothing stored'
  return [
    { type: 'text', text: 'Let me ask the car what it knows.' }, { type: 'tool_call', tool: 'get_status', args: {} }, { type: 'tool_call', tool: 'read_dtcs', args: {} }, { type: 'tool_call', tool: 'events', args: {} }, { type: 'triage' },
    { type: 'diagnosis', causes: [{ cause: d ? d.desc : sc().warnings?.[0]?.replace('_', ' ') ?? 'nothing wrong', evidence: [what], confidence: d ? 0.7 : 0.9 }], summary: `The car reports ${what}. The rulebook made the safety call above; a shop can confirm the cause.` }, { type: 'done' },
  ]
}
async function run(words: string, delay: number): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  for (const r of script()) {
    let e: AgentEvent
    if (r.type === 'tool_call') e = { type: 'tool_call', tool: r.tool!, args: r.args ?? {}, result: toolResult(r.tool!) }
    else if (r.type === 'triage') { lastTriage = triage(words); e = { type: 'triage', ...lastTriage } }
    else if (r.type === 'step') { const spec = { ...r.spec!, cost_usd: r.spec!.cost_usd ?? undefined }; const g = gate(spec); e = g.approved ? { type: 'step', spec, gate: g } : { type: 'step_blocked', spec, missing: g.missing } }
    else if (r.type === 'diagnosis') e = { type: 'diagnosis', causes: r.causes!, summary: r.summary! }
    else if (r.type === 'text') e = { type: 'text', text: r.text! }
    else e = { type: 'done' }
    out.push(e); publish(e); await wait(delay)
  }
  return out
}
const fault = (): string => {
  const ev = car.events.map((e) => e.type)
  if (ev.includes('airbag_deployed')) return 'possible crash, airbag deployed'
  if (ev.includes('engine_stall')) return 'engine stalled while driving'
  const d = dtcs()[0]
  return d ? `${d.code} ${d.desc}` : 'unknown'
}
function makeAlert(trigger: Trigger, include: boolean, auto: boolean): Alert {
  const a: Alert = { id: `a_${Math.random().toString(16).slice(2, 10)}`, trigger, auto, fault: fault(), call: lastTriage?.call ?? (trigger === 'crash' || trigger === 'stall' ? 'stop_now' : 'unknown'), rule: lastTriage?.rule ?? trigger, location: include && settings.share_location ? LOCATION : null, to: friends.map((f) => f.name), sent_at: now(), status: 'delivered', acks: [] }
  alerts.push(a); publish({ type: 'alert', alert: a })
  return a
}
const fairPrice = fairPriceData as unknown as FairPrice

export const demoApi = {
  health: async () => ({ ok: true, mode: 'fixture', chat: 'fixture' }),
  car: async () => snapshot(),
  setScenario: async (name: Scenario) => {
    if (pending) { clearTimeout(pending); pending = null }
    car.scenario = name; car.running = SCENARIOS[name].running; car.events = SCENARIOS[name].events.map((e) => ({ ...e, at: now() }))
    publish({ type: 'car', status: status(), misfire_counts: counts() })
    const ev = car.events[0]
    if (ev) { // the watcher: countdown, then the alert goes out by itself unless she cancels
      setTimeout(() => publish({ type: 'car_event', event: ev, countdown_s: 10 }), 300)
      pending = setTimeout(() => { pending = null; makeAlert(ev.type === 'airbag_deployed' ? 'crash' : 'stall', settings.share_location, true) }, 10300)
    }
    return snapshot()
  },
  diagnose: async (words: string, delay_ms = 600) => { lastWords = words; return { events: await run(words, delay_ms) } },
  didIt: async (step: string, delay_ms = 600) => {
    if (step === 'swap-coils-1-2' && car.scenario === 'misfire_before_swap') car.scenario = 'misfire_after_swap'
    publish({ type: 'car', status: status(), misfire_counts: counts() })
    return { events: await run(lastWords, delay_ms) }
  },
  gate: async (spec: StepSpec) => gate(spec),
  render: async (spec: StepSpec) => ({ svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120"><rect width="320" height="120" rx="12" fill="#161B22"/><text x="160" y="56" fill="#F2F4F7" font-size="14" text-anchor="middle">${spec.title}</text><text x="160" y="90" fill="#9AA4B2" font-size="11" text-anchor="middle">diagram, not to scale</text></svg>` }),
  friends: async () => friends,
  addFriend: async (f: { name: string; relation: string; phone: string }) => { const x: Friend = { id: `f_${Date.now()}`, ...f, synthetic: true }; friends = [...friends, x]; return x },
  removeFriend: async (id: string) => { friends = friends.filter((f) => f.id !== id); return new Response(null, { status: 204 }) },
  settings: async () => settings,
  setSettings: async (s: Settings) => { settings = s; return s },
  alert: async (trigger: Trigger, include_location = true, auto = false) => makeAlert(trigger, include_location, auto),
  cancelAlert: async () => { const was = !!pending; if (pending) clearTimeout(pending); pending = null; publish({ type: 'alert_cancelled' }); return { cancelled: true, was_pending: was } },
  alerts: async () => alerts,
  ack: async (id: string, by: string, action: AckAction) => { const a = alerts.find((x) => x.id === id)!; a.acks.push({ by, action, at: now() }); publish({ type: 'ack', alert_id: id, by, action }); return a },
  shops: async () => shopsData as Shop[],
  fairPrice: async () => fairPrice,
  draft: async (shop_ids: string[]) => {
    const after = car.scenario === 'misfire_after_swap'
    const test = after ? 'After I swapped the ignition coils on cylinders 1 and 2, the misfire moved to cylinder 2 (P0302), so it is the coil.' : 'I am about to swap the ignition coils on cylinders 1 and 2 to see if the misfire moves.'
    return { draft: `Hi, I'd like a quote for a 2014 compact, 1.8 L inline-4. The car reports ${fault()}. ${test} Please quote the repair with parts and labor separately. The fair range for an ignition coil is $${fairPrice.fair_range_usd[0]} to $${fairPrice.fair_range_usd[1]} all in (${fairPrice.sources[0]}). Thanks, Maya. (${shop_ids.length} shop${shop_ids.length === 1 ? '' : 's'})` }
  },
  send: async (shop_ids: string[]) => {
    const shops = shopsData as Shop[]
    const high = fairPrice.fair_range_usd[1]
    const made = shop_ids.map((id) => { const i = shops.findIndex((s) => s.id === id); const t = (templates as { total_factor: number; parts_share: number; note: string }[])[Math.max(0, i) % templates.length]; const total = Math.round(high * t.total_factor); const parts = Math.round(total * t.parts_share); return { id: `q_${id}_${Date.now()}`, shop: shops[i]?.name ?? id, total_usd: total, parts_usd: parts, labor_usd: total - parts, fair_range_usd: fairPrice.fair_range_usd, flag: total > high ? 'above_range' : 'in_range', note: t.note, sources: fairPrice.sources } as Quote })
    quotes = [...quotes, ...made]
    made.forEach((q, i) => setTimeout(() => publish({ type: 'quote', quote: q }), 700 * (i + 1)))
    return { sent: made.length }
  },
  inbox: async () => quotes,
  chat: async (messages: ChatMessage[], image: ChatImage | null): Promise<ChatResponse> => {
    await sleep(900)
    const codes = dtcs().map((d) => `${d.code} (${d.desc})`).join(', ') || 'no stored codes'
    const reply = `This hosted demo runs without an API key, so I can't read your words or your photo for real. Clone the repo and run it with a key for the live conversation. Right now the car reports ${codes}.${image ? ' On the photo: 1: the ignition coils, 2: the dipstick, 3: the battery. The cheapest test is to swap two coils, engine off and cool.' : ''}`
    const annotations = image ? [{ label: 'Ignition coils', x: 0.3, y: 0.18, w: 0.4, h: 0.16, note: 'one per cylinder, on top of the engine' }, { label: 'Dipstick', x: 0.12, y: 0.42, w: 0.1, h: 0.22, note: 'pull to check the oil level, engine off' }, { label: 'Battery', x: 0.72, y: 0.55, w: 0.22, h: 0.25, note: 'disconnect the negative terminal first' }] : []
    const out: ChatResponse = { reply, annotations, mode: 'fixture', tool_calls: [], triage: null }
    publish({ type: 'chat_reply', reply, annotations, mode: 'fixture' }); void messages
    return out
  },
  events: (onEvent: (e: AgentEvent) => void) => { subs.add(onEvent); return () => { subs.delete(onEvent) } },
}
