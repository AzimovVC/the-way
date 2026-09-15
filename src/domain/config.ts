/**
 * Scale of the per-day "pull" a fully-completed or fully-missed day contributes, in degrees.
 * This feeds the *analytics* signal (angleDelta -> pathAngleDelta, used for trend arrows and
 * streak runs), not the drawn path: what the path aims at comes from targetHeadingDeg, which
 * reads the smoothed completion rate directly.
 */
export const MAX_ANGLE_PER_DAY = 36

/** Trailing window (in days, including today) used to smooth both the analytics pull and the completion rate the path aims by. */
export const SMOOTHING_WINDOW_DAYS = 4

/**
 * When the smoothed analytics pull turns negative, its magnitude is multiplied by this factor so a
 * slump reads as unwinding several times faster than the streak was built.
 *
 * The drawn path expresses that same asymmetry on its own, in targetHeadingDeg's two halves —
 * everything at or above GREEN_THRESHOLD spans 0°, everything below it spans 180° — so this now
 * only shapes the analytics signal.
 */
export const ROLLBACK_MULTIPLIER = 5

/** completionRate at/above this (but below 1.0) is a "green" day. */
export const GREEN_THRESHOLD = 0.5

/** The logical day closes at this local hour, not at midnight. */
export const DAY_BOUNDARY_HOUR = 3

/**
 * Lateral amplitude, in px, of the decorative left/right wave — how far the path swings off
 * the centre of its own column, each way. This is now a *true* amplitude: the wave is applied
 * as a curvature (see waveCurvatureDegPerPx in pathCurve.ts), so the path reaches exactly this
 * far sideways without any step changing length. Under the old perpendicular-offset model the
 * same number also stretched every step it bent, which is why steps ranged 64→161px.
 *
 * 40 is measured, not invented: read five consecutive node centres off a Duolingo path and its
 * steps come out 266/268/259/253px — constant to ±3%, which is arc-length spacing — with the
 * direction of travel swinging ±28° over a wavelength of about 8 nodes. Reproducing that swing at
 * this wavelength puts the lateral amplitude at 0.62 × the node spacing, i.e. 40px at our 64px.
 *
 * Sized against MAX_TURN_PER_DAY_DEG: a reversal opens a lane 2/κmax wide and both lanes weave
 * ±this, so 2× this plus MIN_POINT_SEPARATION_PX has to stay under that lane (see there).
 */
export const ZIGZAG_AMPLITUDE_PX = 40

/**
 * How many days of travel one full left-right wave cycle spans. A hash-based per-day offset
 * reads as jitter, not motion — a fixed period is what makes the path snake predictably back
 * and forth even during a perfectly straight streak, the way Duolingo's path does. 8 is the
 * wavelength measured off their path (see ZIGZAG_AMPLITUDE_PX); it also puts one bay of the
 * serpentine every four days, which is what spaces the weekly boxes (they sit in those bays).
 */
export const ZIGZAG_PERIOD_DAYS = 8

/** Horizontal px of column drift per smoothed degree of turn. */
export const DRIFT_PX_PER_DEGREE = 4

/** Vertical px between consecutive day circles on the path. */
export const DAY_SPACING_PX = 64

/**
 * The path's entire curvature budget, expressed as degrees of turn per day of travel — every
 * influence (wave, trend, history avoidance) is summed and then clamped to this. Divided by
 * DAY_SPACING_PX it is the max curvature in deg/px, and its reciprocal is the path's tightest
 * possible turn radius.
 *
 * 44 is derived, not picked. It sets a min turn radius of ~83px, so a full 180° reversal traces a
 * half-circle ~167px across — and that half-circle's diameter *is* the gap between the stretch the
 * path came up and the stretch it goes back down. Both of those lanes weave up to
 * ±(ZIGZAG_AMPLITUDE_PX + MAX_WOBBLE_PX) = ±50, so the worst-case gap between them is 167 − 100 =
 * 67px, clear of the 52px at which two day circles would touch (MIN_POINT_SEPARATION_PX). That is
 * the whole no-overlap argument: a reversal cannot retrace its own column, because it physically
 * cannot turn tightly enough to. Raising this number shrinks that lane and eventually breaks the
 * guarantee — pathEngine.test.ts pins the arithmetic.
 *
 * It also sets how long a reversal takes: 180° / 44 ≈ 4 days of travel, which is about how long a
 * switchback should read as taking.
 */
export const MAX_TURN_PER_DAY_DEG = 44

