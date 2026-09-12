import { DAY_CIRCLE_RADIUS, DAY_SPACING_PX } from '../../domain/config'
import type { Day } from '../../domain/models'
import { computePathPoints } from '../../domain/pathEngine'

interface Segment {
  label: string
  color: string
  days: Day[]
}

export default function PathComparisonView({ segments, height = 320 }: { segments: Segment[]; height?: number }) {
  const normalized = segments.map((segment) => {
    const points = computePathPoints(segment.days)
    const originX = points[0]?.x ?? 0
    return {
      ...segment,
      points: points.map((p, i) => ({ x: p.x - originX, y: i * DAY_SPACING_PX })),
    }
  })

  const maxLen = Math.max(1, ...normalized.map((s) => s.points.length))
  const maxAbsX = Math.max(1, ...normalized.flatMap((s) => s.points.map((p) => Math.abs(p.x))))

  return (
    <div className="flex flex-col gap-2">
      <svg width="100%" height={height} viewBox={`${-maxAbsX - 30} 0 ${2 * (maxAbsX + 30)} ${maxLen * DAY_SPACING_PX + 40}`}>
        {normalized.map((segment) => (
          <g key={segment.label}>
            <polyline
              points={segment.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={segment.color}
              strokeWidth={3}
              opacity={0.9}
            />
            {segment.points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={DAY_CIRCLE_RADIUS * 0.5} fill={segment.color} />
            ))}
          </g>
        ))}
      </svg>
      <div className="flex justify-center gap-4 text-xs text-text-secondary">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export type { Segment as PathComparisonSegment }
