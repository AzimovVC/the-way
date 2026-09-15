import type { AppState, Day, Tier } from './models'
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
  return {
    currentGoldStreak,
    totalGoldDays,
    freezesRemaining: state.user.freezesRemaining,
    totalDays: state.days.length,
    startDate: firstDate(state.days),
  }
}

export interface Trophy {
  taskId: string
  goalId: string
  tier: Tier
  /** The day it was reached — the place on the road the shelf can send you back to. */
  date: string
  /**
   * Null when the task it was earned for is gone. A milestone is stamped on the day forever, but
   * the template that carried the name is not: a task removed later leaves the trophy standing
   * with nothing left in the state that can say what it was called.
   */
  taskTitle: string | null
  goalTitle: string | null
}

/**
 * Every milestone ever reached, newest first — the shelf is a reading of `Day.milestonesReached`,
 * not a second list kept beside it. Nothing is recomputed from the tasks' current tiers either:
 * a tier that later rolled back was still reached on the day it was reached, and the day says so.
 */
export function collectTrophies(state: AppState): Trophy[] {
  const taskTitles = new Map<string, string>()
  const goalTitles = new Map<string, string>()
  for (const goal of state.user.goals) {
    goalTitles.set(goal.id, goal.title)
    for (const task of goal.tasks) taskTitles.set(task.id, task.title)
  }

  const trophies: Trophy[] = []
  for (const day of state.days) {
    for (const reached of day.milestonesReached ?? []) {
      trophies.push({
        taskId: reached.taskId,
        goalId: reached.goalId,
        tier: reached.tier,
        date: day.date,
        taskTitle: taskTitles.get(reached.taskId) ?? null,
        goalTitle: goalTitles.get(reached.goalId) ?? null,
      })
    }
  }

  return trophies.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
