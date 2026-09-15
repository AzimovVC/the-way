import { daysWord, type PeriodSummary } from '../../domain/analytics'
import { formatShortDate } from '../../domain/calendar'
import Icon, { type IconName } from '../Icon'

const TREND: Record<PeriodSummary['trend'], { icon: IconName; color: string; text: (pp: number) => string }> = {
  improving: {
    icon: 'trending-up',
    color: 'var(--color-day-green)',
    text: (pp) => `Вторая половина периода идёт лучше первой — на ${pp} п.п.`,
  },
  declining: {
    icon: 'trending-down',
    color: 'var(--color-day-red)',
    text: (pp) => `Вторая половина периода идёт слабее первой — на ${pp} п.п.`,
  },
  stable: {
    icon: 'minus',
    color: 'var(--color-text-muted)',
    text: () => 'Период идёт ровно: обе половины примерно одинаковы.',
  },
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
 */
export default function PeriodSummaryCard({ summary, periodLabel }: { summary: PeriodSummary; periodLabel: string }) {
  const trend = TREND[summary.trend]
  const pp = Math.round(Math.abs(summary.delta) * 100)

  return (
    <div className="sk-card flex flex-col gap-3">
      <p className="sk-eyebrow">{periodLabel}</p>

      <div className="flex items-baseline gap-2">
        <span className="sk-num text-[44px] leading-none font-semibold text-text-primary">{summary.goldDays}</span>
        <span className="text-[15px] text-text-secondary">
          {/* «дней» is fixed here: after «из» the count takes the genitive plural whatever it ends in. */}
          из {summary.askedDays} дней закрыты полностью
        </span>
      </div>

      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <Icon name={trend.icon} size={16} color={trend.color} />
        </span>
        <p className="text-[15px] text-text-secondary">{trend.text(pp)}</p>
      </div>

      <p className="text-[13px] text-text-muted">
        {summary.currentGoldStreak > 0
          ? `Сейчас ${summary.currentGoldStreak} ${daysWord(summary.currentGoldStreak)} подряд`
          : 'Серии сейчас нет'}
        {summary.lastMissDate && ` · последний неполный день — ${formatShortDate(summary.lastMissDate)}`}
        {summary.restDays > 0 && ` · ${summary.restDays} ${daysWord(summary.restDays)} не в счёт`}
      </p>
    </div>
  )
}
