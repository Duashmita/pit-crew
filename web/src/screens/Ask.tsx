import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { callWords } from '../components/shell/words'
import PhotoAnnotated from '../components/shell/PhotoAnnotated'
import type { Annotation, AskSeed, ChatImage, ChatMessage, Photo, TriageResult } from '../types'

interface Bubble { role: 'user' | 'assistant'; content: string; photo?: Photo; annotations?: Annotation[]; error?: boolean }
export interface ToolChip { tool: string; result: unknown }

const TOOL_WORDS: Record<string, string> = { get_status: 'Reading the warning lights', read_dtcs: 'Reading the codes', misfire_counts: 'Counting misfires', events: 'Checking for crash or stall', triage: 'Asking the rulebook', annotate_photo: 'Marking up the photo' }

/** downscale to 1024 px on the long edge, jpeg 0.85, so a phone photo is a small upload */
export async function shrink(file: Blob): Promise<Photo> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight, 1))
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k))
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const dataUrl = c.toDataURL('image/jpeg', 0.85)
    return { dataUrl, data: dataUrl.split(',')[1] ?? '', media_type: 'image/jpeg', w, h }
  } finally { URL.revokeObjectURL(url) }
}

export default function Ask({ onAlert, tools = [], onStart, seed = null }: { onAlert: () => void | Promise<void>; tools?: ToolChip[]; onStart?: () => void; seed?: AskSeed | null }) {
  // a check already done seeds the thread with her words and the call, so a follow-up has its context
  const [thread, setThread] = useState<Bubble[]>(seed?.context
    ? [{ role: 'user', content: seed.context.words }, { role: 'assistant', content: `The rulebook says ${callWords(seed.context.call).toLowerCase()}. Ask me anything about it.` }]
    : [])
  const seeded = useRef(false)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'live' | 'fixture' | null>(null)
  const [strip, setStrip] = useState<{ triage: TriageResult; sent: boolean } | null>(null)
  const [sample, setSample] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetch(`${import.meta.env.BASE_URL}sample-engine.jpg`, { method: 'HEAD' }).then((r) => setSample(r.ok && (r.headers.get('content-type') ?? '').startsWith('image'))).catch(() => {}) }, [])
  // a first message from home is sent as soon as the thread opens (once, StrictMode-safe)
  useEffect(() => { if (!seeded.current && seed && !seed.context && (seed.text || seed.photo)) { seeded.current = true; send(seed.text, seed.photo ?? null) } }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [thread.length, busy, tools.length])

  const pick = async (file: Blob | null) => { if (file) { try { setPhoto(await shrink(file)) } catch { /* not an image */ } } }
  const useSample = async () => { try { await pick(await (await fetch(`${import.meta.env.BASE_URL}sample-engine.jpg`)).blob()) } catch { /* missing */ } }

  const send = async (wordsIn: string = text, photoIn: Photo | null = photo) => {
    const words = wordsIn.trim()
    const photo = photoIn
    if ((!words && !photo) || busy) return
    const mine: Bubble = { role: 'user', content: words || 'What do you see in this photo?', photo: photo ?? undefined }
    const history: ChatMessage[] = [...thread.filter((b) => !b.error).map((b) => ({ role: b.role, content: b.content })), { role: 'user', content: mine.content }]
    const image: ChatImage | null = photo ? { media_type: photo.media_type, data: photo.data } : null
    setThread((t) => [...t, mine]); setText(''); setPhoto(null); setBusy(true); onStart?.()
    try {
      const r = await api.chat(history, image)
      setMode(r.mode)
      setThread((t) => {
        const next = [...t]
        if (r.annotations?.length) for (let i = next.length - 1; i >= 0; i--) if (next[i].photo) { next[i] = { ...next[i], annotations: r.annotations }; break }
        return [...next, { role: 'assistant', content: r.reply }]
      })
      if (r.triage && r.triage.call !== 'ok_to_drive') setStrip({ triage: r.triage, sent: false })
    } catch {
      setThread((t) => [...t, { role: 'assistant', content: 'Backend not ready. Start it with make dev, then ask again.', error: true }])
    } finally { setBusy(false) }
  }

  return (
    <div className="ask-screen">
      <div className="row ask-head">
        <span className="small muted">Ask me anything, in your own words. A photo helps.</span>
        <span className={`pill ${mode === 'live' ? 'live' : mode === 'fixture' ? 'off' : ''}`}>{mode === 'live' ? 'live' : mode === 'fixture' ? 'offline demo' : 'ready'}</span>
      </div>
      <div className="thread" role="log" aria-live="polite">
        {thread.length === 0 && (
          <div className="bubble ai intro">Tell me what the car is doing, or show me a photo. I can read the car while we talk, and I'll tell you straight if it isn't safe to drive.</div>
        )}
        {thread.map((b, i) => (
          <div key={i} className={`bubble ${b.role === 'user' ? 'me' : 'ai'} ${b.error ? 'err' : ''}`}>
            {b.photo && <PhotoAnnotated src={b.photo.dataUrl} width={b.photo.w} height={b.photo.h} annotations={b.annotations ?? []} />}
            <div>{b.content}</div>
          </div>
        ))}
        {busy && tools.map((t, i) => <span key={i} className="chip pulse tool"><span className="dot" />{TOOL_WORDS[t.tool] ?? t.tool}</span>)}
        {busy && <div className="bubble ai typing" aria-label="Claude is thinking"><i /><i /><i /></div>}
        <div ref={endRef} />
      </div>
      {strip && (
        <div className={`ask-strip ${strip.triage.call}`}>
          <div><b>{callWords(strip.triage.call)}</b><span className="small"> · rule {strip.triage.rule}</span></div>
          {strip.sent ? <span className="small">Sent to Priya</span> : <button className="btn sm" onClick={async () => { await onAlert(); setStrip({ ...strip, sent: true }) }}>Tell Priya</button>}
        </div>
      )}
      {photo && (
        <div className="ask-preview">
          <img src={photo.dataUrl} alt="Photo to send" />
          <span className="small muted">Photo attached</span>
          <button className="btn ghost sm" onClick={() => setPhoto(null)} aria-label="Remove photo">×</button>
        </div>
      )}
      <div className="ask-input">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <button className="btn ghost sm icon" aria-label="Attach a photo" title="Attach a photo" onClick={() => fileRef.current?.click()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        </button>
        {sample && <button className="btn ghost sm" onClick={useSample} title="Use the sample engine-bay photo">sample</button>}
        <input className="ask-text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder="Tell it what's wrong" aria-label="Tell it what's wrong" />
        <button className="btn ok sm" disabled={busy || (!text.trim() && !photo)} onClick={() => send()} aria-label="Send">Send</button>
      </div>
      <div className="ai-notice" style={{ marginTop: 6 }}>AI was used. Live answers come from Claude; the safety call still comes from the rulebook.</div>
    </div>
  )
}
