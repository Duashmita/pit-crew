import { useEffect, useState } from 'react'
import type { GateResult, StepSpec } from '../types'
import CoilSwapAnimation from '../components/engine/CoilSwapAnimation'
import { api } from '../lib/api'
import { AiNotice, Btn, Chip, PRECAUTION, cap } from '../components/engine/bits'
import '../components/engine/engine.css'

type Props = { spec: StepSpec; gate: GateResult; onDidIt: () => void }

export default function StepPlayer({ spec, gate, onDidIt }: Props) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set())
  const left = spec.precautions.filter((p) => !ticked.has(p)).length
  const toggle = (p: string) => setTicked((prev) => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n })
  // the hand-drawn animation covers the coil swap; any other approved step is drawn by claude from the checked spec
  const isSwap = spec.id === 'swap-coils-1-2' || spec.actions.some((a) => a.verb === 'swap')
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    if (isSwap || !gate.approved) return
    let on = true
    api.render(spec).then((r) => { if (on) setSvg(r.svg) }).catch(() => { if (on) setSvg('') })
    return () => { on = false }
  }, [spec, gate.approved, isSwap])
  return (
    <section className="dx-screen" aria-label="Do the test">
      <h2 className="dx-h">{cap(spec.title)}</h2>
      <p className="dx-sub">You need: {spec.tools.join(', ')}. About {spec.est_minutes ?? 10} minutes, {spec.cost_usd ? `$${spec.cost_usd}` : 'no parts to buy'}.</p>
      {gate.approved ? (
        <div><Chip tone="ok">Checked by the rulebook</Chip></div>
      ) : (
        <div className="dx-card dx-blocked">
          <strong>The rulebook will not draw this step yet.</strong>
          <p>Missing: {gate.missing.map((m) => PRECAUTION[m] ?? m).join('; ')}.</p>
        </div>
      )}
      <div className="dx-list" role="group" aria-label="Before you start">
        {spec.precautions.map((p) => (
          <button key={p} type="button" role="checkbox" aria-checked={ticked.has(p)} className="dx-check" onClick={() => toggle(p)}>
            <span className="dx-box" aria-hidden>{ticked.has(p) ? '✓' : ''}</span>
            <span>{PRECAUTION[p] ?? p}</span>
          </button>
        ))}
      </div>
      {gate.approved && isSwap && <div className="dx-card dx-card--lift"><CoilSwapAnimation /></div>}
      {gate.approved && !isSwap && svg && (
        <div className="dx-card dx-card--lift">
          <iframe sandbox="" srcDoc={svg} title="diagram, not to scale" style={{ width: '100%', aspectRatio: '340 / 192', border: 0, borderRadius: 10, background: 'var(--ink)' }} />
          <p className="dx-sub">Drawn by Claude from the checked spec. Diagram, not to scale.</p>
        </div>
      )}
      <ol className="dx-steps">{spec.actions.map((a, i) => <li key={i}>{cap(a.verb)} {a.target}.</li>)}</ol>
      <p className="dx-sub">Expect: the {spec.expect}.</p>
      <Btn kind="primary" disabled={left > 0 || !gate.approved} onClick={onDidIt}>
        {left > 0 ? `Tick ${left} more to continue` : 'I did it'}
      </Btn>
      <AiNotice />
    </section>
  )
}
