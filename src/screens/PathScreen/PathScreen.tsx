import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../../components/AppShell'
import DayCard from '../../components/DayCard'
import TomorrowSheet from '../../components/TomorrowSheet'
import Icon from '../../components/Icon'
import PathView from '../../components/PathView'
import { computeStreak } from '../../domain/analytics'
import { upcomingMarkers } from '../../domain/horizon'
import { spendFreezeOnDay } from '../../domain/freezes'
import { describeToday, tomorrowPlan } from '../../domain/todayBrief'
import type { TaskTemplate } from '../../domain/models'
import { useAppState } from '../../state/AppStateContext'
import {
  useAvoidanceStrength,
  useFocusedDaysCount,
  useMaxTurnPerDay,
  useMaxWobble,
  useAvoidanceRadius,
  useCameraBackFraction,
  useGhostHorizonDays,
  useGreenThreshold,
  useTrendResponsePx,
  usePathZoomedOut,
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
  const greenThreshold = useGreenThreshold()
  const trendResponsePx = useTrendResponsePx()
  const scrollPxPerDay = useScrollPxPerDay()
  const focusedDaysCount = useFocusedDaysCount()
  const weekBoxSizeRatio = useWeekBoxSizeRatio()
  const zoomedOut = usePathZoomedOut()
  const ghostDays = useGhostHorizonDays()
  const cameraBackFraction = useCameraBackFraction()

  const markersAhead = useMemo(() => upcomingMarkers(state), [state])
  // What the road cannot show yet. Listing it keeps a goal that is still months out from being
  // simply invisible — the horizon is a drawing limit, not a statement that nothing else exists.
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
  const [showTomorrow, setShowTomorrow] = useState(false)

  const streak = useMemo(() => computeStreak(state.days), [state.days])
  const brief = useMemo(() => describeToday(state), [state])
  const tomorrow = useMemo(() => tomorrowPlan(state), [state])

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

      <div className="flex shrink-0 px-3 pb-2">
        {/* Always the goal's own colour — even mid-slump. The road below already says how things
            are going, and it draws the way back; a second, darker label naming what you are
            failing at would be the streak-guilt the voice rules out. The big line is the state of
            today rather than the goal's name, which the user knows by heart; the goal stays above
            it, so it is never the plate that disappears — see describeToday.

            Tapping it opens today's card, the same sheet today's circle opens. The circle scrolls
            away, the plate does not, and a second list of the same tasks would be a second place
            for one truth.

            Nothing sits beside it: creating a goal is a once-or-twice-ever act, it has a home on
            the Задачи tab, and a 52px button in the top corner is both the rarest action here and
            the hardest to reach with a thumb. */}
        <button
          type="button"
          disabled={!todayDayId}
          onClick={() => todayDayId && setOpenDay({ dayId: todayDayId, anchorX: containerWidth / 2 })}
          aria-label="Сегодняшний день"
          className="sk-press sk-focus flex min-w-0 flex-1 flex-col gap-0.5 rounded-[20px] px-4 py-3 text-left"
          style={{
            backgroundColor: 'var(--color-day-green)',
            boxShadow: '0 4px 0 var(--teal-700)',
          }}
        >
          <span className="sk-eyebrow truncate" style={{ color: 'rgba(0,0,0,.55)' }}>
            {brief.goalLabel}
          </span>
          <span className="sk-heading truncate text-2xl" style={{ color: 'var(--ink-950)' }}>
            {brief.headline}
          </span>
        </button>
      </div>

      <div
        ref={pathAreaRef}
        className="relative min-h-0 flex-1 transition-[filter] duration-300"
        style={{ filter: openDay || showTomorrow ? 'grayscale(1) brightness(0.55)' : 'none' }}
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
          greenThreshold={greenThreshold}
          trendResponsePx={trendResponsePx}
          scrollPxPerDay={scrollPxPerDay}
          focusedDaysCount={focusedDaysCount}
          weekBoxSizeRatio={weekBoxSizeRatio}
          zoomedOut={zoomedOut}
          ghostDays={ghostDays}
          cameraBackFraction={cameraBackFraction}
          markersAhead={markersAhead}
          tomorrowLabel="Что завтра"
          tomorrowShown={brief.settled}
          onTomorrowTap={() => setShowTomorrow(true)}
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

      {showTomorrow && <TomorrowSheet plan={tomorrow} onClose={() => setShowTomorrow(false)} />}

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

    </AppShell>
  )
}
