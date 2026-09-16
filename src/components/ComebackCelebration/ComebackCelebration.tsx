import { useNavigate } from 'react-router-dom'
import { dayWord, formatShortDate } from '../../domain/calendar'
import { comebackRank, type Comeback, type ComebackDay } from '../../domain/comeback'
import type { ColorTier } from '../../domain/models'
import ReviewScreen, { type ReviewTileData } from '../ReviewScreen'

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

const RADIUS = 13
const RISE = 17
const VIEW_W = 330
const VIEW_H = 128

/**
 * The stretch that fell and climbed, drawn as the road drew it.
 *
 * This is the screen's whole reason to exist. «Спад 5 дней, вверх 3 дня» is the same fact, and it
 * shows nothing: the shape is what the person recognises, because it is the shape they have been
 * looking at on the path all week. Height is integrated from each day's own direction rather than
 * from its colour — the two answer different questions, and a drawing that dipped on a green day
 * the road had climbed on would be arguing with the road.
 */
function ComebackHero({ shape }: { shape: ComebackDay[] }) {
  const levels = heightsOf(shape)

  // Normalised to the box rather than scaled by a constant: a 3-day dip and a 9-day dip must both
  // fill the drawing, or the deeper slump looks like the smaller one on a taller graph.
  const low = Math.min(...levels)
  const high = Math.max(...levels)
  const span = high - low || 1
  const step = (VIEW_W - 2 * (RADIUS + 9)) / Math.max(1, shape.length - 1)
  const points = shape.map((day, i) => ({
    day,
    x: RADIUS + 9 + i * step,
    y: VIEW_H - 34 - ((levels[i] - low) / span) * (RISE * 2.6),
  }))

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      style={{ maxWidth: VIEW_W, height: 'auto' }}
      role="presentation"
      aria-hidden="true"
    >
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="var(--color-surface-raised)"
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <g key={p.day.date}>
          <circle cx={p.x} cy={p.y + 3} r={RADIUS} fill={TIER_FILL[p.day.tier].plinth} />
          <circle cx={p.x} cy={p.y} r={RADIUS} fill={TIER_FILL[p.day.tier].fill} />
          {/* Only the last slot is labelled. Nine dates under nine circles is a table, and the one
              date that matters here is the day the person is standing on. */}
          {i === points.length - 1 && (
            <text x={p.x} y={VIEW_H - 4} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--color-text-muted)">
              {formatShortDate(p.day.date)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

/**
 * Shown once, on the mark that confirmed the return. Built on the same shell as the week summary
 * because it is the same kind of moment — the road stopping to say what just happened — and a
 * comeback shown in a smaller frame than a week would say it mattered less.
 */
export default function ComebackCelebration({ comeback, onClose }: { comeback: Comeback; onClose: () => void }) {
  const navigate = useNavigate()
  const rank = comebackRank(comeback.ordinal)

  const tiles: ReviewTileData[] = [
    { label: 'Спад', value: `${comeback.slumpLength} ${dayWord(comeback.slumpLength)}`, color: 'var(--color-day-red)' },
    { label: 'Вверх', value: `${comeback.returnLength} ${dayWord(comeback.returnLength)}`, color: 'var(--color-day-green)' },
    // The ordinal, never the rank: the rank is already the title, and a tile repeating the title
    // word for word is a third of the row spent saying nothing new.
    { label: 'Возвращение', value: `${comeback.ordinal}-е`, color: 'var(--color-day-green)' },
  ]

  return (
    <ReviewScreen
      tone="dark"
      eyebrow="Возвращение"
      title={rank ? `Ты вернулся. ${rank}` : 'Ты вернулся'}
      subtitle={`${formatShortDate(comeback.slumpStart)} — ${formatShortDate(comeback.confirmedDate)}`}
      hero={<ComebackHero shape={comeback.shape} />}
      tiles={tiles}
      note="Считается не то, что ты не падал. Считается, что ты возвращаешься."
      primaryLabel="Идти дальше"
      onPrimary={onClose}
      secondaryLabel="Открыть статистику"
      onSecondary={() => {
        onClose()
        navigate('/stats')
      }}
    />
  )
}
