import { buildCycleReport, computeMilestoneProgress, type CycleReport } from './milestones'
import type { AppState, Day, TaskTemplate } from './models'
import type { Rank } from './ranks'

/** A level just taken, with the report its screen prints. */
export interface MilestoneAward {
  taskId: string
  goalId: string
  goalTitle: string
  taskTitle: string
  rank: Rank
  report: CycleReport
}

/** The highest rung already stamped on the road for this task — levels only ever move up from it. */
function stampedRankDays(days: Day[], taskId: string): number {
  let max = 0
  for (const day of days) {
    for (const reached of day.milestonesReached ?? []) {
      if (reached.taskId === taskId && reached.days > max) max = reached.days
    }
  }
  return max
}

/**
 * Moves the first habit that has crossed a rung up to it, and hands back the award for the screen.
 * One event per call: two full screens stacked on one tap is the app taking the day over, and the
 * caller runs this again once the first is dismissed.
 *
 * There used to be a second kind of event here — the finish the person set for themselves — and it
 * took precedence whenever both landed on the same day. For a «простая» habit that was every time:
 * its 21-day finish *is* the «Ученик» rung, so that level was never once shown. The finish is gone
 * now, with the whole idea behind it: the app handed out the number and then congratulated the
 * person for reaching it.
 *
 * It is deliberately not tied to marking a task. Milestone days are calendar days, so a rung can be
 * crossed on a day the task was never asked for — a Mon–Fri habit finishes its 21st day on a
 * Saturday — and the app can also be opened after a week away with the days already rolled forward.
 * While the award only happened on a mark, the card sat past the rung waiting for a tap the
 * schedule was not going to ask for.
 */
export function awardReachedMilestone(
  state: AppState,
  now: Date = new Date(),
): { state: AppState; award: MilestoneAward } | null {
  const stampDay = state.days[state.days.length - 1]
  if (!stampDay) return null

  for (const goal of state.user.goals) {
    if (goal.archived) continue
    for (const task of goal.tasks) {
      const progress = computeMilestoneProgress(task, state.days)
      const rank = progress.currentRank
      if (!rank || rank.days <= stampedRankDays(state.days, task.id)) continue

      const report = buildCycleReport(task, progress, { rank })

      return {
        state: {
          // Раскрывается всё состояние, а не собирается заново из пользователя и дней: рядом с
          // `days` лежат дела, и запись, собранная по двум полям, молча теряла бы их при каждом
          // взятом уровне.
          ...state,
          // Stamped on the day the road is standing on, whichever day carried the count over: the
          // mark says when the person was told, and putting it on a day they filled in afterwards
          // would leave it behind them on the road.
          days: state.days.map((d) => (d.id === stampDay.id ? stamp(d, goal.id, task, rank, now) : d)),
        },
        award: {
          taskId: task.id,
          goalId: goal.id,
          goalTitle: goal.title,
          taskTitle: task.title,
          rank,
          report,
        },
      }
    }
  }

  return null
}

function stamp(day: Day, goalId: string, task: TaskTemplate, rank: Rank, now: Date): Day {
  return {
    ...day,
    milestonesReached: [
      ...(day.milestonesReached ?? []),
      // The minute goes on beside the rung, and it is the minute the person was **told** — the
      // same thing the day itself records. The count crosses the rung at a boundary nobody
      // watches; being handed the level is what happens to someone, and that is what the feed is
      // saying the age of.
      { taskId: task.id, goalId, rank: rank.id, days: rank.days, at: now.toISOString() },
    ],
  }
}
