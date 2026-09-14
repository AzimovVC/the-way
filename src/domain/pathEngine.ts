import type { ColorTier, Day } from './models'
import {
  AVOIDANCE_STRENGTH_DEG,
  DAY_BOUNDARY_HOUR,
  DAY_CIRCLE_RADIUS,
  DAY_SPACING_PX,
  DRIFT_PX_PER_DEGREE,
  GREEN_THRESHOLD,
  MAX_ANGLE_PER_DAY,
  MAX_TURN_PER_DAY_DEG,
  MAX_WOBBLE_PX,
  MIN_POINT_SEPARATION_PX,
  ROLLBACK_MULTIPLIER,
  SMOOTHING_WINDOW_DAYS,
  WOBBLE_SENSITIVITY,
  ZIGZAG_AMPLITUDE_PX,
  ZIGZAG_PERIOD_DAYS,
} from './config'

/**
 * Raw turn contributed by a single day. 1.0 -> +maxAnglePerDay (toward the
 * goal), 0.0 -> -maxAnglePerDay (toward the anti-goal), 0.5 -> ~0 (straight).
 */
export function angleDelta(completionRate: number, maxAnglePerDay: number = MAX_ANGLE_PER_DAY): number {
  return (completionRate - 0.5) * 2 * maxAnglePerDay
}

/** gold/green/red for a day the user actually visited. Gray is assigned separately for reconciled days. */
export function computeColorTier(completionRate: number, greenThreshold: number = GREEN_THRESHOLD): 'gold' | 'green' | 'red' {
  if (completionRate >= 1) return 'gold'
  if (completionRate >= greenThreshold) return 'green'
  return 'red'
}

/**
 * Trailing moving average of raw angle deltas (window includes the current
 * day, so today's result is reflected immediately). When the average turns
 * negative, it is amplified by rollbackMultiplier so a slump retreats faster
 * than a streak was built. A single bad day inside a good window is diluted
 * by the average and rarely flips the sign.
 */
export function computeSmoothedAngles(
  rawDeltas: number[],
  windowSize: number = SMOOTHING_WINDOW_DAYS,
  rollbackMultiplier: number = ROLLBACK_MULTIPLIER,
): number[] {
  const smoothed: number[] = []
  for (let i = 0; i < rawDeltas.length; i++) {
    const start = Math.max(0, i - windowSize + 1)
    const slice = rawDeltas.slice(start, i + 1)
    const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length
    smoothed.push(avg >= 0 ? avg : avg * rollbackMultiplier)
  }
  return smoothed
}

/** Cumulative horizontal drift of the whole column, derived from smoothed angles. */
export function computeColumnDrift(
  smoothedAngles: number[],
  pxPerDegree: number = DRIFT_PX_PER_DEGREE,
): number[] {
  const drift: number[] = []
  let acc = 0
  for (const angle of smoothedAngles) {
    acc += angle * pxPerDegree
    drift.push(acc)
  }
  return drift
}

/**
 * Purely decorative left/right offset, perpendicular to the day's heading. A fixed-period
 * sine (rather than per-day random noise) is what makes the path visibly snake back and
 * forth at a steady rhythm — including during a perfectly straight streak — the way
 * Duolingo's path does, instead of reading as jitter on top of an otherwise straight line.
 */
export function zigzagOffset(
  dayIndex: number,
  amplitude: number = ZIGZAG_AMPLITUDE_PX,
  periodDays: number = ZIGZAG_PERIOD_DAYS,
): number {
  if (periodDays <= 0) return 0
  return amplitude * Math.sin((2 * Math.PI * dayIndex) / periodDays)
}

export interface PathPoint {
  date: string
  x: number
  y: number
  /** Compass heading for this day's step, in degrees: 0 = straight up (toward the goal), ±90 = sideways, past ±90 = tipping down toward the anti-goal. */
  headingDeg: number
  colorTier: ColorTier
  frozen: boolean
  completionRate: number
}

const MAX_HEADING_DEG = 180

/** How many recent points to check a new point against — older points are already far away from forward travel, so this keeps the check cheap on long histories. */
const COLLISION_CHECK_WINDOW = 40

/** Shortest distance from point `p` to the segment `a`-`b`. */
function pointToSegmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lenSq = abx * abx + aby * aby
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq
  t = Math.max(0, Math.min(1, t))
  const closestX = a.x + t * abx
  const closestY = a.y + t * aby
  return Math.hypot(p.x - closestX, p.y - closestY)
}

