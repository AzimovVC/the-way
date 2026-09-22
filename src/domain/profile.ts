import type { AppState, Day } from './models'
import { computeStreak } from './analytics'

/**
 * What the profile shows about the person rather than the plan. Every number here is read out of
 * the state that already exists — nothing on this screen is stored for its own sake, so there is
 * no second record of the history that could disagree with the road.
 */
export interface ProfileOverview {
  currentGoldStreak: number
  totalGoldDays: number
  freezesRemaining: number
  totalDays: number
  /** Сколько привычек день сейчас спрашивает: живые задачи живых целей. */
  habitCount: number
  /**
   * Сколько из них видно друзьям. Второе число, а не то же самое, потому что «сколько у него
   * привычек» на чужом экране обязано сходиться с полкой, которая туда приехала, — а тихие в неё
   * не попали. На своём профиле стоит `habitCount`: там прятать не от кого.
   */
  sharedHabitCount: number
  /** The first day the road holds, or null before there is one. */
  startDate: string | null
}

function firstDate(days: Day[]): string | null {
  let earliest: string | null = null
  for (const day of days) {
    if (earliest === null || day.date < earliest) earliest = day.date
  }
  return earliest
}

export function computeProfileOverview(state: AppState): ProfileOverview {
  const { currentGoldStreak, totalGoldDays } = computeStreak(state.days)
  const liveTasks = state.user.goals.filter((goal) => !goal.archived).flatMap((goal) => goal.tasks)
  const habitCount = liveTasks.length
  const sharedHabitCount = liveTasks.filter((task) => task.private !== true).length

  return {
    habitCount,
    sharedHabitCount,
    currentGoldStreak,
    totalGoldDays,
    freezesRemaining: state.user.freezesRemaining,
    totalDays: state.days.length,
    startDate: firstDate(state.days),
  }
}
