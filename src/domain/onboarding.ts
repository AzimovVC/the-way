import { DEFAULT_FREEZES_REMAINING } from './config'
import type { AppState, Day, DayTask, Goal, TaskTemplate } from './models'
import { getLogicalToday } from './pathEngine'
import { isTaskScheduledOn } from './schedule'

export interface OnboardingTaskInput {
  title: string
  weekdays?: number[]
  predictedDays?: number
}

export interface OnboardingGoalInput {
  title: string
  tasks: OnboardingTaskInput[]
}

/**
 * Builds the initial User, Goal[], TaskTemplate[] and first Day from onboarding
 * answers. The first day starts with angle/drift at 0 — the path begins from
 * the center, with no artificial grace period applied afterward.
 */
export function buildInitialState(goalsInput: OnboardingGoalInput[], now: Date = new Date()): AppState {
  const goals: Goal[] = goalsInput.map((goalInput) => {
    const goalId = crypto.randomUUID()
    const tasks: TaskTemplate[] = goalInput.tasks.map((taskInput) => ({
      id: crypto.randomUUID(),
      goalId,
      title: taskInput.title,
      weekdays: taskInput.weekdays,
      predictedDays: taskInput.predictedDays,
      cycleStartDate: getLogicalToday(now),
    }))

    return {
      id: goalId,
      title: goalInput.title,
      tasks,
      archived: false,
    }
  })

  const today = getLogicalToday(now)
  const dayTasks: DayTask[] = goals.flatMap((goal) =>
    goal.tasks.filter((task) => isTaskScheduledOn(task, today)).map((task) => ({
      id: crypto.randomUUID(),
      taskTemplateId: task.id,
      dayId: today,
      isDone: false,
      skipped: false,
      completedAt: null,
    })),
  )

  const firstDay: Day = {
    id: today,
    date: today,
    tasks: dayTasks,
    completionRate: 0,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: dayTasks.length === 0 ? 'rest' : 'red',
    frozen: false,
    rest: dayTasks.length === 0,
    newGoalIds: [],
    taskChanges: [],
  }

  return {
    user: {
      id: crypto.randomUUID(),
      name: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      notificationsEnabled: true,
      freezesRemaining: DEFAULT_FREEZES_REMAINING,
      freezesRefilledMonth: getLogicalToday(now).slice(0, 7),
      goals,
    },
    days: [firstDay],
  }
}
