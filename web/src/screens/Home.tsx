import { useEffect, useRef, useState } from 'react'
import { shrink } from './Ask'
import type { Photo } from '../types'

const CHIPS = ["It's shaking and the light is blinking", 'It just died on the freeway', 'I hit something']

const Gear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
)
const Camera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
)

/** one input, two paths: a photo, a question mark or a question word opens the live thread; a plain description starts the car check */
export const isQuestion = (t: string, photo: Photo | null) => !!photo || /\?\s*$/.test(t) || /^(what|why|how|can|is|should|which|where)\b/i.test(t)

export default function Home({ up, onAsk, onOpenAsk, onSettings }: {
  up: boolean; onAsk: (words: string) => void; onOpenAsk: (text: string, photo: Photo | null) => void; onSettings: () => void
}) {
  const [words, setWords] = useState('')
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [sample, setSample] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetch('/sample-engine.jpg', { method: 'HEAD' }).then((r) => setSample(r.ok && (r.headers.get('content-type') ?? '').startsWith('image'))).catch(() => {}) }, [])
  const pick = async (file: Blob | null) => { if (file) { try { setPhoto(await shrink(file)) } catch { /* not an image */ } } }
  const useSample = async () => { try { await pick(await (await fetch('/sample-engine.jpg')).blob()) } catch { /* missing */ } }
  const send = (t: string) => { const w = t.trim(); if (!w && !photo) return; if (isQuestion(w, photo)) onOpenAsk(w, photo); else onAsk(w) }

  return (
    <div className="phone-body">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className={`chip ${up ? '' : 'down'}`}><span className="dot" />{up ? "Maya's car, connected" : 'backend starting'}</span>
        <button className="btn ghost sm" aria-label="Settings" onClick={onSettings}><Gear /></button>
      </div>
      <h1 className="h1" style={{ marginTop: 30 }}>Hi Maya, I'm here.</h1>
      <p className="muted" style={{ margin: '0 0 12px' }}>What's going on with the car? Tell me what you feel, hear or see.</p>
      <textarea className="ask" value={words} onChange={(e) => setWords(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(words) } }} placeholder="Say it the way you'd tell a friend" aria-label="What's going on with the car" />
      {photo && (
        <div className="ask-preview">
          <img src={photo.dataUrl} alt="Photo to send" />
          <span className="small muted">Photo attached</span>
          <button className="btn ghost sm" onClick={() => setPhoto(null)} aria-label="Remove photo">×</button>
        </div>
      )}
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <button className="btn ghost sm icon" aria-label="Attach a photo" title="Attach a photo" onClick={() => fileRef.current?.click()}><Camera /></button>
        {sample && <button className="btn ghost sm" onClick={useSample} title="Use the sample engine-bay photo">sample</button>}
        <button className="btn ok block" style={{ flex: 1 }} disabled={!words.trim() && !photo} onClick={() => send(words)}>Send</button>
      </div>
      <div className="suggest" style={{ marginTop: 20 }}>
        {CHIPS.map((c) => <button className="chip" key={c} onClick={() => send(c)}>{c}</button>)}
      </div>
      <p className="small muted" style={{ margin: '14px 0 0' }}>Describe it and I'll check the car for you. Ask a question or add a photo and we'll talk it through.</p>
      <div className="ai-notice">AI was used. Simulated car. The safety call comes from a rulebook you can read.</div>
    </div>
  )
}