/**
 * Nudges `candidate` away from any of `priorPoints` closer than `minSeparation`,
 * iterating a few times since resolving one overlap can create another. This is
 * the path's backstop against self-crossing: the turn-rate cap above makes
 * crossing rare, but a long enough run of wild swings could still trace a loop
 * tight enough to overlap without it. Purely geometric, no side effects.
 *
 * When `segmentStart` is given, this also checks the segment from `segmentStart`
 * to `candidate` against each prior point's circle — a sharp turn can produce an
 * endpoint that clears every centre-to-centre distance while the *line* drawn to
 * get there still cuts straight through an earlier circle, since a point-only
 * check never looks at what the connecting stroke passes through.
 *
 * Exported so callers placing extra decorative points near the path (e.g. the
 * ghost future-day circles in PathView) can keep them out of the same way.
 */
export function resolveCollisions(
  candidate: { x: number; y: number },
  priorPoints: { x: number; y: number }[],
  minSeparation: number = MIN_POINT_SEPARATION_PX,
  maxIterations = 16,
  segmentStart?: { x: number; y: number },
  circleRadius: number = DAY_CIRCLE_RADIUS,
): { x: number; y: number } {
  let point = candidate
  const segmentClearance = circleRadius + 8
  for (let iter = 0; iter < maxIterations; iter++) {
    let pushX = 0
    let pushY = 0
    let collided = false
    for (const other of priorPoints) {
      const dx = point.x - other.x
      const dy = point.y - other.y
      const dist = Math.hypot(dx, dy) || 0.001

      let violation = dist < minSeparation ? minSeparation - dist : 0
      // Skip the segment check for the point the segment itself starts at — it sits exactly on
      // the segment by construction (distance 0), which isn't a collision, just the line's origin.
      const isSegmentOrigin = segmentStart && Math.hypot(other.x - segmentStart.x, other.y - segmentStart.y) < 1e-6
      if (segmentStart && !isSegmentOrigin) {
        const segDist = pointToSegmentDistance(other, segmentStart, point)
        if (segDist < segmentClearance) violation = Math.max(violation, segmentClearance - segDist)
      }
      if (violation <= 0) continue

      collided = true
      // Overshoot slightly (not just the exact overlap) so multi-constraint cases — where
      // pushing away from one point moves the candidate toward another — still converge to
      // a result that clears minSeparation everywhere, rather than settling just short of it.
      const overlap = violation * 1.15
      pushX += (dx / dist) * overlap
      pushY += (dy / dist) * overlap
    }
    if (!collided) break
    point = { x: point.x + pushX, y: point.y + pushY }
  }
  return point
}

/**
 * Turns a chronologically-sorted Day[] into path geometry. Pure, no side effects.
 *
 * Each day is a fixed-length step whose *direction* (not just sideways offset)
 * is set by the smoothed trend: a heading of 0 points straight up (toward the
 * goal banner), a strong sustained slump rotates the heading past ±90° so the
 * step actually points back down (toward the anti-goal banner) — "down" is
 * something you only do by consistently failing, never a side effect of one
 * bad day inside a good window.
 *
 * The smoothed trend is only a *target* heading, though — the actual heading
 * turns toward it by at most maxTurnPerDayDeg per day (like a steering wheel
 * with inertia), so the path can never curl into a tighter loop than that
 * allows. If that's still not enough to clear an upcoming point, the heading
 * is allowed to borrow up to avoidanceStrengthDeg of extra turn to steer
 * around it (a smooth correction) before falling back to the resolveCollisions
 * point-push, which is a harder, more visible last resort.
 *
 * On top of the trend, each day's *deviation* from its own recent average
 * (rawDeltas[i] - smoothed[i]) also nudges the path sideways, up to
 * maxWobblePx — a day a bit better than your recent norm pulls one way, a bit
 * worse pulls the other, regardless of whether the overall trend is climbing
 * or falling. That's what keeps a winning streak from always leaning the
 * exact same direction (which the trend alone would, since its sign is just
 * "good vs. bad", not "left vs. right"). This rides along with the decorative
 * wave as a perpendicular offset rather than as a heading change: folding it
 * into the heading instead would make maxTurnPerDayDeg fight it every single
 * day (the deviation flips sign roughly as often as performance does, day to
 * day, far faster than a turn-rate cap sized to prevent self-crossing loops
 * would ever let heading track), damping it down to nearly nothing.
 */
export interface MilestonePathPoint {
  kind: MilestoneKind
  x: number
  y: number
  headingDeg: number
  /** 1-based occurrence count — only set for 'week' (see PathMilestone). */
  n?: number
}

