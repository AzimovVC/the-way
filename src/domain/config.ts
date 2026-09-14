/** Max path turn per fully-completed or fully-missed day, in degrees. */
export const MAX_ANGLE_PER_DAY = 36

/** Trailing window (in days, including today) used to smooth the path's turn. */
export const SMOOTHING_WINDOW_DAYS = 4

/**
 * When the smoothed trend turns negative, its magnitude is multiplied by this
 * factor so a slump retreats several times faster than a streak was built.
 * 5 is deliberate: MAX_ANGLE_PER_DAY (36) * 5 = 180, so a fully-sustained 0%
 * streak can reach a heading of exactly straight-down, not just steeply
 * diagonal — see MAX_HEADING_DEG in pathEngine.ts.
 */
export const ROLLBACK_MULTIPLIER = 5

/** completionRate at/above this (but below 1.0) is a "green" day. */
export const GREEN_THRESHOLD = 0.5

/** The logical day closes at this local hour, not at midnight. */
export const DAY_BOUNDARY_HOUR = 3

/** Amplitude, in px, of the purely decorative left/right wave between days. */
export const ZIGZAG_AMPLITUDE_PX = 26

/**
 * How many days one full left-right wave cycle spans. A hash-based per-day
 * offset reads as jitter, not motion — a fixed period is what makes the path
 * snake predictably back and forth even during a perfectly straight streak,
 * the way Duolingo's path does.
 */
export const ZIGZAG_PERIOD_DAYS = 6

/** Horizontal px of column drift per smoothed degree of turn. */
export const DRIFT_PX_PER_DEGREE = 4

/** Vertical px between consecutive day circles on the path. */
export const DAY_SPACING_PX = 64

/**
 * Max change in the path's heading per day, in degrees. The smoothed trend
 * (see computeSmoothedAngles) is a *target* heading, not the heading itself —
 * each day's actual heading turns toward that target by at most this many
 * degrees, like a steering wheel with inertia. This bounds the path's
 * curvature so it can never curl tighter than its own circle spacing allows,
 * which is what stops it from looping back and overlapping itself.
 */
export const MAX_TURN_PER_DAY_DEG = 10

/** Radius, in px, of a day circle at scale 1. */
export const DAY_CIRCLE_RADIUS = 22

/** Two day-circles closer than this (centre to centre) would visually overlap. */
export const MIN_POINT_SEPARATION_PX = DAY_CIRCLE_RADIUS * 2 + 8

/**
 * Extra turn budget, in degrees, the path may borrow on top of MAX_TURN_PER_DAY_DEG
 * when steering away from an upcoming collision. Without this, the only way to
 * avoid an overlap is the post-hoc point-push in resolveCollisions, which can look
 * like the path snapping sideways; steering into the turn earlier keeps the curve
 * smooth. 0 disables proactive steering and leaves collision-avoidance entirely to
 * the point-push backstop.
 */
export const AVOIDANCE_STRENGTH_DEG = 20

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

/** Hard cap, in px, on how far a single day's variance-driven wobble (see WOBBLE_SENSITIVITY) may offset the path sideways. */
export const MAX_WOBBLE_PX = 30

/**
 * Sets the scroll view's zoom: a day circle is sized so that roughly this many fit vertically in
 * the container at once. Not a fit of any particular window of days — the scale this produces is
 * constant regardless of scroll position, so scrolling never rescales the path underneath you.
 */
export const FOCUSED_DAYS_COUNT = 5

/**
 * The weekly side-placeholder box's ideal size, as a multiple of DAY_CIRCLE_RADIUS — sized close to
 * a day circle (like Duolingo's owl/chest illustrations sit right next to a lesson node, not
 * dwarfing it) rather than several times larger. Dev-tunable at runtime (see pathTuning.ts).
 */
export const WEEK_BOX_SIZE_RATIO = 2.2

/** Decorative placeholder circles drawn past today to hint the path continues. */
export const GHOST_FUTURE_DAYS = 1

/**
 * Px of extra perpendicular offset ("hug") the path leans toward a weekly side box while passing
 * it, so the day circles visibly sweep in around the box instead of running straight past it —
 * like Duolingo's path bending slightly toward its mascot/chest illustrations rather than ignoring
 * them. Peaks at the box's own day and eases out over WEEK_BOX_HUG_WINDOW_DAYS on each side.
 */
export const WEEK_BOX_HUG_PX = 12

/** How many days on each side of a weekly box's day the hug (see WEEK_BOX_HUG_PX) eases in/out over. */
export const WEEK_BOX_HUG_WINDOW_DAYS = 2

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
