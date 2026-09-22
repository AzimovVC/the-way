import { computeMilestoneProgress } from './milestones'
import type { AppState, Day } from './models'
import { type Rank, type RankId } from './ranks'

/** One habit on the shelf: where it stands now, and every rank it has taken. */
export interface ShowcaseHabit {
  taskId: string
  title: string
  /** Null while the habit is its own goal — printing the same words twice says nothing. */
  goalTitle: string | null
  /**
   * Значок, если человек его выбирал. У завершённой привычки его нет и быть не может: карточка
   * собирается из отметки в дне, а шаблона к тому моменту уже нет — медаль там возвращается к
   * букве, как было до значков.
   */
  icon?: string
  /**
   * Тихая привычка — на свою витрину она встаёт как все, а наружу не уезжает (`toShelf`).
   * У завершённой этого уже не спросить: шаблона нет, а карточка собрана из отметки в дне.
   */
  private?: boolean
  status: 'active' | 'finished'
  /** The rank standing now. Null for a habit that never reached the first rung. */
  rank: Rank | null
  /** Ranks taken, oldest first — the row of marks under the card. */
  history: { rank: RankId; days: number; date: string }[]
  /**
   * Days walked, and what the habit is walking to. Null on a finished habit: its day count stopped
   * when it stopped being asked for, and the days after that are not its days.
   */
  daysWalked: number | null
  nextRank: Rank | null
  /** The day on the road this card sends you to — the last thing that happened to this habit. */
  markDate: string | null
  finishedOn: string | null
}

function rankHistory(days: Day[], taskId: string): ShowcaseHabit['history'] {
  const history: ShowcaseHabit['history'] = []
  for (const day of days) {
    for (const reached of day.milestonesReached ?? []) {
      if (reached.taskId === taskId) history.push({ rank: reached.rank, days: reached.days, date: day.date })
    }
  }
  return history.sort((a, b) => a.days - b.days)
}

/**
 * The habits shelf — one card per habit, and not one per rank.
 *
 * The shelf used to list every milestone ever reached, so a single habit stood on it three times
 * and read as three achievements. A habit is the thing a person keeps; its ranks are moments in
 * it, and they belong inside its card.
 *
 * A habit that was **finished on purpose stays here**, marked as finished. That is the whole reason
 * the ending is offered at all: if closing a habit wiped it off the shelf, nobody would ever press
 * the button, and «завершить» would be a punishment rather than an honest end. A finished habit is
 * read out of the day it left the daily set — the task template is gone by then, and that stamp is
 * the only thing that still knows what it was called.
 */
export function buildShowcase(state: AppState): ShowcaseHabit[] {
  const active: ShowcaseHabit[] = []
  const live = new Set<string>()

  for (const goal of state.user.goals) {
    if (goal.archived) continue
    for (const task of goal.tasks) {
      live.add(task.id)
      const progress = computeMilestoneProgress(task, state.days)
      const history = rankHistory(state.days, task.id)
      active.push({
        taskId: task.id,
        title: task.title,
        goalTitle: goal.title === task.title ? null : goal.title,
        icon: task.icon,
        private: task.private,
        status: 'active',
        rank: progress.currentRank,
        history,
        daysWalked: progress.progressDays,
        nextRank: progress.nextRank,
        markDate: history[history.length - 1]?.date ?? null,
        finishedOn: null,
      })
    }
  }

  const finished: ShowcaseHabit[] = []
  for (const day of state.days) {
    for (const change of day.taskChanges ?? []) {
      if (change.kind !== 'removed' || live.has(change.taskId)) continue
      const history = rankHistory(state.days, change.taskId)
      const last = history[history.length - 1]
      finished.push({
        taskId: change.taskId,
        title: change.title,
        goalTitle: null,
        status: 'finished',
        rank: last ? { id: last.rank, days: last.days, year: Math.max(1, Math.floor(last.days / 365)) } : null,
        history,
        daysWalked: null,
        nextRank: null,
        markDate: last?.date ?? day.date,
        finishedOn: day.date,
      })
    }
  }

  // Live habits first, the longest-standing at the top; then the finished ones, most recent first.
  // A finished habit is not a lesser habit, but the shelf is read from the top by someone looking
  // for what they are doing now.
  active.sort((a, b) => (b.daysWalked ?? 0) - (a.daysWalked ?? 0))
  finished.sort((a, b) => (a.finishedOn! < b.finishedOn! ? 1 : -1))
  return [...active, ...finished]
}
