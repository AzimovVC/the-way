import { useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import DayCard from '../components/DayCard'
import Icon, { type IconName } from '../components/Icon'
import { spendFreezeOnDay } from '../domain/freezes'
import PathComparisonView, { type PathComparisonSegment } from '../components/PathComparisonView'
import PathView from '../components/PathView'
import WrappedCard, { type WrappedData } from '../components/WrappedCard'
import {
  computeGoalStats,
  computeStreak,
  computeWeekdayStats,
  detectPatterns,
  findBestRebounds,
  findSlumpRecoveryCycles,
} from '../domain/analytics'
import type { Day, TaskTemplate } from '../domain/models'
import { useAppState } from '../state/AppStateContext'

type PeriodKey = 'month' | 'quarter' | 'year' | 'all'

const PERIOD_LABEL: Record<PeriodKey, string> = {
  month: 'Месяц',
  quarter: 'Квартал',
  year: 'Год',
  all: 'Всё время',
}

const PERIOD_SPAN_DAYS: Record<PeriodKey, number | null> = {
  month: 30,
  quarter: 90,
  year: 365,
  all: null,
}

const WEEKDAY_LABEL = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

/** State is carried by a glyph and a colour; the system never uses emoji. */
const TREND_GLYPH: Record<'improving' | 'declining' | 'stable', { icon: IconName; color: string; label: string }> = {
  improving: { icon: 'trending-up', color: 'var(--color-day-green)', label: 'растёт' },
  declining: { icon: 'trending-down', color: 'var(--color-day-red)', label: 'проседает' },
  stable: { icon: 'minus', color: 'var(--color-text-muted)', label: 'стабильно' },
}

const COMPARISON_COLORS = ['var(--color-ring-start)', 'var(--color-day-green)']

function sortedByDate(days: Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

function filterByPeriod(days: Day[], period: PeriodKey): Day[] {
  const span = PERIOD_SPAN_DAYS[period]
  const sorted = sortedByDate(days)
  return span === null ? sorted : sorted.slice(-span)
}

function groupByMonth(days: Day[]): Map<string, Day[]> {
  const map = new Map<string, Day[]>()
  for (const day of sortedByDate(days)) {
    const key = day.date.slice(0, 7)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(day)
  }
  return map
}

export default function StatsScreen() {
  const { state, setState, toggleDayTask } = useAppState()
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [openDayId, setOpenDayId] = useState<string | null>(null)
  const [anchorX, setAnchorX] = useState(0)

  const containerWidth = 358
  const todayDayId = state.days[state.days.length - 1]?.id

  const periodDays = useMemo(() => filterByPeriod(state.days, period), [state.days, period])

  const taskTemplates = useMemo(() => {
    const map = new Map<string, TaskTemplate>()
    for (const goal of state.user.goals) for (const task of goal.tasks) map.set(task.id, task)
    return map
  }, [state.user.goals])

  const wrapped = useMemo<WrappedData>(() => {
    const streak = computeStreak(periodDays)
    const cycles = findSlumpRecoveryCycles(periodDays)
    const longestDeclineLength = cycles.reduce((max, c) => Math.max(max, c.declineLength), 0)
    const { steepest } = findBestRebounds(periodDays)
    return {
      periodLabel: PERIOD_LABEL[period],
      streak,
      longestDeclineLength,
      bestRebound: steepest,
      patterns: detectPatterns(periodDays, state.user.goals),
    }
  }, [periodDays, period, state.user.goals])

  const weekdayStats = useMemo(() => computeWeekdayStats(periodDays), [periodDays])
  const goalStats = useMemo(() => computeGoalStats(state.user.goals, periodDays), [state.user.goals, periodDays])

  const cycleTrend = useMemo(() => {
    const cycles = findSlumpRecoveryCycles(state.days)
    if (cycles.length < 2) return null
    const mid = Math.floor(cycles.length / 2)
    const avg = (arr: typeof cycles) =>
      arr.reduce((sum, c) => sum + c.declineLength + c.recoveryLength, 0) / arr.length
    const early = avg(cycles.slice(0, mid))
    const late = avg(cycles.slice(mid))
    return { early, late, direction: late < early ? 'shorter' : late > early ? 'longer' : 'stable' } as const
  }, [state.days])

  const bestRebounds = useMemo(() => findBestRebounds(state.days), [state.days])

  const monthOptions = useMemo(() => [...groupByMonth(state.days).keys()], [state.days])
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const monthGroups = useMemo(() => groupByMonth(state.days), [state.days])

  const comparisonSegments: PathComparisonSegment[] = []
  if (compareA && monthGroups.has(compareA)) {
    comparisonSegments.push({ label: compareA, color: COMPARISON_COLORS[0], days: monthGroups.get(compareA)! })
  }
  if (compareB && monthGroups.has(compareB)) {
    comparisonSegments.push({ label: compareB, color: COMPARISON_COLORS[1], days: monthGroups.get(compareB)! })
  }

  const openDay = openDayId ? state.days.find((d) => d.id === openDayId) : undefined

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
      <h1 className="sk-heading text-[32px] text-text-primary">Статистика</h1>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            data-selected={period === key}
            className="sk-chip sk-plinth sk-focus"
          >
            {PERIOD_LABEL[key]}
          </button>
        ))}
      </div>

      <section>
        <h2 className="sk-eyebrow mb-2 block">Карта пути за период</h2>
        <PathView
          days={periodDays}
          containerWidth={containerWidth}
          containerHeight={420}
          todayDayId={todayDayId}
          showQuestTrack={false}
          showGhostFuture={false}
          zoomedOut
          onDaySelect={(day, x) => {
            setOpenDayId(day.id)
            setAnchorX(x)
          }}
        />
      </section>

      <section>
        <h2 className="sk-eyebrow mb-2 block">Итоги периода</h2>
        <WrappedCard data={wrapped} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="sk-eyebrow">Сравнение периодов</h2>
        <div className="flex gap-2">
          <select
            value={compareA}
            onChange={(e) => setCompareA(e.target.value)}
            className="sk-input flex-1"
          >
            <option value="">Месяц A</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={compareB}
            onChange={(e) => setCompareB(e.target.value)}
            className="sk-input flex-1"
          >
            <option value="">Месяц B</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {comparisonSegments.length > 0 && <PathComparisonView segments={comparisonSegments} />}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="sk-eyebrow">Инсайты</h2>

        <div>
          <p className="sk-eyebrow mb-2">По дням недели</p>
          <div className="flex justify-between gap-1">
            {weekdayStats.map((w) => (
              <div key={w.weekday} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="flex w-full items-end overflow-hidden rounded-[8px] bg-surface-track"
                  style={{ height: 56, boxShadow: 'var(--shadow-inset-well)' }}
                >
                  <div
                    className="w-full rounded-[8px] bg-day-green"
                    style={{
                      height: `${Math.max(6, w.avgCompletionRate * 100)}%`,
                      transition: `height var(--dur-slow) var(--ease-out)`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-bold text-text-muted">{WEEKDAY_LABEL[w.weekday]}</span>
              </div>
            ))}
          </div>
        </div>

        {goalStats.length > 0 && (
          <div>
            <p className="sk-eyebrow mb-2">Цели</p>
            <ul className="flex flex-col gap-2 text-[15px] text-text-primary">
              {goalStats.map((g) => {
                const trend = TREND_GLYPH[g.trend]
                return (
                  <li key={g.goalId} className="flex items-center justify-between gap-3">
                    <span className="truncate">{g.title}</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold" style={{ color: trend.color }}>
                      <Icon name={trend.icon} size={16} color={trend.color} />
                      {trend.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {cycleTrend && (
          <p className="text-[15px] text-text-secondary">
            Средний цикл «срыв → восстановление» {cycleTrend.direction === 'shorter' ? 'сокращается' : cycleTrend.direction === 'longer' ? 'растёт' : 'стабилен'}:
            было {Math.round(cycleTrend.early)} дн., сейчас {Math.round(cycleTrend.late)} дн.
          </p>
        )}

        {(bestRebounds.steepest || bestRebounds.smoothest) && (
          <div className="flex flex-col gap-1 text-[15px] text-text-secondary">
            {bestRebounds.steepest && <p>Самый резкий разворот: {bestRebounds.steepest.length} дн. ({bestRebounds.steepest.startDate} → {bestRebounds.steepest.endDate})</p>}
            {bestRebounds.smoothest && <p>Самый плавный разворот: {bestRebounds.smoothest.length} дн. ({bestRebounds.smoothest.startDate} → {bestRebounds.smoothest.endDate})</p>}
          </div>
        )}
      </section>

      {openDay && (
        <DayCard
          day={openDay}
          allDays={state.days}
          taskTemplates={taskTemplates}
          isToday={openDay.id === todayDayId}
          anchorX={anchorX}
          containerWidth={containerWidth}
          freezesRemaining={state.user.freezesRemaining}
          onClose={() => setOpenDayId(null)}
          onToggleTask={(dayTaskId) => toggleDayTask(openDay.id, dayTaskId)}
          onFreeze={() => setState(spendFreezeOnDay(state, openDay.id))}
        />
      )}
      </div>
    </AppShell>
  )
}
