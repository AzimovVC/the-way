import type { TaskDifficulty } from './config'
import type { AppState, Day, DayTask, Goal, TaskChange, TaskTemplate, User } from './models'
import { applyPathGeometry, getLogicalToday } from './pathEngine'
import { isTaskScheduledOn } from './schedule'

/**
 * Recomputes a day's completion rate from its own task list — the one place that arithmetic
 * lives, so adding and dropping tasks can never drift apart on it.
 */
function withRecomputedRate(day: Day, tasks: DayTask[]): Day {
  const countable = tasks.filter((t) => !t.skipped)
  const completionRate = countable.length === 0 ? 0 : countable.filter((t) => t.isDone).length / countable.length
  // A day left asking for nothing is a day off, not a day failed — the same thing a schedule
  // means by an empty weekday. applyPathGeometry reads `rest` and leaves the road straight.
  return { ...day, tasks, completionRate, rest: tasks.length === 0 }
}

/** Stamps changes onto today's day, leaving every earlier day exactly as it was recorded. */
function stampChanges(days: Day[], today: string, changes: TaskChange[], mapToday: (day: Day) => Day): Day[] {
  return days.map((day) =>
    day.date === today ? { ...mapToday(day), taskChanges: [...(day.taskChanges ?? []), ...changes] } : day,
  )
}

/**
 * Archives a goal: its tasks stop being asked for from today on. History keeps every day it
 * was part of — the road is a record, not a current settings screen — so today's day carries
 * a removal marker per task and only today's remaining tasks are re-counted.
 */
export function archiveGoal(state: AppState, goalId: string, now: Date = new Date()): AppState {
  const goal = state.user.goals.find((g) => g.id === goalId)
  if (!goal || goal.archived) return state

  const today = getLogicalToday(now)
  const removedIds = new Set(goal.tasks.map((t) => t.id))
  const changes: TaskChange[] = goal.tasks.map((task) => ({
    taskId: task.id,
    goalId,
    title: task.title,
    kind: 'removed',
  }))

  const days = stampChanges(state.days, today, changes, (day) =>
    withRecomputedRate(day, day.tasks.filter((t) => !removedIds.has(t.taskTemplateId))),
  )

  return {
    user: {
      ...state.user,
      goals: state.user.goals.map((g) => (g.id === goalId ? { ...g, archived: true } : g)),
    },
    days: applyPathGeometry(days),
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
  weekdays?: number[]
}

export interface NewGoalInput {
  title: string
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
    frequency: task.weekdays && task.weekdays.length < 7 ? 'custom' : 'daily',
    weekdays: task.weekdays,
    habitLevel: 0,
    habitExp: 0,
    targetDays: task.targetDays,
    currentTier: 'none',
    cycleStartDate: today,
  }))

  const goal: Goal = {
    id: goalId,
    title: input.title,
    tasks,
    archived: false,
  }

  // The goal's own flag marks this spot; its starting tasks are not stamped on top of it as
  // separate arrivals, or one decision would leave six marks on one circle.
  const days: Day[] = state.days.map((day) => {
    if (day.date !== today) return day

    const newDayTasks: DayTask[] = tasks.filter((task) => isTaskScheduledOn(task, today)).map((task) => ({
      id: crypto.randomUUID(),
      taskTemplateId: task.id,
      dayId: day.id,
      isDone: false,
      skipped: false,
      completedAt: null,
    }))

    return {
      ...withRecomputedRate(day, [...day.tasks, ...newDayTasks]),
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
    frequency: input.weekdays && input.weekdays.length < 7 ? 'custom' : 'daily',
    weekdays: input.weekdays,
    habitLevel: 0,
    habitExp: 0,
    targetDays: input.targetDays,
    currentTier: 'none',
    cycleStartDate: getLogicalToday(now),
  }

  const today = getLogicalToday(now)
  const changes: TaskChange[] = [{ taskId: task.id, goalId, title: task.title, kind: 'added' }]
  // The mark goes on today either way — the day the set changed is the fact worth keeping — but
  // the task itself only joins today if today is one of its days.
  const days = stampChanges(state.days, today, changes, (day) => {
    if (!isTaskScheduledOn(task, today)) return day
    const newDayTask: DayTask = {
      id: crypto.randomUUID(),
      taskTemplateId: task.id,
      dayId: day.id,
      isDone: false,
      skipped: false,
      completedAt: null,
    }
    return withRecomputedRate(day, [...day.tasks, newDayTask])
  })

  return {
    user: {
      ...state.user,
      goals: state.user.goals.map((g) => (g.id === goalId ? { ...g, tasks: [...g.tasks, task] } : g)),
    },
    days: applyPathGeometry(days),
  }
}

/**
 * Drops a task from a goal. Like archiving, this changes what *tomorrow* asks for and what
 * today still counts — earlier days keep the task they were actually judged on, so a green
 * day cannot turn gold retroactively just because the bar was lowered later.
 */
export function removeTaskFromGoal(state: AppState, goalId: string, taskId: string, now: Date = new Date()): AppState {
  const goal = state.user.goals.find((g) => g.id === goalId)
  const task = goal?.tasks.find((t) => t.id === taskId)
  if (!goal || !task) return state

  const today = getLogicalToday(now)
  const changes: TaskChange[] = [{ taskId: task.id, goalId, title: task.title, kind: 'removed' }]
  const days = stampChanges(state.days, today, changes, (day) =>
    withRecomputedRate(day, day.tasks.filter((t) => t.taskTemplateId !== taskId)),
  )

  return {
    user: {
      ...state.user,
      goals: state.user.goals.map((g) => (g.id === goalId ? { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) } : g)),
    },
    days: applyPathGeometry(days),
  }
}
