import type { RankId } from './ranks'

export interface User {
  id: string
  name: string
  timezone: string
  notificationsEnabled: boolean
  freezesRemaining: number
  /** YYYY-MM of the last monthly freeze top-up, so it only happens once per month. */
  freezesRefilledMonth: string
  goals: Goal[]
}

export interface Goal {
  id: string
  title: string
  tasks: TaskTemplate[]
  archived: boolean
}

export interface TaskTemplate {
  id: string
  goalId: string
  title: string
  /**
   * Monday-first weekday indices (0..6) the task is asked for. Absent or empty means every day,
   * which is what every task created before schedules existed must keep meaning.
   */
  weekdays?: number[]
  /**
   * How long the person guessed they would keep this up, from `PREDICTION_CHOICES`. Absent when
   * they skipped the question, and for every habit made before it existed.
   *
   * It is a word given at a moment, not a setting: the editor does not offer it for a habit that
   * is already running, because a guess revised halfway is no longer a guess. Reaching it is never
   * required and can never fail — the day count only ever gets there late, never not at all.
   */
  predictedDays?: number
  /** Date the day count starts from — the day the task was created. It never restarts. */
  cycleStartDate: string
}

/**
 * 'gray' means nothing was ever recorded for this day; 'rest' means the day asked nothing of you
 * — a planned day off or a spent freeze. Keeping them apart is the whole point: one is a hole in
 * the record, the other is the record saying everything is fine.
 */
export type ColorTier = 'gold' | 'green' | 'red' | 'gray' | 'rest'

/**
 * A change to what the day *asks of you*, stamped on the day it happened. The title is a
 * snapshot, not a lookup: a removed task's template is gone from the goal, so nothing else
 * in the state can still say what it was called.
 *
 * `rescheduled` is here for the same reason `added` is: narrowing «Пн Ср Пт» to «Пн Пт» moves the
 * bar every following day is judged against, and without the mark the stretch after it is
 * unreadable — a Wednesday that stopped being asked looks exactly like a Wednesday that was
 * skipped. A rename leaves no mark on purpose: it changes what the habit is called, not what the
 * day asks, and each past day already holds the name it was judged under right here.
 */
export interface TaskChange {
  taskId: string
  goalId: string
  title: string
  kind: 'added' | 'removed' | 'rescheduled'
}

export interface Day {
  id: string
  date: string
  tasks: DayTask[]
  completionRate: number
  pathAngleDelta: number
  columnDriftX: number
  colorTier: ColorTier
  frozen: boolean
  /** True when nothing was scheduled for this day at all — a planned day off, not a miss. */
  rest?: boolean
  /** Ids of goals that started contributing to the path as of this day, for the permanent "new goal appeared here" marker. */
  newGoalIds?: string[]
  /**
   * Ranks taken on this day, for the permanent mark on the road and for the shelf. `days` is the
   * rung that was crossed, which is what makes «Легенда · 3 года» readable years later without
   * asking the ladder to keep a name for every year.
   */
  milestonesReached?: { taskId: string; goalId: string; rank: RankId; days: number }[]
  /**
   * Guesses walked out on this day — «ты говорил, что продержишься месяц, и вот он». Stamped so it
   * is said once and never again: the day count can dip back under the number after a break, and
   * saying it a second time on the way back up would turn a warm moment into a loop.
   */
  predictionsMet?: { taskId: string; goalId: string; days: number }[]
  /** Tasks added to or dropped from the daily set on this day, for the permanent "the rules changed here" marker. */
  taskChanges?: TaskChange[]
}

export interface DayTask {
  id: string
  taskTemplateId: string
  dayId: string
  isDone: boolean
  skipped: boolean
  completedAt: string | null
  /**
   * Local wall-clock time of the mark, 'HH:mm' — the clock the person actually looked at.
   *
   * Optional, so nothing older breaks: completedAt alone is still readable, just in whatever zone
   * the browser is in now rather than the one the mark was made in. Recorded from here on because
   * a zone that was never written down cannot be recovered afterwards — a move or a trip would
   * quietly shift a whole history by hours.
   */
  completedLocal?: string
}

export interface AppState {
  user: User
  days: Day[]
}
