import type { AckAction, AgentEvent, Alert, AskSeed, CarEvent, CarSnapshot, Diagnosis, FairPrice, Friend, GateResult, Quote, Settings, Shop, StepSpec, TriageResult } from '../types'

export type Screen = 'home' | 'ask' | 'checking' | 'banner' | 'diagnosis' | 'step' | 'result' | 'diy' | 'shops' | 'inbox'
export type OfferStatus = 'hidden' | 'shown' | 'sent' | 'declined'
export interface CountdownState { kind: 'sos' | 'car_event'; seconds: number; event?: CarEvent }

export interface AppState {
  screen: Screen
  backendUp: boolean
  mode: string
  snapshot: CarSnapshot | null
  log: AgentEvent[]
  busy: boolean
  triage: TriageResult | null
  diagnosis: Diagnosis | null
  step: { spec: StepSpec; gate: GateResult } | null
  stepBlocked: { spec: StepSpec; missing: string[] } | null
  friends: Friend[]
  settings: Settings
  alerts: Alert[]
  offer: OfferStatus
  lastAck: { by: string; action: AckAction } | null
  countdown: CountdownState | null
  fairPrice: FairPrice | null
  shops: Shop[]
  quotes: Quote[]
  settingsOpen: boolean
  chatTools: { tool: string; result: unknown }[]
  words: string
  askSeed: AskSeed | null
  sentShop: string | null
}

export const initial: AppState = {
  screen: 'home', backendUp: false, mode: 'fixture', snapshot: null, log: [], busy: false,
  triage: null, diagnosis: null, step: null, stepBlocked: null,
  friends: [], settings: { share_location: true }, alerts: [], offer: 'hidden', lastAck: null, countdown: null,
  fairPrice: null, shops: [], quotes: [], settingsOpen: false, chatTools: [], words: '', askSeed: null, sentShop: null,
}

export type Action =
  | { type: 'event'; event: AgentEvent }
  | { type: 'go'; screen: Screen }
  | { type: 'snapshot'; snapshot: CarSnapshot }
  | { type: 'backend'; up: boolean; mode?: string }
  | { type: 'friends'; friends: Friend[] }
  | { type: 'settings'; settings: Settings }
  | { type: 'alert'; alert: Alert }
  | { type: 'offer'; status: OfferStatus }
  | { type: 'countdown'; countdown: CountdownState | null }
  | { type: 'busy'; busy: boolean }
  | { type: 'fairPrice'; fairPrice: FairPrice }
  | { type: 'shops'; shops: Shop[] }
  | { type: 'quotes'; quotes: Quote[] }
  | { type: 'settingsOpen'; open: boolean }
  | { type: 'ask'; words: string }
  | { type: 'openAsk'; seed: AskSeed | null }
  | { type: 'sentShop'; name: string }
  | { type: 'chatClear' }
  | { type: 'reset' }

function addAlert(s: AppState, alert: Alert): AppState {
  const known = s.alerts.some((x) => x.id === alert.id)
  const alerts = known ? s.alerts.map((x) => (x.id === alert.id ? { ...x, ...alert, acks: alert.acks?.length ? alert.acks : x.acks } : x)) : [...s.alerts, alert]
  const offer: OfferStatus = alert.trigger === 'verdict' && s.offer !== 'declined' ? 'sent' : s.offer
  const countdown = s.countdown && (alert.auto || s.countdown.kind === 'sos') ? null : s.countdown
  return { ...s, alerts, offer, countdown }
}

function onEvent(s: AppState, e: AgentEvent): AppState {
  switch (e.type) {
    case 'text':
    case 'tool_call':
      return { ...s, log: [...s.log, e] }
    case 'triage': {
      const triage: TriageResult = { call: e.call, rule: e.rule, why: e.why, cite: e.cite, unknowns: e.unknowns ?? [] }
      const screen: Screen = s.screen === 'checking' ? 'banner' : s.screen
      const offer: OfferStatus = s.offer === 'hidden' && triage.call !== 'ok_to_drive' ? 'shown' : s.offer
      return { ...s, triage, screen, offer }
    }
    case 'diagnosis': {
      const diagnosis: Diagnosis = { causes: e.causes, summary: e.summary }
      const screen: Screen = s.screen === 'step' ? 'result' : s.screen
      return { ...s, diagnosis, screen }
    }
    case 'step':
      return { ...s, step: { spec: e.spec, gate: e.gate }, stepBlocked: null }
    case 'step_blocked':
      return { ...s, stepBlocked: { spec: e.spec, missing: e.missing }, step: null }
    case 'done':
      return { ...s, busy: false }
    case 'car':
      return { ...s, snapshot: s.snapshot ? { ...s.snapshot, status: e.status, misfire_counts: e.misfire_counts } : s.snapshot }
    case 'car_event':
      return { ...s, countdown: { kind: 'car_event', seconds: e.countdown_s, event: e.event } }
    case 'alert':
      return addAlert(s, e.alert)
    case 'alert_cancelled':
      return { ...s, countdown: s.countdown?.kind === 'car_event' ? null : s.countdown }
    case 'ack': {
      const alerts = s.alerts.map((a) =>
        a.id === e.alert_id && !a.acks.some((x) => x.by === e.by && x.action === e.action)
          ? { ...a, acks: [...a.acks, { by: e.by, action: e.action, at: new Date().toISOString() }] }
          : a,
      )
      return { ...s, alerts, lastAck: { by: e.by, action: e.action } }
    }
    case 'quote':
      return s.quotes.some((q) => q.id === e.quote.id) ? s : { ...s, quotes: [...s.quotes, e.quote] }
    case 'chat_tool':
      return { ...s, chatTools: [...s.chatTools, { tool: e.tool, result: e.result }] }
    case 'chat_reply':
      return { ...s, chatTools: [] }
  }
  return s
}

export function reduce(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'event': return onEvent(s, a.event)
    case 'go': return { ...s, screen: a.screen }
    case 'snapshot': return { ...s, snapshot: a.snapshot, backendUp: true }
    case 'backend': return { ...s, backendUp: a.up, mode: a.mode ?? s.mode }
    case 'friends': return { ...s, friends: a.friends }
    case 'settings': return { ...s, settings: a.settings }
    case 'alert': return addAlert(s, a.alert)
    case 'offer': return { ...s, offer: a.status }
    case 'countdown': return { ...s, countdown: a.countdown }
    case 'busy': return { ...s, busy: a.busy }
    case 'fairPrice': return { ...s, fairPrice: a.fairPrice }
    case 'shops': return { ...s, shops: a.shops }
    case 'quotes': return { ...s, quotes: a.quotes }
    case 'settingsOpen': return { ...s, settingsOpen: a.open }
    case 'chatClear': return { ...s, chatTools: [] }
    case 'openAsk': return { ...s, screen: 'ask', askSeed: a.seed }
    case 'sentShop': return { ...s, sentShop: a.name }
    case 'ask': return { ...s, words: a.words, sentShop: null, screen: 'checking', busy: true, log: [], triage: null, diagnosis: null, step: null, stepBlocked: null, offer: 'hidden', lastAck: null, quotes: [] }
    case 'reset': return { ...initial, snapshot: s.snapshot, backendUp: s.backendUp, mode: s.mode, friends: s.friends, settings: s.settings }
  }
}
