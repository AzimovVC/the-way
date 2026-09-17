import { boxIntrusionPx, type ChipFitBox } from './chipFit'
import type { ColorTier, Day, TaskTemplate } from './models'
import { isDayExcused, monthMarkElapsed, templatesAskedOn, weekMarkElapsed } from './schedule'
import {
  AVOIDANCE_IGNORE_RECENT_DAYS,
  WEEK_INTERVAL_DAYS,
  AVOIDANCE_RADIUS_PX,
  AVOIDANCE_STRENGTH_DEG,
  CHIP_STRAIGHTEN_RESPONSE_PX,
  CHIP_STRAIGHTEN_WINDOW_DAYS,
  DAY_BOUNDARY_HOUR,
  DAY_SPACING_PX,
  DRIFT_PX_PER_DEGREE,
  GHOST_FUTURE_DAYS,
  GREEN_THRESHOLD,
  MAX_ANGLE_PER_DAY,
  MAX_TARGET_SLEW_DEG_PER_DAY,
  MAX_TURN_PER_DAY_DEG,
  MAX_WOBBLE_PX,
  MEANDER_PX,
  ROLLBACK_MULTIPLIER,
  SMOOTHING_WINDOW_DAYS,
  TREND_RESPONSE_PX,
  WAVE_YIELD_FRACTION,
  WOBBLE_SENSITIVITY,
  ZIGZAG_AMPLITUDE_PX,
  ZIGZAG_PERIOD_DAYS,
} from './config'
import {
  CURVE_STEP_PX,
  integrateCurve,
  normalizeAngleDeg,
  rightNormal,
  sampleCurve,
  waveCurvatureDegPerPx,
  type CurveSample,
} from './pathCurve'

