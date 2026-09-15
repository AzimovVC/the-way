import { useNavigate } from 'react-router-dom'
import { dayWord, formatShortDate } from '../../domain/calendar'
import type { ColorTier } from '../../domain/models'
import type { WeekReview } from '../../domain/review'
import { WEEKDAY_LABELS } from '../../domain/schedule'
import ReviewScreen, { type ReviewTileData } from '../ReviewScreen'

/** The day colours, with the darker shade each one rests on — the same pairing the path uses. */
const TIER_FILL: Record<ColorTier, { fill: string; plinth: string }> = {
  gold: { fill: 'var(--color-day-gold)', plinth: 'var(--color-day-gold-plinth)' },
  green: { fill: 'var(--color-day-green)', plinth: 'var(--color-day-green-plinth)' },
  red: { fill: 'var(--color-day-red)', plinth: 'var(--color-day-red-plinth)' },
  gray: { fill: 'var(--color-day-gray)', plinth: 'var(--color-day-gray-plinth)' },
  rest: { fill: 'var(--color-day-rest)', plinth: 'var(--color-day-rest-plinth)' },
}

const RADIUS = 15
const STEP = 46
const LEFT = 24

/** A gentle climb, Monday low and Sunday high — the road's own shape, read across one week. */
function slotY(index: number): number {
  return 70 + 18 * Math.cos((Math.PI * index) / 6)
}

/**
 * The week as the piece of road it was: seven circles in their real colours, Monday first.
 *
 * This is the whole point of the screen. Five numbers can say the same thing, and none of them
 * shows that the two misses sat side by side on Saturday and Sunday. A day the history has no
 * record for is drawn as an empty ring rather than skipped — the week keeps its seven slots, or
 * a person reads a short week as a full one.
 */
function WeekHero({ shape }: { shape: (ColorTier | null)[] }) {
  const points = shape.map((tier, i) => ({ tier, x: LEFT + i * STEP, y: slotY(i) }))

  return (
    // Fluid, with a ceiling — a fixed width overflows a 320px phone, and the screen scrolls
    // sideways rather than the drawing shrinking.
    <svg
      viewBox="0 0 330 128"
      width="100%"
      style={{ maxWidth: 330, height: 'auto' }}
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
        <g key={p.x}>
          {p.tier === null ? (
            <circle cx={p.x} cy={p.y} r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={2} />
          ) : (
            <>
              <circle cx={p.x} cy={p.y + 3} r={RADIUS} fill={TIER_FILL[p.tier].plinth} />
              <circle cx={p.x} cy={p.y} r={RADIUS} fill={TIER_FILL[p.tier].fill} />
            </>
          )}
          <text
            x={p.x}
            y={120}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="var(--color-text-muted)"
          >
            {WEEKDAY_LABELS[i]}
          </text>
        </g>
      ))}
    </svg>
  )
}

/**
 * Shown once, on the first open after a week has ended. It looks only at the week that is already
 * closed: a summary of the week you are standing in would be a verdict passed halfway through.
 */
export default function WeekReviewScreen({ review, onClose }: { review: WeekReview; onClose: () => void }) {
  const navigate = useNavigate()

  const tiles: ReviewTileData[] = [
    { label: 'Золотых', value: `${review.goldDays} из ${review.judgedDays}`, color: 'var(--color-day-gold)' },
    // Neutral on purpose: green is the colour of a day that came up short, and a percentage is
    // not a day at all. Colour is kept for the two things that own one — gold days and the streak.
    {
      label: 'Выполнено',
      value: `${Math.round(review.completionRate * 100)}%`,
      color: 'var(--color-text-primary)',
      border: 'var(--color-border)',
    },
    { label: 'Серия', value: `${review.goldStreakAtEnd}`, color: 'var(--color-streak-flame)' },
  ]

  const rests = review.restDays > 0 ? `${review.restDays} ${dayWord(review.restDays)} не в счёт.` : null
  const note = [review.note, rests].filter(Boolean).join(' ') || null

  return (
    <ReviewScreen
      tone="dark"
      eyebrow="Итог недели"
      title={review.goldDays === review.judgedDays ? 'Неделя без пропусков' : 'Неделя позади'}
      subtitle={`${formatShortDate(review.start)} — ${formatShortDate(review.end)}`}
      hero={<WeekHero shape={review.shape} />}
      tiles={tiles}
      note={note}
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
