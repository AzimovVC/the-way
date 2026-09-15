import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AWARD_PATH_D, ICON_PATH_D, LOCK_PATH_D } from '../../components/Icon'
import {
  DAY_CIRCLE_RADIUS,
  DAY_SPACING_PX,
  FOCUSED_DAYS_COUNT,
  GHOST_FUTURE_DAYS,
  MILESTONE_CHIP_DEPTH,
  MILESTONE_CHIP_FONT_SIZE,
  MILESTONE_CHIP_HEIGHT,
  MILESTONE_CLEARANCE_PX,
  WEEK_BOX_SIZE_RATIO,
} from '../../domain/config'
import { chipFitScale } from '../../domain/chipFit'
import {
  computeWeekBoxGeometry,
  milestoneChipBox,
  milestoneChipWidth,
  milestoneLabel,
} from '../../domain/decorGeometry'
import type { ColorTier, Day } from '../../domain/models'
import {
  computePathPoints,
  type MilestonePathPoint,
  type WeekBoxPoint,
} from '../../domain/pathEngine'
import { rightNormal } from '../../domain/pathCurve'
import { dailyQuestsFor } from '../../domain/quests'
import { describeArc, ringSegmentAngles } from '../ringSegments'

const MILESTONE_TIER_COLOR = { bronze: 'var(--rust-500)', gold: 'var(--marigold-500)', platinum: 'var(--cobalt-500)' } as const
const TODAY_RING_GAP_DEG = 16
const TODAY_RING_OFFSET = 8
const TODAY_RING_STROKE = 3.5

/** The "СЕГОДНЯ" pill, which rides beside today's circle on the path's normal (see its use below). */
const TODAY_LABEL_WIDTH = 64
const TODAY_LABEL_HEIGHT = 18
const TODAY_LABEL_GAP = 10

/**
 * Where to hang today's label relative to its circle. It sits on the normal — perpendicular to the
 * direction of travel — because that is the only direction the road is guaranteed to leave clear:
 * along the path, one slot up and one slot down are both occupied by circles.
 *
 * Of the two normals it takes whichever points more to the left, so the pill leans back over
 * ground the path has already covered rather than reaching out into the side the weekly boxes and
 * the zoom button occupy.
 */
function todayLabelAnchor(headingDeg: number, radius: number) {
  const normal = rightNormal(headingDeg)
  const side = normal.x > 0 ? -1 : 1
  const reach = radius + TODAY_RING_OFFSET + TODAY_LABEL_GAP + TODAY_LABEL_WIDTH / 2
  return { dx: normal.x * reach * side, dy: normal.y * reach * side }
}

const MIN_SCALE = 0.1
const MAX_SCALE = 3
// Fraction of the container's height, from the top, where "today" is scrolled to when the
// scroll view (re)centers on it. Only GHOST_FUTURE_DAYS circles live above today, so most of the
// height needs to go below it, toward the actual history — a bigger fraction here both starves
// that history of room and leaves dead space under the goal card. 0.24 is about one ghost circle
// plus a margin (this used to be 0.65, sized for when 3 ghosts were shown above instead of 1).
const FOCUS_VIEWPORT_FRACTION = 0.24
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

/**
 * A chip takes one ordinary slot in the snake — exactly DAY_SPACING_PX of road, the same as a day
 * circle — so its width no longer has to be reserved anywhere. What has to fit in that slot is only
 * its extent *along* the path, i.e. its half-height plus its plinth, and the engine leans the road
 * back toward vertical wherever a chip sits so that stays true on a bend (see
 * CHIP_STRAIGHTEN_RESPONSE_PX).
 *
 * Reserving the chip's full *width* instead — which is what the old layout did — is what opened
 * 156px craters in the rhythm either side of every НЕДЕЛЯ marker.
 *
 * `scale` closes the last gap: on a hairpin the road has no budget left to straighten with, so the
 * chip shrinks instead of overlapping (see chipFit.ts). It is 1 virtually everywhere.
 */
