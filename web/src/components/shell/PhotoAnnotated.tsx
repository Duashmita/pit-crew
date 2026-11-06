import type { Annotation } from '../../types'

/** her photo with claude's boxes drawn over it. coordinates are normalized 0..1; the svg viewBox matches the image so the boxes stay put at any size. */
export default function PhotoAnnotated({ src, width, height, annotations, alt }: { src: string; width: number; height: number; annotations: Annotation[]; alt?: string }) {
  const sw = Math.max(2, width / 280)
  const fs = Math.max(12, width / 26)
  const r = fs * 0.85
  return (
    <figure className="photo">
      <div className="photo-img">
      <img src={src} alt={alt ?? 'Her photo'} />
      {annotations.length > 0 && (
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {annotations.map((a, i) => {
            const x = a.x * width, y = a.y * height, w = Math.max(a.w * width, sw * 4), h = Math.max(a.h * height, sw * 4)
            return (
              <g key={i} className="ann">
                <rect x={x} y={y} width={w} height={h} rx={sw * 3} fill="rgba(255,90,78,0.14)" stroke="var(--danger)" strokeWidth={sw} />
                <circle cx={x} cy={y} r={r} fill="var(--danger)" />
                <text x={x} y={y} fontSize={fs} fontWeight={800} fill="var(--ink)" textAnchor="middle" dominantBaseline="central">{i + 1}</text>
              </g>
            )
          })}
        </svg>
      )}
      </div>
      {annotations.length > 0 && (
        <figcaption className="legend">
          {annotations.map((a, i) => (
            <div key={i} className="legend-row"><b>{i + 1}</b><span><strong>{a.label}</strong>{a.note ? ` · ${a.note}` : ''}</span></div>
          ))}
          <div className="small muted" style={{ marginTop: 6 }}>Boxes are where Claude thinks the parts are. Check before you touch anything.</div>
        </figcaption>
      )}
    </figure>
  )
}
