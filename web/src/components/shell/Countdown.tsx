import { useEffect, useRef, useState } from 'react'

/** full-screen countdown inside the phone. label may contain {n}. onDone fires once at zero. */
export default function Countdown({ seconds, label, cancelLabel = 'Cancel', doneLabel = 'Sending', onCancel, onDone }: {
  seconds: number; label: string; cancelLabel?: string; doneLabel?: string; onCancel: () => void; onDone: () => void
}) {
  const [left, setLeft] = useState(seconds)
  const fired = useRef(false)
  useEffect(() => {
    if (left <= 0) {
      if (!fired.current) { fired.current = true; onDone() }
      return
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(id)
  }, [left, onDone])
  const C = 2 * Math.PI * 66
  return (
    <div className="overlay" role="alertdialog" aria-live="assertive">
      <div className="ring">
        <svg viewBox="0 0 150 150" aria-hidden="true">
          <circle cx="75" cy="75" r="66" stroke="var(--panel-2)" strokeWidth="8" fill="none" />
          <circle cx="75" cy="75" r="66" stroke="var(--danger)" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / seconds)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="n">{left}</div>
      </div>
      <div className="label">{left > 0 ? label.replace('{n}', String(left)) : `${doneLabel}…`}</div>
      {left > 0 && <button className="btn block" style={{ marginTop: 24, maxWidth: 300 }} onClick={onCancel}>{cancelLabel}</button>}
    </div>
  )
}
