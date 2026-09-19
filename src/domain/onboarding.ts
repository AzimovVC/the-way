import { DEFAULT_FREEZES_REMAINING } from './config'
import type { AppState, Day, DayTask, Goal, TaskTemplate } from './models'
import type { PartOfDay } from './partOfDay'
import { getLogicalToday } from './pathEngine'
import { isTaskScheduledOn } from './schedule'

export interface OnboardingTaskInput {
  /** Ключ привычки — см. [ids.ts](./ids.ts). */
  id: string
  title: string
  weekdays?: number[]
  partOfDay?: PartOfDay
  icon?: string
  predictedDays?: number
}

export interface OnboardingGoalInput {
  /** Ключ цели. */
  id: string
  title: string
  tasks: OnboardingTaskInput[]
}

/**
 * Builds the initial User, Goal[], TaskTemplate[] and first Day from onboarding
 * answers. The first day starts with angle/drift at 0 — the path begins from
 * the center, with no artificial grace period applied afterward.
 *
 * `userId` приезжает снаружи по той же причине, что и `now`, и что ключи целей с привычками: онбординг
 * — это одна операция, и все имена, которые в ней рождаются, чеканит тот, кто её составил. Иначе
 * «завёл путь с тремя привычками», применённое дважды, дало бы двух разных людей с одной историей.
 */
export function buildInitialState(
  goalsInput: OnboardingGoalInput[],
  userId: string,
  now: Date = new Date(),
): AppState {
  // Сквозной номер на все цели: порядок живёт в списке дня, а он по целям не разбит.
  let order = 0
  const goals: Goal[] = goalsInput.map((goalInput) => {
    const goalId = goalInput.id
    const tasks: TaskTemplate[] = goalInput.tasks.map((taskInput) => ({
      id: taskInput.id,
      goalId,
      title: taskInput.title,
      weekdays: taskInput.weekdays,
      partOfDay: taskInput.partOfDay,
      icon: taskInput.icon,
      order: order++,
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
      id: userId,
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