/**
 * A weekly side-placeholder — reserved for a future mascot/quest slot — attached just off the path
 * next to the day circle at its index, connected by a short stub line, rather than sitting inline in
 * the snake like the other milestone chips.
 */
export interface WeekBoxPoint {
  /** 1-based week-occurrence count, same numbering as PathMilestone's 'week' entries. */
  n: number
  x: number
  y: number
  /** The day circle it's attached to — draw the connecting stub from here to (x, y). */
  attachX: number
  attachY: number
}

export interface PathLayout {
  points: PathPoint[]
  milestones: MilestonePathPoint[]
  weekBoxes: WeekBoxPoint[]
}

/** Required center-to-center clearance a point/obstacle needs from another obstacle's center. */
interface Obstacle {
  x: number
  y: number
  radius: number
}

/**
 * Picks a side (whichever has more room in the recently-placed path) for a weekly box attached to
 * the point at (px, py, headingDeg), then hard-pushes it away from anything still too close — the
 * same overshoot-push idiom as resolveCollisions, just against a single new candidate instead of a
 * whole path.
 */
function placeWeekBox(
  px: number,
  py: number,
  headingDeg: number,
  geometry: { offsetPx: number; separationPx: number },
  nearby: { x: number; y: number }[],
  obstacles: Obstacle[],
): { x: number; y: number } {
  const rad = (headingDeg * Math.PI) / 180
  // Perpendicular to the forward vector (sin, -cos) used elsewhere in this file.
  const perpX = Math.cos(rad)
  const perpY = Math.sin(rad)
  const candidateFor = (side: 1 | -1) => ({
    x: px + perpX * geometry.offsetPx * side,
    y: py + perpY * geometry.offsetPx * side,
  })
  const clearanceOf = (c: { x: number; y: number }) => {
    const pointMin = nearby.reduce((min, o) => Math.min(min, Math.hypot(c.x - o.x, c.y - o.y)), Infinity)
    const obstacleMin = obstacles.reduce((min, o) => Math.min(min, Math.hypot(c.x - o.x, c.y - o.y) - o.radius), Infinity)
    return Math.min(pointMin, obstacleMin)
  }
  const left = candidateFor(1)
  const right = candidateFor(-1)
  let best = clearanceOf(left) >= clearanceOf(right) ? left : right

  const targets: { x: number; y: number; minSep: number }[] = [
    ...nearby.map((o) => ({ x: o.x, y: o.y, minSep: geometry.separationPx })),
    ...obstacles.map((o) => ({ x: o.x, y: o.y, minSep: o.radius })),
  ]
  for (let iter = 0; iter < 8; iter++) {
    let pushed = false
    for (const o of targets) {
      const dx = best.x - o.x
      const dy = best.y - o.y
      const dist = Math.hypot(dx, dy) || 0.001
      if (dist < o.minSep) {
        const overshoot = (o.minSep - dist) * 1.15
        best = { x: best.x + (dx / dist) * overshoot, y: best.y + (dy / dist) * overshoot }
        pushed = true
      }
    }
    if (!pushed) break
  }
  return best
}

