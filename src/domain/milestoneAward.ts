import { buildCycleReport, computeMilestoneProgress, type CycleReport } from './milestones'
import type { AppState } from './models'

/** A tier just taken, with the report the celebration screen prints. */
export interface TierAward {
  taskId: string
  goalId: string
  goalTitle: string
  tier: 'bronze' | 'gold' | 'platinum'
  report: CycleReport
}

/**
 * Moves the first task whose day count is in up to its next tier, and hands back the award for the
 * screen. One task per call: two ranks at once would mean two full screens stacked on one tap, and
 * the caller runs this again once the first is dismissed.
 *
 * It is deliberately not tied to marking a task. Milestone days are calendar days, so a target can
 * be crossed on a day the task was never asked for — a Mon–Fri habit finishes its 21st day on a
 * Saturday — and the app can also be opened after a week away with the days already rolled forward.
 * While the award only happened on a mark, the card sat at «35 / 21 дн.» waiting for a tap the
 * schedule was not going to ask for, and the one screen that asks «дальше или хватит?» never came
 * up. Nothing may accumulate past a target: crossing it is the moment the question is live.
 */
export function awardReachedTier(state: AppState): { state: AppState; award: TierAward } | null {
  const stampDay = state.days[state.days.length - 1]
  if (!stampDay) return null

  for (const goal of state.user.goals) {
    if (goal.archived) continue
    for (const task of goal.tasks) {
      const progress = computeMilestoneProgress(task, state.days)
      const tier = progress.reachedTier
      if (!tier) continue

      // Only the tier moves. `cycleStartDate` stays where it was, so the day count keeps running
      // and the days past the target are the first days of the next rank instead of being burned —
      // the multipliers in MILESTONE_TIER_MULTIPLIER are read from one start, 66 → 132 → 198, and
      // the card's bar never restarts empty the morning after a rank.
      const goals = state.user.goals.map((g) =>
        g.id === goal.id
          ? { ...g, tasks: g.tasks.map((t) => (t.id === task.id ? { ...t, currentTier: tier } : t)) }
          : g,
      )
      // Stamped on the day the road is standing on, whichever day carried the count over: the chip
      // marks when the person was told, and a rank appearing on a day they filled in afterwards
      // would put it behind them on the road.
      const days = state.days.map((d) =>
        d.id === stampDay.id
          ? { ...d, milestonesReached: [...(d.milestonesReached ?? []), { taskId: task.id, goalId: goal.id, tier }] }
          : d,
      )

      return {
        state: { user: { ...state.user, goals }, days },
        award: {
          taskId: task.id,
          goalId: goal.id,
          goalTitle: goal.title,
          tier,
          report: buildCycleReport(task, goal.title, progress, tier),
        },
      }
    }
  }

  return null
}
