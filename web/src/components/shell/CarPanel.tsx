import type { CarSnapshot, Scenario } from '../../types'

/** realistic situations she could be in; each maps to one mock-car scenario, tap again to switch it off */
const SCEN: { id: Scenario; label: string }[] = [
  { id: 'misfire_before_swap', label: 'Shaking at a red light, light flashing' },
  { id: 'misfire_after_swap', label: 'After swapping the coils' },
  { id: 'overheating', label: 'Temperature gauge in the red' },
  { id: 'gas_cap', label: 'Light came on after filling up' },
  { id: 'flat_tire', label: 'Thumping, pulling to one side' },
  { id: 'weak_battery', label: 'Slow to start, dim lights' },
  { id: 'stall', label: 'Engine died on the freeway' },
  { id: 'crash', label: 'Hit something, airbag went off' },
]
const CYL = ['1', '2', '3', '4'] as const

export default function CarPanel({ snapshot, up, onScenario }: { snapshot: CarSnapshot | null; up: boolean; onScenario: (s: Scenario) => void }) {
  const st = snapshot?.status
  const counts = snapshot?.misfire_counts ?? { '1': 0, '2': 0, '3': 0, '4': 0 }
  const max = Math.max(12, ...CYL.map((c) => counts[c] ?? 0))
  const misfiring = CYL.some((c) => (counts[c] ?? 0) > 0)
  return (
    <div className="card carpanel">
      <div>
        <div className="h2" style={{ marginBottom: 2 }}>What's happening to the car</div>
        <div className="muted small">Simulated 2014 compact. Tap a situation to switch it on, tap again to switch it off.</div>
        <div className="scen">
          {SCEN.map((s) => (
            <button key={s.id} className={st?.scenario === s.id ? 'on' : ''} onClick={() => onScenario(st?.scenario === s.id ? 'ok' : s.id)} aria-pressed={st?.scenario === s.id}>{s.label}</button>
          ))}
        </div>
      </div>
      <div className="live">
        <div>
          <div className="rpm">{st ? st.rpm : '–'}</div>
          <div className="muted small">rpm{st && !st.engine_running ? ', engine off' : ''}</div>
        </div>
        <div className={`mil ${st?.mil_on ? 'on' : ''} ${st?.mil_on && misfiring ? 'flash' : ''}`} title="check-engine light">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 7h4l1-2h3l1 2h2v3h2v6h-2l-2 3h-6l-2-2H6l-2-3V9h3z" /></svg>
        </div>
        <div>
          <div className="bars">
            {CYL.map((c) => (
              <div className="bar" key={c}><b style={{ height: `${((counts[c] ?? 0) / max) * 100}%` }} /><span>{c}</span></div>
            ))}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>misfires per cylinder</div>
        </div>
        <div className="small muted" style={{ maxWidth: 220 }}>
          <div className={`chip ${up ? '' : 'down'}`}><span className="dot" />{up ? 'car connected' : 'backend starting'}</div>
          {st && <div style={{ marginTop: 6 }}>coolant {st.coolant_c} °C{st.battery_v != null ? `, battery ${st.battery_v} V` : ''}, {st.dtc_count} stored {st.dtc_count === 1 ? 'code' : 'codes'}{st.warnings?.length ? `, ${st.warnings.join(', ')}` : ''}</div>}
        </div>
      </div>
    </div>
  )
}