/**
 * How eagerly the path steers toward the heading the trend is asking for: the correction is
 * (target − heading) / this, in deg/px. 160px ≈ 2.5 days, so an ordinary few-degree correction
 * is a gentle lean while a full reversal saturates the budget above and turns as hard as the
 * radius allows.
 */
export const TREND_RESPONSE_PX = 160

/**
 * Fraction of the curvature budget the trend has to be using before the decorative wave has
 * faded out completely (it fades linearly from full to nothing across this range). During a hard
 * reversal the road should be a clean arc, not a wobbly one — and handing the wave's share of the
 * budget back to the trend is also what lets a 180° turn complete in ~4 days instead of ~8: at full
 * amplitude the wave alone claims about half the budget.
 */
export const WAVE_YIELD_FRACTION = 0.5

/**
 * Cap, in degrees per day, on how fast the *target* heading itself may move. The smoothed trend
 * amplifies a slump by ROLLBACK_MULTIPLIER, so alternating good/bad days can otherwise demand a
 * full 180° flip every few days — which is a statement about noise, not about a trend. Limiting
 * the target (rather than only the steering) keeps the path from spending its whole life in
 * U-turns, and is what makes a reversal mean "you have genuinely been slipping for a while".
 */
export const MAX_TARGET_SLEW_DEG_PER_DAY = 45

/** Radius, in px, of a day circle at scale 1. */
export const DAY_CIRCLE_RADIUS = 22

/** Today's circle is drawn a touch larger than the rest — the first of the three things that mark it. */
export const TODAY_CIRCLE_SCALE = 1.1
/** Daylight between today's circle and the task ring orbiting it, and that ring's stroke width. */
export const TODAY_RING_OFFSET_PX = 9
export const TODAY_RING_STROKE_PX = 6

/**
 * The largest radius a day actually occupies on the road: today's circle plus its ring. Anything
 * that keeps its distance from a day must measure from *this*, not from DAY_CIRCLE_RADIUS — the
 * ring is 14px of drawn width that a clearance derived against a plain circle does not know about,
 * which is exactly how the weekly box ended up sitting on top of it.
 */
export const DAY_CIRCLE_MAX_RADIUS =
  DAY_CIRCLE_RADIUS * TODAY_CIRCLE_SCALE + TODAY_RING_OFFSET_PX + TODAY_RING_STROKE_PX / 2

/** Two day-circles closer than this (centre to centre) would visually overlap. */
export const MIN_POINT_SEPARATION_PX = DAY_CIRCLE_RADIUS * 2 + 8

/** Width of the lane a full 180° reversal opens, given a per-day turn budget: the diameter of the tightest half-circle it can trace. */
export function reversalLaneWidthPx(maxTurnPerDayDeg: number): number {
  return (2 * DAY_SPACING_PX * 180) / (maxTurnPerDayDeg * Math.PI)
}

/**
 * Clearance the safe-limit helpers below keep on top of MIN_POINT_SEPARATION_PX. A limit derived
 * to land exactly on that separation would put two circles precisely touching at the limit, which
 * is not a limit worth offering; this is what makes the extreme of a slider still look right
 * rather than merely not overlap.
 */
const LANE_SAFETY_MARGIN_PX = 8

/**
 * The largest turn budget that still leaves two day circles able to pass in the lane a reversal
 * opens, given how far the path weaves. This is MAX_TURN_PER_DAY_DEG's derivation solved for the
 * budget — the dev panel clamps its slider to it so a tuning session can't quietly break the
 * no-overlap guarantee (and so a value saved before the constants moved doesn't linger unclamped
 * in someone's browser).
 */
function maxSafeTurnPerDayDeg(weavePx: number): number {
  const neededLanePx = MIN_POINT_SEPARATION_PX + LANE_SAFETY_MARGIN_PX + 2 * weavePx
  return (2 * DAY_SPACING_PX * 180) / (neededLanePx * Math.PI)
}

/** The same relationship solved the other way: how far the path may weave at a given turn budget. */
function maxSafeWeavePx(maxTurnPerDayDeg: number): number {
  return (reversalLaneWidthPx(maxTurnPerDayDeg) - MIN_POINT_SEPARATION_PX - LANE_SAFETY_MARGIN_PX) / 2
}

/**
 * How hard the path steers away from stretches of its own older history that it is drifting
 * back toward, in degrees of turn per day. This is insurance, not the main defence: the turn
 * radius implied by MAX_TURN_PER_DAY_DEG is what actually prevents a reversal from retracing
 * itself, and this only catches the long-range case where two lanes laid down weeks apart
 * happen to wander together.
 *
 * Being a curvature term rather than a push on a placed point is the important part — it bends
 * the road, so spacing and smoothness are untouched. The old model moved points sideways after
 * placing them, which is what broke both. 0 disables it.
 */