/**
 * Raw turn contributed by a single day. 1.0 -> +maxAnglePerDay (toward the
 * goal), 0.0 -> -maxAnglePerDay (away from it), 0.5 -> ~0 (straight).
 *
 * This is the *analytics* signal (see applyPathGeometry) — "was this day pulling you forward
 * or back", used for trend arrows and streak runs. It is no longer what aims the drawn path:
 * that comes from targetHeadingDeg below, which reads the smoothed completion rate directly.
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
  return trailingMean(rawDeltas, windowSize).map((avg) => (avg >= 0 ? avg : avg * rollbackMultiplier))
}

/** Trailing moving average, window inclusive of the current element (so today's value counts immediately). */
function trailingMean(series: number[], windowSize: number): number[] {
  const out: number[] = []
  for (let i = 0; i < series.length; i++) {
    const slice = series.slice(Math.max(0, i - windowSize + 1), i + 1)
    out.push(slice.reduce((sum, v) => sum + v, 0) / slice.length)
  }
  return out
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
 * The heading the path aims for, given a trailing-average completion rate: 0° is straight up
 * (toward the goal), 180° is straight down (back the way you came).
 *
 *   r ≥ 0.50 ->   0°   keeping up: climb straight up the column
 *   r = 0.35 ->  54°
 *   r = 0.25 ->  90°   treading water — travelling, gaining nothing
 *   r = 0.10 -> 144°
 *   r = 0.00 -> 180°   straight back down, away from the goal
 *
 * Everything at or above the threshold aims at **exactly** vertical, and that matters more than
 * it looks. A steady-state heading of θ drifts the whole column sideways by sin(θ) of every step
 * it ever takes, forever: the old model's best case was a sustained +36°, so a flawless month
 * wandered ~2250px off to one side and the snake read as a long diagonal rather than as a road.
 * Any non-zero tilt for an ordinary "doing fine" user has that same unbounded drift in it, so the
 * good state has to be a column, not a lean.
 *
 * How *well* you are doing above the threshold is then carried by the width of the path's weave
 * instead of by its direction (see the wobble term in computePathPoints): a perfect streak walks a
 * tight, confident line, a scrappier one meanders. Below the threshold, direction takes over and
 * the road tips downhill, away from the goal.
 */
export function targetHeadingDeg(smoothedRate: number, greenThreshold: number = GREEN_THRESHOLD): number {
  const r = Math.max(0, Math.min(1, smoothedRate))
  if (r >= greenThreshold) return 0
  return 180 * (1 - r / Math.max(1e-6, greenThreshold))
}

/** Trailing moving average of completion rate, same window as computeSmoothedAngles. */
export function smoothCompletionRates(rates: number[], windowSize: number = SMOOTHING_WINDOW_DAYS): number[] {
  return trailingMean(rates, windowSize)
}

export interface PathPoint {
  date: string
  x: number
  y: number
  /** Compass heading for this day's step, in degrees: 0 = straight up (toward the goal), ±90 = sideways, past ±90 = tipping downhill, away from it. */
  headingDeg: number
  colorTier: ColorTier
  frozen: boolean
  completionRate: number
}

export interface MilestonePathPoint {
  kind: MilestoneKind
  x: number
  y: number
  headingDeg: number
  /** 1-based occurrence count — set for the repeating kinds (see PathMilestone). */
  n?: number
  /**
   * The day the mark stands on. Carried here because a weekly badge is tappable and opens that
   * week's summary, and the badge is the only thing on screen that knows which week it means —
   * reading it back off x/y would be guessing at what the geometry already settled.
   */
  date: string
  /**
   * Где метка стоит на той же шкале дней, по которой считает скролл, — дробное число между двумя
   * соседними днями.
   *
   * Чип занимает собственный слот дороги, но в счёте дней слота у него нет: индексы скролла идут
   * подряд по `points`, и между днём k−1 и днём k метка лежит ровно посередине. Это нужно подъёму
   * фокуса: без числа на этой шкале он умеет поднимать только дни, и метка одна оставалась бы
   * лежать, пока соседи встают.
   */
  atDayIndex: number
}

/**
 * A weekly side-placeholder — reserved for a future mascot/quest slot — sitting just off the path
 * rather than inline in the snake like the milestone chips.
 *
 * It is placed in one of the *bays* of the decorative wave: the points where the serpentine has
 * swung as far to one side as it is going to, and the open ground on the outside of that bend is
 * at its widest. That is where Duolingo puts its owl and its treasure chest, and it is why those
 * never look wedged in — the space was already there, rather than being made by shoving the path
 * out of the way. Consecutive bays alternate sides for free, so a week's two boxes land one left,
 * one right without anyone having to decide.
 */
export interface WeekBoxPoint {
  /** 1-based week-occurrence count, same numbering as PathMilestone's 'week' entries. */
  n: number
  /** Which of that week's two boxes this is (index into WEEK_BOX_OFFSET_DAYS) — unique together with `n`. */
  slot: number
  x: number
  y: number
  /** Where on the path the box sits beside — the bay's own centre, so the side it went to is `sign(x - attachX)`. */
  attachX: number
}

export interface PathLayout {
  points: PathPoint[]
  milestones: MilestonePathPoint[]
  weekBoxes: WeekBoxPoint[]
  /** Decorative locked circles past today, continuing along the same curve. */
  ghosts: { x: number; y: number }[]
}

export interface PathLayoutOptions {
  /** Total curvature budget in degrees of turn per day — sets the path's tightest turn radius. */
  maxTurnPerDayDeg?: number
  /** How close the path has to come to a stretch of its own older history before it starts bending away, in px. 0 disables it. */
  avoidanceRadiusPx?: number
  /** Lateral amplitude of the decorative wave, in px. */
  zigzagAmplitudePx?: number
  /** Strength of the steer-away-from-older-history term, in degrees per day. */
  avoidanceStrengthDeg?: number
  /** Days of travel per full wave cycle. */
  zigzagPeriodDays?: number
  /** Px of extra wave amplitude per degree a day deviates from its own recent average. */
  wobbleSensitivity?: number
  /** Cap on that extra amplitude. */
  maxWobblePx?: number
  /**
   * Geometry for the weekly side box: how far its centre sits from the path, and the centre-to-centre
   * distance it needs from each of the three things it can collide with. The view owns these numbers
   * because it owns the box's, the circle's and the chip's pixel sizes; the engine owns where the box
   * goes. Omit to place no boxes.
   */
  weekBoxGeometry?: {
    offsetPx: number
    /** Centre-to-centre distance the box keeps from a day circle — circles are round, so a radius is exact here. */
    separationPx: number
    /** The box's own footprint. Boxes keep clear of other boxes and of milestone chips as rectangles rather than as discs. */
    footprint: ChipFitBox
    /** The widest milestone chip's footprint, for that same rectangle test. */
    chipFootprint: ChipFitBox
    /** Daylight kept between those rectangles. */
    clearancePx: number
  }
  /** Extra locked circles to continue past today. */
  ghostDays?: number
  /**
   * Smoothed completion rate at or above which the road aims straight at the goal. Below it, the
   * road tips downhill, away from the goal (see targetHeadingDeg). Exposed here because where this line
   * sits *is* the app's definition of "you are off track": with the default smoothing window of
   * four days, 0.5 makes two missed days in a row cost exactly nothing, while 0.6 makes the second
   * miss the first one that shows. Which of those the road should say is a judgement about voice,
   * not a derivation, so it is tunable.
   */
  greenThreshold?: number
  /** How eagerly the heading chases the trend's target, in px of travel per unit of correction. Lower turns sooner; see TREND_RESPONSE_PX. */
  trendResponsePx?: number
}

/** One position along the snake. Days and milestone chips both take exactly one, DAY_SPACING_PX of arc apart. */
interface Slot {
  kind: 'day' | 'chip'
  dayIndex: number
  milestone?: PathMilestone
  /**
   * Место чипа на шкале дней — дробное, потому что чип стоит между двумя днями. Своё у каждого:
   * когда 1-е число выпало на понедельник, перед одним днём стоят две метки подряд, и общее число
   * на двоих означало бы, что подъём под фокусом видит их в одной точке — а тело умеет тянуться
   * только у последней, кто его занял.
   */
  atDayIndex?: number
}

/**
 * Buckets points by grid cell so "is there anything near me?" is answered in constant time
 * instead of by scanning the whole history — used by the self-avoidance term on every one of the
 * several thousand integration steps, and by the weekly-box search for every candidate spot it
 * tries. Both are otherwise O(days) inside a loop that is itself O(days).
 *
 * Cells are sized to the query radius, so the 3x3 block around a point contains everything within
 * that radius of it (and a little more, which callers filter).
 */
class PointGrid {
  private cells = new Map<number, { x: number; y: number; s: number }[]>()
  private cellSize: number

  constructor(cellSize: number) {
    this.cellSize = cellSize
  }

  private key(cx: number, cy: number): number {
    // Cantor-ish pairing into a single number key — cheaper than building a string per lookup.
    return (cx + 32768) * 65536 + (cy + 32768)
  }

  /** `s` is the arc length the point was laid down at, for callers that care how old it is. */
  add(x: number, y: number, s = 0): void {
    const k = this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize))
    const cell = this.cells.get(k)
    if (cell) cell.push({ x, y, s })
    else this.cells.set(k, [{ x, y, s }])
  }

  /**
   * Visits every stored point in the 3x3 cell block around (x, y). A callback rather than a
   * returned array: this runs once per integration step, and an array per call is thousands of
   * throwaway allocations per layout.
   */
  forEachNear(x: number, y: number, visit: (px: number, py: number, ps: number) => void): void {
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = this.cells.get(this.key(cx + dx, cy + dy))
        if (!cell) continue
        for (const entry of cell) visit(entry.x, entry.y, entry.s)
      }
    }
  }
}

