import { useMemo, useState } from 'react'
import DayCard from '../components/DayCard'
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
  const { state, toggleDayTask } = useAppState()
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [openDayId, setOpenDayId] = useState<string | null>(null)
  const [anchorX, setAnchorX] = useState(0)

  const containerWidth = 360
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
      patterns: detectPatterns(periodDays),
    }
  }, [periodDays, period])

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
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-6">
      <h1 className="text-xl font-semibold text-text-primary">Статистика</h1>

      <div className="flex gap-2">
        {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              period === key ? 'border-accent bg-accent/20 text-text-primary' : 'border-border text-text-secondary'
            }`}
          >
            {PERIOD_LABEL[key]}
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-text-secondary">Карта пути за период</h2>
        <PathView
          days={periodDays}
          containerWidth={containerWidth}
          containerHeight={420}
          todayDayId={todayDayId}
          showQuestTrack={false}
          showGhostFuture={false}
          initialZoom="overview"
          onDaySelect={(day, x) => {
            setOpenDayId(day.id)
            setAnchorX(x)
          }}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-text-secondary">Итоги периода</h2>
        <WrappedCard data={wrapped} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-text-secondary">Сравнение периодов</h2>
        <div className="flex gap-2">
          <select
            value={compareA}
            onChange={(e) => setCompareA(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text-primary"
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
            className="flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text-primary"
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
        <h2 className="text-sm font-medium text-text-secondary">Инсайты</h2>

        <div>
          <p className="mb-1 text-xs text-text-secondary">По дням недели</p>
          <div className="flex justify-between gap-1">
            {weekdayStats.map((w) => (
              <div key={w.weekday} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded bg-day-green"
                  style={{ height: 40, opacity: 0.25 + w.avgCompletionRate * 0.75 }}
                />
                <span className="text-[10px] text-text-secondary">{WEEKDAY_LABEL[w.weekday]}</span>
              </div>
            ))}
          </div>
        </div>

        {goalStats.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-text-secondary">Цели</p>
            <ul className="flex flex-col gap-1 text-sm text-text-primary">
              {goalStats.map((g) => (
                <li key={g.goalId} className="flex justify-between">
                  <span>{g.title}</span>
                  <span className="text-text-secondary">
                    {g.trend === 'improving' ? '📈 растёт' : g.trend === 'declining' ? '📉 проседает' : '➡️ стабильно'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {cycleTrend && (
          <p className="text-sm text-text-primary">
            Средний цикл «срыв → восстановление» {cycleTrend.direction === 'shorter' ? 'сокращается' : cycleTrend.direction === 'longer' ? 'растёт' : 'стабилен'}:
            было {Math.round(cycleTrend.early)} дн., сейчас {Math.round(cycleTrend.late)} дн.
          </p>
        )}

        {(bestRebounds.steepest || bestRebounds.smoothest) && (
          <div className="text-sm text-text-primary">
            {bestRebounds.steepest && <p>Самый резкий разворот: {bestRebounds.steepest.length} дн. ({bestRebounds.steepest.startDate} → {bestRebounds.steepest.endDate})</p>}
            {bestRebounds.smoothest && <p>Самый плавный разворот: {bestRebounds.smoothest.length} дн. ({bestRebounds.smoothest.startDate} → {bestRebounds.smoothest.endDate})</p>}
          </div>
        )}
      </section>

      {openDay && (
        <DayCard
          day={openDay}
          taskTemplates={taskTemplates}
          isToday={openDay.id === todayDayId}
          anchorX={anchorX}
          containerWidth={containerWidth}
          onClose={() => setOpenDayId(null)}
          onToggleTask={(dayTaskId) => toggleDayTask(openDay.id, dayTaskId)}
        />
      )}
    </div>
  )
}
