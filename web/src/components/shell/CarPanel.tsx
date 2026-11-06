import type { CarSnapshot, Scenario } from '../../types'

const SCEN: { id: Scenario; label: string }[] = [
  { id: 'misfire_before_swap', label: 'misfire' },
  { id: 'misfire_after_swap', label: 'after swap' },
  { id: 'stall', label: 'stall' },
  { id: 'crash', label: 'crash' },
  { id: 'ok', label: 'ok' },
]
const CYL = ['1', '2', '3', '4'] as const

export default function CarPanel({ snapshot, up, onScenario }: { snapshot: CarSnapshot | null; up: boolean; onScenario: (s: Scenario) => void }) {
  const st = snapshot?.status
  const counts = snapshot?.misfire_counts ?? { '1': 0, '2': 0, '3': 0, '4': 0 }
  const max = Math.max(12, ...CYL.map((c) => counts[c] ?? 0))
  const misfiring = CYL.some((c) => (counts[c] ?? 0) > 0)
  return (
    <div className="card carpanel">
      <div className="h2" style={{ marginBottom: 2 }}>Simulated car</div>
      <div className="muted small">2014 compact, inline-4, one coil per cylinder</div>
      <div className="scen">
        {SCEN.map((s) => (
          <button key={s.id} className={st?.scenario === s.id ? 'on' : ''} onClick={() => onScenario(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
        <div>
          <div className="rpm">{st ? st.rpm : '–'}</div>
          <div className="muted small">rpm{st && !st.engine_running ? ', engine off' : ''}</div>
        </div>
        <div className={`mil ${st?.mil_on ? 'on' : ''} ${st?.mil_on && misfiring ? 'flash' : ''}`} title="check-engine light">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 7h4l1-2h3l1 2h2v3h2v6h-2l-2 3h-6l-2-2H6l-2-3V9h3z" /></svg>
        </div>
      </div>
      <div className="bars">
        {CYL.map((c) => (
          <div className="bar" key={c}><b style={{ height: `${((counts[c] ?? 0) / max) * 100}%` }} /><span>{c}</span></div>
        ))}
      </div>
      <div className="muted small" style={{ marginTop: 6 }}>misfires per cylinder</div>
      <div className={`chip ${up ? '' : 'down'}`} style={{ marginTop: 16 }}><span className="dot" />{up ? 'car server: connected' : 'backend starting'}</div>
      {st && <div className="muted small" style={{ marginTop: 10 }}>coolant {st.coolant_c} °C, {st.dtc_count} stored {st.dtc_count === 1 ? 'code' : 'codes'}</div>}
    </div>
  )
}
