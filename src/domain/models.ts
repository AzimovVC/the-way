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

export type TaskFrequency = 'daily' | 'custom'

export type Tier = 'none' | 'bronze' | 'gold' | 'platinum'

export interface TaskTemplate {
  id: string
  goalId: string
  title: string
  frequency: TaskFrequency
  /**
   * Monday-first weekday indices (0..6) the task is asked for. Absent or empty means every day,
   * which is what every task created before schedules existed must keep meaning.
   */
  weekdays?: number[]
  habitLevel: number
  habitExp: number
  targetDays: number
  currentTier: Tier
  /** Date the current milestone cycle started counting from (task creation, or the day after the last tier was reached). */
  cycleStartDate: string
}

export type ColorTier = 'gold' | 'green' | 'red' | 'gray'

/**
 * A change to what the day *asks of you*, stamped on the day it happened. The title is a
 * snapshot, not a lookup: a removed task's template is gone from the goal, so nothing else
 * in the state can still say what it was called.
 */
export interface TaskChange {
  taskId: string
  goalId: string
  title: string
  kind: 'added' | 'removed'
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
  /** Task milestones (anchored/gold/platinum) reached on this day, for the permanent trophy marker. */
  milestonesReached?: { taskId: string; goalId: string; tier: Tier }[]
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
}

export interface AppState {
  user: User
  days: Day[]
}
