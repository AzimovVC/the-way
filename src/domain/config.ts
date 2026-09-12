/** Max path turn per fully-completed or fully-missed day, in degrees. */
export const MAX_ANGLE_PER_DAY = 36

/** Trailing window (in days, including today) used to smooth the path's turn. */
export const SMOOTHING_WINDOW_DAYS = 4

/**
 * When the smoothed trend turns negative, its magnitude is multiplied by this
 * factor so a slump retreats several times faster than a streak was built.
 */
export const ROLLBACK_MULTIPLIER = 4

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

/** Radius, in px, of a day circle at scale 1. */
export const DAY_CIRCLE_RADIUS = 22

/** How many recent days the default (focused) camera fits in view. */
export const FOCUSED_DAYS_COUNT = 8

/** Decorative placeholder circles drawn past today to hint the path continues. */
export const GHOST_FUTURE_DAYS = 3

export type TaskDifficulty = 'simple' | 'medium' | 'hard'

/** Default targetDays prefilled from the difficulty chosen during onboarding. */
export const TASK_DIFFICULTY_TARGET_DAYS: Record<TaskDifficulty, number> = {
  simple: 21,
  medium: 66,
  hard: 90,
}

/** Freeze credits a new user starts with (see Промпт 8 for spending them). */
export const DEFAULT_FREEZES_REMAINING = 3
