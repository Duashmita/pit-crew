import { useEffect, useState } from 'react'
import type { MisfireCounts } from '../../types'
import { BORE_Y, CX, Coil, Cover, Cylinder, misfiringCyl } from './drawing'
import './engine.css'

/** where the glow was on the previous screen, so it travels on mount instead of jumping */
let lastCounts: MisfireCounts | null = null

export default function EngineSVG({ counts, size }: { counts: MisfireCounts; size?: number }) {
  const target = misfiringCyl(counts)
  const [pos, setPos] = useState<number | null>(() => misfiringCyl(lastCounts) ?? target)
  useEffect(() => { lastCounts = counts }, [counts])
  useEffect(() => {
    if (target == null) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPos(target)))
    return () => cancelAnimationFrame(id)
  }, [target])
  const glowX = CX[(pos ?? 1) - 1] - CX[0]
  const n = target ? counts[String(target) as keyof MisfireCounts] : 0
  return (
    <svg className="eng" viewBox="0 0 340 192" width={size} role="img"
      aria-label={target ? `Engine diagram: cylinder ${target} is misfiring, ${n} misfires` : 'Engine diagram: no misfires'}>
      <defs>
        <filter id="eng-blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9" /></filter>
      </defs>
      <Cover />
      <g transform={`translate(${CX[0]}, ${BORE_Y})`}>
        <circle className={`glow ${target != null ? 'on' : ''}`} r={36} filter="url(#eng-blur)" style={{ transform: `translateX(${glowX}px)` }} />
      </g>
      {[1, 2, 3, 4].map((i) => <Cylinder key={i} i={i} prefix="" misfiring={target === i} />)}
      {[1, 2, 3, 4].map((i) => <Coil key={i} i={i} prefix="" />)}
      <text className="cap" x={18} y={186}>coils on top, spark plugs in the bores, cylinders 1 to 4. diagram, not to scale</text>
    </svg>
  )
}