/**
 * Turns a chronologically-sorted Day[] into path geometry. Pure, no side effects.
 *
 * The path is built as one continuous curve (see pathCurve.ts) and then *sampled* — day circles,
 * milestone chips and weekly boxes are all read off it at chosen arc lengths. Nothing is placed
 * and then moved: every influence on the shape is a curvature term, they are summed, and the sum
 * is clamped once to maxTurnPerDayDeg. The consequences are worth stating, because they are the
 * whole reason for this design:
 *
 *  - **Day circles are exactly DAY_SPACING_PX apart, always.** Not approximately, not on average.
 *    A milestone chip takes one slot of exactly the same length, so the rhythm does not break
 *    around it either.
 *  - **The path cannot kink**, because curvature is continuous in arc length.
 *  - **A reversal cannot retrace the stretch it came up.** Turning 180° takes a half-circle of
 *    radius ≥ 1/κmax, so the descent necessarily comes back down a lane ~167px to the side —
 *    wide enough for two day circles to pass with room to spare. See MAX_TURN_PER_DAY_DEG.
 *
 * The curvature terms, in the order they are combined:
 *
 *  1. **trend** — steers toward targetHeadingDeg for the day being travelled through. This is the
 *     only term that carries meaning; everything else is either decoration or safety.
 *  2. **chip straightening** — leans the road back toward vertical where a milestone chip sits,
 *     so the wide horizontal pill fits its single slot (see CHIP_STRAIGHTEN_DEG_PER_DAY).
 *  3. **wave** — the decorative serpentine, as a sinusoidal curvature. Fades out as the trend
 *     claims the budget, so a hard reversal is a clean arc and completes in ~4 days rather than ~8.
 *  4. **avoidance** — bends away from stretches of its own history laid down days ago. Insurance
 *     for the long-range case only; the turn radius above is what does the real work.
 */
