import { useState } from 'react'

const CHIPS = ["It's shaking and the light is blinking", 'It just died on the freeway', 'I hit something']

export default function Home({ up, onAsk, onSettings }: { up: boolean; onAsk: (words: string) => void; onSettings: () => void }) {
  const [words, setWords] = useState('')
  return (
    <div className="phone-body">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className={`chip ${up ? '' : 'down'}`}><span className="dot" />{up ? "Maya's car, connected" : 'backend starting'}</span>
        <button className="btn ghost sm" aria-label="Settings" onClick={onSettings}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </div>
      <h1 className="h1" style={{ marginTop: 30 }}>Hi Maya</h1>
      <p className="muted" style={{ margin: '0 0 14px' }}>What's going on with the car?</p>
      <textarea className="ask" value={words} onChange={(e) => setWords(e.target.value)} placeholder="Say it the way you'd tell a friend" aria-label="What's going on with the car" />
      <button className="btn ok block" style={{ marginTop: 8 }} disabled={!words.trim()} onClick={() => onAsk(words.trim())}>Ask the car</button>
      <div className="suggest" style={{ marginTop: 20 }}>
        {CHIPS.map((c) => <button className="chip" key={c} onClick={() => onAsk(c)}>{c}</button>)}
      </div>
      <div className="ai-notice">AI was used. Simulated car. The safety call comes from a rulebook you can read.</div>
    </div>
  )
}
