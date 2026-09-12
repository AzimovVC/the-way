import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { DAY_CIRCLE_RADIUS, DAY_SPACING_PX, FOCUSED_DAYS_COUNT, GHOST_FUTURE_DAYS } from '../../domain/config'
import type { ColorTier, Day } from '../../domain/models'
import { computePathPoints } from '../../domain/pathEngine'

const MIN_SCALE = 0.1
const MAX_SCALE = 3
const FOCUS_VIEWPORT_FRACTION = 0.65
const QUEST_TRACK_OFFSET_X = 90

const TIER_COLOR: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold)',
  green: 'var(--color-day-green)',
  red: 'var(--color-day-red)',
  gray: 'var(--color-day-gray)',
}

export interface PathViewProps {
  days: Day[]
  containerWidth: number
  containerHeight: number
  todayDayId?: string
  showQuestTrack?: boolean
  showGhostFuture?: boolean
  showMascot?: boolean
  initialZoom?: 'focused' | 'overview'
  onDaySelect?: (day: Day, screenX: number) => void
  onFutureTap?: () => void
}

export default function PathView({
  days,
  containerWidth,
  containerHeight,
  todayDayId,
  showQuestTrack = true,
  showGhostFuture = true,
  showMascot = false,
  initialZoom = 'focused',
  onDaySelect,
  onFutureTap,
}: PathViewProps) {
  const points = days.length > 0 ? computePathPoints(days) : []
  const lastIndex = points.length - 1
  const lastX = points[lastIndex]?.x ?? 0
  const lastY = lastIndex * DAY_SPACING_PX

  const focusedScale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, containerHeight / (FOCUSED_DAYS_COUNT * DAY_SPACING_PX)),
  )
  const svgHeight = (points.length + GHOST_FUTURE_DAYS) * DAY_SPACING_PX + 160
  const overviewScale = Math.max(MIN_SCALE, Math.min(1, containerHeight / svgHeight))

  const [scale, setScale] = useState(initialZoom === 'overview' ? overviewScale : focusedScale)
  const [zoomedOut, setZoomedOut] = useState(initialZoom === 'overview')
  const pinchState = useRef<{ startDistance: number; startScale: number } | null>(null)
  const activeTouches = useRef<Map<number, { x: number; y: number }>>(new Map())

  const translateY = containerHeight * FOCUS_VIEWPORT_FRACTION - lastY * scale
  const translateX = containerWidth / 2 - lastX * scale

  function handleZoomToggle() {
    setZoomedOut((prev) => {
      const next = !prev
      setScale(next ? overviewScale : focusedScale)
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
      const ratio = distanceBetween(a, b) / pinchState.current.startDistance
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchState.current.startScale * ratio)))
    }
  }

  function handlePointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    activeTouches.current.delete(e.pointerId)
    if (activeTouches.current.size < 2) pinchState.current = null
  }

  return (
    <div className="relative overflow-hidden" style={{ height: containerHeight, width: containerWidth }}>
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

        <g
          style={{
            transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
            transition: 'transform 200ms ease-out',
          }}
        >
          {showQuestTrack && (
            <>
              <text x={(points[0]?.x ?? 0) + QUEST_TRACK_OFFSET_X - 20} y={-16} fontSize={10} fill="var(--color-quest-dot)">
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
            </>
          )}

          <polyline
            points={points.map((p, i) => `${p.x},${i * DAY_SPACING_PX}`).join(' ')}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={3}
          />

          {points.map((p, i) => {
            const cy = i * DAY_SPACING_PX
            const isToday = days[i]?.id === todayDayId
            const day = days[i]
            return (
              <g
                key={p.date}
                onClick={() => day && onDaySelect?.(day, translateX + p.x * scale)}
                style={{ cursor: onDaySelect ? 'pointer' : 'default' }}
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
                <circle cx={p.x} cy={cy} r={DAY_CIRCLE_RADIUS} fill={TIER_COLOR[p.colorTier]} filter="url(#dayShadow)" />
                {isToday && showMascot && (
                  <polygon
                    points={`${p.x},${cy - DAY_CIRCLE_RADIUS - 14} ${p.x - 7},${cy - DAY_CIRCLE_RADIUS - 2} ${p.x + 7},${cy - DAY_CIRCLE_RADIUS - 2}`}
                    fill="var(--color-text-primary)"
                    transform={`rotate(${(p.completionRate - 0.5) * 60} ${p.x} ${cy - DAY_CIRCLE_RADIUS - 8})`}
                  />
                )}
              </g>
            )
          })}

          {showGhostFuture &&
            Array.from({ length: GHOST_FUTURE_DAYS }, (_, n) => {
              const i = lastIndex + 1 + n
              const cy = i * DAY_SPACING_PX
              return (
                <circle
                  key={`ghost-${n}`}
                  cx={lastX}
                  cy={cy}
                  r={DAY_CIRCLE_RADIUS}
                  fill="none"
                  stroke="var(--color-border)"
                  strokeDasharray="4 4"
                  onClick={() => onFutureTap?.()}
                  style={{ cursor: onFutureTap ? 'pointer' : 'default' }}
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
  )
}
