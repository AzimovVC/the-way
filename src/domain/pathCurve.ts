/**
 * The path as a curve integrated at constant arc-length steps, instead of as a list of
 * day positions computed one per day and then nudged apart.
 *
 * The rule this module exists to enforce: **every influence on the path's shape is a
 * curvature — degrees of turn per pixel travelled — and positions come only from
 * integrating it. Nothing ever moves a point after the fact.** The decorative wave, the
 * data-driven trend, steering away from older history: all of them are terms added into
 * one curvature, clamped once to one budget, and then walked.
 *
 * Three properties fall out of that, and no amount of tuning can break them:
 *
 *  - **Spacing is exact.** Every step advances the same arc length, so "64px along the
 *    curve" is always 64px of road. Day circles dropped every DAY_SPACING_PX of arc are
 *    perfectly evenly spaced no matter what the path is doing — climbing, reversing, or
 *    weaving. The old model added the wave as a perpendicular offset *to an already-placed
 *    endpoint*, which made a "64px step" actually hypot(64, offset) long: that is where the
 *    64→161px spread in the old spacing came from.
 *  - **Turns are smooth.** Curvature is a continuous function of arc length, so the
 *    direction of travel is C¹ — there is no step at which the path can kink.
 *  - **Turns have a floor radius** of 1/maxCurvature. The path can never curl tighter than
 *    that, so a full 180° reversal traces a half-circle whose *diameter* is 2/maxCurvature.
 *    That is what makes a reversal open a clean parallel lane beside the stretch it came up,
 *    rather than retracing it — see MAX_TURN_PER_DAY_DEG in config.ts for how that diameter
 *    is sized against MIN_POINT_SEPARATION_PX.
 */

const DEG_TO_RAD = Math.PI / 180

/**
 * Arc length between integration samples, in px. Small enough that a circular arc at the
 * tightest allowed radius (~52px) is sampled every ~4.4°, which is well under what reads as
 * a straight chord at day-circle scale; large enough that a year of history is only ~6k
 * samples. Only the integrator sees this — everything downstream addresses the curve by arc
 * length, not by sample index.
 */
export const CURVE_STEP_PX = 4

export interface CurveSample {
  /** Arc length from the start of the curve, in px. Sample k is always at exactly k * CURVE_STEP_PX. */
  s: number
  x: number
  y: number
  /** Direction of travel: 0 = straight up the screen (toward the goal), ±90 = sideways, ±180 = straight down. */
  headingDeg: number
}

export interface CurveSpec {
  /** Total arc length to walk, in px. */
  lengthPx: number
  /**
   * Hard cap on |curvature|, in degrees of turn per px travelled. This is the single knob
   * that bounds the path's tightest turn: minimum radius = 1 / (maxCurvatureDegPerPx * π/180).
   */
  maxCurvatureDegPerPx: number
  /**
   * Sum of every curvature influence at this point on the curve, in deg/px, before clamping.
   * Called once per sample with the state the walk has reached so far, so terms that depend
   * on position (e.g. steering away from earlier history) can be expressed here too.
   */
  curvatureAt: (s: number, state: Readonly<CurveSample>) => number
  startHeadingDeg?: number
  stepPx?: number
}

/**
 * Walks the curve. Rotate-half / translate / rotate-half rather than plain Euler, so the
 * chord between two samples is centred on the turn instead of lagging it — over a long
 * sustained arc, plain Euler's half-step lag accumulates into a visibly wrong radius.
 */
export function integrateCurve(spec: CurveSpec): CurveSample[] {
  const step = spec.stepPx ?? CURVE_STEP_PX
  const maxTurnPerStep = spec.maxCurvatureDegPerPx * step
  const samples: CurveSample[] = []

  let x = 0
  let y = 0
  let headingDeg = spec.startHeadingDeg ?? 0
  let s = 0

  const count = Math.max(1, Math.ceil(spec.lengthPx / step))
  samples.push({ s, x, y, headingDeg })

  for (let i = 0; i < count; i++) {
    const raw = spec.curvatureAt(s, samples[samples.length - 1]) * step
    const turn = Math.max(-maxTurnPerStep, Math.min(maxTurnPerStep, raw))

    headingDeg += turn / 2
    const rad = headingDeg * DEG_TO_RAD
    x += Math.sin(rad) * step
    y += -Math.cos(rad) * step
    headingDeg += turn / 2

    s += step
    samples.push({ s, x, y, headingDeg })
  }

  return samples
}

/**
 * The curve's state at an arbitrary arc length, interpolated between the two bracketing
 * samples. O(1) — samples are uniformly spaced by construction, so the index is just
 * s / stepPx. This is how *everything* downstream is placed: day circles, milestone chips
 * and weekly boxes all pick an arc length and read off the curve here, which is why their
 * spacing is exact rather than approximate.
 */
export function sampleCurve(samples: CurveSample[], s: number, stepPx: number = CURVE_STEP_PX): CurveSample {
  if (samples.length === 0) return { s: 0, x: 0, y: 0, headingDeg: 0 }
  const clamped = Math.max(0, Math.min(s, samples[samples.length - 1].s))
  const exact = clamped / stepPx
  const i0 = Math.floor(exact)
  const i1 = Math.min(i0 + 1, samples.length - 1)
  const frac = exact - i0
  const a = samples[i0]
  const b = samples[i1]
  return {
    s: clamped,
    x: a.x + (b.x - a.x) * frac,
    y: a.y + (b.y - a.y) * frac,
    // Heading is continuous along the curve (never wrapped by the integrator), so a plain
    // lerp is correct here — no shortest-arc handling needed.
    headingDeg: a.headingDeg + (b.headingDeg - a.headingDeg) * frac,
  }
}

/**
 * Unit vector perpendicular to the direction of travel, pointing to the right of it — the
 * axis milestone chips and weekly boxes are offset along. Matches the (cos, sin) convention
 * used for forward = (sin, -cos) elsewhere.
 */
export function rightNormal(headingDeg: number): { x: number; y: number } {
  const rad = headingDeg * DEG_TO_RAD
  return { x: Math.cos(rad), y: Math.sin(rad) }
}

/** Wraps a heading difference into (-180, 180] — the shortest way round. */
export function normalizeAngleDeg(deg: number): number {
  let d = deg % 360
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

/**
 * Curvature, in deg/px, of a sine wave of the given lateral amplitude and wavelength.
 *
 * For κ(s) = K·sin(2πs/L), heading is θ(s) = -(KL/2π)·cos(2πs/L) and lateral excursion is
 * A = K·L²/4π², so K = 4π²A/L². Expressing the wave as a *curvature* rather than as a
 * perpendicular offset is what keeps arc length exact while it weaves — the offset form
 * stretches every step it bends (see this module's header).
 */
export function waveCurvatureDegPerPx(amplitudePx: number, wavelengthPx: number): number {
  if (wavelengthPx <= 0) return 0
  const radPerPx = (4 * Math.PI * Math.PI * amplitudePx) / (wavelengthPx * wavelengthPx)
  return radPerPx / DEG_TO_RAD
}
