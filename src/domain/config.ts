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
