import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AddGoalFlow from '../../components/AddGoalFlow'
import DayCard from '../../components/DayCard'
import Icon from '../../components/Icon'
import PathView from '../../components/PathView'
import { computeStreak } from '../../domain/analytics'
import { spendFreezeOnDay } from '../../domain/freezes'
import type { TaskTemplate } from '../../domain/models'
import { useAppState } from '../../state/AppStateContext'
import { useAvoidanceStrength, useMaxTurnPerDay, useMinPointSeparation, useZigzagAmplitude } from '../../dev/pathTuning'

interface OpenDay {
  dayId: string
  anchorX: number
}

export default function PathScreen() {
  const { state, setState, toggleDayTask } = useAppState()
  const maxTurnPerDayDeg = useMaxTurnPerDay()
  const minPointSeparationPx = useMinPointSeparation()
  const zigzagAmplitudePx = useZigzagAmplitude()
  const avoidanceStrengthDeg = useAvoidanceStrength()

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
    <div className="flex h-dvh justify-center bg-bg sm:h-screen sm:py-6">
      <div
        className="relative flex h-full w-full max-w-[390px] flex-col overflow-hidden bg-bg sm:h-[844px] sm:rounded-[2.5rem] sm:border sm:border-border sm:shadow-2xl"
      >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-1" aria-label="Золотая серия">
          <Icon name="flame" size={24} color="var(--color-streak-flame)" />
          <span className="sk-num text-xl font-semibold" style={{ color: 'var(--color-streak-flame)' }}>
            {streak.currentGoldStreak}
          </span>
        </div>
        <div className="flex items-center gap-1" aria-label="Дни отдыха (заморозки)">
          <Icon name="moon" size={24} color="var(--color-freeze)" />
          <span className="sk-num text-xl font-semibold" style={{ color: 'var(--color-freeze)' }}>
            {state.user.freezesRemaining}
          </span>
        </div>
        <div className="flex-1" />
        <Link
          to="/profile"
          aria-label="Профиль"
          className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-surface-raised text-text-secondary"
        >
          <Icon name="user" size={20} />
        </Link>
      </header>

      <div className="flex shrink-0 items-stretch gap-2 px-2 pb-2">
        <div
          className="flex flex-1 items-stretch overflow-hidden rounded-2xl shadow-[0_4px_0_rgba(0,0,0,.25)] transition-opacity duration-300"
          style={{ backgroundColor: 'var(--color-day-green)', opacity: isPositiveTrend ? 1 : 0.5 }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3">
            <span
              className="text-[11px] font-bold uppercase"
              style={{ letterSpacing: '0.09em', color: 'rgba(0,0,0,.55)' }}
            >
              Твоя цель
            </span>
            <span className="font-display truncate text-2xl font-semibold" style={{ color: 'var(--ink-950)' }}>
              {primaryGoal?.title ?? 'своей цели'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAddingGoal(true)}
          aria-label="Добавить цель"
          className="grid size-[52px] shrink-0 place-items-center rounded-[12px] bg-surface-raised text-text-secondary"
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
          minPointSeparationPx={minPointSeparationPx}
          zigzagAmplitudePx={zigzagAmplitudePx}
          avoidanceStrengthDeg={avoidanceStrengthDeg}
          showMascot
          onDaySelect={(day, screenX) => setOpenDay({ dayId: day.id, anchorX: screenX })}
          onFutureTap={() => setFutureNotice(true)}
        />
      </div>

      <div className="shrink-0 px-2 pb-3">
        <div
          className="flex items-stretch overflow-hidden rounded-2xl shadow-[0_4px_0_rgba(0,0,0,.25)] transition-opacity duration-300"
          style={{ backgroundColor: 'var(--color-day-red)', opacity: isPositiveTrend ? 0.5 : 1 }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3">
            <span
              className="text-[11px] font-bold uppercase"
              style={{ letterSpacing: '0.09em', color: 'rgba(0,0,0,.55)' }}
            >
              Твоя антицель
            </span>
            <span className="font-display truncate text-2xl font-semibold" style={{ color: 'var(--ink-950)' }}>
              {primaryGoal?.antiGoalTitle ?? 'антицели'}
            </span>
          </div>
        </div>
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
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setFutureNotice(false)}
        >
          <div className="w-full max-w-xs rounded-xl border border-border bg-surface p-4 text-center text-text-primary">
            <p className="text-sm text-text-secondary">Этот день ещё не наступил.</p>
          </div>
        </div>
      )}

      {addingGoal && <AddGoalFlow onClose={() => setAddingGoal(false)} />}
      </div>
    </div>
  )
}
