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
  antiGoalTitle: string
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
  habitLevel: number
  habitExp: number
  targetDays: number
  currentTier: Tier
  /** Date the current milestone cycle started counting from (task creation, or the day after the last tier was reached). */
  cycleStartDate: string
}

export type ColorTier = 'gold' | 'green' | 'red' | 'gray'

export interface Day {
  id: string
  date: string
  tasks: DayTask[]
  completionRate: number
  pathAngleDelta: number
  columnDriftX: number
  colorTier: ColorTier
  frozen: boolean
  /** Ids of goals that started contributing to the path as of this day, for the permanent "new goal appeared here" marker. */
  newGoalIds?: string[]
  /** Task milestones (anchored/gold/platinum) reached on this day, for the permanent trophy marker. */
  milestonesReached?: { taskId: string; goalId: string; tier: Tier }[]
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
