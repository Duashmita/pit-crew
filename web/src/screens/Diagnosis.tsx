import type { CarSnapshot, Diagnosis as Dx, GateResult, MisfireCounts, StepSpec } from '../types'
import EngineSVG from '../components/engine/EngineSVG'
import { misfiringCyl } from '../components/engine/drawing'
import { AiNotice, Bar, Btn, Chip, cap, usd } from '../components/engine/bits'
import '../components/engine/engine.css'

type Props = { snapshot: CarSnapshot; diagnosis: Dx | null; step: { spec: StepSpec; gate: GateResult } | null; onShowMe: () => void }

export default function Diagnosis({ snapshot, diagnosis, step, onShowMe }: Props) {
  const cyl = misfiringCyl(snapshot.misfire_counts)
  const n = cyl ? snapshot.misfire_counts[String(cyl) as keyof MisfireCounts] : 0
  return (
    <section className="dx-screen" aria-label="What is wrong">
      <div className="dx-card dx-card--lift">
        <EngineSVG counts={snapshot.misfire_counts} />
        <p className="dx-sub">{cyl ? `Cylinder ${cyl} is misfiring: ${n} misfires since the engine started. Live from the car.` : 'No misfires right now. Live from the car.'}</p>
      </div>
      <h2 className="dx-h">Likely causes</h2>
      {diagnosis ? (
        <ol className="dx-list">
          {diagnosis.causes.map((c, i) => (
            <li key={c.cause} className={`dx-cause ${i === 0 ? 'dx-cause--top' : ''}`}>
              <strong>{cap(c.cause)}</strong>
              <span className="dx-pct">{Math.round(c.confidence * 100)}%</span>
              <Bar value={c.confidence} tone={i === 0 ? 'danger' : undefined} />
              <div className="dx-evidence">{c.evidence.map((e) => <Chip key={e}>{e}</Chip>)}</div>
            </li>
          ))}
        </ol>
      ) : <p className="dx-sub">Ranking the causes from what the car said.</p>}
      {diagnosis?.summary && <p className="dx-sub">{diagnosis.summary}</p>}
      {step && (
        <div className="dx-card dx-card--lift">
          <div className="dx-row">
            <strong className="dx-grow">Cheapest test first</strong>
            <Chip tone="ok">{step.spec.cost_usd ? usd(step.spec.cost_usd) : '$0'}</Chip>
            <Chip>{step.spec.est_minutes ?? 10} min</Chip>
          </div>
          <h3 className="dx-h3">{cap(step.spec.title)}</h3>
          <p className="dx-sub">If the {step.spec.expect}, it is the coil, not the plug or the injector.</p>
          <Btn kind="primary" onClick={onShowMe} style={{ marginTop: 12 }}>Show me</Btn>
        </div>
      )}
      <AiNotice />
    </section>
  )
}
