import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import DayCard from '../../components/DayCard'
import TomorrowPopover from '../../components/TomorrowPopover'
import type { PopoverAnchor } from '../../components/NodePopover'
import Icon from '../../components/Icon'
import PathView from '../../components/PathView'
import StreakSheet from '../../components/StreakSheet'
import { computeStreak } from '../../domain/analytics'
import { upcomingMarkers } from '../../domain/horizon'
import { spendFreezeOnDay } from '../../domain/freezes'
import { describeToday, tomorrowPlan } from '../../domain/todayBrief'
import type { TaskTemplate } from '../../domain/models'
import { useAppState } from '../../state/appState'
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
 *
 * With `onOpen` it is a button — the same pill, so the header does not grow a second shape for
 * the one metric that has a screen behind it.
 */
function MetricChip({
  icon,
  value,
  color,
  label,
  onOpen,
}: {
  icon: 'flame' | 'moon'
  value: number
  color: string
  label: string
  onOpen?: () => void
}) {
  const className = 'flex h-[34px] items-center gap-1.5 rounded-full bg-surface-raised px-3'
  const body = (
    <>
      <Icon name={icon} size={20} color={color} />
      <span className="sk-num text-[19px] font-semibold" style={{ color }}>
        {value}
      </span>
    </>
  )

  if (!onOpen) {
    return (
      <div className={className} aria-label={label}>
        {body}
      </div>
    )
  }
  return (
    <button type="button" onClick={onOpen} aria-label={label} className={`sk-press sk-focus ${className}`}>
      {body}
    </button>
  )
}

interface OpenDay {
  dayId: string
  /** Where the tapped circle stands inside the phone frame — the card opens on it. */
  anchor: PopoverAnchor
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

  // ?day=YYYY-MM-DD — where a trophy on the profile sends the road. Read as a plain date so the
  // link carries no state of its own: a day that is not in the history is simply ignored.
  const [searchParams] = useSearchParams()
  const focusDate = searchParams.get('day')

  const markersAhead = useMemo(() => upcomingMarkers(state), [state])
  // What the road cannot show yet. Listing it keeps a goal that is still months out from being
  // simply invisible — the horizon is a drawing limit, not a statement that nothing else exists.
  const todayDayId = state.days[state.days.length - 1]?.id

  const pathAreaRef = useRef<HTMLDivElement>(null)
  const plateRef = useRef<HTMLButtonElement>(null)
  const [pathSize, setPathSize] = useState({ width: 390, height: 480 })
  // The phone frame's own box, and where the road's area starts inside it. PathView reports tap
  // positions in its own coordinates; the cards that open on them are laid out against the whole
  // frame, so they can hang past the road's edges rather than being trapped in it.
  const [frame, setFrame] = useState({ width: 390, height: 844, pathTop: 0 })

  useLayoutEffect(() => {
    const el = pathAreaRef.current
    if (!el) return
    const update = () => {
      setPathSize({ width: el.clientWidth, height: el.clientHeight })
      const box = el.offsetParent as HTMLElement | null
      setFrame({
        width: box?.clientWidth ?? el.clientWidth,
        height: box?.clientHeight ?? el.clientHeight,
        pathTop: el.offsetTop,
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.offsetParent instanceof HTMLElement) ro.observe(el.offsetParent)
    return () => ro.disconnect()
  }, [])

  const containerWidth = pathSize.width
  const containerHeight = pathSize.height

  /** A tap position from PathView, moved into the frame's coordinates. */
  const fromPath = (anchor: PopoverAnchor): PopoverAnchor => ({ ...anchor, y: anchor.y + frame.pathTop })

  /** The plate is not a circle on the road, but it opens the same card — so the card opens on it. */
  const plateAnchor = (): PopoverAnchor => {
    const el = plateRef.current
    const box = el?.offsetParent as HTMLElement | null
    if (!el || !box) return { x: frame.width / 2, y: frame.pathTop, radius: 0 }
    const r = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, radius: r.height / 2 }
  }

  const taskTemplates = useMemo(() => {
    const map = new Map<string, TaskTemplate>()
    for (const goal of state.user.goals) {
      for (const task of goal.tasks) map.set(task.id, task)
    }
    return map
  }, [state.user.goals])

  const [openDay, setOpenDay] = useState<OpenDay | null>(null)
  const [futureNotice, setFutureNotice] = useState(false)
  const [streakOpen, setStreakOpen] = useState(false)
  const [tomorrowAnchor, setTomorrowAnchor] = useState<PopoverAnchor | null>(null)

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
          onOpen={() => setStreakOpen(true)}
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
          ref={plateRef}
          type="button"
          disabled={!todayDayId}
          onClick={() => todayDayId && setOpenDay({ dayId: todayDayId, anchor: plateAnchor() })}
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
        style={{ filter: openDay || tomorrowAnchor ? 'grayscale(1) brightness(0.55)' : 'none' }}
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
          focusDate={focusDate}
          tomorrowLabel="Что завтра"
          tomorrowShown={brief.settled}
          onTomorrowTap={(anchor) => setTomorrowAnchor(fromPath(anchor))}
          showMascot
          onDaySelect={(day, anchor) => setOpenDay({ dayId: day.id, anchor: fromPath(anchor) })}
          onFutureTap={() => setFutureNotice(true)}
        />
      </div>

      {openDay && openDayData && (
        <DayCard
          day={openDayData}
          allDays={state.days}
          taskTemplates={taskTemplates}
          isToday={cardIsToday}
          anchor={openDay.anchor}
          frameWidth={frame.width}
          frameHeight={frame.height}
          freezesRemaining={state.user.freezesRemaining}
          onClose={() => setOpenDay(null)}
          onToggleTask={(dayTaskId) => toggleDayTask(openDay.dayId, dayTaskId)}
          onFreeze={() => setState(spendFreezeOnDay(state, openDay.dayId))}
        />
      )}

      {streakOpen && (
        <StreakSheet days={state.days} todayDayId={todayDayId} onClose={() => setStreakOpen(false)} />
      )}

      {tomorrowAnchor && (
        <TomorrowPopover
          plan={tomorrow}
          anchor={tomorrowAnchor}
          frameWidth={frame.width}
          frameHeight={frame.height}
          onClose={() => setTomorrowAnchor(null)}
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

    </AppShell>
  )
}