export const AVOIDANCE_STRENGTH_DEG = 25

/**
 * How far ahead of itself the path looks when steering away from older history — anything
 * closer than this to the sample being placed counts as something to bend away from. A little
 * wider than MIN_POINT_SEPARATION_PX so the correction starts before circles actually touch.
 */
export const AVOIDANCE_RADIUS_PX = 78

/**
 * How much of its own recent past the path ignores when avoiding itself, in days of travel.
 * The road it has just driven is always right behind it; only history older than this is a
 * lane it could collide with.
 */
export const AVOIDANCE_IGNORE_RECENT_DAYS = 3

/**
 * Px of sideways offset per degree that a single day's raw pull deviates from
 * its own recent (smoothed) average — independent of whether the overall trend
 * is up or down. The sign of "today vs. your recent norm" isn't the same as
 * "good vs. bad": a day a little above your norm pulls one way, a little below
 * pulls the other, so this is what lets a winning streak still wander both
 * left and right instead of always leaning the same direction (that direction
 * being whichever the smoothed trend's sign happens to be). 0 disables this
 * entirely.
 */
export const WOBBLE_SENSITIVITY = 1

/** Hard cap, in px, on how far the wave may be widened or narrowed on top of its own ZIGZAG_AMPLITUDE_PX — by the meander and wobble terms together. Kept small so the total stays inside the column width the reversal lane is sized for (see MAX_TURN_PER_DAY_DEG). */
export const MAX_WOBBLE_PX = 10

/**
 * The ceilings the dev panel clamps its three geometry sliders to, so a tuning session can't
 * quietly break the no-overlap guarantee — and so a value saved before these constants moved
 * doesn't linger unclamped in someone's browser.
 *
 * Each is derived against the other two at their shipped defaults, since a slider takes a fixed
 * ceiling; pushing two of them to their limits at once is still out of contract. They live here
 * rather than beside the sliders because what they encode is a property of the geometry, not of
 * the dev UI — pathEngine.test.ts checks them against the same arithmetic they come from.
 */
export const MAX_TURN_PER_DAY_CAP = maxSafeTurnPerDayDeg(ZIGZAG_AMPLITUDE_PX + MAX_WOBBLE_PX)
export const ZIGZAG_AMPLITUDE_CAP = maxSafeWeavePx(MAX_TURN_PER_DAY_DEG) - MAX_WOBBLE_PX
export const MAX_WOBBLE_CAP = maxSafeWeavePx(MAX_TURN_PER_DAY_DEG) - ZIGZAG_AMPLITUDE_PX

/**
 * Px of extra wave amplitude at a completion rate of 0, tapering to none at a perfect 1.0 — the
 * "how well are you doing" signal for everything at or above GREEN_THRESHOLD, where the path's
 * *direction* is pinned to vertical and so can't carry it (see targetHeadingDeg). A flawless
 * streak walks a tight line; a scrappier one visibly wanders on its way up.
 */
export const MEANDER_PX = 16

/**
 * Sets the scroll view's zoom: a day circle is sized so that roughly this many fit vertically in
 * the container at once. Not a fit of any particular window of days — the scale this produces is
 * constant regardless of scroll position, so scrolling never rescales the path underneath you.
 *
 * 8 puts the rendering scale near 1.0 on a phone, which is where DAY_CIRCLE_RADIUS and
 * DAY_SPACING_PX were designed to sit (and is about the node density Duolingo shows). At the
 * previous 5 the scale came out ~1.9 and only two circles fit on screen at once, which is most of
 * why the path read as sparse and arbitrary rather than as a road.
 */
export const FOCUSED_DAYS_COUNT = 8

/**
 * The weekly side-placeholder box's ideal size, as a multiple of DAY_CIRCLE_RADIUS — sized close to
 * a day circle (like Duolingo's owl/chest illustrations sit right next to a lesson node, not
 * dwarfing it) rather than several times larger. Dev-tunable at runtime (see pathTuning.ts).
 */
export const WEEK_BOX_SIZE_RATIO = 2.2

