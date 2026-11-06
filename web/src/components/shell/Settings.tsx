import { useState } from 'react'
import type { Friend, Settings as SettingsT } from '../../types'

export default function Settings({ friends, settings, onAdd, onRemove, onShare, onClose }: {
  friends: Friend[]; settings: SettingsT; onAdd: (f: { name: string; relation: string; phone: string }) => void
  onRemove: (id: string) => void; onShare: (on: boolean) => void; onClose: () => void
}) {
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [phone, setPhone] = useState('')
  return (
    <div className="sheet" role="dialog" aria-label="Settings">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="h2" style={{ margin: 0 }}>Your people</div>
        <button className="btn ghost sm" onClick={onClose}>Done</button>
      </div>
      <div className="people">
        {friends.map((f) => (
          <div className="person" key={f.id}>
            <span className="avatar">{f.name[0]}</span>
            <div style={{ flex: 1 }}><b>{f.name}</b><div className="muted small">{f.relation}, {f.phone}</div></div>
            <button className="btn ghost sm" onClick={() => onRemove(f.id)}>Remove</button>
          </div>
        ))}
        {!friends.length && <div className="muted" style={{ padding: '10px 0' }}>No one yet. Add someone who should know when your car fails.</div>}
      </div>
      <form className="stack" style={{ marginTop: 14, gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAdd({ name: name.trim(), relation: relation.trim(), phone: phone.trim() }); setName(''); setRelation(''); setPhone('') } }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        <div className="row"><input placeholder="Relation" value={relation} onChange={(e) => setRelation(e.target.value)} aria-label="Relation" /><input placeholder="Phone (synthetic)" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone" /></div>
        <button className="btn block" type="submit" disabled={!name.trim()}>Add</button>
      </form>
      <label className="row" style={{ justifyContent: 'space-between', marginTop: 20 }}>
        <div><b>Share my location in alerts</b><div className="muted small">Off hides the location toggle on every alert.</div></div>
        <button type="button" className={`switch ${settings.share_location ? 'on' : ''}`} role="switch" aria-checked={settings.share_location} aria-label="Share my location in alerts" onClick={() => onShare(!settings.share_location)} />
      </label>
      <div className="ai-notice">Your people are a list on this phone. Numbers are synthetic.</div>
    </div>
  )
}