export function computePathPoints(days: Day[], options: PathLayoutOptions = {}): PathLayout {
  const {
    maxTurnPerDayDeg = MAX_TURN_PER_DAY_DEG,
    avoidanceRadiusPx = AVOIDANCE_RADIUS_PX,
    zigzagAmplitudePx = ZIGZAG_AMPLITUDE_PX,
    avoidanceStrengthDeg = AVOIDANCE_STRENGTH_DEG,
    zigzagPeriodDays = ZIGZAG_PERIOD_DAYS,
    wobbleSensitivity = WOBBLE_SENSITIVITY,
    maxWobblePx = MAX_WOBBLE_PX,
    weekBoxGeometry,
    ghostDays = GHOST_FUTURE_DAYS,
    greenThreshold = GREEN_THRESHOLD,
    trendResponsePx = TREND_RESPONSE_PX,
  } = options

  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (sorted.length === 0) return { points: [], milestones: [], weekBoxes: [], ghosts: [] }

  // --- What the data asks the path to do -------------------------------------------------

  const rates = sorted.map((day) => (isDayExcused(day) ? greenThreshold : day.completionRate))
  const smoothedRates = smoothCompletionRates(rates)
  // Rate-limit the target itself, not just the steering. Alternating good/bad days otherwise
  // demand a full 180° flip every few days, and the path spends its life in U-turns describing
  // noise rather than a trend (see MAX_TARGET_SLEW_DEG_PER_DAY).
  const targets: number[] = []
  for (let i = 0; i < smoothedRates.length; i++) {
    const wanted = targetHeadingDeg(smoothedRates[i], greenThreshold)
    if (i === 0) {
      targets.push(wanted)
      continue
    }
    const delta = wanted - targets[i - 1]
    const capped = Math.max(-MAX_TARGET_SLEW_DEG_PER_DAY, Math.min(MAX_TARGET_SLEW_DEG_PER_DAY, delta))
    targets.push(targets[i - 1] + capped)
  }

  // How wide the weave runs. Two things share one clamped budget, so the column can never grow
  // past the width the reversal lane is sized for (see MAX_TURN_PER_DAY_DEG):
  //
  //  - **meander** — how far below a perfect streak the recent average sits. This is what carries
  //    "how well are you doing" above the threshold, now that every rate at or above it aims at the
  //    same vertical heading: a perfect streak walks a tight, confident line, a scrappier one
  //    wanders. Putting it in the *width* rather than in the direction is what keeps it from
  //    drifting the whole column sideways forever (see targetHeadingDeg).
  //  - **wobble** — how far this one day sits from its own recent norm.
  //
  // Both ride on the wave rather than being their own sideways nudge, because a one-day-wide
  // lateral offset is a very high-frequency signal: reproducing even 10px of it inside a single
  // 64px step would take ~7°/px of curvature, ten times the path's entire budget. That mismatch is
  // exactly what made the old per-day wobble read as a kink rather than as a lean.
  const rawDeltas = sorted.map((day) => (isDayExcused(day) ? 0 : angleDelta(day.completionRate)))
  const smoothedAngles = computeSmoothedAngles(rawDeltas)
  const wobbles = rawDeltas.map((raw, i) => {
    const meander = (1 - smoothedRates[i]) * MEANDER_PX
    const deviation = (raw - smoothedAngles[i]) * wobbleSensitivity
    return Math.max(-maxWobblePx, Math.min(maxWobblePx, meander + deviation))
  })

  // --- Slots: one per day, one per milestone chip, all the same length -------------------

  // Grouped, not a 1:1 map: more than one milestone can land on the same day — week 26 and the
  // half-year mark both fall on day 182, week 52 and the year mark both on day 365. Keying them
  // by index alone would silently drop one of each pair, so a user reaching six months would lose
  // that week's chip.
  const chipsAtDayIndex = new Map<number, PathMilestone[]>()
  for (const m of computeMilestones(days)) {
    const at = chipsAtDayIndex.get(m.index)
    if (at) at.push(m)
    else chipsAtDayIndex.set(m.index, [m])
  }
  const slots: Slot[] = []
  const slotOfDay: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    const chips = chipsAtDayIndex.get(i) ?? []
    // Чипы делят промежуток между предыдущим днём и этим поровну: один встаёт на середину, двое —
    // на треть и две трети. Слоты равной длины, поэтому эта дробь и есть настоящее расстояние.
    chips.forEach((milestone, k) =>
      slots.push({ kind: 'chip', dayIndex: i, milestone, atDayIndex: i - 1 + (k + 1) / (chips.length + 1) }),
    )
    slotOfDay[i] = slots.length
    slots.push({ kind: 'day', dayIndex: i })
  }

  const slotTarget = slots.map((slot) => targets[slot.dayIndex])
  const slotWobble = slots.map((slot) => wobbles[slot.dayIndex])

  // Past today there is no history to describe, so the road describes intent instead: the target
  // heading walks to the one a kept day aims at (straight up, at the goal) and the weave drops to
  // its base amplitude, since meander and wobble are both read off completion rates that do not
  // exist yet.
  //
  // This is not a forecast. The road turns under exactly the rules the real days turn under, so the
  // arc it opens is simply the way back to the goal from wherever the road is pointing — which
  // makes the *length* of that arc the honest cost of the slump that turned it away.
  //
  // That length is set by the slew and TREND_RESPONSE_PX together, not by MAX_TURN_PER_DAY_DEG:
  // the target walks toward the goal at MAX_TARGET_SLEW_DEG_PER_DAY while the heading chases it at
  // delta/TREND_RESPONSE_PX, so the heading lags about a slew-step behind and turns at roughly
  // 45/160 deg/px ≈ 18°/day — well inside the 44°/day the clamp would allow. A road pointing
  // pointing straight downhill therefore needs ~8 kept days to come fully about, not the ~4 the
  // turn cap alone suggests.
  const goalTargetDeg = targetHeadingDeg(1, greenThreshold)
  for (let n = 0; n < Math.max(0, ghostDays); n++) {
    const prev = slotTarget[slotTarget.length - 1]
    const delta = goalTargetDeg - prev
    const capped = Math.max(-MAX_TARGET_SLEW_DEG_PER_DAY, Math.min(MAX_TARGET_SLEW_DEG_PER_DAY, delta))
    slotTarget.push(prev + capped)
    slotWobble.push(0)
  }
  // Each chip straightens the road toward one vertical — up or down — and *which* one has to be
  // decided once and then held, not re-derived per integration step. Two rules that look equivalent
  // both fail: "whichever vertical the heading is nearest right now" flips its own target halfway
  // through a reversal, when the heading sweeps past ±90°, so the straightener spends the window
  // fighting itself (a chip inside a U-turn came out at 50° off vertical, worse than leaving it
  // alone); and "whichever vertical the trend is aiming for" is no better, because mid-reversal the
  // trend's own target is sitting at 90° and the choice is a coin toss.
  //
  // So it is latched instead, from the actual heading at the moment the road *enters* the chip's
  // window (see curvatureAt — arc length only ever increases, so that moment is well-defined), and
  // held until it leaves. Whichever way the road was already going when the sign came into view is
  // the way it stays.
  const chipArcs = slots.flatMap((slot, j) =>
    slot.kind === 'chip' ? [{ arc: j * DAY_SPACING_PX, verticalDeg: null as number | null }] : [],
  )

  /** Linear interpolation of a per-slot series at an arbitrary arc length. */
  function atArc(series: number[], s: number): number {
    const exact = s / DAY_SPACING_PX
    const i0 = Math.max(0, Math.min(series.length - 1, Math.floor(exact)))
    const i1 = Math.max(0, Math.min(series.length - 1, i0 + 1))
    const frac = Math.max(0, Math.min(1, exact - i0))
    return series[i0] + (series[i1] - series[i0]) * frac
  }

  // --- Curvature terms --------------------------------------------------------------------

  const maxCurvature = maxTurnPerDayDeg / DAY_SPACING_PX
  const maxAvoid = avoidanceStrengthDeg / DAY_SPACING_PX
  const waveLengthPx = Math.max(1, zigzagPeriodDays) * DAY_SPACING_PX
  const avoidRadius = Math.max(0, avoidanceRadiusPx)
  const avoidIgnorePx = AVOIDANCE_IGNORE_RECENT_DAYS * DAY_SPACING_PX
  const chipWindowPx = CHIP_STRAIGHTEN_WINDOW_DAYS * DAY_SPACING_PX

  // Either knob at 0 turns self-avoidance off entirely, and then the trail is not just unread but
  // must not be built: its cell size *is* the radius, so a 0 there collapses every sample into one
  // degenerate cell and makes each lookup a full scan of the history.
  const avoidanceOn = maxAvoid > 0 && avoidRadius > 0
  const trail = new PointGrid(Math.max(1, avoidRadius))
  // Decimate what goes into the grid — one entry per quarter-day of road is plenty to represent
  // a lane, and keeps the grid small over a year of history.
  const TRAIL_SAMPLE_EVERY_PX = 16
  let nextTrailAtS = 0
  // Chips are sorted by arc and `s` only ever increases, so a moving cursor is enough to find
  // the ones in range without scanning them all on every step.
  let chipCursor = 0

  function curvatureAt(s: number, state: Readonly<CurveSample>): number {
    if (avoidanceOn && s >= nextTrailAtS) {
      trail.add(state.x, state.y, s)
      nextTrailAtS = s + TRAIL_SAMPLE_EVERY_PX
    }

    // 4. avoidance — computed first because it also breaks the tie in an exactly-behind reversal.
    let avoidK = 0
    if (avoidanceOn && s > avoidIgnorePx) {
      const perp = rightNormal(state.headingDeg)
      const olderThanS = s - avoidIgnorePx
      trail.forEachNear(state.x, state.y, (px, py, ps) => {
        if (ps > olderThanS) return
        const dx = px - state.x
        const dy = py - state.y
        const dist = Math.hypot(dx, dy)
        if (dist >= avoidRadius || dist < 1e-6) return
        // Positive curvature turns right, so bend away from whichever side the old road is on.
        const side = Math.sign(dx * perp.x + dy * perp.y) || 1
        avoidK -= side * maxAvoid * (1 - dist / avoidRadius)
      })
      avoidK = Math.max(-maxAvoid, Math.min(maxAvoid, avoidK))
    }

    // 1. trend. There is no tie-break needed at exactly ±180 (target straight behind):
    // normalizeAngleDeg resolves that to +180, so the turn is deterministic rather than a
    // floating-point coin flip. Which way round it goes doesn't matter — going down and coming
    // back up necessarily lands in a lane beside the one it climbed, whichever way it turns,
    // and that displacement *is* the switchback.
    const delta = normalizeAngleDeg(atArc(slotTarget, s) - state.headingDeg)
    const trendK = Math.max(-maxCurvature, Math.min(maxCurvature, delta / trendResponsePx))

    // 2. chip straightening. Note this *replaces* the trend's steer rather than adding to it,
    // weighted by the same raised cosine that eases the window in and out. Summing the two let a
    // hard reversal keep most of the budget and leave the chip stranded at ~44° off vertical —
    // measurably the angle at which a chip's corners start biting into the day circles beside it.
    // Under a chip the road's job is to be straight; the trend can have it back either side.
    let chipWeight = 0
    let chipVerticalDeg = 0
    while (chipCursor < chipArcs.length && chipArcs[chipCursor].arc < s - chipWindowPx) chipCursor++
    for (let c = chipCursor; c < chipArcs.length && chipArcs[c].arc <= s + chipWindowPx; c++) {
      const chip = chipArcs[c]
      if (chip.verticalDeg === null) {
        const h = normalizeAngleDeg(state.headingDeg)
        chip.verticalDeg = Math.abs(h) <= 90 ? 0 : 180
      }
      const d = Math.abs(s - chip.arc) / chipWindowPx
      // sqrt of the raised cosine, not the raised cosine itself: the plain curve is still near zero
      // a day out from the chip, which hands that day back to the trend — and a day is most of the
      // road the straightening has to work with. This keeps the same smooth ease in and out (it is
      // still 0 at the window's edge and 1 at the chip) while reaching authority much sooner.
      const w = Math.sqrt(0.5 * (1 + Math.cos(Math.PI * d)))
      if (w > chipWeight) {
        chipWeight = w
        chipVerticalDeg = chip.verticalDeg
      }
    }
    let steerK = trendK
    if (chipWeight > 0) {
      const toVertical = normalizeAngleDeg(chipVerticalDeg - state.headingDeg)
      const straightenK = Math.max(-maxCurvature, Math.min(maxCurvature, toVertical / CHIP_STRAIGHTEN_RESPONSE_PX))
      steerK = trendK * (1 - chipWeight) + straightenK * chipWeight
    }
    steerK = Math.max(-maxCurvature, Math.min(maxCurvature, steerK))

    // 3. wave — yields its share of the budget to a hard turn, so a reversal is a clean arc, and
    // yields entirely to a chip. Without that second term the wave is at its *strongest* exactly
    // where it does the most harm: it fades only for a busy trend, and a road the straightening has
    // just brought to vertical is by that measure not busy at all, so the wave would promptly tilt
    // it back off vertical again right under the chip.
    const amplitude = Math.max(0, zigzagAmplitudePx + atArc(slotWobble, s))
    const waveK = waveCurvatureDegPerPx(amplitude, waveLengthPx) * Math.sin((2 * Math.PI * s) / waveLengthPx)
    const yieldAt = maxCurvature * WAVE_YIELD_FRACTION
    const waveFade = yieldAt > 0 ? Math.max(0, 1 - Math.abs(steerK) / yieldAt) * (1 - chipWeight) : 0

    return steerK + waveK * waveFade + avoidK
  }

  // --- Walk it, then read everything off by arc length -------------------------------------

  const lastSlotArc = (slots.length - 1) * DAY_SPACING_PX
  const samples = integrateCurve({
    lengthPx: lastSlotArc + Math.max(0, ghostDays) * DAY_SPACING_PX + CURVE_STEP_PX,
    maxCurvatureDegPerPx: maxCurvature,
    startHeadingDeg: targets[0],
    curvatureAt,
  })

  const points: PathPoint[] = []
  const milestones: MilestonePathPoint[] = []
  for (let j = 0; j < slots.length; j++) {
    const slot = slots[j]
    const at = sampleCurve(samples, j * DAY_SPACING_PX)
    if (slot.kind === 'chip' && slot.milestone) {
      milestones.push({
        kind: slot.milestone.kind,
        x: at.x,
        y: at.y,
        headingDeg: normalizeAngleDeg(at.headingDeg),
        n: slot.milestone.n,
        date: sorted[slot.milestone.index].date,
        atDayIndex: slot.atDayIndex ?? points.length - 0.5,
      })
      continue
    }
    const day = sorted[slot.dayIndex]
    points.push({
      date: day.date,
      x: at.x,
      y: at.y,
      headingDeg: normalizeAngleDeg(at.headingDeg),
      colorTier: isDayExcused(day) ? 'rest' : day.colorTier === 'gray' ? 'gray' : computeColorTier(day.completionRate),
      frozen: day.frozen,
      completionRate: day.completionRate,
    })
  }

  const ghosts: { x: number; y: number }[] = []
  for (let n = 1; n <= Math.max(0, ghostDays); n++) {
    const at = sampleCurve(samples, lastSlotArc + n * DAY_SPACING_PX)
    ghosts.push({ x: at.x, y: at.y })
  }

  // Weekly boxes. They *prefer* the wave's bays — the lateral extremes, a quarter-cycle in and
  // every half-cycle after, where the road has already swung aside and the open ground on the
  // outside of the bend is at its widest — but a bay is a preference, not a guarantee, because
  // there are not always enough of them: two boxes a week against a bay every half wavelength is
  // 2 per 7 days versus 1.75, and marching each displaced box outward to the next free bay turns
  // that small deficit into boxes piling up on each other hundreds of px from the week they
  // belong to (measured over a year of history).
  //
  // So each box is offered a short list of candidate spots, nearest-first, and takes the first one
  // that actually clears everything already on the page: the day circles, the milestone chips, and
  // the boxes placed before it. Falling back to its own day's arc — which is never more than a few
  // days from a bay anyway — bounds how far a box can end up from the week it marks.
  //
  // Note this searches only where a *decoration* goes. The road itself is untouched: nothing here
  // moves a point on the path, which is the invariant the whole curvature model rests on.
  const weekBoxes: WeekBoxPoint[] = []
  if (weekBoxGeometry) {
    const { offsetPx, separationPx, footprint, chipFootprint, clearancePx } = weekBoxGeometry
    const bayOf = (arc: number) => Math.round((arc - waveLengthPx / 4) / (waveLengthPx / 2))
    // A bay past either end of the road is not a bay. Clamping one onto the end instead of dropping
    // it collapses several candidates onto the same spot, which both wastes them and breaks the
    // left/right alternation of a week's pair near the end of a history.
    const arcOfBay = (bay: number) => {
      const arc = waveLengthPx / 4 + bay * (waveLengthPx / 2)
      return arc >= 0 && arc <= lastSlotArc ? arc : null
    }

    function spotAt(arc: number, side: number) {
      const at = sampleCurve(samples, arc)
      const perp = rightNormal(at.headingDeg)
      return { x: at.x + perp.x * offsetPx * side, y: at.y + perp.y * offsetPx * side, attachX: at.x, attachY: at.y }
    }

    // Only a circle within separationPx of a spot can block it, so the grid's 3x3 block around
    // that spot holds every circle that could — a full scan of the history per candidate spot is
    // what made this pass quadratic in the length of the history, and the dominant cost of the
    // whole layout over a year of days.
    const circleGrid = new PointGrid(separationPx)
    for (const p of points) circleGrid.add(p.x, p.y)

    /**
     * How badly a spot is blocked, in px of shortfall — at or below 0 when it clears everything.
     *
     * Day circles are round, so a centre distance is exact for them. Chips and other boxes are
     * rectangles, and treating those as discs demands room off a chip's ends that it does not
     * occupy — enough, over a year, to leave a box no legal spot at all.
     *
     * The one circle that does *not* count is the one at (attachX, attachY): that is the circle the
     * box is deliberately nestling against, and offsetPx is built to leave it exactly the small gap
     * that look wants — which is by definition less than the clearance every other circle gets. Held
     * to the larger clearance it fails by exactly the difference between the two, at every candidate
     * spot, so nothing below could ever be accepted and every box silently took the least-bad
     * branch. Slots are exactly DAY_SPACING_PX of arc apart, so at most one circle can lie within
     * half a slot of the attach point: that one, and only that one, is exempt.
     */
    function intrusionAt(x: number, y: number, attachX: number, attachY: number): number {
      let worst = -Infinity
      circleGrid.forEachNear(x, y, (px, py) => {
        if (Math.hypot(px - attachX, py - attachY) <= DAY_SPACING_PX / 2) return
        worst = Math.max(worst, separationPx - Math.hypot(px - x, py - y))
      })
      for (const b of weekBoxes) worst = Math.max(worst, boxIntrusionPx(b.x - x, b.y - y, footprint, footprint, clearancePx))
      for (const m of milestones) worst = Math.max(worst, boxIntrusionPx(m.x - x, m.y - y, footprint, chipFootprint, clearancePx))
      return worst
    }

    const sideTakenThisWeek = new Map<number, number>()
    for (const slot of computeWeekBoxSlots(days)) {
      const dayArc = slotOfDay[slot.index] * DAY_SPACING_PX
      const nearest = bayOf(dayArc)
      // The wave's lateral offset goes as -sin(2πs/L), so even bays bulge left and odd bays right,
      // and a bay's box goes on the outside of its own bulge where the open ground is. That also
      // alternates the sides of a week's pair for free, which is why every bay's own side is offered
      // before any bay's far side: alternation survives wherever the geometry allows it, and is
      // given up only for a box that would otherwise have nowhere to go.
      const bays = [0, -1, 1, -2, 2].map((d) => nearest + d)
      const candidates: { arc: number; side: number }[] = []
      // Own side (flip 1) for every bay first, then the far side (flip -1) for every bay.
      for (const flip of [1, -1]) {
        for (const bay of bays) {
          const arc = arcOfBay(bay)
          if (arc !== null) candidates.push({ arc, side: (bay % 2 === 0 ? -1 : 1) * flip })
        }
      }
      candidates.push({ arc: dayArc, side: -1 }, { arc: dayArc, side: 1 })
      // A week's two boxes read as a pair, so the second one prefers the side the first didn't take
      // — nearest-first within that preference, so it still lands next to the week it belongs to.
      // Alternating bays give this for free when both boxes get their first choice; this is what
      // keeps it true when one of them has been displaced.
      const takenSide = sideTakenThisWeek.get(slot.n)
      if (takenSide !== undefined) {
        candidates.sort((a, b) => Number(a.side === takenSide) - Number(b.side === takenSide))
      }

      let best: ReturnType<typeof spotAt> | null = null
      let bestSide = 0
      let bestIntrusion = Infinity
      for (const c of candidates) {
        const spot = spotAt(c.arc, c.side)
        const intrusion = intrusionAt(spot.x, spot.y, spot.attachX, spot.attachY)
        if (intrusion <= 0) {
          best = spot
          bestSide = c.side
          break
        }
        // Nothing clears outright: keep the least-bad rather than the last tried.
        if (intrusion < bestIntrusion) {
          bestIntrusion = intrusion
          best = spot
          bestSide = c.side
        }
      }
      if (best) {
        sideTakenThisWeek.set(slot.n, bestSide)
        weekBoxes.push({ n: slot.n, slot: slot.slot, x: best.x, y: best.y, attachX: best.attachX })
      }
    }
  }

  return { points, milestones, weekBoxes, ghosts }
}

