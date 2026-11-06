/** web-diagnosis preview: every screen of this lane with fixture props, no App.tsx needed. served at /preview.html */
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import type { CarSnapshot, Diagnosis as Dx, FairPrice, GateResult, Quote, Shop, StepSpec } from './types'
import Diagnosis from './screens/Diagnosis'
import StepPlayer from './screens/StepPlayer'
import Result from './screens/Result'
import DIY from './screens/DIY'
import Shops from './screens/Shops'
import Inbox from './screens/Inbox'

const before: CarSnapshot = {
  status: { mil_on: true, dtc_count: 1, rpm: 742, speed_kph: 0, coolant_c: 92, engine_running: true, scenario: 'misfire_before_swap' },
  dtcs: [{ code: 'P0301', desc: 'cylinder 1 misfire detected' }], misfire_counts: { '1': 12, '2': 0, '3': 0, '4': 0 }, events: [],
}
const after: CarSnapshot = { ...before, status: { ...before.status, scenario: 'misfire_after_swap' }, dtcs: [{ code: 'P0302', desc: 'cylinder 2 misfire detected' }], misfire_counts: { '1': 0, '2': 11, '3': 0, '4': 0 } }
const dx: Dx = {
  causes: [
    { cause: 'ignition coil 1', evidence: ['P0301', '12 misfires on cylinder 1', 'rough idle at 740 rpm'], confidence: 0.6 },
    { cause: 'spark plug 1', evidence: ['same symptoms', 'cheaper part'], confidence: 0.25 },
    { cause: 'fuel injector 1', evidence: ['fuel trims normal'], confidence: 0.1 },
  ],
  summary: 'One cylinder, one code, fuel trims normal: it is almost certainly ignition on cylinder 1. A coil swap tells coil from plug for free.',
}
const dxAfter: Dx = { causes: [{ cause: 'ignition coil 1', evidence: ['P0302 after the swap', 'misfire followed the coil'], confidence: 0.92 }], summary: 'The misfire followed the coil, so it is the ignition coil from cylinder 1.' }
const spec: StepSpec = {
  id: 'swap-coils-1-2', title: 'swap the coils on cylinders 1 and 2', parts: ['coil 1', 'coil 2', 'coil connectors', 'coil bolts'],
  actions: [{ verb: 'unclip', target: 'coil 1 connector' }, { verb: 'remove', target: 'coil 1 bolt' }, { verb: 'lift', target: 'coil 1' }, { verb: 'swap', target: 'coil 1 and coil 2' }, { verb: 'reinstall', target: 'both coils' }],
  tools: ['10 mm socket'], precautions: ['engine_off', 'engine_cool'], expect: 'misfire moves to cylinder 2', est_minutes: 10, cost_usd: 0,
}
const ok: GateResult = { approved: true, missing: [], required: ['engine_off', 'engine_cool'] }
const blocked: GateResult = { approved: false, missing: ['engine_cool'], required: ['engine_off', 'engine_cool'] }
const fair: FairPrice = { part: 'ignition coil', parts_usd: [35, 90], labor_usd: [60, 120], fair_range_usd: [95, 210], sources: ['https://repairpal.com/estimator/ignition-coil-replacement-cost', 'https://www.kbb.com/car-repair/ignition-coil-replacement/'], as_of: '2026-11' }
const shops: Shop[] = [
  { id: 's1', name: 'Elm Street Auto', distance_km: 1.2, open_until: '6 pm', phone: '+1 555 0101', rating: 4.7, synthetic: true },
  { id: 's2', name: 'Bayside Garage', distance_km: 2.4, open_until: '7 pm', phone: '+1 555 0102', rating: 4.4, synthetic: true },
  { id: 's3', name: 'QuickFix Tire and Lube', distance_km: 3.1, open_until: '9 pm', phone: '+1 555 0103', rating: 4.1, synthetic: true },
]
const quotes: Quote[] = [
  { id: 'q1', shop: 'Elm Street Auto', total_usd: 165, parts_usd: 70, labor_usd: 95, fair_range_usd: [95, 210], flag: 'in_range', note: 'Can do it today.', sources: fair.sources },
  { id: 'q2', shop: 'Bayside Garage', total_usd: 440, parts_usd: 190, labor_usd: 250, fair_range_usd: [95, 210], flag: 'above_range', note: 'Recommends replacing all four coils.', sources: fair.sources },
  { id: 'q3', shop: 'QuickFix Tire and Lube', total_usd: 190, parts_usd: 85, labor_usd: 105, fair_range_usd: [95, 210], flag: 'in_range', note: 'Tomorrow morning.', sources: fair.sources },
]

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ width: 390, flex: 'none' }}>
      <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 8px 4px' }}>{title}</p>
      <div style={{ height: 780, overflow: 'auto', borderRadius: 28, border: '1px solid var(--line)', background: 'var(--ink)', position: 'relative' }}>{children}</div>
    </div>
  )
}

function Preview() {
  const [snap, setSnap] = useState(before)
  const [sent, setSent] = useState(false)
  const [n, setN] = useState(3)
  return (
    <div style={{ display: 'flex', gap: 16, padding: 16, overflowX: 'auto', alignItems: 'flex-start' }}>
      <Col title={`Diagnosis (${snap === before ? 'before' : 'after'} the swap)`}>
        <div style={{ padding: '12px 16px 0' }}><button type="button" className="dx-btn" onClick={() => setSnap(snap === before ? after : before)}>Toggle before/after to watch the glow travel</button></div>
        <Diagnosis snapshot={snap} diagnosis={dx} step={{ spec, gate: ok }} onShowMe={() => console.log('show me')} />
      </Col>
      <Col title="Step player, approved"><StepPlayer spec={spec} gate={ok} onDidIt={() => console.log('did it')} /></Col>
      <Col title="Step player, blocked"><StepPlayer spec={spec} gate={blocked} onDidIt={() => {}} /></Col>
      <Col title="Result, after the swap"><Result snapshot={after} diagnosis={dxAfter} fairPrice={fair} onDiy={() => console.log('diy')} onShops={() => console.log('shops')} /></Col>
      <Col title="DIY"><DIY fairPrice={fair} spec={null} /></Col>
      <Col title={sent ? 'Shops (sent)' : 'Shops'}><Shops shops={shops} onSent={() => setSent(true)} /></Col>
      <Col title="Inbox">
        <div style={{ padding: '12px 16px 0' }}><button type="button" className="dx-btn" onClick={() => setN((n + 1) % 4)}>Replies arrived: {n}</button></div>
        <Inbox quotes={quotes.slice(0, n)} fairPrice={fair} />
      </Col>
    </div>
  )
}

export const fixtures = { before, after, dx, dxAfter, spec, ok, blocked, fair, shops, quotes }
if (typeof document !== 'undefined') createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview /></React.StrictMode>)
