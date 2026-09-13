import type { ColorTier, Day } from './models'
import {
  DAY_BOUNDARY_HOUR,
  DAY_SPACING_PX,
  DRIFT_PX_PER_DEGREE,
  GREEN_THRESHOLD,
  MAX_ANGLE_PER_DAY,
  ROLLBACK_MULTIPLIER,
  SMOOTHING_WINDOW_DAYS,
  ZIGZAG_AMPLITUDE_PX,
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

function hashString(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return hash >>> 0
}

/** Deterministic, purely decorative left/right offset for a given date — stable across rerenders. */
export function zigzagOffset(dateISO: string, amplitude: number = ZIGZAG_AMPLITUDE_PX): number {
  const normalized = (hashString(dateISO) % 1000) / 1000
  return (normalized - 0.5) * 2 * amplitude
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

const MAX_HEADING_DEG = 170

/**
 * Turns a chronologically-sorted Day[] into path geometry. Pure, no side effects.
 *
 * Each day is a fixed-length step whose *direction* (not just sideways offset)
 * is set by the smoothed trend: a heading of 0 points straight up (toward the
 * goal banner), a strong sustained slump rotates the heading past ±90° so the
 * step actually points back down (toward the anti-goal banner) — "down" is
 * something you only do by consistently failing, never a side effect of one
 * bad day inside a good window.
 */
export function computePathPoints(days: Day[]): PathPoint[] {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const rawDeltas = sorted.map((day) => (day.frozen ? 0 : angleDelta(day.completionRate)))
  const smoothed = computeSmoothedAngles(rawDeltas)

  let x = 0
  let y = 0
  return sorted.map((day, i) => {
    const headingDeg = Math.max(-MAX_HEADING_DEG, Math.min(MAX_HEADING_DEG, smoothed[i]))
    const headingRad = (headingDeg * Math.PI) / 180
    const forwardX = Math.sin(headingRad)
    const forwardY = -Math.cos(headingRad)
    // Perpendicular to the heading — decorative wiggle only, same role as the old left/right zigzag.
    const wiggle = zigzagOffset(day.date)
    x += DAY_SPACING_PX * forwardX + wiggle * forwardY
    y += DAY_SPACING_PX * forwardY - wiggle * forwardX

    return {
      date: day.date,
      x,
      y,
      headingDeg,
      colorTier: day.frozen || day.colorTier === 'gray' ? 'gray' : computeColorTier(day.completionRate),
      frozen: day.frozen,
      completionRate: day.completionRate,
    }
  })
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