export type MilestoneKind = 'start' | 'week' | 'month' | 'halfYear' | 'year'

export interface PathMilestone {
  kind: MilestoneKind
  /** Index into the sorted days/points array of the first day on/after the milestone. */
  index: number
  /** 1-based occurrence count — set for the repeating kinds, 'week' and 'month'. */
  n?: number
}

/**
 * Elapsed-days threshold (from the first day) at which each one-time milestone is reached. 'start'
 * has none — it is index 0 — and the repeating marks are not here: the week's is weekMarkElapsed,
 * the month's is monthMarkElapsed.
 *
 * 'month' used to sit here at day 30, once, and that was the whole trouble with it: a mark saying
 * «a month of road» that a person met exactly once in their life, on a day that was not the first
 * of anything. A month is a thing people count their lives in — it earns a signpost every time.
 */
export type OneOffMilestoneKind = Exclude<MilestoneKind, 'start' | 'week' | 'month'>

export const MILESTONE_THRESHOLD_DAYS: Record<OneOffMilestoneKind, number> = {
  halfYear: 182,
  year: 365,
}

/**
 * Where, within each 7-day stretch since the first day, its two side-placeholder boxes fall (see
 * WeekBoxPoint) — one early (day 2) and one around the middle (day 4).
 *
 * These stretches are **not** the app's weeks. The 'week' milestone chip lands on a Monday, because
 * a badge somebody can tap has to point at the same seven days every summary counts; these boxes
 * are blank placeholders for a future mascot, point at nothing, and are spaced from day one so the
 * rhythm of the decoration stays even. Do not «fix» one to match the other without a reason the
 * person can see on screen.
 */
