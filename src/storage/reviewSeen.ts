/**
 * Which week summary this browser has already shown.
 *
 * Its own key rather than a field on the state, for the same reason the backup date is: it is a
 * fact about this device, not about the history. Carried in the envelope it would travel inside
 * the backup file, and restoring a copy on a new phone would arrive already claiming the week had
 * been seen there — on the one screen whose whole job is to be seen once.
 *
 * Losing it costs one repeated screen, which is why nothing here throws: a blocked or full storage
 * must not stand between the person and their road.
 */
const WEEK_REVIEW_KEY = 'the-way:week-review-seen'

/** The Monday ('YYYY-MM-DD') of the last week whose summary was shown here, or null. */
export function readWeekReviewSeen(): string | null {
  try {
    const raw = localStorage.getItem(WEEK_REVIEW_KEY)
    return raw !== null && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
  } catch {
    return null
  }
}

export function markWeekReviewSeen(weekStart: string): void {
  try {
    localStorage.setItem(WEEK_REVIEW_KEY, weekStart)
  } catch {
    // Nothing to do: the screen has been shown, and only the note about it is lost.
  }
}
