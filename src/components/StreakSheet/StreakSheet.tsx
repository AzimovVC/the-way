import { useMemo } from 'react'
import { dayWord, formatLongDate } from '../../domain/calendar'
import { findComebacks } from '../../domain/comeback'
import type { Day } from '../../domain/models'
import { streakHighlight, streakOverview } from '../../domain/streak'
import ComebackShelf from '../ComebackShelf'
import Icon from '../Icon'
import StreakCalendar from '../StreakCalendar'

interface Props {
  days: Day[]
  todayDayId?: string
  onClose: () => void
}

/**
 * The streak, opened from the flame in the header.
 *
 * The chip states one number and the road states the shape of the whole history; between them
 * there was nowhere to see the stretch itself — where it started, which days it stepped over, how
 * it stands against the longest one walked. That is this screen, and it holds nothing the state
 * does not already know: every number here is read off `days`.
 *
 * There is no ladder of streak steps and no target to reach. Ranks are the app's one ladder and
 * they belong to a habit; the streak's only mark is the longest stretch the person has already
 * lived, which is a target nobody else set for them. Nor is there an empty rung saying how far
 * they have not got — the app has no dark half, and this screen least of all.
 */
export default function StreakSheet({ days, todayDayId, onClose }: Props) {
  const overview = useMemo(() => streakOverview(days), [days])
  const comebacks = useMemo(() => findComebacks(days), [days])
  const highlight = streakHighlight(overview)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Серия"
      className="sk-rise absolute inset-0 z-40 flex flex-col bg-bg"
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="sk-press sk-focus flex h-10 w-10 items-center justify-center rounded-full"
        >
          <Icon name="x" size={22} color="var(--color-text-secondary)" />
        </button>
        <span className="sk-heading flex-1 pr-10 text-center text-[17px]">Серия</span>
      </div>

      <div className="hide-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-8">
        {/* The count and the fact about it share one block in the streak's own colour: the flame
            in the header is the same colour, so the screen reads as that chip opened up. */}
        <div
          className="flex items-center gap-4 rounded-[20px] px-5 py-4"
          style={{ backgroundColor: 'var(--color-streak-flame)' }}
        >
          <Icon name="flame" size={44} color="var(--ink-950)" />
          <div className="flex min-w-0 flex-col">
            <span className="sk-num text-[34px] leading-none font-semibold" style={{ color: 'var(--ink-950)' }}>
              {overview.current}
            </span>
            <span className="text-[14px] font-semibold" style={{ color: 'rgba(0,0,0,.65)' }}>
              {dayWord(overview.current)} подряд
            </span>
          </div>
        </div>

        <p className="text-[15px] text-text-secondary">{highlight}</p>

        <StreakCalendar days={days} runs={overview.runs} todayDayId={todayDayId} />

        {/* Nothing to record yet is not a record of nothing: a shelf of zeroes on the first day is
            the empty rung this app does not have. */}
        {overview.totalGoldDays > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="sk-eyebrow">Записи</h2>
            <div className="grid grid-cols-2 gap-2">
              <Record value={overview.best} label="самая длинная серия" color="var(--color-streak-flame)" />
              <Record value={overview.totalGoldDays} label="золотых дней всего" color="var(--color-day-gold)" />
            </div>
            {overview.currentStartDate && (
              <p className="text-[13px] text-text-muted">Серия идёт с {formatLongDate(overview.currentStartDate)}.</p>
            )}
          </section>
        )}

        {comebacks.length > 0 && (
          <section className="flex flex-col gap-3">
            {/* The one thing a streak that never broke cannot have. It stands here rather than only
                on the profile because this is the screen where a broken stretch is being looked at,
                and it is the answer to what came of the last one. */}
            <h2 className="sk-eyebrow">Возвращения</h2>
            <div onClick={onClose}>
              <ComebackShelf comebacks={comebacks} />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Record({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="sk-card-nested flex flex-col gap-1">
      <span className="sk-num text-[24px] leading-none font-semibold" style={{ color }}>
        {value}
      </span>
      <span className="text-[12px] text-text-muted">{label}</span>
    </div>
  )
}
