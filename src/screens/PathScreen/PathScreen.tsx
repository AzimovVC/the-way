import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import DayCard from '../../components/DayCard'
import {
  DAY_CIRCLE_RADIUS,
  DAY_SPACING_PX,
  FOCUSED_DAYS_COUNT,
  GHOST_FUTURE_DAYS,
} from '../../domain/config'
import type { ColorTier, Day, TaskTemplate } from '../../domain/models'
import { computePathPoints } from '../../domain/pathEngine'
import { useAppState } from '../../state/AppStateContext'

const MIN_SCALE = 0.2
const MAX_SCALE = 3
const FOCUS_VIEWPORT_FRACTION = 0.65
const QUEST_TRACK_OFFSET_X = 90

const TIER_COLOR: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold)',
  green: 'var(--color-day-green)',
  red: 'var(--color-day-red)',
  gray: 'var(--color-day-gray)',
}

interface OpenDay {
  dayId: string
  anchorX: number
}

export default function PathScreen() {
  const { state, toggleDayTask } = useAppState()
  const containerRef = useRef<HTMLDivElement>(null)

  const points = useMemo(() => computePathPoints(state.days), [state.days])
  const todayIndex = points.length - 1
  const todayX = points[todayIndex]?.x ?? 0
  const todayY = todayIndex * DAY_SPACING_PX
  const todayDayId = state.days[state.days.length - 1]?.id

  const taskTemplates = useMemo(() => {
    const map = new Map<string, TaskTemplate>()
    for (const goal of state.user.goals) {
      for (const task of goal.tasks) map.set(task.id, task)
    }
    return map
  }, [state.user.goals])

  const containerHeight = 640
  const containerWidth = 360
  const focusedScale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, containerHeight / (FOCUSED_DAYS_COUNT * DAY_SPACING_PX)),
  )

  const [scale, setScale] = useState(focusedScale)
  const [zoomedOut, setZoomedOut] = useState(false)
  const pinchState = useRef<{ startDistance: number; startScale: number } | null>(null)
  const activeTouches = useRef<Map<number, { x: number; y: number }>>(new Map())

  const svgHeight = (points.length + GHOST_FUTURE_DAYS) * DAY_SPACING_PX + 160
  const fullOverviewScale = Math.max(MIN_SCALE, Math.min(1, containerHeight / svgHeight))

  const translateY = containerHeight * FOCUS_VIEWPORT_FRACTION - todayY * scale
  const translateX = containerWidth / 2 - todayX * scale

  const [openDay, setOpenDay] = useState<OpenDay | null>(null)
  const [futureNotice, setFutureNotice] = useState(false)

  const recentTrend = points.length > 0 ? state.days[state.days.length - 1].pathAngleDelta : 0
  const primaryGoal = state.user.goals.find((g) => !g.archived)
  const statusText =
    recentTrend >= 0
      ? `Ты двигаешься к цели: ${primaryGoal?.title ?? 'своей цели'} 💪`
      : `Осторожно, ты сползаешь к: ${primaryGoal?.antiGoalTitle ?? 'антицели'} 😴`

  function handleZoomToggle() {
    setZoomedOut((prev) => {
      const next = !prev
      setScale(next ? fullOverviewScale : focusedScale)
      return next
    })
  }

  function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function handlePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'touch') return
    activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activeTouches.current.size === 2) {
      const [a, b] = [...activeTouches.current.values()]
      pinchState.current = { startDistance: distanceBetween(a, b), startScale: scale }
    }
  }

  function handlePointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'touch' || !activeTouches.current.has(e.pointerId)) return
    activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activeTouches.current.size === 2 && pinchState.current) {
      const [a, b] = [...activeTouches.current.values()]
      const distance = distanceBetween(a, b)
      const ratio = distance / pinchState.current.startDistance
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchState.current.startScale * ratio))
      setScale(next)
    }
  }

  function handlePointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    activeTouches.current.delete(e.pointerId)
    if (activeTouches.current.size < 2) pinchState.current = null
  }

  function openDayCard(day: Day, worldX: number) {
    const screenX = translateX + worldX * scale
    setOpenDay({ dayId: day.id, anchorX: screenX })
  }

  const openDayData = openDay ? state.days.find((d) => d.id === openDay.dayId) : undefined
  const cardIsToday = openDay?.dayId === todayDayId

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="z-10 px-4 py-3">
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium text-text-primary shadow">
          {statusText}
        </div>
      </header>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden transition-[filter] duration-300"
        style={{
          height: containerHeight,
          filter: openDay ? 'grayscale(1) brightness(0.55)' : 'none',
        }}
      >
        <svg
          width="100%"
          height={containerHeight}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="touch-none"
        >
          <defs>
            <filter id="dayShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.35" />
            </filter>
          </defs>

          <g style={{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`, transition: 'transform 200ms ease-out' }}>
            {/* secondary quest track — decorative placeholder, see prompt 8 */}
            <text
              x={(points[0]?.x ?? 0) + QUEST_TRACK_OFFSET_X - 20}
              y={-16}
              fontSize={10}
              fill="var(--color-quest-dot)"
            >
              квесты
            </text>
            {points.map((p, i) => (
              <circle
                key={`quest-${p.date}`}
                cx={p.x + QUEST_TRACK_OFFSET_X}
                cy={i * DAY_SPACING_PX}
                r={DAY_CIRCLE_RADIUS * 0.35}
                fill="var(--color-quest-dot)"
                opacity={0.5}
              />
            ))}

            {/* main path */}
            <polyline
              points={points.map((p, i) => `${p.x},${i * DAY_SPACING_PX}`).join(' ')}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={3}
            />

            {points.map((p, i) => {
              const cy = i * DAY_SPACING_PX
              const isToday = i === todayIndex
              const day = state.days[i]
              return (
                <g
                  key={p.date}
                  onClick={() => day && openDayCard(day, p.x)}
                  style={{ cursor: 'pointer' }}
                >
                  {isToday && (
                    <circle
                      className="pulse-ring"
                      cx={p.x}
                      cy={cy}
                      r={DAY_CIRCLE_RADIUS + 4}
                      fill="none"
                      stroke="var(--color-ring-start)"
                      strokeWidth={3}
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={cy}
                    r={DAY_CIRCLE_RADIUS}
                    fill={TIER_COLOR[p.colorTier]}
                    filter="url(#dayShadow)"
                  />
                  {isToday && (
                    <polygon
                      points={`${p.x},${cy - DAY_CIRCLE_RADIUS - 14} ${p.x - 7},${cy - DAY_CIRCLE_RADIUS - 2} ${p.x + 7},${cy - DAY_CIRCLE_RADIUS - 2}`}
                      fill="var(--color-text-primary)"
                      transform={`rotate(${clampAngle(p.completionRate)} ${p.x} ${cy - DAY_CIRCLE_RADIUS - 8})`}
                    />
                  )}
                </g>
              )
            })}

            {/* ghost future days */}
            {Array.from({ length: GHOST_FUTURE_DAYS }, (_, n) => {
              const i = todayIndex + 1 + n
              const cy = i * DAY_SPACING_PX
              return (
                <circle
                  key={`ghost-${n}`}
                  cx={todayX}
                  cy={cy}
                  r={DAY_CIRCLE_RADIUS}
                  fill="none"
                  stroke="var(--color-border)"
                  strokeDasharray="4 4"
                  onClick={() => setFutureNotice(true)}
                  style={{ cursor: 'pointer' }}
                />
              )
            })}
          </g>
        </svg>

        <button
          type="button"
          onClick={handleZoomToggle}
          className="absolute bottom-4 right-4 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-primary shadow"
        >
          {zoomedOut ? 'Приблизить' : 'Отдалить'}
        </button>
      </div>

      {openDay && openDayData && (
        <DayCard
          day={openDayData}
          taskTemplates={taskTemplates}
          isToday={cardIsToday}
          anchorX={openDay.anchorX}
          containerWidth={containerWidth}
          onClose={() => setOpenDay(null)}
          onToggleTask={(dayTaskId) => toggleDayTask(openDay.dayId, dayTaskId)}
        />
      )}

      {futureNotice && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setFutureNotice(false)}
        >
          <div className="w-full max-w-xs rounded-xl border border-border bg-surface p-4 text-center text-text-primary">
            <p className="text-sm text-text-secondary">Этот день ещё не наступил.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function clampAngle(completionRate: number): number {
  return (completionRate - 0.5) * 60
}
