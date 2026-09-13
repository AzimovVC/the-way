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

/** Amplitude, in px, of the purely decorative left/right zigzag between days. */
export const ZIGZAG_AMPLITUDE_PX = 6

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

/** How many recent days the default (focused) camera fits in view. */
export const FOCUSED_DAYS_COUNT = 8

/** Decorative placeholder circles drawn past today to hint the path continues. */
export const GHOST_FUTURE_DAYS = 1

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
