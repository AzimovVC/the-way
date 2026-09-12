import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  DAY_CIRCLE_RADIUS,
  DAY_SPACING_PX,
  FOCUSED_DAYS_COUNT,
  GHOST_FUTURE_DAYS,
} from '../../domain/config'
import type { ColorTier } from '../../domain/models'
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

type ModalContent = { title: string; body: string } | null

export default function PathScreen() {
  const { state } = useAppState()
  const containerRef = useRef<HTMLDivElement>(null)

  const points = useMemo(() => computePathPoints(state.days), [state.days])
  const todayIndex = points.length - 1
  const todayX = points[todayIndex]?.x ?? 0
  const todayY = todayIndex * DAY_SPACING_PX

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

  const [modal, setModal] = useState<ModalContent>(null)

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

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="z-10 px-4 py-3">
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium text-text-primary shadow">
          {statusText}
        </div>
      </header>

      <div ref={containerRef} className="relative flex-1 overflow-hidden" style={{ height: containerHeight }}>
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
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-ring-start)" />
              <stop offset="100%" stopColor="var(--color-ring-end)" />
            </linearGradient>
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
              return (
                <g
                  key={p.date}
                  onClick={() =>
                    setModal({
                      title: p.date,
                      body: `Выполнено ${Math.round(p.completionRate * 100)}% задач.`,
                    })
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={p.x}
                    cy={cy}
                    r={DAY_CIRCLE_RADIUS + 5}
                    fill="none"
                    stroke="url(#ringGradient)"
                    strokeWidth={4}
                    strokeDasharray={2 * Math.PI * (DAY_CIRCLE_RADIUS + 5)}
                    strokeDashoffset={2 * Math.PI * (DAY_CIRCLE_RADIUS + 5) * (1 - p.completionRate)}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${p.x} ${cy})`}
                  />
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
                  onClick={() => setModal({ title: 'Скоро', body: 'Этот день ещё не наступил.' })}
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

      {modal && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-border bg-surface p-4 text-text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-medium">{modal.title}</h3>
            <p className="text-sm text-text-secondary">{modal.body}</p>
            <button
              type="button"
              onClick={() => setModal(null)}
              className="mt-3 w-full rounded-lg border border-border py-2 text-sm"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function clampAngle(completionRate: number): number {
  return (completionRate - 0.5) * 60
}
