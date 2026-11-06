import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
export const range = ([a, b]: [number, number]) => `${usd(a)} to ${usd(b)}`
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
export const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }

export const PRECAUTION: Record<string, string> = {
  engine_off: 'Engine off, key out of the ignition',
  engine_cool: 'Engine cool to the touch, about 30 minutes after driving',
  no_flame: 'No flames, sparks or smoking nearby',
  key_out: 'Key out of the ignition',
  negative_first: 'Disconnect the negative battery terminal first',
}

export function AiNotice({ children }: { children?: ReactNode }) {
  return <p className="dx-ai">{children ?? 'AI was used on this screen. The safety call came from the rulebook, not from the AI. Simulated car.'}</p>
}

export function Btn({ kind = 'default', className = '', ...rest }: { kind?: 'default' | 'primary' | 'ok' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`dx-btn dx-btn--${kind} ${className}`} {...rest} />
}

export function Chip({ tone, children }: { tone?: 'danger' | 'ok' | 'caution'; children: ReactNode }) {
  return <span className={`dx-chip ${tone ? `dx-chip--${tone}` : ''}`}>{children}</span>
}

export function Bar({ value, tone }: { value: number; tone?: 'danger' | 'ok' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className={`dx-bar ${tone ? `dx-bar--${tone}` : ''}`} role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Sources({ urls }: { urls: string[] }) {
  return <div className="dx-sources">{urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer">{host(u)}</a>)}</div>
}
