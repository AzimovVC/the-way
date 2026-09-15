/**
 * How much a milestone chip has to shrink to fit the gap the road left it.
 *
 * A chip is a wide, screen-axis-aligned pill sitting inline in the snake, so what it needs is
 * lateral room, and the road only has that where it is running roughly vertically. pathEngine
 * straightens the road under every chip for exactly that reason (see CHIP_STRAIGHTEN_RESPONSE_PX),
 * and that is enough almost everywhere — but not on a hairpin, where the trend is spending the
 * whole turn budget on the reversal itself and there is none left to flatten with. Measured across
 * the scripted histories, one weekly chip in a full climb→collapse→recover arc lands mid-U-turn at
 * ~58° off vertical and its corners reach ~8px into the day circle beside it.
 *
 * Rather than bend the road harder (which would cost the reversal its radius, and with it the
 * no-overlap guarantee that radius *is*), the chip yields: it scales down just enough to clear its
 * neighbours. That degrades gracefully and locally — a chip on a hairpin renders ~15% smaller and
 * nothing else in the layout moves — and it is a contraction in both dimensions, so shrinking can
 * only ever increase clearance. There is therefore always a scale that fits.
 */

/**
 * How far two screen-axis-aligned footprints intrude into each other's clearance, in px — positive
 * when they are too close, negative when there is daylight between them (and then its magnitude is
 * the width of that daylight along whichever axis is tightest).
 *
 * Used instead of a centre-to-centre distance because these footprints are nothing like round: a
 * milestone chip is a ~160×30 pill. Asking a weekly box to keep a *circular* 99px from a chip's
 * centre demands room off the chip's ends that it never actually occupies, which over a year of
 * history leaves boxes with nowhere legal to go at all — while the real constraint, that the two
 * rectangles not touch, is satisfiable everywhere.
 */
export function boxIntrusionPx(dx: number, dy: number, a: ChipFitBox, b: ChipFitBox, clearancePx = 0): number {
  const alongX = a.halfWidth + b.halfWidth + clearancePx - Math.abs(dx)
  const alongY = dy >= 0 ? a.halfDown + b.halfUp + clearancePx - dy : a.halfUp + b.halfDown + clearancePx + dy
  return Math.min(alongX, alongY)
}

export interface ChipFitBox {
  /** Half-width of the chip at scale 1. */
  halfWidth: number
  /** Extent above the chip's centre at scale 1. */
  halfUp: number
  /** Extent below the chip's centre at scale 1 — larger than halfUp, since the plinth hangs below. */
  halfDown: number
}

/**
 * Distance from a point to a chip's box — 0 when the point is inside it. The box is not symmetric
 * about its centre: the plinth hangs below, so `halfDown` exceeds `halfUp`.
 */
export function distanceToChip(
  chipX: number,
  chipY: number,
  box: ChipFitBox,
  scale: number,
  px: number,
  py: number,
): number {
  const dx = px - chipX
  const dy = py - chipY
  const ox = Math.abs(dx) - box.halfWidth * scale
  const oy = dy < 0 ? -dy - box.halfUp * scale : dy - box.halfDown * scale
  if (ox <= 0 && oy <= 0) return 0
  return Math.hypot(Math.max(0, ox), Math.max(0, oy))
}

/**
 * The largest uniform scale at or below 1 at which a chip of `box`, centred at (cx, cy), keeps
 * `clearancePx` between itself and every circle in `circles`.
 *
 * Bisection rather than a closed form: the exact per-circle constraint is piecewise (which face or
 * corner of the box is nearest depends on the scale itself), and there are two neighbours plus any
 * circle from a passing lane to satisfy at once. 24 steps resolve it to well under a tenth of a
 * pixel, and this runs a few dozen times per render at most.
 *
 * CHIP_MIN_SCALE floors it: below that a chip is too small to read, and a chip that would need to
 * go smaller is a sign the road's straightening has stopped working rather than a chip that should
 * quietly vanish (pathEngine.test.ts asserts the shipped histories stay well above it).
 */
const CHIP_MIN_SCALE = 0.6

export function chipFitScale(
  cx: number,
  cy: number,
  box: ChipFitBox,
  circles: readonly { x: number; y: number; radius?: number }[],
  circleRadius: number,
  clearancePx = 0,
): number {
  // A circle may carry its own radius: today's is drawn half again as wide as the rest once its
  // task ring is counted (DAY_CIRCLE_MAX_RADIUS), and a clearance derived against a plain circle is
  // a clearance from a circle that is not on the screen.
  const needOf = (c: { radius?: number }) => (c.radius ?? circleRadius) + clearancePx
  let maxNeed = circleRadius + clearancePx
  for (const c of circles) maxNeed = Math.max(maxNeed, needOf(c))
  // Only circles that could possibly reach the chip at full size matter.
  const reach = Math.hypot(box.halfWidth, Math.max(box.halfUp, box.halfDown)) + maxNeed
  const nearby = circles.filter((c) => Math.abs(c.x - cx) <= reach && Math.abs(c.y - cy) <= reach)
  if (nearby.length === 0) return 1

  const fits = (scale: number) => nearby.every((c) => distanceToChip(cx, cy, box, scale, c.x, c.y) >= needOf(c))

  if (fits(1)) return 1
  let lo = CHIP_MIN_SCALE
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  return lo
}
