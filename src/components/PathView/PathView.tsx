import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
// Fraction of the container's height, from the top, where "today" is scrolled to when the
// scroll view (re)centers on it. Only the single ghost circle plus its label live above today,
// so most of the height needs to go below it, toward the actual history — a bigger fraction
// here starves that history of room (this used to be 0.65, sized for when 3 ghost circles were
// shown above instead of 1).
const FOCUS_VIEWPORT_FRACTION = 0.3
/**
 * Physical px of scroll the user must move to advance one day, independent of the path's visual
 * scale — this, not circle size, is what actually controls how fast scrolling through history
 * feels. Higher = slower/more deliberate scrolling for the same wheel/touch motion.
 */
const SCROLL_PX_PER_DAY = 90
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
  /** Dev-only override: physical scroll px per day in the focus/scroll view — defaults to SCROLL_PX_PER_DAY. */
  scrollPxPerDay?: number
  /** Dev-only override: how many days fill the container height in the focus/scroll view — defaults to FOCUSED_DAYS_COUNT. Smaller = more zoomed in. */
  focusedDaysCount?: number
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
  scrollPxPerDay = SCROLL_PX_PER_DAY,
  focusedDaysCount = FOCUSED_DAYS_COUNT,
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
  // Kept in sync every render so the scroll listener's effect (which doesn't re-subscribe on every
  // data change — see its dependency array) always reads the current points, never a stale closure.
  const pointsRef = useRef(points)
  pointsRef.current = points
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

  // The scroll view's scale is a fixed "about this many days fill the screen vertically" density —
  // not a fit of any particular window's bounding box — so it stays constant as you scroll, with no
  // rescaling jump. Width doesn't factor in: the camera continuously re-centers horizontally on
  // whatever's on screen (see focalXRef below), so only the path's *local* sideways wobble
  // (ZIGZAG_AMPLITUDE_PX + MAX_WOBBLE_PX, well under containerWidth at this scale) needs to fit —
  // never its cumulative drift over the whole history.
  const scrollScale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, containerHeight / (focusedDaysCount * DAY_SPACING_PX)),
  )
  const overviewScale = Math.max(
    MIN_SCALE,
    Math.min(1, containerHeight / (maxY - minY + 200), containerWidth / (maxX - minX + 200)),
  )

  const [zoomedOut, setZoomedOut] = useState(initialZoom === 'overview')
  // The base scale that fits the current data (scroll or overview) is recomputed from
  // days/container on every render; zoomFactor is only the user's manual pinch on top of
  // overview's fit, so newly added/removed days keep the path correctly framed without a stale
  // scale left over from before the data changed.
  const [zoomFactor, setZoomFactor] = useState(1)
  const pinchState = useRef<{ startDistance: number; startScale: number } | null>(null)
  const activeTouches = useRef<Map<number, { x: number; y: number }>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const innerGroupRef = useRef<SVGGElement>(null)
  // Local path-space x currently centered horizontally — the "camera" the scroll view follows.
  // A ref, not state: it updates every scroll frame, and going through React state/re-render for
  // that would re-render the whole circle list at scroll frequency.
  const focalXRef = useRef(lastX)
  // Same as focalXRef, for the vertical camera position (see focusOn below).
  const focalYRef = useRef(lastY)
  // Tracks the last (todayDayId, days.length, today's x/y) combo the "bring today into view" effect
  // acted on, so a container resize alone (which reruns that effect but changes none of these) never
  // forces a recenter. See that effect below for the full rationale.
  const recenterKeyRef = useRef<string | null>(null)
  const prevZoomedOutRef = useRef(zoomedOut)

  const scale = zoomedOut ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, zoomFactor * overviewScale)) : scrollScale

  // In overview, the outer group centers the whole box on the container (static). In the scroll
  // view, the outer group is pinned at a fixed screen row (FOCUS_VIEWPORT_FRACTION down) forever —
  // it no longer depends on scroll position at all. All movement through history happens on the
  // inner group below, driven by the scroll-progress -> (x,y) camera position (see focusOn).
  const translateY = zoomedOut ? containerHeight / 2 - boxCenterY * scale : containerHeight * FOCUS_VIEWPORT_FRACTION
  // Height of the invisible spacer that gives the scroll container its physical scroll room — the
  // SVG itself stays pinned (position: sticky) at containerHeight, so this is the entire scrollable
  // range: scrollTop runs from 0 (first day) to exactly this value (last day), matching
  // `lastIndex * SCROLL_PX_PER_DAY` used to reset scrollTop below.
  const spacerHeight = zoomedOut ? 0 : Math.max(0, points.length - 1) * scrollPxPerDay
  // The point currently centered: the whole box in overview (static), or wherever the camera has
  // scrolled to in the scroll view (focalXRef/focalYRef, updated by the scroll handler below).
  const centeredX = zoomedOut ? boxCenterX : focalXRef.current
  const centeredY = zoomedOut ? boxCenterY : focalYRef.current

  function handleZoomToggle() {
    setZoomedOut((prev) => !prev)
    setZoomFactor(1)
  }

  // Move the camera to a *continuous* index into `points` (e.g. 2.4 = 40% of the way from day 2 to
  // day 3), linearly interpolating (x,y) between the two bracketing points. Days are laid down by
  // pathEngine as fixed-length steps (~DAY_SPACING_PX apart, see computePathPoints), so they're
  // already near-equidistant — interpolating between chronological neighbors like this is both
  // continuous (no jumps, unlike snapping to whichever point is nearest by y) and correct (never
  // locks onto a point from an unrelated loop just because the path doubled back near it).
  function focusOn(indexFloat: number) {
    const pts = pointsRef.current
    if (pts.length === 0) return
    const clamped = Math.max(0, Math.min(indexFloat, pts.length - 1))
    const i0 = Math.floor(clamped)
    const i1 = Math.min(i0 + 1, pts.length - 1)
    const frac = clamped - i0
    const p0 = pts[i0]
    const p1 = pts[i1]
    const x = p0.x + (p1.x - p0.x) * frac
    const y = p0.y + (p1.y - p0.y) * frac
    focalXRef.current = x
    focalYRef.current = y
    if (innerGroupRef.current) innerGroupRef.current.style.transform = `translate(${-x}px, ${-y}px)`
  }

  // Bring "today" into view whenever the scroll view becomes active (mount, or switching back
  // from overview), a new day starts, or today's own point moves (e.g. toggling a task shifts
  // today's heading/position without changing todayDayId or days.length) — otherwise a manual
  // scroll to browse old history is left alone, the same way the old center-on-today behavior
  // never fought a user who'd zoomed out. `recenterKeyRef` tracks the logical reasons to recenter,
  // so a bare container resize (which doesn't even appear in this effect's deps any more, now that
  // scroll position is index-based rather than pixel-based) never yanks a manually-scrolled view
  // back to today.
  useEffect(() => {
    if (zoomedOut) {
      prevZoomedOutRef.current = true
      return
    }
    const el = scrollContainerRef.current
    if (!el) return
    const enteringFocus = prevZoomedOutRef.current
    prevZoomedOutRef.current = false
    const key = `${todayDayId}:${days.length}:${lastX.toFixed(1)}:${lastY.toFixed(1)}`
    if (!enteringFocus && recenterKeyRef.current === key) return
    recenterKeyRef.current = key
    focusOn(lastIndex)
    el.scrollTop = lastIndex * scrollPxPerDay
  }, [zoomedOut, todayDayId, days.length, lastX, lastY, scrollPxPerDay])

  // Camera-follow: as the container scrolls, move the camera through `points` in lockstep, so the
  // user only ever scrolls vertically and the path's wander (both its curve and its own vertical
  // ups and downs) is always centered under them — a native listener (not React's onScroll) kept
  // off the render path and rAF-throttled, since this can fire at native scroll frequency.
  useEffect(() => {
    if (zoomedOut) return
    const el = scrollContainerRef.current
    if (!el) return
    let rafId: number | null = null
    function handleScroll() {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const el = scrollContainerRef.current
        if (!el) return
        focusOn(el.scrollTop / scrollPxPerDay)
      })
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [zoomedOut, scrollPxPerDay])

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
      <div
        ref={scrollContainerRef}
        className="hide-scrollbar"
        style={{ height: containerHeight, width: containerWidth, overflowY: zoomedOut ? 'hidden' : 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}
      >
      <svg
        width="100%"
        height={containerHeight}
        style={zoomedOut ? undefined : { position: 'sticky', top: 0, display: 'block' }}
        onPointerDown={zoomedOut ? handlePointerDown : undefined}
        onPointerMove={zoomedOut ? handlePointerMove : undefined}
        onPointerUp={zoomedOut ? handlePointerUp : undefined}
        onPointerCancel={zoomedOut ? handlePointerUp : undefined}
        className={zoomedOut ? 'touch-none' : undefined}
      >
        <g
          style={{
            transform: `translate(${containerWidth / 2}px, ${translateY}px) scale(${scale})`,
            transition: 'transform 200ms ease-out',
          }}
        >
          {/*
            The camera position lives on this inner group, split out from the outer one above, so it
            can be updated instantly on every scroll frame (see the camera-follow effect) without
            fighting the outer group's transition — which is reserved for scale changes on zoom
            toggle, far rarer. `-centeredX/-centeredY` are in pre-scale local units; the outer
            group's scale() above applies to it like everything else in its subtree, so they don't
            need to be pre-multiplied by scale here.
          */}
          <g ref={innerGroupRef} style={{ transform: `translate(${-centeredX}px, ${-centeredY}px)` }}>
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
                onClick={() =>
                  day && onDaySelect?.(day, containerWidth / 2 + (p.x - (zoomedOut ? boxCenterX : focalXRef.current)) * scale)
                }
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
        </g>
      </svg>
      {!zoomedOut && <div aria-hidden style={{ height: spacerHeight }} />}
      </div>

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
