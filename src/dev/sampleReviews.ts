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
