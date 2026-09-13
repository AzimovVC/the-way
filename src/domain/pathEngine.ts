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
export function computePathPoints(
  days: Day[],
  maxTurnPerDayDeg: number = MAX_TURN_PER_DAY_DEG,
  minPointSeparationPx: number = MIN_POINT_SEPARATION_PX,
  zigzagAmplitudePx: number = ZIGZAG_AMPLITUDE_PX,
  avoidanceStrengthDeg: number = AVOIDANCE_STRENGTH_DEG,
  zigzagPeriodDays: number = ZIGZAG_PERIOD_DAYS,
  wobbleSensitivity: number = WOBBLE_SENSITIVITY,
  maxWobblePx: number = MAX_WOBBLE_PX,
): PathPoint[] {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const rawDeltas = sorted.map((day) => (day.frozen ? 0 : angleDelta(day.completionRate)))
  const smoothed = computeSmoothedAngles(rawDeltas)

  let x = 0
  let y = 0
  let heading = 0
  const positions: { x: number; y: number }[] = []
  const points: PathPoint[] = []
  // A point closer than this to the plain (no-avoidance) candidate is worth steering around —
  // wider than minPointSeparationPx so the correction kicks in a little before an actual overlap.
  const dangerRadius = minPointSeparationPx * 1.6

  for (let i = 0; i < sorted.length; i++) {
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

    const windowStart = Math.max(0, i - COLLISION_CHECK_WINDOW)
    const nearby = positions.slice(windowStart, i)
    // The immediate predecessor is always ~DAY_SPACING_PX away by construction — that's a normal
    // step, not a collision to steer around, so the proactive check only looks at older points.
    const nearbyForSteering = nearby.slice(0, -1)

    const candidateFor = (headingDeg: number) => {
      const rad = (headingDeg * Math.PI) / 180
      const fx = Math.sin(rad)
      const fy = -Math.cos(rad)
      return { x: x + DAY_SPACING_PX * fx + wiggle * fy, y: y + DAY_SPACING_PX * fy - wiggle * fx }
    }
    const nearestDist = (p: { x: number; y: number }) =>
      nearbyForSteering.reduce((min, other) => Math.min(min, Math.hypot(p.x - other.x, p.y - other.y)), Infinity)

    let bestHeading = heading + baseTurn
    let bestCandidate = candidateFor(bestHeading)
    let bestDist = nearestDist(bestCandidate)

    // Proactive steering: if the plain candidate would land dangerously close to an earlier
    // point, try borrowing extra turn (in either direction) to route around it smoothly,
    // instead of relying only on the post-hoc point-push below.
    if (bestDist < dangerRadius && avoidanceStrengthDeg > 0) {
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
    const resolved = resolveCollisions(bestCandidate, nearby, minPointSeparationPx, 16, { x, y })

    x = resolved.x
    y = resolved.y
    positions.push({ x, y })
    points.push({
      date: day.date,
      x,
      y,
      headingDeg,
      colorTier: day.frozen || day.colorTier === 'gray' ? 'gray' : computeColorTier(day.completionRate),
      frozen: day.frozen,
      completionRate: day.completionRate,
    })
  }

  return points
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