const WEEK_BOX_OFFSET_DAYS = [2, 4]

/**
 * Finds where each week's two side-placeholder boxes fall in a chronologically-sorted Day[] — same
 * elapsed-calendar-time logic as computeMilestones' 'week' loop, just at WEEK_BOX_OFFSET_DAYS'
 * within-week offsets instead of the week boundary. Stops once a week's start hasn't been reached yet
 * by the last day in history; an individual offset within an in-progress week that hasn't been
 * reached yet is simply omitted (findIndex returns -1), rather than the whole week being skipped.
 */
function computeWeekBoxSlots(days: Day[]): { index: number; n: number; slot: number }[] {
  if (days.length === 0) return []
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const startMs = toUTCms(sorted[0].date)
  const lastMs = toUTCms(sorted[sorted.length - 1].date)
  const slots: { index: number; n: number; slot: number }[] = []
  for (let n = 1; ; n++) {
    const weekStartMs = startMs + (n - 1) * WEEK_INTERVAL_DAYS * 86_400_000
    if (weekStartMs > lastMs) break
    WEEK_BOX_OFFSET_DAYS.forEach((offsetDays, slot) => {
      const thresholdMs = weekStartMs + offsetDays * 86_400_000
      const index = sorted.findIndex((day) => toUTCms(day.date) >= thresholdMs)
      if (index >= 0) slots.push({ index, n, slot })
    })
  }
  return slots
}

