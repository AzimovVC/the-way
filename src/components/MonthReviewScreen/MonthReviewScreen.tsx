import { useNavigate } from 'react-router-dom'
import { buildCalendar, formatMonthTitle } from '../../domain/calendar'
import type { ColorTier, Day } from '../../domain/models'
import type { MonthReview } from '../../domain/monthReview'
import { WEEKDAY_LABELS } from '../../domain/schedule'
import ReviewScreen, { type ReviewTileData } from '../ReviewScreen'

/** The same pairing the path and the calendar use — a colour must not change between screens. */
const TIER_FILL: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold)',
  green: 'var(--color-day-green)',
  red: 'var(--color-day-red)',
  gray: 'var(--color-day-gray)',
  rest: 'var(--color-day-rest)',
}

/**
 * The month as a calendar, not as a road.
 *
 * Thirty circles in a line is what the week's hero would become at month scale, and at 390px each
 * one lands under thirteen pixels — a smear, not a shape. The point of a month is which days fell
 * where, and that needs the seven columns to mean the seven weekdays: it is the only way the
 * sentence below it, about a weekday, can be checked by eye.
 *
 * Static on purpose. The grid on the statistics screen opens a day card on tap; here a tap would
 * put a card over the screen the person opened deliberately, and the road behind it is where days
 * are opened.
 */
function MonthHero({ days, monthKey }: { days: Day[]; monthKey: string }) {
  const month = buildCalendar(days).find((m) => m.key === monthKey)
  if (!month) return null

  return (
    <div className="w-full max-w-[300px]">
      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="text-center text-[10px] font-semibold text-text-muted">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {month.weeks.flat().map((cell, i) => (
          <div
            key={cell.date ?? `pad-${i}`}
            className="aspect-square rounded-[7px]"
            style={{
              backgroundColor: cell.day ? TIER_FILL[cell.day.colorTier] : 'transparent',
              // A date the history does not hold keeps its square rather than closing the grid up:
              // the gaps are half of what a calendar is for.
              border: cell.date && !cell.day ? '1.5px solid var(--color-border)' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}

/**
 * What the halves say, in one sentence with both numbers in it.
 *
 * Never the verdict alone. «Обе половины прошли одинаково» over 62% and 91% reads as a blind app
 * until the pair is beside it, and the person cannot tell a threshold from a mistake.
 */
function halvesLine(review: MonthReview): string | null {
  if (!review.hasHalves) return null
  // Identical halves have nothing to resolve: on a month without a single miss the pair can only be
  // «100% и 100%», which is the tile above repeated twice and dressed as a finding.
  if (review.earlyRate === review.lateRate) return null
  const early = percent(review.earlyRate)
  const late = percent(review.lateRate)
  if (review.trend === 'improving') return `Вторая половина месяца сильнее первой: ${late} против ${early}.`
  if (review.trend === 'declining') return `Вторая половина месяца слабее первой: ${late} против ${early}.`
  return `Обе половины месяца прошли одинаково: ${early} и ${late}.`
}

/**
 * The month opened from its badge on the road.
 *
 * It carries the numbers every summary carries, but it exists for the line under them: a weekday
 * held up or did not, and a week has one of each and cannot say so. When the month cannot support
 * that claim the line is simply absent — a month where every day went alike has nothing to report,
 * and naming a weakest weekday anyway would turn an even month into one with a problem.
 */
export default function MonthReviewScreen({
  review,
  days,
  today,
  onClose,
  steps,
}: {
  review: MonthReview
  days: Day[]
  /** Today's date key, so a month of this year is «Сентябрь» and one of a past year keeps its year. */
  today?: string
  onClose: () => void
  steps?: { onPrev: (() => void) | null; onNext: (() => void) | null }
}) {
  const navigate = useNavigate()

  const tiles: ReviewTileData[] = [
    { label: 'Золотых', value: `${review.goldDays} из ${review.judgedDays}`, color: 'var(--color-day-gold)' },
    {
      label: 'Выполнено',
      value: percent(review.completionRate),
      color: 'var(--color-text-primary)',
      border: 'var(--color-border)',
    },
  ]
  // Only when there were any. «Не в счёт 0» is a third of the row spent on nothing, and the grid
  // gives the two real numbers the whole width instead.
  if (review.restDays > 0) {
    tiles.push({
      label: 'Не в счёт',
      value: `${review.restDays}`,
      color: 'var(--color-day-rest)',
      border: 'var(--color-border)',
    })
  }

  const halves = halvesLine(review)
  // The weak end carries the witness when both are named: it is the half a person acts on, and the
  // half whose thinness would cost them something.
  const named = review.weakest ?? review.strongest

  return (
    <ReviewScreen
      tone="dark"
      eyebrow="Месяц"
      title={formatMonthTitle(review.key, today ? Number(today.slice(0, 4)) : undefined)}
      hero={<MonthHero days={days} monthKey={review.key} />}
      tiles={tiles}
      note={halves}
      body={named ? (
        <div className="flex max-w-sm flex-col gap-1.5 text-[15px] text-text-secondary">
          {/* Each end speaks only if it is there. Usually that is the weak one alone: in an ordinary
              month several weekdays tie at the top, and the domain reports a tied end as nothing
              rather than picking one and inventing a difference. */}
          <p>
            {[
              review.strongest && `крепче всего ${review.strongest.name.toLowerCase()} — ${percent(review.strongest.rate)}`,
              review.weakest && `слабее всего ${review.weakest.name.toLowerCase()} — ${percent(review.weakest.rate)}`,
            ]
              .filter(Boolean)
              .join(', ')
              .replace(/^./, (c) => c.toUpperCase())}
            .
          </p>
          {/* The witness rides in the line rather than behind a tap: three of a weekday is not yet a
              rule, and somebody about to move their run on this deserves to see how thin the ground
              is while they read the claim. Named rather than «таких дней», which points at whichever
              of the two weekdays the reader happened to hold in mind. */}
          <p className="text-text-muted">
            {named.countedName} в месяце было {named.sampleCount}. Это наблюдение, а не причина.
          </p>
        </div>
      ) : undefined}
      primaryLabel="Закрыть"
      onPrimary={onClose}
      steps={
        steps && (steps.onPrev || steps.onNext)
          ? { onPrev: steps.onPrev, onNext: steps.onNext, prevLabel: 'Месяц раньше', nextLabel: 'Месяц позже' }
          : undefined
      }
      secondaryLabel="Открыть статистику"
      onSecondary={() => {
        onClose()
        navigate('/stats')
      }}
    />
  )
}
