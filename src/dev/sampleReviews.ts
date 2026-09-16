import type { Comeback } from '../domain/comeback'
import type { MilestoneAward } from '../domain/milestoneAward'
import type { DayReview, WeekReview } from '../domain/review'

/**
 * Stand-ins for the two summary screens, used only when the history cannot supply the real thing
 * — a fresh install, or a week that judged nothing. Without them the preview buttons would do
 * nothing at all on exactly the state a new screen is most often looked at from.
 *
 * Deliberately not a perfect week: a preview that is all gold hides what the week drawing is for.
 */
export const SAMPLE_DAY_REVIEW: DayReview = {
  date: '2026-09-14',
  taskCount: 3,
  goldStreak: 12,
  isStreakRecord: true,
  goldDaysThisWeek: 4,
  judgedDaysThisWeek: 5,
  totalGoldDays: 38,
  note: 'Такой длинной серии у тебя ещё не было.',
}

export const SAMPLE_WEEK_REVIEW: WeekReview = {
  start: '2026-09-07',
  end: '2026-09-13',
  goldDays: 4,
  judgedDays: 6,
  restDays: 1,
  completionRate: 0.81,
  prevGoldDays: 3,
  goldStreakAtEnd: 2,
  shape: ['gold', 'gold', 'red', 'gold', 'rest', 'gold', 'green'],
  note: 'Золотых дней больше, чем неделей раньше: было 3.',
}

/**
 * Stand-in for the comeback screen, for the same reason as the two above: a fresh history has no
 * slump to return from, and that is exactly the state the screen is first looked at from.
 */
export const SAMPLE_COMEBACK: Comeback = {
  slumpStart: '2026-09-01',
  slumpEnd: '2026-09-05',
  slumpLength: 5,
  returnStart: '2026-09-06',
  confirmedDate: '2026-09-08',
  returnLength: 3,
  ordinal: 3,
  // A gold day at the top, the fall, a rest day inside it, and the climb back — deliberately not
  // a clean V, because a real one never is and the drawing has to survive the messy case.
  shape: [
    { date: '2026-08-31', tier: 'gold', direction: 1 },
    { date: '2026-09-01', tier: 'red', direction: -1 },
    { date: '2026-09-02', tier: 'red', direction: -1 },
    { date: '2026-09-03', tier: 'rest', direction: 0 },
    { date: '2026-09-04', tier: 'red', direction: -1 },
    { date: '2026-09-05', tier: 'green', direction: -1 },
    { date: '2026-09-06', tier: 'gold', direction: 1 },
    { date: '2026-09-07', tier: 'gold', direction: 1 },
    { date: '2026-09-08', tier: 'gold', direction: 1 },
  ],
}

/**
 * Stand-in for the rank screen, same reason again: a fresh history has not walked out a target,
 * and the screen that asks «дальше или хватит?» is one of the rarest in the app — it must be
 * possible to look at it without living through 21 days first.
 */
export const SAMPLE_TIER_AWARD: MilestoneAward = {
  kind: 'target',
  taskId: 'sample-task',
  goalId: 'sample-goal',
  goalTitle: 'Читать',
  taskTitle: 'Читать',
  rank: { id: 'apprentice', days: 21, year: 1 },
  report: {
    kind: 'target',
    rank: { id: 'apprentice', days: 21, year: 1 },
    cycleStartDate: '2026-08-26',
    cycleEndDate: '2026-09-16',
    thresholdDays: 21,
    daysWalked: 21,
    nextRankDays: 66,
    missedDays: 3,
    missStreakCount: 2,
    avgRecoveryDays: 2.5,
    avgCompletionRate: 0.84,
    freezesUsed: 1,
    message:
      'Цель, которую ты сам себе поставил: 21 день — Читать. Дошёл. Было 2 срыв(ов) и столько же возвращений — и это ничуть не хуже идеального пути: тут важна настойчивость, а не только дисциплина.',
  },
}
