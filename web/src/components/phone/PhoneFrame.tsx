import { useEffect, useState, type ReactNode } from 'react'

export function useClock(every = 15000) {
  const [t, setT] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), every)
    return () => clearInterval(id)
  }, [every])
  return t
}

export const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const W = 390
const H = 844

export default function PhoneFrame({ children, scale = 1, label, overlay }: { children: ReactNode; scale?: number; label?: string; overlay?: ReactNode }) {
  const t = useClock()
  return (
    <div className="phone-wrap" style={{ width: W * scale, height: H * scale + (label ? 32 : 0) }}>
      <div className="phone" style={{ transform: `scale(${scale})` }}>
        <div className="notch" />
        <div className="phone-screen">
          <div className="statusbar">
            <span>{fmtTime(t)}</span>
            <span className="row" style={{ gap: 6 }}>
              <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" /><rect x="10" y="2" width="3" height="10" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" opacity="0.35" /></svg>
              <svg width="26" height="12" viewBox="0 0 26 12" fill="none" stroke="currentColor" aria-hidden="true"><rect x="0.5" y="0.5" width="22" height="11" rx="3" /><rect x="2.5" y="2.5" width="14" height="7" rx="1.5" fill="currentColor" stroke="none" /><rect x="24" y="4" width="2" height="4" rx="1" fill="currentColor" stroke="none" /></svg>
            </span>
          </div>
          {children}
          {overlay}
        </div>
      </div>
      {label && <div className="phone-label" style={{ position: 'absolute', top: H * scale + 8, left: 0, right: 0 }}>{label}</div>}
    </div>
  )
}
