import { useMemo, useState } from 'react'
import { buildCalendar } from '../../domain/calendar'
import type { Day } from '../../domain/models'
import { WEEKDAY_LABELS } from '../../domain/schedule'
import { streakIndex, type StreakRun } from '../../domain/streak'
import Icon from '../Icon'

interface Props {
  days: Day[]
  runs: StreakRun[]
  todayDayId?: string
}

/**
 * The month with the streak drawn through it as one line.
 *
 * [MonthGrid](../MonthGrid/MonthGrid.tsx) answers a different question — what colour each day came
 * out — and paints every cell for it. Here the question is the shape of the stretch, so a day that
 * is not part of one stays plain ground: a grid where everything is coloured has nothing left to
 * say which days belong together.
 *
 * The line runs straight through a rest day or a freeze, which is the rule `isDayExcused` states in
 * the one place a person will go looking for it. Those days sit on the line without a disc of their
 * own — they did not add to the count, and a filled circle would say they did.
 *
 * One month per page with arrows, rather than the swipe track next door: this grid draws a run that
 * crosses a month edge, and a half-shown neighbouring page would cut such a run in two mid-gesture.
 */
export default function StreakCalendar({ days, runs, todayDayId }: Props) {
  const currentYear = new Date().getFullYear()
  const months = useMemo(() => buildCalendar(days, currentYear), [days, currentYear])
  const index = useMemo(() => streakIndex(runs), [runs])
  const [page, setPage] = useState(() => Math.max(0, months.length - 1))

  if (months.length === 0) return null

  const month = months[Math.min(page, months.length - 1)]

  return (
    <div className="sk-card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <PagerButton dir="left" disabled={page === 0} onClick={() => setPage((p) => p - 1)} />
        <span className="sk-heading text-[17px]">{month.title}</span>
        <PagerButton dir="right" disabled={page >= months.length - 1} onClick={() => setPage((p) => p + 1)} />
      </div>

      {/* No column gap: the cells touch, so the bar under a run is continuous without anything
          being drawn between them. The row gap keeps two runs a week apart from reading as one. */}
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="pb-1 text-center text-[10px] font-bold text-text-muted">
            {label}
          </span>
        ))}

        {month.weeks.flat().map((cell, i) => {
          if (!cell.date) return <span key={`pad-${month.key}-${i}`} aria-hidden className="aspect-square" />

          const mark = index.get(cell.date)
          const column = i % 7
          // Where the bar has to stop: the neighbouring date is read rather than the run's own
          // ends, because a run also stops at the edge of a row and at the edge of a month, and
          // both of those are days the run holds but this grid cannot draw a line to.
          const reaches = (delta: number) => {
            const neighbour = shiftDate(cell.date!, delta)
            return neighbour.slice(0, 7) === month.key && index.has(neighbour)
          }
          const roundLeft = !mark || column === 0 || !reaches(-1)
          const roundRight = !mark || column === 6 || !reaches(1)
          const isToday = cell.day?.id === todayDayId

          return (
            <div key={cell.date} className="relative flex aspect-square items-center justify-center">
              {mark && (
                <span
                  aria-hidden
                  className="absolute inset-y-[22%] inset-x-0"
                  style={{
                    backgroundColor: 'var(--marigold-tint)',
                    borderTopLeftRadius: roundLeft ? 999 : 0,
                    borderBottomLeftRadius: roundLeft ? 999 : 0,
                    borderTopRightRadius: roundRight ? 999 : 0,
                    borderBottomRightRadius: roundRight ? 999 : 0,
                  }}
                />
              )}
              <span
                className="sk-num relative flex h-[74%] w-[74%] items-center justify-center rounded-full text-[13px] font-semibold"
                style={cellStyle(mark?.kind, Boolean(cell.day), isToday)}
              >
                {cell.dayOfMonth}
              </span>
            </div>
          )
        })}
      </div>

      {/* Said only where it is visible. On a history with no day off yet it explains a mark that
          is not on the screen, which reads as a rule the person has already broken. */}
      {runs.some((run) => run.bridgedDates.length > 0) && (
        <p className="text-[12px] text-text-muted">
          Линия идёт через выходные и заморозки: такой день ничего не спрашивал и серию не прерывает.
        </p>
      )}
    </div>
  )
}

/**
 * A gold day wears the streak's colour as a filled disc; a bridged day only stands on the line.
 * A day outside every stretch is left as plain ground — and a date the history does not cover is
 * dimmer still, because it is not a miss, it is time this road has not walked.
 */
function cellStyle(kind: 'gold' | 'bridged' | undefined, covered: boolean, isToday: boolean) {
  const ring = isToday ? 'inset 0 0 0 2px var(--color-text-primary)' : undefined

  if (kind === 'gold') {
    return {
      backgroundColor: 'var(--color-day-gold)',
      color: 'var(--ink-950)',
      boxShadow: isToday ? 'inset 0 0 0 2px var(--color-bg), inset 0 0 0 4px var(--color-text-primary)' : undefined,
    }
  }
  if (kind === 'bridged') {
    return { color: 'var(--color-day-rest)', boxShadow: ring }
  }
  return { color: covered ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', opacity: covered ? 1 : 0.5, boxShadow: ring }
}

/** Neighbouring calendar date. Parsed at UTC midnight, like every other date key in the app. */
function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

function PagerButton({ dir, disabled, onClick }: { dir: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Предыдущий месяц' : 'Следующий месяц'}
      className="sk-press sk-focus flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised disabled:opacity-35"
    >
      <Icon name={dir === 'left' ? 'chevron-left' : 'chevron-right'} size={18} color="var(--color-text-secondary)" />
    </button>
  )
}
