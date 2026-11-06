import type { MisfireCounts } from '../../types'

export const CX = [65, 135, 205, 275]
export const BORE_Y = 122
export const COIL_Y = 50

/** the cylinder with the most misfires, or null when the engine runs clean */
export function misfiringCyl(counts: MisfireCounts | null | undefined): number | null {
  let best: number | null = null
  let max = 0
  for (const k of ['1', '2', '3', '4'] as const) {
    const v = counts?.[k] ?? 0
    if (v > max) { max = v; best = Number(k) }
  }
  return best
}

const hex = (cx: number, cy: number, r: number) =>
  [0, 1, 2, 3, 4, 5].map((i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}` }).join(' ')

export function Cover() {
  return (
    <>
      <rect className="cover" x={18} y={30} width={304} height={130} rx={24} />
      <rect className="cover-inner" x={30} y={42} width={280} height={106} rx={18} />
    </>
  )
}

export function Cylinder({ i, prefix, misfiring }: { i: number; prefix: string; misfiring: boolean }) {
  const cx = CX[i - 1]
  return (
    <g id={`${prefix}cyl-${i}`} className={misfiring ? 'cyl misfiring' : 'cyl'}>
      <circle className="bore" cx={cx} cy={BORE_Y} r={27} />
      <circle className="ring" cx={cx} cy={BORE_Y} r={19} />
      <line className="lead" x1={cx} y1={COIL_Y + 40} x2={cx} y2={BORE_Y - 11} />
      <g id={`${prefix}plug-${i}`} className="plug">
        <polygon points={hex(cx, BORE_Y, 8)} />
        <circle cx={cx} cy={BORE_Y} r={2.5} fill="var(--ink)" />
      </g>
      <text className="label" x={cx} y={BORE_Y + 45} textAnchor="middle">{i}</text>
    </g>
  )
}

/** outer g positions the coil (svg attribute); inner g carries the id and any css animation, so the two transforms never fight */
export function Coil({ i, prefix, className }: { i: number; prefix: string; className?: string }) {
  return (
    <g transform={`translate(${CX[i - 1] - 14}, ${COIL_Y})`}>
      <g id={`${prefix}coil-${i}`} className={`coil ${className ?? ''}`.trim()}>
        <rect className="tab" x={9} y={-6} width={10} height={7} rx={2} />
        <rect className="body" x={0} y={0} width={28} height={30} rx={7} />
        <circle className="pin" cx={14} cy={10} r={3} />
        <rect className="boot" x={10} y={30} width={8} height={10} rx={2} />
      </g>
    </g>
  )
}