function milestoneChipGeometry(label: string, scale = 1) {
  return {
    width: milestoneChipWidth(label) * scale,
    height: MILESTONE_CHIP_HEIGHT * scale,
    depth: MILESTONE_CHIP_DEPTH * scale,
    fontSize: MILESTONE_CHIP_FONT_SIZE * scale,
  }
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
  /** Dev-only overrides for the path's geometry tuning — each defaults to its domain constant. */
  maxTurnPerDayDeg?: number
  avoidanceRadiusPx?: number
  zigzagAmplitudePx?: number
  avoidanceStrengthDeg?: number
  zigzagPeriodDays?: number
  wobbleSensitivity?: number
  maxWobblePx?: number
  /** Dev-only override: physical scroll px per day in the focus/scroll view — defaults to SCROLL_PX_PER_DAY. */
  scrollPxPerDay?: number
  /** Dev-only override: how many days fill the container height in the focus/scroll view — defaults to FOCUSED_DAYS_COUNT. Smaller = more zoomed in. */
  focusedDaysCount?: number
  /** Dev-only override: the weekly placeholder box's ideal size as a multiple of DAY_CIRCLE_RADIUS — defaults to WEEK_BOX_SIZE_RATIO. */
  weekBoxSizeRatio?: number
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
  avoidanceRadiusPx,
  zigzagAmplitudePx,
  avoidanceStrengthDeg,
  zigzagPeriodDays,
  wobbleSensitivity,
  maxWobblePx,
  scrollPxPerDay = SCROLL_PX_PER_DAY,
  focusedDaysCount = FOCUSED_DAYS_COUNT,
  weekBoxSizeRatio = WEEK_BOX_SIZE_RATIO,
  onDaySelect,
  onFutureTap,
}: PathViewProps) {
  // The scroll view's scale only depends on container height + the focus density, never on the
  // points themselves (see its full derivation below) — computed here, ahead of computePathPoints,
  // so the week-box geometry (which must be sized in screen px to guarantee it fits on screen) can
  // feed into that same layout pass instead of being bolted on after the fact.
  const scrollScale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, containerHeight / (focusedDaysCount * DAY_SPACING_PX)),
  )
  const weekBoxGeometry = useMemo(
    () => computeWeekBoxGeometry(containerWidth, scrollScale, DAY_CIRCLE_RADIUS * weekBoxSizeRatio),
    [containerWidth, scrollScale, weekBoxSizeRatio],
  )

  // One layout pass produces everything: day circles, milestone chips, weekly boxes and the
  // ghost circles past today are all read off the same curve at their own arc lengths, so they
  // cannot disagree about where the road is.
  //
  // Memoized because that pass is the expensive part of this component by a wide margin (a curve
  // integrated every few px over the whole history, plus a search for each weekly box's spot), and
  // most renders don't change any of its inputs: a pinch-zoom fires setZoomFactor on every
  // pointermove, opening the day card re-renders, and so does every container resize. The geometry
  // object above is memoized too, so it can be a dependency here rather than defeating this one
  // with a fresh identity each render.
  const { points, milestones: pathMilestones, weekBoxes, ghosts } = useMemo(
    () =>
      days.length > 0
        ? computePathPoints(days, {
            maxTurnPerDayDeg,
            avoidanceRadiusPx,
            zigzagAmplitudePx,
            avoidanceStrengthDeg,
            zigzagPeriodDays,
            wobbleSensitivity,
            maxWobblePx,
            weekBoxGeometry,
            ghostDays: showGhostFuture ? GHOST_FUTURE_DAYS : 0,
          })
        : {
            points: [],
            milestones: [] as MilestonePathPoint[],
            weekBoxes: [] as WeekBoxPoint[],
            ghosts: [] as { x: number; y: number }[],
          },
    [
      days,
      maxTurnPerDayDeg,
      avoidanceRadiusPx,
      zigzagAmplitudePx,
      avoidanceStrengthDeg,
      zigzagPeriodDays,
      wobbleSensitivity,
      maxWobblePx,
      weekBoxGeometry,
      showGhostFuture,
    ],
  )

  // Each chip's label and the scale it has to shrink to to clear its neighbours — an O(points) scan
  // per chip, so it rides in the same memo rather than being redone for every chip on every render.
  const chips = useMemo(
    () =>
      pathMilestones.map((m) => {
        const text = milestoneLabel(m.kind, m.n)
        // Every day circle is a candidate obstacle, not just the two the chip sits between: on a
        // switchback the lane coming back down passes within a chip's reach too. chipFitScale
        // filters by proximity itself, and returns 1 unless something is actually in the way.
        const fit = chipFitScale(m.x, m.y, milestoneChipBox(text), points, DAY_CIRCLE_RADIUS, MILESTONE_CLEARANCE_PX)
        return { ...m, text, fit }
      }),
    [pathMilestones, points],
  )

  // Kept in sync every render so the scroll listener's effect (which doesn't re-subscribe on every
  // data change — see its dependency array) always reads the current points, never a stale closure.
  const pointsRef = useRef(points)
  pointsRef.current = points
  const lastIndex = points.length - 1
  const lastX = points[lastIndex]?.x ?? 0
  const lastY = points[lastIndex]?.y ?? 0

  // Ghosts are part of what overview has to fit — they sit past today, so on a path whose last
  // stretch is climbing they are the topmost thing on screen. The 0 seed keeps this defined for an
  // empty history (and costs nothing otherwise: the path always starts at the origin).
  const { minX, maxX, minY, maxY } = useMemo(() => {
    let minX = 0
    let maxX = 0
    let minY = 0
    let maxY = 0
    for (const p of [...points, ...ghosts]) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    return { minX, maxX, minY, maxY }
  }, [points, ghosts])
  const boxCenterX = (minX + maxX) / 2
  const boxCenterY = (minY + maxY) / 2

  // scrollScale itself (a fixed "about this many days fill the screen vertically" density, so it
  // stays constant as you scroll with no rescaling jump) is computed above, ahead of
  // computePathPoints. Width doesn't factor into it: the camera continuously re-centers
  // horizontally on whatever's on screen (see focalXRef below), so only the path's *local* sideways
  // wobble (ZIGZAG_AMPLITUDE_PX + MAX_WOBBLE_PX, well under containerWidth at this scale) needs to
  // fit — never its cumulative drift over the whole history. The week box is the one exception,
  // which is exactly why its own geometry is pre-sized against containerWidth instead.
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

  // Where the point the inner group centres on (centeredX/centeredY below) lands on screen. The
  // two groups compose as `screen = translate + scale * (local − centered)`, so this is the whole
  // vertical placement: in overview the box centre goes to the middle of the container, and in the
  // scroll view the camera's current point is pinned at a fixed screen row (FOCUS_VIEWPORT_FRACTION
  // down) forever — it no longer depends on scroll position at all. All movement through history
  // happens on the inner group, driven by the scroll-progress -> (x,y) camera position (see focusOn).
  //
  // Note this is *not* `containerHeight / 2 − boxCenterY * scale` in overview: the inner group
  // already subtracts boxCenterY inside the same scale, so doing it here as well double-counts it
  // and pushes the whole path off-centre by its own height.
  const translateY = zoomedOut ? containerHeight / 2 : containerHeight * FOCUS_VIEWPORT_FRACTION
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

  function renderMilestoneChip(chip: (typeof chips)[number]) {
    const { kind, n, x: cx, y: cy, text, fit } = chip
    const { width: chipWidth, height, depth, fontSize } = milestoneChipGeometry(text, fit)
    return (
      <g key={n !== undefined ? `${kind}-${n}` : kind}>
        {/* plinth: a solid offset copy underneath, same idiom as the day circles' shadow */}
        <rect
          x={cx - chipWidth / 2}
          y={cy - height / 2 + depth}
          width={chipWidth}
          height={height}
          rx={height / 2}
          fill="var(--color-brand-plinth)"
        />
        <rect
          x={cx - chipWidth / 2}
          y={cy - height / 2}
          width={chipWidth}
          height={height}
          rx={height / 2}
          fill="var(--color-brand)"
        />
        <text
          x={cx}
          y={cy + fontSize / 3}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily="var(--font-sans)"
          fontWeight={700}
          letterSpacing={0.5 * fit}
          fill="var(--color-text-on-brand)"
        >
          {text}
        </text>
      </g>
    )
  }

  function renderWeekBox(box: WeekBoxPoint) {
    const { size, depth } = weekBoxGeometry
    return (
      <g key={`week-box-${box.n}-${box.slot}`}>
        {/* No connecting line to the day circle — like Duolingo's side illustrations, the box just
            nestles up against it (see WEEK_BOX_GAP_PX) rather than being tethered to it. */}
        {/* plinth: a solid offset copy underneath, same idiom as the day circles' shadow */}
        <rect
          x={box.x - size / 2}
          y={box.y - size / 2 + depth}
          width={size}
          height={size}
          rx={16}
          fill="var(--cobalt-700)"
        />
        <rect
          x={box.x - size / 2}
          y={box.y - size / 2}
          width={size}
          height={size}
          rx={16}
          fill="var(--cobalt-500)"
        />
      </g>
    )
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
                    {/* Beside the circle on the path's normal, not above it. Above is where the
                        next day's ghost circle sits — exactly one slot away, like every other
                        circle — so a label there is guaranteed to collide with it. The normal is
                        the one direction the road provably leaves empty. */}
                    {(() => {
                      const label = todayLabelAnchor(p.headingDeg, radius)
                      return (
                        <>
                          <rect
                            x={p.x + label.dx - TODAY_LABEL_WIDTH / 2}
                            y={cy + label.dy - TODAY_LABEL_HEIGHT / 2}
                            width={TODAY_LABEL_WIDTH}
                            height={TODAY_LABEL_HEIGHT}
                            rx={TODAY_LABEL_HEIGHT / 2}
                            fill="var(--marigold-tint)"
                          />
                          <text
                            x={p.x + label.dx}
                            y={cy + label.dy + 3.5}
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
                      )
                    })()}
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

          {/* Ghosts continue along the same curve past today, one slot apart like every other
              circle — so they keep the rhythm instead of shooting off on the last heading. */}
          {ghosts.map((g, n) => (
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
          ))}

          {chips
            // Overview stays to the big, one-time picture (month/half-year/year) — 'start' would
            // otherwise spam a long history with a chip right at its very beginning, and repeating
            // weekly markers would otherwise spam it with dozens of chips.
            .filter((m) => (zoomedOut ? m.kind !== 'start' && m.kind !== 'week' : true))
            .map((chip) => renderMilestoneChip(chip))}

          {/* Weekly boxes: overview would otherwise spam a long history with dozens of them. */}
          {!zoomedOut && weekBoxes.map((box) => renderWeekBox(box))}
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
