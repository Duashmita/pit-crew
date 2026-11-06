import { callWords } from './words'
import type { TriageResult } from '../../types'

export default function SafetyBanner({ triage }: { triage: TriageResult }) {
  return (
    <section className={`banner ${triage.call}`} aria-live="assertive">
      <h1 className="call">{callWords(triage.call)}</h1>
      <p className="why">{triage.why}</p>
      <span className="rule">
        rule {triage.rule}
        {triage.cite?.url && <a href={triage.cite.url} target="_blank" rel="noreferrer">source</a>}
      </span>
      {triage.unknowns?.length > 0 && <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>Unknown, so treated as unsafe: {triage.unknowns.join('; ')}</div>}
      <div className="ai">AI was used. The call comes from the rulebook, not from the AI.</div>
    </section>
  )
}
