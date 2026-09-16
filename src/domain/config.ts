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
 * The inline milestone badge's pixel geometry at scale 1 — a scalloped rosette with the same
 * solid-plinth idiom as the day circles. Here rather than in PathView because the layout's
 * no-overlap guarantee is stated in these numbers (see chipFit.ts and the layout tests), so the
 * drawing and the checking have to be reading the same ones.
 *
 * It used to be a wide horizontal pill carrying the whole word ("НЕДЕЛЯ 7"), and that shape is what
 * chipFit.ts and CHIP_STRAIGHTEN_RESPONSE_PX exist to cope with: a screen-axis-aligned pill needs
 * lateral room, and the road only has lateral room where it runs vertically. A rosette is very
 * nearly rotation-invariant, so what it asks of the road is a radius rather than a heading — the
 * price is that only a short token fits inside it (see milestoneBadgeToken).
 *
 * The radii are derived, not chosen. A badge takes one slot, so the nearest day circle is
 * DAY_SPACING_PX away along the arc, and what has to fit in that gap is the badge's extent plus its
 * plinth plus MILESTONE_CLEARANCE_PX:
 *
 *     R + DEPTH + MILESTONE_CLEARANCE_PX  <=  DAY_SPACING_PX - DAY_CIRCLE_RADIUS = 38
 *
 * 22 and 26 leave 8px and 4px of that budget unspent, which is what pays for the road being a
 * curve: over one 64px step at the full turn budget the straight-line distance between two slots
 * drops to ~62px, and the check measures the straight line.
 *
 * Against *today's* circle the budget is 27.8px rather than 38 (DAY_CIRCLE_MAX_RADIUS — the ring
 * makes it half as wide again), and neither radius fits there. That case is left to chipFitScale,
 * which shrinks the one badge that lands beside today to ~0.79 and moves nothing else: sizing every
 * badge in the app for a slot that exists on one day out of seven would cost more than it buys.
 */
/** Repeating weekly badge — the small one, since a long history is mostly these. */
export const MILESTONE_BADGE_RADIUS = 22
/** The one-time marks (start, month, half-year, year) sit a size up: the only hierarchy left once the word is gone. */
export const MILESTONE_BADGE_MAJOR_RADIUS = 26
export const MILESTONE_BADGE_DEPTH = 4
export const MILESTONE_BADGE_FONT_SIZE = 15
/**
 * Scallops. Ten is what reads as a rosette rather than as a gear (too many) or a flower (too few) at
 * these radii, and the 2.5px bite is given in px rather than as a fraction of R so both sizes get
 * the same physical tooth — a fraction would make the major badge's scallops visibly coarser.
 */
export const MILESTONE_BADGE_LOBES = 10
export const MILESTONE_BADGE_LOBE_PX = 2.5
/** Clear space, in px, kept between a milestone badge's edge and any day circle near it. */
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

/**
 * The finish line each difficulty sets — the person's own goal, and the single day the app asks
 * whether to go on or stop. 21 and 66 are the lower end and the mean of Lally et al. 2010; 90 is
 * the far end of the same range, for something that is genuinely hard.
 *
 * These are targets, not ranks. A rank is a rung of the shared ladder and means the same number of
 * days whichever difficulty the habit was created at.
 */
export const TASK_DIFFICULTY_TARGET_DAYS: Record<TaskDifficulty, number> = {
  simple: 21,
  medium: 66,
  hard: 90,
}

/** Freeze credits a new user starts with. */
export const DEFAULT_FREEZES_REMAINING = 2

/** Freeze credits granted back at the start of each calendar month, up to this cap. */
export const FREEZE_MONTHLY_ALLOWANCE = 2

// There is deliberately no completion-rate gate and no cap on the miss streak here. Both existed,
// and both judged a second time what MILESTONE_MISS_COST_BY_STREAK already judges: a miss takes
// days off the count, a comeback pays them back double, and the day count is therefore the honest
// one. The gates only added a second verdict that could contradict it — a person who slipped, came
// back and walked out the 66 days met the target and was told the tier was «waiting for
// stability», with nothing on the screen saying what would end the wait.

// Ranks are not here: they are one absolute ladder in [ranks.ts](ranks.ts), the same days for
// every habit. They used to be this task's own target times 1, 2, 3 — which made «Бронза» mean 21
// days for a simple habit and 66 for a medium one, and put the third rank 198 days out where
// nobody would ever see it.

/**
 * What a missed day costs, by its place in the run of misses: the first entry is the first miss
 * in a row, the last entry repeats for every day after it. Separate from ROLLBACK_MULTIPLIER,
 * which drives the main path's angle.
 *
 * The shape comes from the same study the 66 in TASK_DIFFICULTY_TARGET_DAYS comes from — Lally
 * et al., 2010, which measured automaticity daily over 84 days and reported that missing a single
 * opportunity did not materially affect the curve. So an isolated miss costs nothing here. What
 * does cost is a *gap*: the cue-response link weakens while the behaviour is not performed, and
 * it weakens gradually, which is why the cost grows and then plateaus rather than jumping.
 *
 * These numbers are now the whole cost of a slip — there is no second gate behind them — so they
 * have to be liveable on their own. A flat 5 was not: a daily task missing one day a week netted
 * +1 a week, putting a 66-day tier fifteen months away for someone doing the behaviour six days
 * out of seven.
 */
