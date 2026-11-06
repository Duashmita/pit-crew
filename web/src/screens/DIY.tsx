import type { FairPrice, StepSpec } from '../types'
import CoilSwapAnimation from '../components/engine/CoilSwapAnimation'
import { AiNotice, Sources, cap, range } from '../components/engine/bits'
import '../components/engine/engine.css'

const REPLACE = [
  { verb: 'unclip', target: 'the connector on coil 1' },
  { verb: 'remove', target: 'the coil bolt, 10 mm' },
  { verb: 'lift', target: 'the old coil straight up' },
  { verb: 'seat', target: 'the new coil onto the plug until it clicks' },
  { verb: 'bolt', target: 'it down and clip the connector' },
]

export default function DIY({ fairPrice, spec }: { fairPrice: FairPrice | null; spec: StepSpec | null }) {
  const actions = spec?.actions?.length ? spec.actions : REPLACE
  return (
    <section className="dx-screen" aria-label="Fix it yourself">
      <h2 className="dx-h">Replace the ignition coil on cylinder 1</h2>
      <div className="dx-card">
        <div className="dx-row"><span className="dx-grow">One ignition coil</span><strong>{fairPrice ? range(fairPrice.parts_usd) : 'price loading'}</strong></div>
        {fairPrice && <Sources urls={fairPrice.sources} />}
        <p className="dx-sub" style={{ marginTop: 8 }}>Parts store nearby: Elm Street Auto Parts, 0.6 mi, open until 9 pm. Simulated.</p>
      </div>
      <div className="dx-card dx-card--lift"><CoilSwapAnimation /></div>
      <ol className="dx-steps">{actions.map((a, i) => <li key={i}>{cap(a.verb)} {a.target}.</li>)}</ol>
      <p className="dx-sub">Same moves as the test you just did, with the new coil going into slot 1. The light goes out on its own after a few drives.</p>
      <AiNotice />
    </section>
  )
}