/**
 * How far past today the road is drawn — the horizon.
 *
 * Deliberately *not* tied to how far away the user's own targets are: that would make the length of
 * the road ahead a function of what someone typed into "цель, дней", so one person gets a screen
 * and a half of scrolling and another gets thirty. A target enters the road when it comes inside
 * this window, and lives in the edge list until then.
 *
 * 14 is picked against two numbers rather than by eye. A fully collapsed road needs ~8 kept days to
 * come about (the target slew chased at TREND_RESPONSE_PX, ~18°/day — see the ghost section of
 * pathEngine), so the whole recovery arc has to fit; and weekly chips fall every 7 days, so a
 * two-week window always has at least one marker in it and never looks empty. Dev-tunable at
 * runtime (see pathTuning.ts).
 */
export const GHOST_FUTURE_DAYS = 14

/**
 * The inline milestone chip's pixel geometry at scale 1 — a wide pill with the same solid-plinth
 * idiom as the day circles. Here rather than in PathView because the layout's no-overlap guarantee
 * is stated in these numbers (see chipFit.ts and the layout tests), so the drawing and the checking
 * have to be reading the same ones.
 *
 * CHAR_WIDTH is a rough px-per-character at FONT_SIZE, which lets the chip be sized to its label
 * without measuring text in the DOM — deliberately a slight over-estimate, so an error goes toward
 * extra clearance rather than toward a collision.
 */
export const MILESTONE_CHIP_HEIGHT = 26
export const MILESTONE_CHIP_PADDING_X = 14
export const MILESTONE_CHIP_DEPTH = 4
export const MILESTONE_CHIP_FONT_SIZE = 12
export const MILESTONE_CHAR_WIDTH = 8.5
/** Clear space, in px, kept between a milestone chip's edge and any day circle near it. */
export const MILESTONE_CLEARANCE_PX = 4

/**
 * How the road flattens where a milestone chip sits: how eagerly it steers back toward vertical
 * (as TREND_RESPONSE_PX does for the trend), and over how many days of travel that lean eases in
 * and out.
 *
 * A chip is a wide horizontal pill sitting inline in the snake, so it only fits its one slot while
 * the road through it is running roughly up-or-down: measured against the day circles either side,
 * a chip clears them below about 35° off vertical and starts biting into them past about 45°.
 * Rather than reserving a double-width slot for it (which is what left 156px craters in the old
 * rhythm), the road simply straightens out to meet it — the same way a real road flattens where it
 * passes under a sign.
 *
 * Two things make that a guarantee rather than a preference, and both were missing at first:
 *
 *  - Inside the window the chip's steer **replaces** the trend's rather than adding to it (weighted
 *    by the same raised-cosine that eases the window in). Summing them let a hard reversal keep
 *    most of the budget and leave the chip stranded at 44° — exactly the angle at which it starts
 *    to overlap.
 *  - The decorative wave fades out under a chip too. It is otherwise at its *strongest* there,
 *    since it yields only to a busy trend — and a road the straightening has just brought to
 *    vertical is, by that measure, not busy at all.
 *
 * 2 days of window is what the turn budget needs to swing a fully sideways road to vertical and
 * back: 180° of correction at MAX_TURN_PER_DAY_DEG takes ~4 days, and the window covers half of
 * that either side of the chip.
 */
export const CHIP_STRAIGHTEN_RESPONSE_PX = 80
export const CHIP_STRAIGHTEN_WINDOW_DAYS = 2

export type TaskDifficulty = 'simple' | 'medium' | 'hard'

/** Default targetDays prefilled from the difficulty chosen during onboarding. */
export const TASK_DIFFICULTY_TARGET_DAYS: Record<TaskDifficulty, number> = {
  simple: 21,
  medium: 66,
  hard: 90,
}

/** Freeze credits a new user starts with. */
export const DEFAULT_FREEZES_REMAINING = 2

/** Freeze credits granted back at the start of each calendar month, up to this cap. */
export const FREEZE_MONTHLY_ALLOWANCE = 2

/** Minimum average completionRate across a milestone cycle to count as "anchored". */
export const MILESTONE_MIN_COMPLETION_RATE = 0.8

/** A miss streak longer than this many days breaks the milestone, regardless of average. */
export const MILESTONE_MAX_MISS_STREAK = 3

/** targetDays multiplier for each milestone tier. */
export const MILESTONE_TIER_MULTIPLIER: Record<'bronze' | 'gold' | 'platinum', number> = {
  bronze: 1,
  gold: 2,
  platinum: 3,
}

/**
 * How many "progress days" a single missed day costs, vs. the +1 a completed
 * day earns — makes a slump unwind several times faster than it was built.
 * Separate from ROLLBACK_MULTIPLIER, which drives the main path's angle.
 */
export const MILESTONE_ROLLBACK_MULTIPLIER = 5

/** EXP a TaskTemplate earns per completed day. */
export const EXP_PER_COMPLETION = 10
