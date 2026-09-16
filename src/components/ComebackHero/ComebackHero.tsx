import { formatShortDate } from '../../domain/calendar'
import type { ComebackDay } from '../../domain/comeback'
import type { ColorTier } from '../../domain/models'

/** The day colours with the shade each rests on — the same pairing the path and the week use. */
const TIER_FILL: Record<ColorTier, { fill: string; plinth: string }> = {
  gold: { fill: 'var(--color-day-gold)', plinth: 'var(--color-day-gold-plinth)' },
  green: { fill: 'var(--color-day-green)', plinth: 'var(--color-day-green-plinth)' },
  red: { fill: 'var(--color-day-red)', plinth: 'var(--color-day-red-plinth)' },
  gray: { fill: 'var(--color-day-gray)', plinth: 'var(--color-day-gray-plinth)' },
  rest: { fill: 'var(--color-day-rest)', plinth: 'var(--color-day-rest-plinth)' },
}

/** Each day's height, integrated from the directions before it — outside the component, so the
 *  running total is never a value left over from a previous render. */
function heightsOf(shape: ComebackDay[]): number[] {
  const levels: number[] = []
  let level = 0
  for (const day of shape) {
    level += day.direction
    levels.push(level)
  }
  return levels
}

/**
 * Two sizes of the same drawing. `hero` is the celebration screen; `inline` is the card in the
 * feed, where the stretch is one item in a scrolling list rather than the whole screen — so it
 * loses the date label and half its height, and keeps everything that makes it recognisable.
 */
const SIZES = {
  hero: { radius: 13, viewW: 330, viewH: 128, rise: 17 * 2.6, baseline: 34, showDate: true },
  inline: { radius: 8, viewW: 300, viewH: 66, rise: 26, baseline: 14, showDate: false },
} as const

export type ComebackHeroSize = keyof typeof SIZES

/**
 * The stretch that fell and climbed, drawn as the road drew it.
 *
 * This is the comeback screen's whole reason to exist. «Спад 5 дней, вверх 3 дня» is the same fact,
 * and it shows nothing: the shape is what the person recognises, because it is the shape they have
 * been looking at on the path all week. Height is integrated from each day's own direction rather
 * than from its colour — the two answer different questions, and a drawing that dipped on a green
 * day the road had climbed on would be arguing with the road.
 *
 * It lives in its own file because the feed shows the same stretch again, later. A second copy of
 * this drawing would one day disagree with the first about what the road did.
 */
export default function ComebackHero({
  shape,
  size = 'hero',
  // The road under the circles has to be lighter than whatever it is drawn on, and the two places
  // this appears sit on different grounds: the celebration's dark screen, and a raised card in the
  // feed. Passed in rather than guessed from `size`, so a third place cannot inherit the wrong one
  // and lose the road entirely — which is exactly what a matching colour does: the circles stay,
  // the road between them disappears, and the shape stops being a road.
  track = 'var(--color-surface-raised)',
}: {
  shape: ComebackDay[]
  size?: ComebackHeroSize
  track?: string
}) {
  const { radius, viewW, viewH, rise, baseline, showDate } = SIZES[size]
  const levels = heightsOf(shape)

  // Normalised to the box rather than scaled by a constant: a 3-day dip and a 9-day dip must both
  // fill the drawing, or the deeper slump looks like the smaller one on a taller graph.
  const low = Math.min(...levels)
  const high = Math.max(...levels)
  const span = high - low || 1
  const step = (viewW - 2 * (radius + 9)) / Math.max(1, shape.length - 1)
  const points = shape.map((day, i) => ({
    day,
    x: radius + 9 + i * step,
    y: viewH - baseline - ((levels[i] - low) / span) * rise,
  }))

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      width="100%"
      style={{ maxWidth: viewW, height: 'auto' }}
      role="presentation"
      aria-hidden="true"
    >
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={track}
        strokeWidth={radius * 0.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <g key={p.day.date}>
          <circle cx={p.x} cy={p.y + 3} r={radius} fill={TIER_FILL[p.day.tier].plinth} />
          <circle cx={p.x} cy={p.y} r={radius} fill={TIER_FILL[p.day.tier].fill} />
          {/* Only the last slot is labelled. Nine dates under nine circles is a table, and the one
              date that matters here is the day the person is standing on. */}
          {showDate && i === points.length - 1 && (
            <text x={p.x} y={viewH - 4} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--color-text-muted)">
              {formatShortDate(p.day.date)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
