import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AWARD_PATH_D, ICON_PATH_D, LOCK_PATH_D } from '../../components/Icon'
import { DAY_CIRCLE_RADIUS, DAY_SPACING_PX, FOCUSED_DAYS_COUNT, GHOST_FUTURE_DAYS } from '../../domain/config'
import type { ColorTier, Day } from '../../domain/models'
import { computeMilestones, computePathPoints, resolveCollisions, type MilestoneKind } from '../../domain/pathEngine'
import { dailyQuestsFor } from '../../domain/quests'
import { describeArc, ringSegmentAngles } from '../ringSegments'

const MILESTONE_TIER_COLOR = { bronze: 'var(--rust-500)', gold: 'var(--marigold-500)', platinum: 'var(--cobalt-500)' } as const
const TODAY_RING_GAP_DEG = 16
const TODAY_RING_OFFSET = 8
const TODAY_RING_STROKE = 3.5

const MIN_SCALE = 0.1
const MAX_SCALE = 3
// Fraction of the container's height, from the top, where "today" sits in the focused view.
// Only the single ghost circle plus its label live above today, so most of the height needs
// to go below it, toward the actual history — a bigger fraction here starves that history of
// room (this used to be 0.65, sized for when 3 ghost circles were shown above instead of 1).
const FOCUS_VIEWPORT_FRACTION = 0.3
const QUEST_TRACK_OFFSET_X = 90
/** Solid "plinth" offset, in px at scale 1 — the design system's stand-in for a blurred shadow. */
const PLINTH_DEPTH = 6
const PLINTH_DEPTH_TODAY = 8

const TIER_COLOR: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold)',
  green: 'var(--color-day-green)',
  red: 'var(--color-day-red)',
  gray: 'var(--color-day-gray)',
}

const TIER_PLINTH: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold-plinth)',
  green: 'var(--color-day-green-plinth)',
  red: 'var(--color-day-red-plinth)',
  gray: 'var(--color-day-gray-plinth)',
}

const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  start: 'СТАРТ',
  week: 'НЕДЕЛЯ',
  month: 'МЕСЯЦ',
  halfYear: 'ПОЛГОДА',
  year: 'ГОД',
}
/** Gap, in px either side of the centered label, left clear for the divider's flanking lines. */
const MILESTONE_LABEL_GAP = 16
/** Length, in px, of each short line flanking the milestone label — Duolingo-style stubs, not full-width rules. */
const MILESTONE_LINE_LENGTH = 56

export interface PathViewProps {
  days: Day[]
  containerWidth: number
  containerHeight: number
  todayDayId?: string
  showQuestTrack?: boolean
  showGhostFuture?: boolean
  showMascot?: boolean
  initialZoom?: 'focused' | 'overview'
  /** Dev-only overrides for the path's geometry tuning — each defaults to its domain constant. */
  maxTurnPerDayDeg?: number
  minPointSeparationPx?: number
  zigzagAmplitudePx?: number
  avoidanceStrengthDeg?: number
  zigzagPeriodDays?: number
  wobbleSensitivity?: number
  maxWobblePx?: number
  onDaySelect?: (day: Day, screenX: number) => void
  onFutureTap?: () => void
}