/**
 * Finds where each calendar milestone falls in a chronologically-sorted Day[], for drawing the
 * path's section dividers: the start of history, every Monday since, the 1st of every month since
 * (both repeating — see weekMarkElapsed and monthMarkElapsed, which is why they sit on the
 * calendar's own boundaries rather than every 7th or 30th day since whenever you began), and the
 * one-time half-year and year marks. Each is placed at the first day whose elapsed time since the first day
 * meets its threshold — it's calendar time, not a count of visited days, so it still lands correctly
 * across gray/reconciled gap days. Returned sorted by index (chronological order).
 */
export function computeMilestones(days: Day[]): PathMilestone[] {
  if (days.length === 0) return []
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const startMs = toUTCms(sorted[0].date)
  const milestones: PathMilestone[] = [{ kind: 'start', index: 0 }]

  for (let n = 1; ; n++) {
    const thresholdMs = startMs + weekMarkElapsed(sorted[0].date, n) * 86_400_000
    const index = sorted.findIndex((day) => toUTCms(day.date) >= thresholdMs)
    if (index <= 0) break
    milestones.push({ kind: 'week', index, n })
  }

  // Months after weeks, so that when a 1st falls on a Monday the week takes the earlier slot. The
  // order is load-bearing: horizon.ts counts the chips laid before a mark and has to agree with it.
  for (let n = 1; ; n++) {
    const thresholdMs = startMs + monthMarkElapsed(sorted[0].date, n) * 86_400_000
    const index = sorted.findIndex((day) => toUTCms(day.date) >= thresholdMs)
    if (index <= 0) break
    milestones.push({ kind: 'month', index, n })
  }

  for (const kind of Object.keys(MILESTONE_THRESHOLD_DAYS) as OneOffMilestoneKind[]) {
    const thresholdMs = startMs + MILESTONE_THRESHOLD_DAYS[kind] * 86_400_000
    const index = sorted.findIndex((day) => toUTCms(day.date) >= thresholdMs)
    if (index > 0) milestones.push({ kind, index })
  }

  return milestones.sort((a, b) => a.index - b.index)
}

