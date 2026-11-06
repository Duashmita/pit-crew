import PhoneFrame, { fmtTime, useClock } from '../phone/PhoneFrame'
import { callWords } from './words'
import type { AckAction, Alert } from '../../types'

const mapTile = (
  <svg viewBox="0 0 300 130" preserveAspectRatio="xMidYMid slice" aria-label="map, synthetic location">
    <rect width="300" height="130" fill="#1c2535" />
    <g stroke="#2e3a50" strokeWidth="6" strokeLinecap="round"><path d="M0 40 H300 M0 95 H300 M60 0 V130 M150 0 V130 M240 0 V130" /></g>
    <g stroke="#3a4a66" strokeWidth="2"><path d="M0 70 H300 M105 0 V130 M195 0 V130" /></g>
    <path d="M0 40 H300" stroke="#4a5a7a" strokeWidth="8" strokeLinecap="round" opacity="0.6" />
    <text x="8" y="34" fill="#8f9bb3" fontSize="10" fontFamily="inherit">Elm St</text>
    <text x="154" y="124" fill="#8f9bb3" fontSize="10" fontFamily="inherit">3rd Ave</text>
    <circle cx="150" cy="70" r="8" fill="none" stroke="#FF5A4E" strokeWidth="2">
      <animate attributeName="r" from="8" to="32" dur="1.6s" repeatCount="indefinite" />
      <animate attributeName="opacity" from="0.9" to="0" dur="1.6s" repeatCount="indefinite" />
    </circle>
    <circle cx="150" cy="70" r="7" fill="#FF5A4E" stroke="#fff" strokeWidth="2" />
  </svg>
)

function body(a: Alert): string {
  const fault = a.fault && a.fault !== 'unknown' ? ` ${a.fault}.` : ''
  if (a.trigger === 'crash') return 'Possible crash. Her airbag went off.'
  if (a.trigger === 'stall') return 'Her engine stalled while driving.'
  if (a.trigger === 'sos') return `She pressed SOS.${fault}`
  return `Her car says ${callWords(a.call).toLowerCase()}.${fault}`
}

export default function FriendPhone({ scale, alert, name, onAck }: { scale: number; alert: Alert | null; name: string; onAck: (id: string, action: AckAction) => void }) {
  const t = useClock()
  const ack = alert?.acks?.find((x) => x.by === name)
  return (
    <PhoneFrame scale={scale} label={`${name}, Maya's sister · simulated`}>
      <div className={`lock ${alert ? '' : 'dim'}`}>
        <div className="time">{fmtTime(t)}</div>
        <div className="date">{t.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        {alert && (
          <div className="notif" key={alert.id} role="status">
            <div className="app"><span>Pit Crew</span><span>now</span></div>
            <div className="title">Maya needs you</div>
            <div>{body(alert)}</div>
            {alert.location ? (
              <>
                <div className="map">{mapTile}</div>
                <div className="small">{alert.location.label}, 0.8 mi away</div>
              </>
            ) : (
              <div className="muted small" style={{ margin: '8px 0' }}>location not shared</div>
            )}
            {ack ? (
              <div className="sent" style={{ marginTop: 10 }}><span className="check">✓</span><b>{ack.action === 'on_my_way' ? "You're on your way" : 'You called her'}</b></div>
            ) : (
              <div className="actions">
                <button className="btn block" onClick={() => onAck(alert.id, 'called')}>Call her</button>
                <button className="btn ok block" onClick={() => onAck(alert.id, 'on_my_way')}>On my way</button>
              </div>
            )}
          </div>
        )}
      </div>
    </PhoneFrame>
  )
}
