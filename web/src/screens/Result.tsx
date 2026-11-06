import type { CarSnapshot, Diagnosis as Dx, FairPrice } from '../types'
import EngineSVG from '../components/engine/EngineSVG'
import { misfiringCyl } from '../components/engine/drawing'
import { AiNotice, Bar, Btn, Sources, range } from '../components/engine/bits'
import '../components/engine/engine.css'

type Props = { snapshot: CarSnapshot; diagnosis: Dx | null; fairPrice: FairPrice | null; onDiy: () => void; onShops: () => void }

export default function Result({ snapshot, diagnosis, fairPrice, onDiy, onShops }: Props) {
  const cyl = misfiringCyl(snapshot.misfire_counts)
  const conf = diagnosis?.causes[0]?.confidence ?? 0
  return (
    <section className="dx-screen" aria-label="Result">
      <div className="dx-card dx-card--lift">
        <EngineSVG counts={snapshot.misfire_counts} />
        <p className="dx-sub">{cyl ? `The misfire is on cylinder ${cyl} now. Live from the car.` : 'Live from the car.'}</p>
      </div>
      <div className="dx-card">
        <h2 className="dx-h">The misfire followed the coil.</h2>
        <p className="dx-sub" style={{ marginTop: 6 }}>{diagnosis?.summary ?? 'It is the ignition coil from cylinder 1.'}</p>
        <div className="dx-row" style={{ margin: '12px 0 6px' }}><span className="dx-grow dx-sub">Confidence</span><strong>{Math.round(conf * 100)}%</strong></div>
        <Bar value={conf} tone="ok" />
      </div>
      {fairPrice ? (
        <div className="dx-card">
          <strong>Fair price for a new {fairPrice.part}</strong>
          <div className="dx-price">{range(fairPrice.fair_range_usd)}</div>
          <dl className="dx-kv">
            <dt>The part</dt><dd>{range(fairPrice.parts_usd)}</dd>
            <dt>Labor at a shop</dt><dd>{range(fairPrice.labor_usd)}</dd>
          </dl>
          <p className="dx-sub">Sources, as of {fairPrice.as_of}</p>
          <Sources urls={fairPrice.sources} />
        </div>
      ) : <div className="dx-card"><p className="dx-sub">Looking up the fair price.</p></div>}
      <Btn kind="ok" onClick={onDiy}>I'll replace it myself</Btn>
      <Btn onClick={onShops}>Find a shop</Btn>
      <AiNotice />
    </section>
  )
}
