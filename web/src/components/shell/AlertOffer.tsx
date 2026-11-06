import { useState } from 'react'
import { timeOf } from './words'
import type { AckAction, Alert, Friend } from '../../types'

export type OfferStatus = 'hidden' | 'shown' | 'sent' | 'declined'

export default function AlertOffer({ friends, shareLocation, status, sentAlert, ack, onSend, onDecline }: {
  friends: Friend[]; shareLocation: boolean; status: OfferStatus; sentAlert: Alert | null
  ack: { by: string; action: AckAction } | null; onSend: (includeLocation: boolean) => void; onDecline: () => void
}) {
  const [include, setInclude] = useState(true)
  const names = friends.map((f) => f.name)
  const who = names.length ? names.join(' and ') : 'your people'
  if (status === 'hidden' || status === 'declined') return null
  if (status === 'sent' && sentAlert) {
    return (
      <div className="card offer">
        <div className="sent">
          <span className="check">✓</span>
          <div>
            <b>Sent to {sentAlert.to.join(' and ')}</b>
            <div className="muted small">{timeOf(sentAlert.sent_at)}, {sentAlert.location ? 'location included' : 'location not shared'}</div>
          </div>
        </div>
        {ack && <div className="sent" style={{ marginTop: 10 }}><span className="check">✓</span><b>{ack.by} is {ack.action === 'on_my_way' ? 'on her way' : 'calling you'}</b></div>}
      </div>
    )
  }
  return (
    <div className="card offer">
      <div className="row">
        <div className="avatars">{names.map((n) => <span className="avatar" key={n}>{n[0]}</span>)}</div>
        <div className="h2" style={{ margin: 0 }}>Tell {who} where you are?</div>
      </div>
      <p className="muted small" style={{ margin: '8px 0 10px' }}>They get the fault, the rulebook's call and the time. Nothing else.</p>
      {shareLocation && (
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Include my location
          <button type="button" className={`switch ${include ? 'on' : ''}`} role="switch" aria-checked={include} aria-label="Include my location" onClick={() => setInclude(!include)} />
        </label>
      )}
      <div className="actions">
        <button className="btn primary block" onClick={() => onSend(shareLocation && include)} disabled={!names.length}>Send</button>
        <button className="btn ghost" onClick={onDecline}>Not now</button>
      </div>
    </div>
  )
}
