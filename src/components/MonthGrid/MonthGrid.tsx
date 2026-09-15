import { useMemo, useRef } from 'react'
import { buildCalendar, monthsWord } from '../../domain/calendar'
import type { ColorTier, Day } from '../../domain/models'
import { WEEKDAY_LABELS } from '../../domain/schedule'
import type { PopoverAnchor } from '../NodePopover'

const TIER_COLOR: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold)',
  green: 'var(--color-day-green)',
  red: 'var(--color-day-red)',
  gray: 'var(--color-day-gray)',
  rest: 'var(--color-day-rest)',
}

const TIER_INK: Record<ColorTier, string> = {
  gold: 'var(--ink-950)',
  green: 'var(--ink-950)',
  red: 'var(--ink-950)',
  gray: 'var(--color-text-secondary)',
  rest: 'var(--color-text-primary)',
}

/**
 * Named, in this order, because colour alone must not be the only thing carrying the meaning.
 * Rest is the pair the validator flags for contrast (2.6:1 against the surface) — the relief is
 * exactly this: every cell also shows its date, and every tier is spelled out here.
 */
const LEGEND: { tier: ColorTier; label: string }[] = [
  { tier: 'gold', label: 'всё' },
  { tier: 'green', label: 'часть' },
  { tier: 'red', label: 'мимо' },
  { tier: 'rest', label: 'выходной' },
  { tier: 'gray', label: 'не в счёт' },
]

interface Props {
  days: Day[]
  todayDayId?: string
  /**
   * Most recent months to draw. A year of calendars is three thousand pixels of scrolling that
   * buries everything under it, so long periods keep the summary and the bars and show the
   * calendar for the months a person can still remember — and the grid says so out loud rather
   * than quietly disagreeing with the filter above it.
   */
  maxMonths?: number
  onDaySelect: (day: Day, anchor: PopoverAnchor) => void
}

/**
 * The period as a calendar, not as a road.
 *
 * The road on the home screen answers «куда я иду»; here the question is «какие дни выпали», and
 * for that a month has to be readable week against week — which needs the seven columns to mean
 * the seven weekdays. Laid out Monday first, like the schedule picker: the same Tuesday must sit
 * in the same place on both screens.
 */
export default function MonthGrid({ days, todayDayId, maxMonths, onDaySelect }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const currentYear = new Date().getFullYear()
  const all = useMemo(() => buildCalendar(days, currentYear), [days, currentYear])
  const months = maxMonths ? all.slice(-maxMonths) : all
  // A key for a colour that is not on this screen sends the reader looking for it.
  const legend = useMemo(() => {
    const present = new Set(days.map((d) => d.colorTier))
    return LEGEND.filter((item) => present.has(item.tier))
  }, [days])

  /** The tapped cell's centre in the grid's own coordinates — the screen moves it into the frame. */
  const anchorOf = (el: HTMLElement): PopoverAnchor => {
    const root = rootRef.current
    const r = el.getBoundingClientRect()
    const b = root?.getBoundingClientRect() ?? r
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, radius: r.height / 2 }
  }

  if (months.length === 0) return null

  return (
    <div ref={rootRef} className="flex flex-col gap-5">
      {months.length < all.length && (
        <p className="text-[12px] text-text-muted">
          Календарь показывает последние {months.length} {monthsWord(months.length)}
        </p>
      )}
      {months.map((month) => (
        <div key={month.key} className="flex flex-col gap-2">
          <p className="sk-eyebrow">{month.title}</p>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="text-center text-[10px] font-bold text-text-muted">
                {label}
              </span>
            ))}

            {month.weeks.flat().map((cell, i) => {
              if (!cell.date) return <span key={`pad-${month.key}-${i}`} aria-hidden />

              const day = cell.day
              if (!day) {
                // A date the history does not cover — before the first day, or still ahead.
                return (
                  <span
                    key={cell.date}
                    className="flex aspect-square items-center justify-center rounded-[8px] text-[11px] text-text-muted/60"
                    style={{ boxShadow: 'inset 0 0 0 1px var(--color-border)' }}
                  >
                    {cell.dayOfMonth}
                  </span>
                )
              }

              const isToday = day.id === todayDayId
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={(e) => onDaySelect(day, anchorOf(e.currentTarget))}
                  aria-label={`${cell.dayOfMonth} ${month.title}`}
                  className="sk-focus flex aspect-square items-center justify-center rounded-[8px] text-[11px] font-bold"
                  style={{
                    backgroundColor: TIER_COLOR[day.colorTier],
                    color: TIER_INK[day.colorTier],
                    // A 2px surface ring, not a border: today is marked by clear ground around it,
                    // the same way an overlapping marker is separated from what it sits on.
                    boxShadow: isToday
                      ? '0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-text-primary)'
                      : undefined,
                  }}
                >
                  {cell.dayOfMonth}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {legend.map((item) => (
          <li key={item.tier} className="flex items-center gap-1.5 text-[12px] text-text-muted">
            <span
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: TIER_COLOR[item.tier] }}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
