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

/**
 * The comeback this browser has already celebrated, by the date it was confirmed on.
 *
 * Same reasoning as the week above, and one more: the comeback is derived from the shape of the
 * road, so restoring a backup re-derives every comeback the history holds. Without this note the
 * newest one would be re-announced on a phone that has only just been handed the file.
 */
const COMEBACK_KEY = 'the-way:comeback-seen'

export function readComebackSeen(): string | null {
  try {
    const raw = localStorage.getItem(COMEBACK_KEY)
    return raw !== null && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
  } catch {
    return null
  }
}

export function markComebackSeen(date: string): void {
  try {
    localStorage.setItem(COMEBACK_KEY, date)
  } catch {
    // Same as the week: the screen has been shown, only the note about it is lost.
  }
}

/**
 * Забыть, что этот браузер уже показывал. Зовётся только «Начать заново»: заметки эти — про
 * историю, которой больше нет, и оставленные они промолчали бы ровно там, где новый путь впервые
 * заслужит свой экран.
 */
export function forgetSeenScreens(): void {
  try {
    localStorage.removeItem(WEEK_REVIEW_KEY)
    localStorage.removeItem(COMEBACK_KEY)
  } catch {
    // Цена — один непоказанный экран, и она не стоит того, чтобы остановить сам сброс.
  }
}
