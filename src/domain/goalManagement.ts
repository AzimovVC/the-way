import type { TaskDifficulty } from './config'
import type { AppState, Day, DayTask, Goal, TaskTemplate, User } from './models'
import { applyPathGeometry, getLogicalToday } from './pathEngine'

export function archiveGoal(state: AppState, goalId: string): AppState {
  return {
    ...state,
    user: {
      ...state.user,
      goals: state.user.goals.map((g) => (g.id === goalId ? { ...g, archived: true } : g)),
    },
  }
}

export function updateAntiGoal(state: AppState, goalId: string, antiGoalTitle: string): AppState {
  return {
    ...state,
    user: {
      ...state.user,
      goals: state.user.goals.map((g) => (g.id === goalId ? { ...g, antiGoalTitle } : g)),
    },
  }
}

export function updateUserProfile(
  state: AppState,
  patch: Partial<Pick<User, 'name' | 'timezone' | 'notificationsEnabled'>>,
): AppState {
  return { ...state, user: { ...state.user, ...patch } }
}

export interface NewTaskInput {
  title: string
  difficulty: TaskDifficulty
  targetDays: number
}

export interface NewGoalInput {
  title: string
  antiGoalTitle: string
  tasks: NewTaskInput[]
}

/**
 * Adds a new goal mid-path. New tasks only start counting from today: today's
 * DayTask list and completionRate are extended/recomputed, and today's day
 * gets a permanent newGoalIds marker so the path (and detectPatterns) can
 * show where the goal appeared. Earlier days are left untouched.
 */
export function addGoalMidPath(state: AppState, input: NewGoalInput, now: Date = new Date()): AppState {
  const goalId = crypto.randomUUID()
  const today = getLogicalToday(now)
  const tasks: TaskTemplate[] = input.tasks.map((task) => ({
    id: crypto.randomUUID(),
    goalId,
    title: task.title,
    frequency: 'daily',
    habitLevel: 0,
    habitExp: 0,
    targetDays: task.targetDays,
    currentTier: 'none',
    cycleStartDate: today,
  }))

  const goal: Goal = {
    id: goalId,
    title: input.title,
    antiGoalTitle: input.antiGoalTitle,
    tasks,
    archived: false,
  }

  const days: Day[] = state.days.map((day) => {
    if (day.date !== today) return day

    const newDayTasks: DayTask[] = tasks.map((task) => ({
      id: crypto.randomUUID(),
      taskTemplateId: task.id,
      dayId: day.id,
      isDone: false,
      skipped: false,
      completedAt: null,
    }))

    const allTasks = [...day.tasks, ...newDayTasks]
    const countable = allTasks.filter((t) => !t.skipped)
    const completionRate = countable.length === 0 ? 0 : countable.filter((t) => t.isDone).length / countable.length

    return {
      ...day,
      tasks: allTasks,
      completionRate,
      newGoalIds: [...(day.newGoalIds ?? []), goalId],
    }
  })

  return {
    user: { ...state.user, goals: [...state.user.goals, goal] },
    days: applyPathGeometry(days),
  }
}

/**
 * Adds a fresh task to an existing goal — the "create a new task instead"
 * option offered when a milestone is reached. Same wiring as addGoalMidPath,
 * but under an existing goal rather than a new one.
 */
export function addTaskToGoal(state: AppState, goalId: string, input: NewTaskInput, now: Date = new Date()): AppState {
  const task: TaskTemplate = {
    id: crypto.randomUUID(),
    goalId,
    title: input.title,
    frequency: 'daily',
    habitLevel: 0,
    habitExp: 0,
    targetDays: input.targetDays,
    currentTier: 'none',
    cycleStartDate: getLogicalToday(now),
  }

  const today = getLogicalToday(now)
  const days: Day[] = state.days.map((day) => {
    if (day.date !== today) return day
    const newDayTask: DayTask = {
      id: crypto.randomUUID(),
      taskTemplateId: task.id,
      dayId: day.id,
      isDone: false,
      skipped: false,
      completedAt: null,
    }
    const allTasks = [...day.tasks, newDayTask]
    const countable = allTasks.filter((t) => !t.skipped)
    const completionRate = countable.length === 0 ? 0 : countable.filter((t) => t.isDone).length / countable.length
    return { ...day, tasks: allTasks, completionRate }
  })

  return {
    user: {
      ...state.user,
      goals: state.user.goals.map((g) => (g.id === goalId ? { ...g, tasks: [...g.tasks, task] } : g)),
    },
    days: applyPathGeometry(days),
  }
}
