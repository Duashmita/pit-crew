import { useEffect, useState, type ReactNode } from 'react'
import PhoneFrame from '../phone/PhoneFrame'
import FriendPhone from './FriendPhone'
import type { AckAction, Alert } from '../../types'

export default function Stage({ carPanel, maya, overlay, alert, friendName, onAck, onHome }: {
  carPanel: ReactNode; maya: ReactNode; overlay?: ReactNode; alert: Alert | null; friendName: string
  onAck: (id: string, action: AckAction) => void; onHome: () => void
}) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.max(0.6, Math.min(1, (window.innerHeight - 56 - 48) / 844)))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <div className="stage">
      <header className="topbar">
        <button className="wordmark" onClick={onHome} title="Start over"><i />Pit Crew</button>
        <div className="notice"><span>AI was used</span><span>simulated car, shops and friends</span></div>
      </header>
      <div className="stage-grid">
        <aside>{carPanel}</aside>
        <PhoneFrame scale={scale} label="Maya" overlay={overlay}>{maya}</PhoneFrame>
        <FriendPhone scale={scale * 0.85} alert={alert} name={friendName} onAck={onAck} />
      </div>
    </div>
  )
}
