import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import AddGoalFlow from '../../components/AddGoalFlow'
import AppShell from '../../components/AppShell'
import DayCard from '../../components/DayCard'
import Icon from '../../components/Icon'
import PathView from '../../components/PathView'
import { computeStreak } from '../../domain/analytics'
import { spendFreezeOnDay } from '../../domain/freezes'
import type { TaskTemplate } from '../../domain/models'
import { useAppState } from '../../state/AppStateContext'
import {
  useAvoidanceStrength,
  useFocusedDaysCount,
  useMaxTurnPerDay,
  useMaxWobble,
  useAvoidanceRadius,
  useScrollPxPerDay,
  useWeekBoxSizeRatio,
  useWobbleSensitivity,
  useZigzagAmplitude,
  useZigzagPeriod,
} from '../../dev/pathTuning'

/**
 * A metric reads as one unit: glyph and number share a pill and a colour, and
 * the numeral is tabular so the counter does not jitter as it ticks.
 */
function MetricChip({ icon, value, color, label }: { icon: 'flame' | 'moon'; value: number; color: string; label: string }) {
  return (
    <div
      className="flex h-[34px] items-center gap-1.5 rounded-full bg-surface-raised px-3"
      aria-label={label}
    >
      <Icon name={icon} size={20} color={color} />
      <span className="sk-num text-[19px] font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

interface OpenDay {
  dayId: string
  anchorX: number
}

export default function PathScreen() {
  const { state, setState, toggleDayTask } = useAppState()
  const maxTurnPerDayDeg = useMaxTurnPerDay()
  const avoidanceRadiusPx = useAvoidanceRadius()
  const zigzagAmplitudePx = useZigzagAmplitude()
  const avoidanceStrengthDeg = useAvoidanceStrength()
  const zigzagPeriodDays = useZigzagPeriod()
  const wobbleSensitivity = useWobbleSensitivity()
  const maxWobblePx = useMaxWobble()
  const scrollPxPerDay = useScrollPxPerDay()
  const focusedDaysCount = useFocusedDaysCount()
  const weekBoxSizeRatio = useWeekBoxSizeRatio()

  const todayDayId = state.days[state.days.length - 1]?.id

  const pathAreaRef = useRef<HTMLDivElement>(null)
  const [pathSize, setPathSize] = useState({ width: 390, height: 480 })

  useLayoutEffect(() => {
    const el = pathAreaRef.current
    if (!el) return
    const update = () => setPathSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const containerWidth = pathSize.width
  const containerHeight = pathSize.height

  const taskTemplates = useMemo(() => {
    const map = new Map<string, TaskTemplate>()
    for (const goal of state.user.goals) {
      for (const task of goal.tasks) map.set(task.id, task)
    }
    return map
  }, [state.user.goals])

  const [openDay, setOpenDay] = useState<OpenDay | null>(null)
  const [futureNotice, setFutureNotice] = useState(false)
  const [addingGoal, setAddingGoal] = useState(false)

  const recentTrend = state.days.length > 0 ? state.days[state.days.length - 1].pathAngleDelta : 0
  const primaryGoal = state.user.goals.find((g) => !g.archived)
  const isPositiveTrend = recentTrend >= 0
  const streak = useMemo(() => computeStreak(state.days), [state.days])

  const openDayData = openDay ? state.days.find((d) => d.id === openDay.dayId) : undefined
  const cardIsToday = openDay?.dayId === todayDayId

  return (
    <AppShell>
      <header className="flex min-h-14 shrink-0 items-center gap-2 px-3">
        <MetricChip
          icon="flame"
          value={streak.currentGoldStreak}
          color="var(--color-streak-flame)"
          label="Золотая серия"
        />
        <MetricChip
          icon="moon"
          value={state.user.freezesRemaining}
          color="var(--color-freeze)"
          label="Дни отдыха (заморозки)"
        />
      </header>

      <div className="flex shrink-0 items-stretch gap-2 px-3 pb-2">
        <div
          className="flex min-w-0 flex-1 flex-col gap-1 rounded-[20px] px-4 py-3 transition-colors"
          style={{
            backgroundColor: isPositiveTrend ? 'var(--color-day-green)' : 'var(--color-day-red)',
            boxShadow: `0 4px 0 ${isPositiveTrend ? 'var(--teal-700)' : 'var(--coral-700)'}`,
            transitionDuration: 'var(--dur-slow)',
          }}
        >
          <span className="sk-eyebrow" style={{ color: 'rgba(0,0,0,.55)' }}>
            {isPositiveTrend ? 'Твоя цель' : 'Твоя антицель'}
          </span>
          <span className="sk-heading truncate text-2xl" style={{ color: 'var(--ink-950)' }}>
            {isPositiveTrend ? (primaryGoal?.title ?? 'своей цели') : (primaryGoal?.antiGoalTitle ?? 'антицели')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAddingGoal(true)}
          aria-label="Добавить цель"
          className="sk-plinth sk-focus grid size-[52px] shrink-0 place-items-center rounded-[16px] bg-surface-raised text-text-secondary"
        >
          <Icon name="plus" size={22} />
        </button>
      </div>

      <div
        ref={pathAreaRef}
        className="relative min-h-0 flex-1 transition-[filter] duration-300"
        style={{ filter: openDay ? 'grayscale(1) brightness(0.55)' : 'none' }}
      >
        <PathView
          days={state.days}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          todayDayId={todayDayId}
          maxTurnPerDayDeg={maxTurnPerDayDeg}
          avoidanceRadiusPx={avoidanceRadiusPx}
          zigzagAmplitudePx={zigzagAmplitudePx}
          avoidanceStrengthDeg={avoidanceStrengthDeg}
          zigzagPeriodDays={zigzagPeriodDays}
          wobbleSensitivity={wobbleSensitivity}
          maxWobblePx={maxWobblePx}
          scrollPxPerDay={scrollPxPerDay}
          focusedDaysCount={focusedDaysCount}
          weekBoxSizeRatio={weekBoxSizeRatio}
          showMascot
          onDaySelect={(day, screenX) => setOpenDay({ dayId: day.id, anchorX: screenX })}
          onFutureTap={() => setFutureNotice(true)}
        />
      </div>

      {openDay && openDayData && (
        <DayCard
          day={openDayData}
          allDays={state.days}
          taskTemplates={taskTemplates}
          isToday={cardIsToday}
          anchorX={openDay.anchorX}
          containerWidth={containerWidth}
          freezesRemaining={state.user.freezesRemaining}
          onClose={() => setOpenDay(null)}
          onToggleTask={(dayTaskId) => toggleDayTask(openDay.dayId, dayTaskId)}
          onFreeze={() => setState(spendFreezeOnDay(state, openDay.dayId))}
        />
      )}

      {futureNotice && (
        <div
          className="sk-scrim absolute inset-0 z-20 flex items-center justify-center px-4"
          onClick={() => setFutureNotice(false)}
        >
          <div className="sk-dialog w-full max-w-xs p-5 text-center">
            <p className="text-[15px] text-text-secondary">Этот день ещё не наступил.</p>
          </div>
        </div>
      )}

      {addingGoal && <AddGoalFlow onClose={() => setAddingGoal(false)} />}
    </AppShell>
  )
}
