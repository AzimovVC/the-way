import { formatLongDate } from '../../domain/calendar'
import type { DayReview } from '../../domain/review'
import { WEEKDAY_LABELS, weekdayIndex } from '../../domain/schedule'
import { ICON_PATH_D } from '../Icon'
import ReviewScreen, { type ReviewTileData } from '../ReviewScreen'

/** A four-point star at the origin, 24×24 like every other glyph here. */
const SPARKLE_D = 'M12 2c.6 5 4 8.4 9 9-5 .6-8.4 4-9 9-.6-5-4-8.4-9-9 5-.6 8.4-4 9-9z'

/** Kept clear of the circle and of the road — a star touching either reads as a smudge on them. */
const SPARKLES = [
  { x: 200, y: 14, size: 1, opacity: 0.9 },
  { x: 292, y: 84, size: 0.7, opacity: 0.45 },
  { x: 176, y: 24, size: 0.5, opacity: 0.35 },
]

/**
 * The day's own piece of road, ending in the circle that was just closed.
 *
 * Drawn rather than photographed from the path screen: this is the same shape, but it has to read
 * at a glance from across a phone, and the real road at this size is a thread. The circles behind
 * it are the days before — they are what makes the last one an arrival instead of a dot.
 */
function DayHero() {
  return (
    <svg width={300} height={170} viewBox="0 0 300 170" role="presentation" aria-hidden="true">
      <path
        d="M14 154 C 69 154, 99 136, 129 107 S 194 45, 247 45"
        fill="none"
        stroke="var(--ink-950)"
        strokeOpacity={0.16}
        strokeWidth={18}
        strokeLinecap="round"
      />
      {[
        { x: 39, y: 151 },
        { x: 83, y: 140 },
        { x: 122, y: 112 },
        { x: 168, y: 72 },
      ].map((c) => (
        <circle key={c.x} cx={c.x} cy={c.y} r={10} fill="var(--marigold-700)" />
      ))}

      {/* The day itself: ink, so the one circle that is about today is the one thing on a gold
          field that gold cannot hide. */}
      <circle cx={247} cy={45} r={36} fill="var(--ink-950)" />
      <g transform="translate(247 45) scale(1.7) translate(-12 -12)">
        <path
          d={ICON_PATH_D.check}
          fill="none"
          stroke="var(--color-day-gold)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {SPARKLES.map((s) => (
        <path
          key={`${s.x}-${s.y}`}
          d={SPARKLE_D}
          fill="var(--ink-950)"
          fillOpacity={s.opacity}
          transform={`translate(${s.x} ${s.y}) scale(${s.size}) translate(-12 -12)`}
        />
      ))}
    </svg>
  )
}

/**
 * Shown at the moment the last task of the day is marked — never on the next open, and never for
 * a day that came up short. See the note at the top of domain/review.ts for why that asymmetry is
 * deliberate.
 */
export default function DayReviewScreen({ review, onClose }: { review: DayReview; onClose: () => void }) {
  const tiles: ReviewTileData[] = [
    { label: 'Задачи', value: `${review.taskCount} из ${review.taskCount}`, color: 'var(--color-day-green)' },
    { label: 'Серия', value: `${review.goldStreak}`, color: 'var(--color-streak-flame)' },
    {
      label: 'На неделе',
      value: `${review.goldDaysThisWeek} из ${review.judgedDaysThisWeek}`,
      color: 'var(--color-day-gold)',
    },
  ]

  return (
    <ReviewScreen
      tone="gold"
      eyebrow={`${WEEKDAY_LABELS[weekdayIndex(review.date)]} · ${formatLongDate(review.date)}`}
      title="Золотой день"
      subtitle="Всё, о чём день просил, сделано."
      hero={<DayHero />}
      tiles={tiles}
      note={review.note}
      primaryLabel="Идти дальше"
      onPrimary={onClose}
    />
  )
}