export function computePathPoints(
  days: Day[],
  maxTurnPerDayDeg: number = MAX_TURN_PER_DAY_DEG,
  minPointSeparationPx: number = MIN_POINT_SEPARATION_PX,
  zigzagAmplitudePx: number = ZIGZAG_AMPLITUDE_PX,
  avoidanceStrengthDeg: number = AVOIDANCE_STRENGTH_DEG,
  zigzagPeriodDays: number = ZIGZAG_PERIOD_DAYS,
  wobbleSensitivity: number = WOBBLE_SENSITIVITY,
  maxWobblePx: number = MAX_WOBBLE_PX,
  /** How much room (centre-to-centre) each kind of milestone chip needs reserved around it, keyed
   * by kind; a kind that's reached but not given a size here just gets a normal day-sized step.
   * 'start' has no earlier circle to reserve room from — its "step" is simply the very first thing
   * placed, walking away from the origin before day 0 follows. 'week' repeats (every 7th day) and
   * *also* spawns a side box (see weekBoxGeometry) independent of this chip. */
  milestoneStepPx: Partial<Record<MilestoneKind, number>> = {},
  /** Geometry for the weekly side-placeholder box: how far its centre sits from the day circle it's
   * attached to (offsetPx) and how much clearance (centre-to-centre) it needs from any day circle or
   * earlier box (separationPx) to never be overlapped by the path. Omit to disable weekly boxes.
   * Unrelated to the 'week' entry in milestoneStepPx — the chip and the box both fire on the same day
   * but are independent, and either can be enabled without the other. */
  weekBoxGeometry?: { offsetPx: number; separationPx: number },
): PathLayout {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const rawDeltas = sorted.map((day) => (day.frozen ? 0 : angleDelta(day.completionRate)))
  const smoothed = computeSmoothedAngles(rawDeltas)
  const allMilestones = computeMilestones(days)
  // Every milestone, 'week' included, reserves its own inline chip step. 'week' *also* spawns a
  // side box (below) — the chip and the box are unrelated features that both happen to fire on the
  // same day, so the same entries feed both maps.
  const chipMilestoneAtIndex = new Map(allMilestones.map((m) => [m.index, m]))
  const weekAtIndex = new Map(allMilestones.filter((m) => m.kind === 'week').map((m) => [m.index, m]))

  let x = 0
  let y = 0
  let heading = 0
  const positions: { x: number; y: number }[] = []
  const points: PathPoint[] = []
  const milestones: MilestonePathPoint[] = []
  const weekBoxes: WeekBoxPoint[] = []
  // Weekly boxes, once placed, stay here for the rest of generation so any later day the path
  // wanders back near one still steers around and hard-pushes off it, exactly like a day circle.
  const obstacles: Obstacle[] = []
  // A point closer than this to the plain (no-avoidance) candidate is worth steering around —
  // wider than minPointSeparationPx so the correction kicks in a little before an actual overlap.
  const dangerRadius = minPointSeparationPx * 1.6

  // Places one step forward from the current (x, y, heading) — through the exact same
  // steering/collision machinery for a real day or a milestone chip alike, so a milestone reserves
  // its own room in the snake instead of being squeezed into whatever gap the days around it happen
  // to leave. Returns the heading the step ended up at.
  function placeStep(stepDistance: number, minSeparation: number, wiggle: number, baseTurn: number): number {
    const windowStart = Math.max(0, positions.length - COLLISION_CHECK_WINDOW)
    const nearby = positions.slice(windowStart)
    // The immediate predecessor is always ~stepDistance away by construction — that's a normal
    // step, not a collision to steer around, so the proactive check only looks at older points.
    const nearbyForSteering = nearby.slice(0, -1)
    const stepDangerRadius = Math.max(dangerRadius, minSeparation * 1.6)

    const candidateFor = (headingDeg: number) => {
      const rad = (headingDeg * Math.PI) / 180
      const fx = Math.sin(rad)
      const fy = -Math.cos(rad)
      return { x: x + stepDistance * fx + wiggle * fy, y: y + stepDistance * fy - wiggle * fx }
    }
    // Obstacles (weekly boxes) have their own, generally larger, required clearance — remapped onto
    // the same scale as a plain point distance (where stepDangerRadius is the "getting close"
    // threshold) so the two can be compared and combined with a plain Math.min below.
    const nearestDist = (p: { x: number; y: number }) => {
      const pointMin = nearbyForSteering.reduce((min, other) => Math.min(min, Math.hypot(p.x - other.x, p.y - other.y)), Infinity)
      const obstacleMin = obstacles.reduce(
        (min, o) => Math.min(min, Math.hypot(p.x - o.x, p.y - o.y) - o.radius + stepDangerRadius),
        Infinity,
      )
      return Math.min(pointMin, obstacleMin)
    }

    let bestHeading = heading + baseTurn
    let bestCandidate = candidateFor(bestHeading)
    let bestDist = nearestDist(bestCandidate)

    // Proactive steering: if the plain candidate would land dangerously close to an earlier
    // point, try borrowing extra turn (in either direction) to route around it smoothly,
    // instead of relying only on the post-hoc point-push below.
    if (bestDist < stepDangerRadius && avoidanceStrengthDeg > 0) {
      for (const extra of [avoidanceStrengthDeg, -avoidanceStrengthDeg]) {
        const tryHeading = Math.max(-MAX_HEADING_DEG, Math.min(MAX_HEADING_DEG, heading + baseTurn + extra))
        const tryCandidate = candidateFor(tryHeading)
        const tryDist = nearestDist(tryCandidate)
        if (tryDist > bestDist) {
          bestDist = tryDist
          bestHeading = tryHeading
          bestCandidate = tryCandidate
        }
      }
    }

    heading = bestHeading
    const headingDeg = heading
    // segmentStart (the previous point) catches not just an overlapping endpoint but a line to
    // it that grazes an earlier circle — the actual complaint with sharp reversals.
    let resolved = resolveCollisions(bestCandidate, nearby, minSeparation, 16, { x, y })
    // Second backstop: a hard push off any weekly box still too close, same overshoot idiom as
    // resolveCollisions, then re-check against nearby points in case that push created a new overlap.
    for (let iter = 0; iter < 4; iter++) {
      let pushed = false
      for (const o of obstacles) {
        const dx = resolved.x - o.x
        const dy = resolved.y - o.y
        const dist = Math.hypot(dx, dy) || 0.001
        if (dist < o.radius) {
          const overshoot = (o.radius - dist) * 1.15
          resolved = { x: resolved.x + (dx / dist) * overshoot, y: resolved.y + (dy / dist) * overshoot }
          pushed = true
        }
      }
      if (!pushed) break
      resolved = resolveCollisions(resolved, nearby, minSeparation, 4, { x, y })
    }

    x = resolved.x
    y = resolved.y
    positions.push({ x, y })
    return headingDeg
  }

  for (let i = 0; i < sorted.length; i++) {
    // A milestone lands "before" the day at this index — insert its step first, reusing the exact
    // same distance as this milestone's own required clearance on both the way in and the way out,
    // so the day right after it also ends up the correct distance from the chip.
    const milestone = chipMilestoneAtIndex.get(i)
    let dayStepDistance = DAY_SPACING_PX
    if (milestone) {
      const milestoneStepDistance = milestoneStepPx[milestone.kind] ?? DAY_SPACING_PX
      const headingDeg = placeStep(milestoneStepDistance, milestoneStepDistance, 0, 0)
      milestones.push({ kind: milestone.kind, x, y, headingDeg, n: milestone.n })
      dayStepDistance = milestoneStepDistance
    }

    const day = sorted[i]
    const target = Math.max(-MAX_HEADING_DEG, Math.min(MAX_HEADING_DEG, smoothed[i]))
    const baseTurn = Math.max(-maxTurnPerDayDeg, Math.min(maxTurnPerDayDeg, target - heading))
    const varianceWobble = Math.max(
      -maxWobblePx,
      Math.min(maxWobblePx, (rawDeltas[i] - smoothed[i]) * wobbleSensitivity),
    )
    // Perpendicular to the heading — decorative offset only, same role as the old left/right
    // zigzag, now the sum of an ambient wave and the data-driven wobble above.
    const wiggle = zigzagOffset(i, zigzagAmplitudePx, zigzagPeriodDays) + varianceWobble
    const headingDeg = placeStep(dayStepDistance, minPointSeparationPx, wiggle, baseTurn)

    points.push({
      date: day.date,
      x,
      y,
      headingDeg,
      colorTier: day.frozen || day.colorTier === 'gray' ? 'gray' : computeColorTier(day.completionRate),
      frozen: day.frozen,
      completionRate: day.completionRate,
    })

    const week = weekAtIndex.get(i)
    if (week && weekBoxGeometry) {
      const windowStart = Math.max(0, positions.length - 1 - COLLISION_CHECK_WINDOW)
      const nearby = positions.slice(windowStart, -1)
      const box = placeWeekBox(x, y, headingDeg, weekBoxGeometry, nearby, obstacles)
      weekBoxes.push({ n: week.n ?? 0, x: box.x, y: box.y, attachX: x, attachY: y })
      obstacles.push({ x: box.x, y: box.y, radius: weekBoxGeometry.separationPx })
    }
  }

  return { points, milestones, weekBoxes }
}

