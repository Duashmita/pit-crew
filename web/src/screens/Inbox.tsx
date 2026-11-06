import type { FairPrice, Quote } from '../types'
import { AiNotice, Chip, host, range, usd } from '../components/engine/bits'
import '../components/engine/engine.css'

type Props = { quotes: Quote[]; fairPrice: FairPrice | null }

export default function Inbox({ quotes, fairPrice }: Props) {
  const fair = fairPrice?.fair_range_usd ?? quotes[0]?.fair_range_usd
  const src = fairPrice?.sources?.[0] ?? quotes[0]?.sources?.[0]
  return (
    <section className="dx-screen" aria-label="Quotes">
      <h2 className="dx-h">Quotes</h2>
      <p className="dx-sub">{quotes.length ? `${quotes.length} of 3 shops replied.` : 'Waiting for the shops to reply.'}</p>
      <div className="dx-list">
        {quotes.map((q, i) => {
          const over = q.flag === 'above_range'
          const ratio = (q.total_usd / Math.max(1, q.fair_range_usd[1])).toFixed(1)
          return (
            <article key={q.id} className={`dx-card dx-quote ${over ? 'dx-quote--flag' : ''}`} style={{ animationDelay: `${i * 80}ms` }}>
              <div className="dx-row">
                <strong className="dx-grow">{q.shop}</strong>
                {over ? <Chip tone="danger">Above fair range, {ratio}x</Chip> : <Chip tone="ok">In range</Chip>}
              </div>
              <div className="dx-price">{usd(q.total_usd)}</div>
              <dl className="dx-kv"><dt>Parts</dt><dd>{usd(q.parts_usd)}</dd><dt>Labor</dt><dd>{usd(q.labor_usd)}</dd></dl>
              {q.note && <p className="dx-sub">{q.note}</p>}
            </article>
          )
        })}
        {Array.from({ length: Math.max(0, 3 - quotes.length) }).map((_, i) => <div key={`s${i}`} className="dx-card dx-skel" aria-hidden />)}
      </div>
      {fair && (
        <p className="dx-sub">Fair range {range(fair)}{src ? <> from <a className="dx-link" href={src} target="_blank" rel="noreferrer">{host(src)}</a></> : null}.</p>
      )}
      <p className="dx-closing">She walks in knowing what's wrong and what it should cost.</p>
      <AiNotice />
    </section>
  )
}
