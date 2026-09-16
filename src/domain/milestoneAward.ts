import { buildCycleReport, computeMilestoneProgress, type CycleReport } from './milestones'
import type { AppState, Day, TaskTemplate } from './models'
import type { Rank } from './ranks'

/** A rank just taken, or a target just reached, with the report its screen prints. */
export interface MilestoneAward {
  kind: CycleReport['kind']
  taskId: string
  goalId: string
  goalTitle: string
  taskTitle: string
  rank: Rank | null
  report: CycleReport
}

/** The highest rung already stamped on the road for this task — ranks only ever move up from it. */
function stampedRankDays(days: Day[], taskId: string): number {
  let max = 0
  for (const day of days) {
    for (const reached of day.milestonesReached ?? []) {
      if (reached.taskId === taskId && reached.days > max) max = reached.days
    }
  }
  return max
}

function targetAlreadyAsked(days: Day[], taskId: string): boolean {
  return days.some((day) => (day.targetsReached ?? []).some((t) => t.taskId === taskId))
}

/**
 * Moves the first habit that has crossed something up to it, and hands back the award for the
 * screen. One event per call: two full screens stacked on one tap is the app taking the day over,
 * and the caller runs this again once the first is dismissed.
 *
 * Two different things can be crossed, and the order between them is deliberate. The target is the
 * finish the person set for themselves, and it is the only moment the app asks whether to go on or
 * stop; a rank is a rung of the ladder every habit shares. When the same day carries both — a
 * 21-day target is also the «Ученик» rung — the target screen is the one that shows, and both are
 * stamped, because asking the question twice about one day is worse than one screen fewer.
 *
 * It is deliberately not tied to marking a task. Milestone days are calendar days, so a threshold
 * can be crossed on a day the task was never asked for — a Mon–Fri habit finishes its 21st day on
 * a Saturday — and the app can also be opened after a week away with the days already rolled
 * forward. While the award only happened on a mark, the card sat past its target waiting for a tap
 * the schedule was not going to ask for.
 */
export function awardReachedMilestone(state: AppState): { state: AppState; award: MilestoneAward } | null {
  const stampDay = state.days[state.days.length - 1]
  if (!stampDay) return null

  for (const goal of state.user.goals) {
    if (goal.archived) continue
    for (const task of goal.tasks) {
      const progress = computeMilestoneProgress(task, state.days)

      const target =
        progress.targetReached && !targetAlreadyAsked(state.days, task.id) ? progress.targetDays : null
      const rank =
        progress.currentRank && progress.currentRank.days > stampedRankDays(state.days, task.id)
          ? progress.currentRank
          : null
      if (target === null && rank === null) continue

      const report = buildCycleReport(
        task,
        goal.title,
        progress,
        target !== null ? { kind: 'target', rank: progress.currentRank } : { kind: 'rank', rank: rank as Rank },
      )

      return {
        state: {
          user: state.user,
          // Stamped on the day the road is standing on, whichever day carried the count over: the
          // mark says when the person was told, and putting it on a day they filled in afterwards
          // would leave it behind them on the road.
          days: state.days.map((d) => (d.id === stampDay.id ? stamp(d, goal.id, task, rank, target) : d)),
        },
        award: {
          kind: report.kind,
          taskId: task.id,
          goalId: goal.id,
          goalTitle: goal.title,
          taskTitle: task.title,
          rank: report.rank,
          report,
        },
      }
    }
  }

  return null
}

function stamp(day: Day, goalId: string, task: TaskTemplate, rank: Rank | null, target: number | null): Day {
  const next = { ...day }
  if (rank) {
    next.milestonesReached = [
      ...(day.milestonesReached ?? []),
      { taskId: task.id, goalId, rank: rank.id, days: rank.days },
    ]
  }
  if (target !== null) {
    next.targetsReached = [...(day.targetsReached ?? []), { taskId: task.id, goalId, days: target }]
  }
  return next
}
