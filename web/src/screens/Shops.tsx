import { useState } from 'react'
import type { Shop } from '../types'
import { api } from '../lib/api'
import { AiNotice, Btn, Chip } from '../components/engine/bits'
import '../components/engine/engine.css'

type Props = { shops: Shop[]; onSent: () => void }

const localDraft = (names: string[]) =>
  `Hi ${names.join(', ')},\n\nMy car has code P0301, a cylinder 1 misfire. I swapped the coils on cylinders 1 and 2 and the misfire moved to cylinder 2, so it is the ignition coil from cylinder 1.\n\nCould you quote parts and labor for one coil replacement? I understand the fair range is around $120 to $250 all in.\n\nThanks,\nMaya`

export default function Shops({ shops, onSent }: Props) {
  const [sel, setSel] = useState<string[]>([])
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const chosen = shops.filter((s) => sel.includes(s.id))

  const openDraft = async () => {
    setBusy(true); setErr(null)
    try { setDraft((await api.draft(sel)).draft) }
    catch { setErr('Could not reach the backend, so this is a local draft.'); setDraft(localDraft(chosen.map((s) => s.name))) }
    finally { setBusy(false) }
  }
  const send = async () => {
    setBusy(true)
    try { await api.send(sel) } catch { /* the demo keeps moving; the inbox shows what arrived */ }
    setBusy(false); setDraft(null); onSent()
  }

  if (draft !== null) {
    return (
      <section className="dx-screen dx-sheet" aria-label="Your request">
        <div className="dx-row"><h2 className="dx-h dx-grow">Your request</h2><Chip tone="caution">Simulated send</Chip></div>
        <p className="dx-sub">To {chosen.map((s) => s.name).join(', ')}. It states the fault, your test and the fair price, so the quote starts from the right number.</p>
        {err && <p className="dx-sub" style={{ color: 'var(--caution)' }}>{err}</p>}
        <pre className="dx-draft">{draft}</pre>
        <Btn kind="primary" disabled={busy} onClick={send}>Approve and send</Btn>
        <Btn onClick={() => setDraft(null)}>Not yet</Btn>
        <p className="dx-sub">Nothing leaves this demo. In the real app, nothing leaves without your approval.</p>
        <AiNotice />
      </section>
    )
  }
  return (
    <section className="dx-screen" aria-label="Find a shop">
      <h2 className="dx-h">Ask a shop, knowing the number</h2>
      <p className="dx-sub">Pick who to ask. Simulated shops.</p>
      <div className="dx-list" role="group" aria-label="Shops nearby">
        {shops.map((s) => (
          <button key={s.id} type="button" role="checkbox" aria-checked={sel.includes(s.id)} className="dx-check" onClick={() => toggle(s.id)}>
            <span className="dx-box" aria-hidden>{sel.includes(s.id) ? '✓' : ''}</span>
            <span className="dx-grow">
              <strong>{s.name}</strong><br />
              <span className="dx-sub">{s.distance_km} km away, open until {s.open_until}, {s.rating.toFixed(1)} stars</span>
            </span>
          </button>
        ))}
      </div>
      <Btn kind="primary" disabled={!sel.length || busy} onClick={openDraft}>
        {sel.length ? `Draft a request to ${sel.length === 1 ? chosen[0].name : `${sel.length} shops`}` : 'Pick at least one shop'}
      </Btn>
      <AiNotice />
    </section>
  )
}