export default function PathView({
  days,
  containerWidth,
  containerHeight,
  todayDayId,
  showQuestTrack = false,
  showGhostFuture = true,
  showMascot = false,
  initialZoom = 'focused',
  maxTurnPerDayDeg,
  minPointSeparationPx,
  zigzagAmplitudePx,
  avoidanceStrengthDeg,
  zigzagPeriodDays,
  wobbleSensitivity,
  maxWobblePx,
  onDaySelect,
  onFutureTap,
}: PathViewProps) {
  const points =
    days.length > 0
      ? computePathPoints(
          days,
          maxTurnPerDayDeg,
          minPointSeparationPx,
          zigzagAmplitudePx,
          avoidanceStrengthDeg,
          zigzagPeriodDays,
          wobbleSensitivity,
          maxWobblePx,
        )
      : []
  const milestones = computeMilestones(days)
  const lastIndex = points.length - 1
  const lastX = points[lastIndex]?.x ?? 0
  const lastY = points[lastIndex]?.y ?? 0
  const lastHeadingRad = ((points[lastIndex]?.headingDeg ?? 0) * Math.PI) / 180
  const lastForward = { x: Math.sin(lastHeadingRad), y: -Math.cos(lastHeadingRad) }

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(0, ...xs)
  const maxX = Math.max(0, ...xs)
  const minY = Math.min(0, ...ys)
  const maxY = Math.max(0, ...ys)
  const boxCenterX = (minX + maxX) / 2
  const boxCenterY = (minY + maxY) / 2

  // A sustained non-zero heading (any streak that isn't a coin flip) drifts sideways as well as
  // up/down, so sizing this from vertical spacing alone can fit the last FOCUSED_DAYS_COUNT days
  // vertically while their horizontal spread is already wider than the phone — same shape of bug
  // as the overview fit, just for the near-term window instead of the whole history. Basing it on
  // the recent points' actual bounding box (like overview does for everything) fits both axes.
  const recentPoints = points.slice(-FOCUSED_DAYS_COUNT)
  const recentMinX = recentPoints.length > 0 ? Math.min(...recentPoints.map((p) => p.x)) : 0
  const recentMaxX = recentPoints.length > 0 ? Math.max(...recentPoints.map((p) => p.x)) : 0
  const recentMinY = recentPoints.length > 0 ? Math.min(...recentPoints.map((p) => p.y)) : 0
  const recentMaxY = recentPoints.length > 0 ? Math.max(...recentPoints.map((p) => p.y)) : 0
  const focusedScale = Math.min(
    MAX_SCALE,
    Math.max(
      MIN_SCALE,
      Math.min(
        containerHeight / Math.max(1, recentMaxY - recentMinY + DAY_SPACING_PX),
        containerWidth / Math.max(1, recentMaxX - recentMinX + DAY_SPACING_PX),
      ),
    ),
  )
  const overviewScale = Math.max(
    MIN_SCALE,
    Math.min(1, containerHeight / (maxY - minY + 200), containerWidth / (maxX - minX + 200)),
  )

  const [zoomedOut, setZoomedOut] = useState(initialZoom === 'overview')
  // The base scale that fits the current data (focused or overview) is recomputed from
  // days/container on every render; zoomFactor is only the user's manual pinch on top of
  // that fit, so newly added/removed days keep the path correctly framed without a stale
  // scale left over from before the data changed.
  const [zoomFactor, setZoomFactor] = useState(1)
  const pinchState = useRef<{ startDistance: number; startScale: number } | null>(null)
  const activeTouches = useRef<Map<number, { x: number; y: number }>>(new Map())

  const baseScale = zoomedOut ? overviewScale : focusedScale
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, zoomFactor * baseScale))

  const translateY = zoomedOut
    ? containerHeight / 2 - boxCenterY * scale
    : containerHeight * FOCUS_VIEWPORT_FRACTION - lastY * scale
  const translateX = zoomedOut ? containerWidth / 2 - boxCenterX * scale : containerWidth / 2 - lastX * scale

  function handleZoomToggle() {
    setZoomedOut((prev) => !prev)
    setZoomFactor(1)
  }

  function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function handlePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'touch') return
    activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activeTouches.current.size === 2) {
      const [a, b] = [...activeTouches.current.values()]
      pinchState.current = { startDistance: distanceBetween(a, b), startScale: zoomFactor }
    }
  }

  function handlePointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'touch' || !activeTouches.current.has(e.pointerId)) return
    activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activeTouches.current.size === 2 && pinchState.current) {
      const [a, b] = [...activeTouches.current.values()]
      const ratio = distanceBetween(a, b) / pinchState.current.startDistance
      setZoomFactor(pinchState.current.startScale * ratio)
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
        <g
          style={{
            transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
            transition: 'transform 200ms ease-out',
          }}
        >
          {showQuestTrack && (
            <>
              <text
                x={(points[0]?.x ?? 0) + QUEST_TRACK_OFFSET_X - 20}
                y={minY - 16}
                fontSize={10}
                fontFamily="var(--font-sans)"
                fill="var(--color-quest-dot)"
              >
                квесты
              </text>
              {points.map((p, i) => {
                const quests = days[i] ? dailyQuestsFor(days[i], days) : []
                const allComplete = quests.length > 0 && quests.every((q) => q.isComplete)
                return (
                  <circle
                    key={`quest-${p.date}`}
                    cx={p.x + QUEST_TRACK_OFFSET_X}
                    cy={p.y}
                    r={DAY_CIRCLE_RADIUS * 0.35}
                    fill={allComplete ? 'var(--color-day-gold)' : 'var(--color-quest-dot)'}
                    opacity={allComplete ? 0.9 : 0.6}
                  />
                )
              })}
            </>
          )}

          {points.map((p, i) => {
            const cy = p.y
            const isToday = days[i]?.id === todayDayId
            const day = days[i]
            const radius = isToday ? DAY_CIRCLE_RADIUS * 1.1 : DAY_CIRCLE_RADIUS
            const depth = isToday ? PLINTH_DEPTH_TODAY : PLINTH_DEPTH
            const dimmed = !isToday
            const ringR = radius + TODAY_RING_OFFSET
            const taskSegments =
              isToday && day
                ? ringSegmentAngles(day.tasks.length, TODAY_RING_GAP_DEG).map((seg, si) => ({
                    d: describeArc(p.x, cy, ringR, seg.start, seg.end),
                    done: day.tasks[si].isDone,
                  }))
                : []
            return (
              <g
                key={p.date}
                onClick={() => day && onDaySelect?.(day, translateX + p.x * scale)}
                style={{ cursor: onDaySelect ? 'pointer' : 'default' }}
                opacity={dimmed ? 0.6 : 1}
              >
                {isToday && (
                  <>
                    {taskSegments.map((seg, si) => (
                      <path
                        key={si}
                        d={seg.d}
                        fill="none"
                        stroke={seg.done ? TIER_COLOR[p.colorTier] : 'var(--color-surface-track)'}
                        strokeWidth={TODAY_RING_STROKE}
                        strokeLinecap="round"
                      />
                    ))}
                    <rect
                      x={p.x - 32}
                      y={cy - radius - 42}
                      width={64}
                      height={18}
                      rx={9}
                      fill="var(--marigold-tint)"
                    />
                    <text
                      x={p.x}
                      y={cy - radius - 30}
                      textAnchor="middle"
                      fontSize={9}
                      fontFamily="var(--font-sans)"
                      fontWeight={700}
                      letterSpacing="0.09em"
                      fill="var(--marigold-500)"
                    >
                      СЕГОДНЯ
                    </text>
                  </>
                )}
                {/* plinth: a solid offset copy underneath, standing in for a blurred shadow */}
                <circle cx={p.x} cy={cy + depth} r={radius} fill={TIER_PLINTH[p.colorTier]} />
                <circle cx={p.x} cy={cy} r={radius} fill={TIER_COLOR[p.colorTier]} />
                {p.frozen && (
                  <g transform={`translate(${p.x - 7}, ${cy - 7}) scale(0.58)`}>
                    <path
                      d={ICON_PATH_D.moon}
                      fill="none"
                      stroke="var(--violet-500)"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}
                {(day?.newGoalIds?.length ?? 0) > 0 && (
                  <g transform={`translate(${p.x + radius}, ${cy - radius - 4}) scale(0.5)`}>
                    <path
                      d={ICON_PATH_D.flag}
                      fill="none"
                      stroke="var(--cobalt-500)"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}
                {day?.milestonesReached?.map((m, mi) => (
                  <g key={m.taskId} transform={`translate(${p.x - radius - 10 - mi * 16}, ${cy - 8}) scale(0.65)`}>
                    <circle cx={12} cy={8} r={7} fill="none" stroke={MILESTONE_TIER_COLOR[m.tier as 'bronze' | 'gold' | 'platinum']} strokeWidth={2.5} />
                    <path
                      d={AWARD_PATH_D}
                      fill="none"
                      stroke={MILESTONE_TIER_COLOR[m.tier as 'bronze' | 'gold' | 'platinum']}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                ))}
                {isToday && showMascot && (
                  <polygon
                    points={`${p.x},${cy - radius - 60} ${p.x - 7},${cy - radius - 48} ${p.x + 7},${cy - radius - 48}`}
                    fill="var(--color-text-secondary)"
                    transform={`rotate(${(p.completionRate - 0.5) * 60} ${p.x} ${cy - radius - 54})`}
                  />
                )}
              </g>
            )
          })}

          {showGhostFuture &&
            (() => {
              // Ghost circles aren't part of computePathPoints, so nudge them through the same
              // collision resolver — otherwise a curled-back path could place a "locked" future
              // circle right on top of an earlier real one.
              const ghosts: { x: number; y: number }[] = []
              let prevX = lastX
              let prevY = lastY
              for (let n = 0; n < GHOST_FUTURE_DAYS; n++) {
                const raw = { x: prevX + lastForward.x * DAY_SPACING_PX, y: prevY + lastForward.y * DAY_SPACING_PX }
                const resolved = resolveCollisions(raw, [...points, ...ghosts], minPointSeparationPx, 16, {
                  x: prevX,
                  y: prevY,
                })
                ghosts.push(resolved)
                prevX = resolved.x
                prevY = resolved.y
              }
              return ghosts.map((g, n) => (
                <g
                  key={`ghost-${n}`}
                  onClick={() => onFutureTap?.()}
                  style={{ cursor: onFutureTap ? 'pointer' : 'default' }}
                >
                  <circle
                    cx={g.x}
                    cy={g.y}
                    r={DAY_CIRCLE_RADIUS}
                    fill="var(--color-day-gray)"
                    stroke="var(--color-border)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <g transform={`translate(${g.x - 8}, ${g.y - 8}) scale(0.67)`}>
                    <rect width={18} height={11} x={3} y={11} rx={2} ry={2} fill="none" stroke="var(--color-text-muted)" strokeWidth={2.5} />
                    <path d={LOCK_PATH_D} fill="none" stroke="var(--color-text-muted)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </g>
              ))
            })()}

          {milestones
            .filter((m) => m.kind !== 'start' || !zoomedOut)
            .map((m) => {
              const point = points[m.index]
              if (!point) return null
              const prevPoint = m.index > 0 ? points[m.index - 1] : null
              // Anchored to the two circles the divider actually sits between (in the path's own
              // wandering coordinates, not screen space) — a fixed full-width line would cut across
              // whatever other loop of the path happens to pass by at that same height.
              const xLocal = prevPoint ? (prevPoint.x + point.x) / 2 : point.x
              const yLocal = prevPoint ? (prevPoint.y + point.y) / 2 : point.y - DAY_SPACING_PX / 2
              return (
                <g key={m.kind}>
                  <line
                    x1={xLocal - MILESTONE_LABEL_GAP - MILESTONE_LINE_LENGTH}
                    y1={yLocal}
                    x2={xLocal - MILESTONE_LABEL_GAP}
                    y2={yLocal}
                    stroke="var(--color-text-muted)"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={xLocal + MILESTONE_LABEL_GAP}
                    y1={yLocal}
                    x2={xLocal + MILESTONE_LABEL_GAP + MILESTONE_LINE_LENGTH}
                    y2={yLocal}
                    stroke="var(--color-text-muted)"
                    strokeWidth={1.5}
                  />
                  <text
                    x={xLocal}
                    y={yLocal + 4}
                    textAnchor="middle"
                    fontSize={13}
                    fontFamily="var(--font-sans)"
                    fontWeight={400}
                    fill="var(--color-text-muted)"
                  >
                    {MILESTONE_LABEL[m.kind]}
                  </text>
                </g>
              )
            })}
        </g>
      </svg>

      <button
        type="button"
        onClick={handleZoomToggle}
        className="absolute bottom-4 right-4 rounded-lg border border-border bg-surface-raised px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-text-primary shadow-[0_3px_0_var(--ink-600)] transition-transform active:translate-y-[3px] active:shadow-none"
      >
        {zoomedOut ? 'Приблизить' : 'Отдалить'}
      </button>
    </div>
  )
}