/** Returns copies of days with pathAngleDelta, columnDriftX and colorTier (gray days excluded) filled in. */
export function applyPathGeometry(days: Day[]): Day[] {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const rawDeltas = sorted.map((day) => (isDayExcused(day) ? 0 : angleDelta(day.completionRate)))
  const smoothed = computeSmoothedAngles(rawDeltas)
  const drift = computeColumnDrift(smoothed)

  return sorted.map((day, i) => ({
    ...day,
    pathAngleDelta: smoothed[i],
    columnDriftX: drift[i],
    colorTier: isDayExcused(day) ? 'rest' : day.colorTier === 'gray' ? 'gray' : computeColorTier(day.completionRate),
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
 * Fills the gap between lastKnownDate (exclusive) and today (exclusive) with Day placeholders so
 * the path honestly keeps moving even though the app was never opened on those dates. Returns a
 * new, sorted array; callers should run applyPathGeometry afterward to (re)compute drift.
 *
 * Each rebuilt day is asked the same question today's day is asked — what does the schedule want
 * here? — and that is the whole point of taking `templates`. A day the schedule never wanted is a
 * rest day, not a hole: it carries `rest`, and so `isDayExcused` covers it everywhere at once. Not
 * asking left a Sunday nobody was due to work bending the road down, breaking the streak, charging
 * milestone days and spending a freeze credit, purely because the app had not been opened on it.
 *
 * A day that did owe something keeps `colorTier: 'gray'`: nothing was ever recorded there, which
 * is a different fact from a day that was opened and came out short, and the road reads it as
 * such.
 *
 * `templates` is required rather than defaulted to empty on purpose: an empty list makes every
 * rebuilt day a rest day, so a caller that forgot it would forgive an entire absence without
 * anything on screen saying so.
 */
export function reconcileMissedDays(
  lastKnownDate: string,
  today: string,
  days: Day[],
  templates: TaskTemplate[],
): Day[] {
  const known = new Set(days.map((day) => day.date))
  const gapDays: Day[] = []

  let cursor = addDaysISO(lastKnownDate, 1)
  while (cursor < today) {
    if (!known.has(cursor)) {
      const asked = templatesAskedOn(templates, cursor)
      const rest = asked.length === 0
      gapDays.push({
        id: crypto.randomUUID(),
        date: cursor,
        tasks: asked.map((task) => ({
          id: crypto.randomUUID(),
          taskTemplateId: task.id,
          dayId: cursor,
          isDone: false,
          skipped: false,
          completedAt: null,
        })),
        completionRate: 0,
        pathAngleDelta: 0,
        columnDriftX: 0,
        colorTier: rest ? 'rest' : 'gray',
        frozen: false,
        rest,
        newGoalIds: [],
        taskChanges: [],
      })
    }
    cursor = addDaysISO(cursor, 1)
  }

  return [...days, ...gapDays].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
