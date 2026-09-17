import { PREDICTION_CHOICES } from './config'
import { computeMilestoneProgress } from './milestones'
import type { AppState, Day } from './models'

/** A guess a habit has just walked out, with what the screen needs to say so. */
export interface PredictionAward {
  taskId: string
  goalId: string
  taskTitle: string
  predictedDays: number
  /** The words the person picked — «Месяц», not «30 дней». They said it that way; so does the screen. */
  label: string
}

/** How the choice was worded when it was made. A guess from an older list still gets a sentence. */
export function predictionLabel(days: number): string {
  return PREDICTION_CHOICES.find((choice) => choice.days === days)?.label ?? `${days} дн.`
}

function alreadySaid(days: Day[], taskId: string): boolean {
  return days.some((day) => (day.predictionsMet ?? []).some((met) => met.taskId === taskId))
}

/**
 * The first habit that has reached the number its person guessed, stamped so it is said once.
 *
 * There is no failing this. The day count only ever arrives late — a break takes days off it and a
 * return pays them back — so a guess is either met or still ahead, never missed. That is the whole
 * licence for asking: a number a person can fall short of is a bet, and the app does not take bets
 * against the people using it.
 *
 * Kept apart from the level award rather than folded into it, because they are two different
 * events. A level says how far the habit has set, on a ladder shared by everyone; this says the
 * person read themselves right, and belongs to nobody else. Both can fall on the same day — the
 * screens queue and neither swallows the other — but none of `PREDICTION_CHOICES` sits on a rung,
 * so in practice they land on different days.
 */
export function awardMetPrediction(state: AppState): { state: AppState; award: PredictionAward } | null {
  const stampDay = state.days[state.days.length - 1]
  if (!stampDay) return null

  for (const goal of state.user.goals) {
    if (goal.archived) continue
    for (const task of goal.tasks) {
      const predictedDays = task.predictedDays
      if (predictedDays === undefined || alreadySaid(state.days, task.id)) continue
      if (computeMilestoneProgress(task, state.days).progressDays < predictedDays) continue

      return {
        state: {
          // Всё состояние целиком — см. ту же оговорку в milestoneAward.
          ...state,
          days: state.days.map((day) =>
            day.id === stampDay.id
              ? {
                  ...day,
                  predictionsMet: [
                    ...(day.predictionsMet ?? []),
                    { taskId: task.id, goalId: goal.id, days: predictedDays },
                  ],
                }
              : day,
          ),
        },
        award: {
          taskId: task.id,
          goalId: goal.id,
          taskTitle: task.title,
          predictedDays,
          label: predictionLabel(predictedDays),
        },
      }
    }
  }

  return null
}