export type MilestoneKind = 'start' | 'week' | 'month' | 'halfYear' | 'year'

export interface PathMilestone {
  kind: MilestoneKind
  /** Index into the sorted days/points array of the first day on/after the milestone. */
  index: number
  /** 1-based occurrence count — only set for 'week', which repeats (every 7th day), unlike the other, one-time kinds. */
  n?: number
}

/** Elapsed-days threshold (from the first day) at which each one-time milestone is reached; 'start' has none (it's just index 0), and 'week' isn't here since it repeats — see WEEK_INTERVAL_DAYS. */
const MILESTONE_THRESHOLD_DAYS: Record<Exclude<MilestoneKind, 'start' | 'week'>, number> = {
  month: 30,
  halfYear: 182,
  year: 365,
}

/** 'week' repeats every this many days (7, 14, 21, ...), unlike the other, one-time milestones. */
const WEEK_INTERVAL_DAYS = 7

/**
 * Finds where each calendar milestone falls in a chronologically-sorted Day[], for drawing the
 * path's section dividers: the start of history, every 7th day since (repeating), and the one-time
 * month/half-year/year marks. Each is placed at the first day whose elapsed time since the first day
 * meets its threshold — it's calendar time, not a count of visited days, so it still lands correctly
 * across gray/reconciled gap days. Returned sorted by index (chronological order).
 */
