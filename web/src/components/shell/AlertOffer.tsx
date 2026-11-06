import { useState } from 'react'
import { timeOf } from './words'
import type { AckAction, Alert, Call, Friend } from '../../types'

export type OfferStatus = 'hidden' | 'shown' | 'sent' | 'declined'

export default function AlertOffer({ friends, shareLocation, status, sentAlert, ack, onSend, onDecline, call = null, sentShop = null, onSendBoth }: {
  friends: Friend[]; shareLocation: boolean; status: OfferStatus; sentAlert: Alert | null
  ack: { by: string; action: AckAction } | null; onSend: (includeLocation: boolean) => void; onDecline: () => void
  call?: Call | null; sentShop?: string | null; onSendBoth?: (includeLocation: boolean) => void
}) {
  const urgent = call === 'stop_now' && !!onSendBoth
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
            <b>Sent to {sentAlert.to.join(' and ')}{sentShop ? ` and ${sentShop}` : ''}</b>
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
        <div className="h2" style={{ margin: 0 }}>Tell {who}{urgent ? ' and the nearest shop' : ''} where you are?</div>
      </div>
      <p className="muted small" style={{ margin: '8px 0 10px' }}>They get the fault, the rulebook's call and the time. Nothing else.</p>
      {shareLocation && (
        <label className="row" style={{ justifyContent: 'space-between' }}>
          Include my location
          <button type="button" className={`switch ${include ? 'on' : ''}`} role="switch" aria-checked={include} aria-label="Include my location" onClick={() => setInclude(!include)} />
        </label>
      )}
      {urgent ? (
        <>
          <button className="btn primary block" onClick={() => onSendBoth?.(shareLocation && include)} disabled={!names.length}>Send both</button>
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn ghost block" onClick={() => onSend(shareLocation && include)} disabled={!names.length}>Just {names[0] ?? 'my people'}</button>
            <button className="btn ghost" style={{ whiteSpace: 'nowrap' }} onClick={onDecline}>Not now</button>
          </div>
        </>
      ) : (
        <div className="actions">
          <button className="btn primary block" onClick={() => onSend(shareLocation && include)} disabled={!names.length}>Send</button>
          <button className="btn ghost" style={{ whiteSpace: 'nowrap' }} onClick={onDecline}>Not now</button>
        </div>
      )}
    </div>
  )
}
