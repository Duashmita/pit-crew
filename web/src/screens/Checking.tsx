import type { ReactNode } from 'react'
import type { AgentEvent } from '../types'

const WORDS: Record<string, string> = {
  get_status: 'Reading the warning lights', read_dtcs: 'Reading the fault codes', misfire_counts: 'Counting misfires per cylinder',
  freeze_frame: 'Reading the freeze frame', read_pid: 'Reading a sensor', events: 'Checking for crash or stall events',
  triage: 'Asking the rulebook', check_spec: 'Checking the precautions', propose_step: 'Proposing the cheapest test',
}

function summarize(tool: string, result: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  try {
    switch (tool) {
      case 'get_status': return `${r.mil_on ? 'check-engine light on' : 'no warning light'}, ${r.dtc_count} ${r.dtc_count === 1 ? 'code' : 'codes'}, ${r.rpm} rpm, ${r.coolant_c} °C`
      case 'read_dtcs': return Array.isArray(r) && r.length ? r.map((d) => `${d.code} (${d.desc})`).join('; ') : 'no stored codes'
      case 'misfire_counts': return Object.entries(r).map(([k, v]) => `cyl ${k}: ${v}`).join(', ')
      case 'freeze_frame': return `${r.code} at ${r.rpm} rpm, ${r.coolant_c} °C, load ${r.load_pct}%`
      case 'read_pid': return `${r.name} ${r.value} ${r.unit}`
      case 'events': return Array.isArray(r) && r.length ? r.map((e) => e.type).join(', ') : 'no events'
      case 'triage': return `${r.call}, rule ${r.rule}`
      case 'check_spec': return r.approved ? 'approved' : `missing ${(r.missing || []).join(', ')}`
    }
  } catch { /* fall through */ }
  const s = typeof result === 'string' ? result : JSON.stringify(result)
  return s.length > 90 ? `${s.slice(0, 88)}…` : s
}

const svg = (d: ReactNode) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
const ICON: Record<string, ReactNode> = {
  get_status: svg(<><path d="M4 15a8 8 0 0 1 16 0" /><path d="M12 15l4-5" /></>),
  read_dtcs: svg(<><path d="M20 12l-8 8-9-9V3h8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>),
  misfire_counts: svg(<><path d="M5 20V9" /><path d="M12 20V4" /><path d="M19 20v-7" /></>),
  freeze_frame: svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" /></>),
  read_pid: svg(<path d="M3 12h4l3-8 4 16 3-8h4" />),
  events: svg(<><path d="M12 3l9 16H3z" /><path d="M12 10v4" /></>),
  triage: svg(<><path d="M4 4h16v16H4z" /><path d="M8 12h8M12 8v8" /></>),
}
const fallbackIcon = svg(<circle cx="12" cy="12" r="4" />)

export function Log({ log }: { log: AgentEvent[] }) {
  return (
    <div className="log">
      {log.map((e, i) => {
        if (e.type === 'text') return <div className="narr" key={i}>{e.text}</div>
        if (e.type !== 'tool_call') return null
        const args = Object.values(e.args ?? {}).join(', ')
        return (
          <div className="call" key={i}>
            <span className="ico">{ICON[e.tool] ?? fallbackIcon}</span>
            <div>
              <div className="tool">{WORDS[e.tool] ?? e.tool}{args && <span className="args"> {args}</span>}</div>
              <div className="res" title={JSON.stringify(e.result)}>{summarize(e.tool, e.result)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Checking({ log, busy, up }: { log: AgentEvent[]; busy: boolean; up: boolean }) {
  return (
    <div className="phone-body">
      <span className={`chip ${busy ? 'pulse' : ''} ${up ? '' : 'down'}`}><span className="dot" />{busy ? 'Asking the car' : "Maya's car, connected"}</span>
      <h1 className="h1" style={{ fontSize: 22, marginTop: 22 }}>Listening to the car's computer</h1>
      <p className="muted small" style={{ marginTop: 0 }}>Each line is one question Claude asked the car.</p>
      <Log log={log} />
      {busy && !log.length && <div className="muted" style={{ marginTop: 12 }}>Connecting…</div>}
      <div className="ai-notice">AI was used.</div>
    </div>
  )
}