export function computeMilestones(days: Day[]): PathMilestone[] {
  if (days.length === 0) return []
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const startMs = toUTCms(sorted[0].date)
  const milestones: PathMilestone[] = [{ kind: 'start', index: 0 }]

  for (let n = 1; ; n++) {
    const thresholdMs = startMs + n * WEEK_INTERVAL_DAYS * 86_400_000
    const index = sorted.findIndex((day) => toUTCms(day.date) >= thresholdMs)
    if (index <= 0) break
    milestones.push({ kind: 'week', index, n })
  }

  for (const kind of Object.keys(MILESTONE_THRESHOLD_DAYS) as Exclude<MilestoneKind, 'start' | 'week'>[]) {
    const thresholdMs = startMs + MILESTONE_THRESHOLD_DAYS[kind] * 86_400_000
    const index = sorted.findIndex((day) => toUTCms(day.date) >= thresholdMs)
    if (index > 0) milestones.push({ kind, index })
  }

  return milestones.sort((a, b) => a.index - b.index)
}

/** Returns copies of days with pathAngleDelta, columnDriftX and colorTier (gray days excluded) filled in. */
export function applyPathGeometry(days: Day[]): Day[] {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const rawDeltas = sorted.map((day) => (day.frozen ? 0 : angleDelta(day.completionRate)))
  const smoothed = computeSmoothedAngles(rawDeltas)
  const drift = computeColumnDrift(smoothed)

  return sorted.map((day, i) => ({
    ...day,
    pathAngleDelta: smoothed[i],
    columnDriftX: drift[i],
    colorTier: day.frozen || day.colorTier === 'gray' ? 'gray' : computeColorTier(day.completionRate),
  }))
}

function parseISODate(dateISO: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateISO.split('-').map(Number)
  return { y, m, d }
}

function toUTCms(dateISO: string): number {
  const { y, m, d } = parseISODate(dateISO)
  return Date.UTC(y, m - 1, d)
}

function formatUTCDate(ms: number): string {
  const date = new Date(ms)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysISO(dateISO: string, days: number): string {
  return formatUTCDate(toUTCms(dateISO) + days * 86_400_000)
}

/**
 * Logical "today" for closing a day, given the day closes at DAY_BOUNDARY_HOUR
 * local time rather than midnight. timezoneOffsetMinutes is minutes east of
 * UTC (add it to UTC time to get local time); defaults to the host's offset.
 */
export function getLogicalToday(
  now: Date,
  timezoneOffsetMinutes: number = -now.getTimezoneOffset(),
): string {
  const shifted = new Date(now.getTime() + timezoneOffsetMinutes * 60_000)
  let y = shifted.getUTCFullYear()
  let m = shifted.getUTCMonth()
  let d = shifted.getUTCDate()
  if (shifted.getUTCHours() < DAY_BOUNDARY_HOUR) {
    const prev = new Date(Date.UTC(y, m, d) - 86_400_000)
    y = prev.getUTCFullYear()
    m = prev.getUTCMonth()
    d = prev.getUTCDate()
  }
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Fills the gap between lastKnownDate (exclusive) and today (exclusive) with
 * gray, empty Day placeholders so the path honestly keeps moving even though
 * the app was never opened on those dates. Returns a new, sorted array;
 * callers should run applyPathGeometry afterward to (re)compute drift.
 */
export function reconcileMissedDays(lastKnownDate: string, today: string, days: Day[]): Day[] {
  const known = new Set(days.map((day) => day.date))
  const gapDays: Day[] = []

  let cursor = addDaysISO(lastKnownDate, 1)
  while (cursor < today) {
    if (!known.has(cursor)) {
      gapDays.push({
        id: crypto.randomUUID(),
        date: cursor,
        tasks: [],
        completionRate: 0,
        pathAngleDelta: 0,
        columnDriftX: 0,
        colorTier: 'gray',
        frozen: false,
        newGoalIds: [],
      })
    }
    cursor = addDaysISO(cursor, 1)
  }

  return [...days, ...gapDays].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
