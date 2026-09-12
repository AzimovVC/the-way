export interface User {
  id: string
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