export const MILESTONE_MISS_COST_BY_STREAK = [0, 1, 2, 3]

/**
 * What a completed day earns while there is ground lost to misses still outstanding — against the
 * +1 of an ordinary day.
 *
 * This is the savings effect: relearning a decayed cue-response link is faster than learning it,
 * so the days after a slump genuinely are worth more than the days before it. It is also what the
 * app already tells the person in buildCycleReport — that persistence counts, not only discipline
 * — finally said in the arithmetic instead of only in the sentence.
 */
export const MILESTONE_COMEBACK_GAIN = 2

/** EXP a TaskTemplate earns per completed day. */
export const EXP_PER_COMPLETION = 10

// --- Time of day -----------------------------------------------------------
// Statistics read off when marks land inside the day. All of it is descriptive: none of these
// feed pathAngleDelta, colorTier or milestones. The road is judged by whether a day was done,
// never by when — a second, stricter bar would be the dark twin this app deliberately lacks.

/**
 * Marks needed for one task before its time statistics mean anything.
 *
 * Derived from the quartiles, not the median: the median survives ⌊n/2⌋ odd marks, but the
 * quartiles that make up the habit window survive only ⌊n/4⌋. At 15 that is 3 marks — roughly
 * one unusual week. Below it, a single strange week rewrites what "usually" means.
 */
export const TIME_MIN_MARKS = 15

/**
 * Below this chance of still getting done, an hour counts as the point of no return: past it
 * the task effectively does not happen any more.
 *
 * 0.2 rather than something smaller because the statement has to survive being wrong: one day
 * in five still landing is already a weak enough promise to call the day lost, and demanding
 * 0.05 would push the hour so late it would arrive after the day was over anyway.
 */
export const POINT_OF_NO_RETURN_CHANCE = 0.2

/**
 * Days that were still open at an hour, below which that hour cannot be judged. With four days
 * left, one of them landing moves the estimate from 0% to 25% — across the threshold and back,
 * on a single day's evidence.
 */
export const POINT_OF_NO_RETURN_MIN_OPEN = 6

/** Marks this close together were made in one sitting, not as the day went. */
export const BATCH_MARK_WINDOW_MIN = 3

/**
 * Share of multi-mark days made in one sitting, above which the timestamps describe when the
 * person *fills the app in* rather than when they act. Set high: this only changes a label, and
 * calling careful marking "batched" would tell someone their own honest record is not real.
 */
export const BATCH_MARK_SHARE = 0.6

/** Multi-mark days needed before marking style can be called at all. */
export const BATCH_MARK_MIN_DAYS = 6

/**
 * Days needed on each side of a two-condition comparison before it is worth stating.
 *
 * Both findings that compare («ранний старт» and the anchor) put two averages side by side, and a
 * side built on two or three days is noise wearing the same bar as a side built on fifty. Eight is
 * where a share stops swinging by more than a tenth when one day changes.
 */
export const COMPARE_MIN_DAYS = 8

/**
 * Days in the count a finished week needs before its summary is worth a full screen.
 *
 * Under three there is no week to speak of: the drawing has two circles and five empty slots, and
 * the comparison with the week before rests on a couple of taps. Three is also the floor that
 * keeps the first screen a person ever sees from being a verdict on a week they were not here
 * for — installing on Saturday would otherwise mean a full-screen «итог недели» on Monday about
 * two days.
 *
 * Not four: a task scheduled Mon/Wed/Fri gives exactly three days in the count every week, and a
 * threshold above that would mean such a person never sees a week summary at all.
 */
export const WEEK_REVIEW_MIN_COUNTED_DAYS = 3

/**
 * How far the road has to have turned down before the turn back up is a comeback rather than an
 * ordinary good day. Matches the default of findSlumpRecoveryCycles, which reads the same shape
 * for the stats screen — two different answers to «был ли спад» would be two different apps.
 */
export const COMEBACK_MIN_SLUMP_DAYS = 3

/**
 * How long the road has to have been climbing again before the comeback is called. One good day
 * after a slump is a good day; the moment worth a screen is the one where the return is no longer
 * in doubt, and it has to arrive on a day the person is looking at — which is why it is counted in
 * days and confirmed on the last of them, not judged in hindsight.
 */
export const COMEBACK_MIN_RETURN_DAYS = 3

/**
 * Which comeback earns a rank, and what it is called. Counted over the whole road, because that
 * is the point: this is the one number in the app that can only grow if you have fallen.
 */
/**
 * How many slots the comeback drawing holds. A long slump would otherwise squeeze the circles to
 * nothing on a 320px phone, and the part worth seeing is the turn — so a longer stretch is cut
 * from the front, keeping the fall's last days and the whole climb.
 */
export const COMEBACK_SHAPE_MAX_DAYS = 11

export const COMEBACK_RANKS: { at: number; label: string }[] = [
  { at: 1, label: 'Вернулся' },
  { at: 3, label: 'Упрямый' },
  { at: 10, label: 'Несгибаемый' },
]
