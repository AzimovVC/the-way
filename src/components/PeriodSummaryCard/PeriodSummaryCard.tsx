import type { ReactNode } from 'react'
import { daysWord, type PeriodSummary } from '../../domain/analytics'
import { formatShortDate } from '../../domain/calendar'
import Icon, { type IconName } from '../Icon'

const TREND: Record<PeriodSummary['trend'], { icon: IconName; color: string; label: string }> = {
  improving: { icon: 'trending-up', color: 'var(--color-day-green)', label: 'Идёшь лучше' },
  declining: { icon: 'trending-down', color: 'var(--color-day-red)', label: 'Идёшь слабее' },
  stable: { icon: 'minus', color: 'var(--color-text-muted)', label: 'Без больших перемен' },
}

/**
 * The line the screen leads with.
 *
 * Everything below it explains this one: how the period went, which way it is moving, where it
 * last broke. A statistics screen that opens with seven equal blocks makes the person do this
 * work themselves, and most of them will not.
 *
 * The hero figure is gold days out of days that were actually asked — excused days are named
 * separately rather than folded in, because counting a planned day off as a miss, or as a win,
 * would both be lies.
 *
 * The two halves are printed beside the verdict rather than kept for the «?». «Без больших
 * перемен» over 82% and 91% reads as a blind app until the numbers are there; a witness that fits
 * on the line belongs on the line, not behind a tap.
 */
export default function PeriodSummaryCard({
  summary,
  periodLabel,
  info,
}: {
  summary: PeriodSummary
  periodLabel: string
  /** The «?» for this block, sat beside the period label. */
  info?: ReactNode
}) {
  const trend = TREND[summary.trend]
  const halves = summary.earlyRate > 0 || summary.lateRate > 0

  return (
    <div className="sk-card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="sk-eyebrow">{periodLabel}</p>
        {info}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="sk-num text-[44px] leading-none font-semibold text-text-primary">{summary.goldDays}</span>
        <span className="text-[15px] text-text-secondary">золотых дней из {summary.askedDays}</span>
      </div>

      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <Icon name={trend.icon} size={16} color={trend.color} />
        </span>
        <p className="text-[15px] text-text-secondary">
          {trend.label}
          {halves && `: было ${percent(summary.earlyRate)}, стало ${percent(summary.lateRate)}`}
        </p>
      </div>

      <p className="text-[13px] text-text-muted">
        {summary.currentGoldStreak > 0
          ? `Сейчас ${summary.currentGoldStreak} ${daysWord(summary.currentGoldStreak)} подряд. `
          : 'Серии сейчас нет. '}
        {summary.lastMissDate && `Последний неполный день: ${formatShortDate(summary.lastMissDate)}. `}
        {summary.restDays > 0 && `${summary.restDays} ${daysWord(summary.restDays)} не в счёт.`}
      </p>
    </div>
  )
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}
