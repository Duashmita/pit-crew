// contracts: mirrors CLAUDE.md. change only there.
export type Scenario = 'misfire_before_swap' | 'misfire_after_swap' | 'stall' | 'crash' | 'ok'
export interface CarStatus { mil_on: boolean; dtc_count: number; rpm: number; speed_kph: number; coolant_c: number; engine_running: boolean; scenario: Scenario }
export interface Dtc { code: string; desc: string }
export type MisfireCounts = Record<'1' | '2' | '3' | '4', number>
export interface CarEvent { type: 'engine_stall' | 'airbag_deployed'; speed_kph?: number; at: string }
export interface CarSnapshot { status: CarStatus; dtcs: Dtc[]; misfire_counts: MisfireCounts; events: CarEvent[] }
export type Call = 'stop_now' | 'short_trip_only' | 'ok_to_drive'
export interface Cite { label: string; url: string; source_id: string }
export interface TriageResult { call: Call; rule: string; why: string; cite: Cite; unknowns: string[] }
export interface StepAction { verb: string; target: string }
export interface StepSpec { id: string; title: string; parts: string[]; actions: StepAction[]; tools: string[]; precautions: string[]; expect: string; est_minutes?: number; cost_usd?: number }
export interface GateResult { approved: boolean; missing: string[]; required: string[] }
export interface Cause { cause: string; evidence: string[]; confidence: number }
export interface Diagnosis { causes: Cause[]; summary: string }
export type Trigger = 'verdict' | 'sos' | 'crash' | 'stall'
export type AckAction = 'on_my_way' | 'called'
export interface Location { lat: number; lng: number; label: string }
export interface Alert { id: string; trigger: Trigger; auto: boolean; fault: string; call: Call | 'unknown'; rule: string; location: Location | null; to: string[]; sent_at: string; status: 'delivered'; acks: { by: string; action: AckAction; at: string }[] }
export interface Friend { id: string; name: string; relation: string; phone: string; synthetic: true }
export interface Settings { share_location: boolean }
export interface Shop { id: string; name: string; distance_km: number; open_until: string; phone: string; rating: number; synthetic: true }
export interface FairPrice { part: string; parts_usd: [number, number]; labor_usd: [number, number]; fair_range_usd: [number, number]; sources: string[]; as_of: string }
export interface Quote { id: string; shop: string; total_usd: number; parts_usd: number; labor_usd: number; fair_range_usd: [number, number]; flag: 'in_range' | 'above_range'; note: string; sources: string[] }
export interface Annotation { label: string; x: number; y: number; w: number; h: number; note: string }
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatImage { media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }
export interface ChatResponse { reply: string; annotations: Annotation[]; mode: 'live' | 'fixture'; tool_calls: { tool: string; result: unknown }[]; triage: TriageResult | null }
export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; tool: string; args: Record<string, unknown>; result: unknown }
  | ({ type: 'triage' } & TriageResult)
  | ({ type: 'diagnosis' } & Diagnosis)
  | { type: 'step'; spec: StepSpec; gate: GateResult }
  | { type: 'step_blocked'; spec: StepSpec; missing: string[] }
  | { type: 'done' }
  | { type: 'car'; status: CarStatus; misfire_counts: MisfireCounts }
  | { type: 'car_event'; event: CarEvent; countdown_s: number }
  | { type: 'alert'; alert: Alert }
  | { type: 'alert_cancelled' }
  | { type: 'ack'; alert_id: string; by: string; action: AckAction }
  | { type: 'quote'; quote: Quote }
  | { type: 'chat_tool'; tool: string; result: unknown }
  | { type: 'chat_reply'; reply: string; annotations: Annotation[]; mode: 'live' | 'fixture' }
