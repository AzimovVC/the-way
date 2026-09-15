import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildCalendar } from '../../domain/calendar'
import type { ColorTier, Day } from '../../domain/models'
import { WEEKDAY_LABELS } from '../../domain/schedule'
import Icon from '../Icon'
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
  /** The «?» for this block. It rides in the legend row, which is the one row with space for it. */
  info?: ReactNode
  onDaySelect: (day: Day, anchor: PopoverAnchor) => void
}

/**
 * The period as a calendar, not as a road.
 *
 * The road on the home screen answers «куда я иду»; here the question is «какие дни выпали», and
 * for that a month has to be readable week against week — which needs the seven columns to mean
 * the seven weekdays. Laid out Monday first, like the schedule picker: the same Tuesday must sit
 * in the same place on both screens.
 *
 * Months are pages, not a stack. A year stacked vertically is three thousand pixels that bury
 * everything under it; swiped sideways it costs one screen, so the whole period stays here and
 * the filter above means what it says. The pager opens on the most recent month, because that is
 * the one being asked about.
 */
export default function MonthGrid({ days, todayDayId, info, onDaySelect }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const currentYear = new Date().getFullYear()
  const months = useMemo(() => buildCalendar(days, currentYear), [days, currentYear])
  const [index, setIndex] = useState(0)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const [trackHeight, setTrackHeight] = useState<number | undefined>(undefined)

  // A key for a colour that is not on this screen sends the reader looking for it.
  const legend = useMemo(() => {
    const present = new Set(days.map((d) => d.colorTier))
    return LEGEND.filter((item) => present.has(item.tier))
  }, [days])

  /**
   * Which page we are on, and how tall the track has to be for it — both read off the scroll
   * position, which is the only thing that knows where a finger left us.
   *
   * Months are of different lengths and a flex row is as tall as its tallest child, so a
   * five-week August left two hundred empty pixels under a three-week September. Between two
   * pages the track takes the taller of the two: the incoming month must be whole before it
   * arrives, and the track is clipped, so a row short of height would simply be cut off.
   */
  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el || el.clientWidth === 0 || months.length === 0) return
    // overflow-y: hidden stops a finger, but not a programmatic scroll — and focus moving to a day
    // on a clipped page would scroll the grid out of its own box and leave it there.
    if (el.scrollTop !== 0) el.scrollTop = 0
    const clamp = (i: number) => Math.max(0, Math.min(months.length - 1, i))
    const pos = el.scrollLeft / el.clientWidth
    const lo = clamp(Math.floor(pos))
    const hi = clamp(Math.ceil(pos))
    // Rounded up from the fractional rect, not offsetHeight: cells are squares of a seventh of the
    // width, so a page is 170.16px tall and the integer 170 cuts the bottom row's rounded corners off.
    const pageHeight = (i: number) => Math.ceil(pageRefs.current[i]?.getBoundingClientRect().height ?? 0)
    const height = Math.max(pageHeight(lo), pageHeight(hi))
    if (height > 0) setTrackHeight(height)
    setIndex(clamp(Math.round(pos)))
  }, [months.length])

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth
    measure()
    // A rotation changes both the page width and every cell's height; nothing else tells us.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, months])

  /** The tapped cell's centre in the grid's own coordinates — the screen moves it into the frame. */
  const anchorOf = (el: HTMLElement): PopoverAnchor => {
    const root = rootRef.current
    const r = el.getBoundingClientRect()
    const b = root?.getBoundingClientRect() ?? r
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, radius: r.height / 2 }
  }

  /**
   * The buttons only scroll; the index comes back from onScroll. Setting it here as well fought
   * the smooth scroll still in flight — every frame of it reported the old page and snapped the
   * title back — so the scroll position stays the single source of truth for which page we are on.
   */
  const go = (delta: number) => {
    const el = trackRef.current
    if (!el) return
    const next = Math.min(months.length - 1, Math.max(0, index + delta))
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }


  if (months.length === 0) return null

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <PagerButton dir="left" disabled={index === 0} onClick={() => go(-1)} />
        <span className="sk-eyebrow">{months[index]?.title}</span>
        <PagerButton dir="right" disabled={index >= months.length - 1} onClick={() => go(1)} />
      </div>

      <div
        ref={trackRef}
        onScroll={measure}
        className="hide-scrollbar flex snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden"
        style={{ height: trackHeight, transition: 'height var(--dur-slow) var(--ease-out)' }}
      >
        {months.map((month, page) => (
          <div
            key={month.key}
            ref={(el) => {
              pageRefs.current[page] = el
            }}
            className="w-full shrink-0 snap-center"
          >
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
                      // A 2px ring of clear ground and then the marker, the same way an overlapping
                      // marker is separated from what it sits on — but drawn inward. An outward halo
                      // is invisible to every height measurement there is, so the track, which is
                      // clipped to the page, cut it off whenever today fell in the last row or the
                      // first column. The ground is the page's own background, the colour already
                      // showing in every gap between cells, so the ring reads as a gap and not as
                      // a second stroke.
                      boxShadow: isToday
                        ? 'inset 0 0 0 2px var(--color-bg), inset 0 0 0 4px var(--color-text-primary)'
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
      </div>

      <div className="flex items-center justify-between gap-3">
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
        {info}
      </div>
    </div>
  )
}

function PagerButton({ dir, disabled, onClick }: { dir: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? 'Предыдущий месяц' : 'Следующий месяц'}
      className="sk-focus flex size-8 items-center justify-center rounded-full disabled:opacity-30"
      style={{ boxShadow: 'inset 0 0 0 1px var(--color-border)' }}
    >
      <Icon name={dir === 'left' ? 'chevron-left' : 'chevron-right'} size={16} color="var(--color-text-secondary)" />
    </button>
  )
}
