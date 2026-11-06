import { CX, Coil, Cover, Cylinder } from './drawing'
import './engine.css'

const top = 38
const arc = `M ${CX[0] + 10} ${top} Q ${(CX[0] + CX[1]) / 2} 2 ${CX[1] - 10} ${top}`

export default function CoilSwapAnimation() {
  return (
    <figure className="dx-fig">
      <svg className="eng" viewBox="0 0 340 192" role="img" aria-label="Swap the coils on cylinders 1 and 2">
        <defs>
          <marker id="swap-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path className="arrowhead" d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        <Cover />
        {[1, 2, 3, 4].map((i) => <Cylinder key={i} i={i} prefix="swap-" misfiring={i === 1} />)}
        <path className="arrow" d={arc} markerStart="url(#swap-head)" markerEnd="url(#swap-head)" />
        <Coil i={1} prefix="swap-" className="swap-a" />
        <Coil i={2} prefix="swap-" className="swap-b" />
        <Coil i={3} prefix="swap-" />
        <Coil i={4} prefix="swap-" />
        <text className="cap" x={18} y={186}>diagram, not to scale</text>
      </svg>
      <figcaption className="dx-sub">Lift coil 1 and coil 2, trade places, seat each one back down. If the misfire moves to cylinder 2, the coil is the problem.</figcaption>
    </figure>
  )
}
