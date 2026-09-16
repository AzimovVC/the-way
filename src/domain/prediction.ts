import type { AppState } from './models'

/**
 * Writes down the guess a person just made about a habit they just created.
 *
 * Only ever called from the screen that asks, and only for a habit whose guess is still empty —
 * `editTaskInGoal` deliberately cannot touch this field, because a guess revised halfway is no
 * longer a guess.
 */
export function setPrediction(state: AppState, taskId: string, days: number): AppState {
  return {
    ...state,
    user: {
      ...state.user,
      goals: state.user.goals.map((goal) => ({
        ...goal,
        tasks: goal.tasks.map((task) => (task.id === taskId ? { ...task, predictedDays: days } : task)),
      })),
    },
  }
}

/** Habits that exist in `after` and did not in `before` — the ones a creation flow just made. */
export function tasksAddedIn(before: AppState, after: AppState): { id: string; title: string }[] {
  const known = new Set(before.user.goals.flatMap((goal) => goal.tasks.map((task) => task.id)))
  return after.user.goals
    .flatMap((goal) => goal.tasks)
    .filter((task) => !known.has(task.id))
    .map((task) => ({ id: task.id, title: task.title }))
}
