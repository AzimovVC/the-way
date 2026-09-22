import type { AppState, Day, DayTask, Goal, TaskChange, TaskTemplate, User } from './models'
import type { PartOfDay } from './partOfDay'
import { applyPathGeometry, getLogicalToday } from './pathEngine'
import { isTaskScheduledOn } from './schedule'
import { nextOrder } from './taskOrder'

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
    at: now.toISOString(),
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
  patch: Partial<Pick<User, 'name' | 'handle' | 'timezone' | 'notificationsEnabled'>>,
): AppState {
  return { ...state, user: { ...state.user, ...patch } }
}

export interface NewTaskInput {
  /** Ключ привычки, отчеканенный тем, кто её завёл, — см. [ids.ts](./ids.ts). */
  id: string
  title: string
  weekdays?: number[]
  partOfDay?: PartOfDay
  icon?: string
  predictedDays?: number
  /** Тихая привычка — наружу о ней не уезжает ничего. См. `TaskTemplate.private`. */
  private?: boolean
  /** Сколько раз за день, если привычка считается по разам. См. `TaskTemplate.target`. */
  target?: { count: number; unit: string }
  /** Строка закрывается только когда отметились оба. См. `TaskTemplate.together`. */
  together?: boolean
  /** Привычка, которую бросают: отметка значит «удержался». См. `TaskTemplate.quit`. */
  quit?: boolean
}

export interface NewGoalInput {
  /** Ключ цели. Ключи её привычек лежат в них самих: одна операция — все свои имена сразу. */
  id: string
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
  const goalId = input.id
  const today = getLogicalToday(now)
  // Новые привычки встают в конец списка дня, в том порядке, в каком человек их написал.
  const base = nextOrder(state.user.goals)
  const tasks: TaskTemplate[] = input.tasks.map((task, i) => ({
    id: task.id,
    goalId,
    title: task.title,
    weekdays: task.weekdays,
    partOfDay: task.partOfDay,
    icon: task.icon,
    private: task.private,
    quit: task.quit,
    target: task.target,
    together: task.together,
    order: base + i,
    predictedDays: task.predictedDays,
    cycleStartDate: today,
  }))

  const goal: Goal = {
    id: goalId,
    title: input.title,
    tasks,
    archived: false,
    // The minute, not just the day: the feed reads it to say «2 часа назад» under the habit that
    // was just made, which is the one event here the person authored at a moment we can honestly
    // name.
    createdAt: now.toISOString(),
  }

  // The goal's own flag marks this spot; its starting tasks are not stamped on top of it as
  // separate arrivals, or one decision would leave six marks on one circle.
  const days: Day[] = state.days.map((day) => {
    if (day.date !== today) return day

    const newDayTasks: DayTask[] = tasks.filter((task) => isTaskScheduledOn(task, today)).map((task) => ({
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
    id: input.id,
    goalId,
    title: input.title,
    weekdays: input.weekdays,
    partOfDay: input.partOfDay,
    icon: input.icon,
    private: input.private,
    quit: input.quit,
    target: input.target,
    together: input.together,
    order: nextOrder(state.user.goals),
    predictedDays: input.predictedDays,
    cycleStartDate: getLogicalToday(now),
  }

  const today = getLogicalToday(now)
  const changes: TaskChange[] = [{ taskId: task.id, goalId, title: task.title, kind: 'added', at: now.toISOString() }]
  // The mark goes on today either way — the day the set changed is the fact worth keeping — but
  // the task itself only joins today if today is one of its days.
  const days = stampChanges(state.days, today, changes, (day) => {
    if (!isTaskScheduledOn(task, today)) return day
    const newDayTask: DayTask = {
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
  // A goal is its tasks: emptying the list leaves a goal that asks nothing, and if it was the
  // last one the app decides the person has never started and offers onboarding — which
  // rebuilds the state and takes the history with it. Dropping a goal is archiveGoal.
  if (goal.tasks.length <= 1) return state

  const today = getLogicalToday(now)
  const changes: TaskChange[] = [{ taskId: task.id, goalId, title: task.title, kind: 'removed', at: now.toISOString() }]
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

/** What the editor can change about a task that already exists. */
export interface TaskEdit {
  title: string
  weekdays: number[]
  partOfDay?: PartOfDay
  icon?: string
  private?: boolean
  quit?: boolean
  target?: { count: number; unit: string }
  together?: boolean
}

/** Same set of weekdays, whatever order they were picked in — and «пусто» means the same as «все семь». */
function sameWeekdays(a: number[] | undefined, b: number[] | undefined): boolean {
  const norm = (w?: number[]) => (!w || w.length === 0 || w.length === 7 ? '0123456' : [...w].sort().join(''))
  return norm(a) === norm(b)
}

/**
 * Сегодняшняя строка, дотянувшаяся до новой цели счётчика. Возвращает тот же массив, когда двигать
 * нечего, — вызывающий по этому и узнаёт, что записывать нечего.
 *
 * Метки на дороге здесь нет нарочно. `TaskChange` объясняет **сдвинутую планку дня** — ту, из
 * которой день считается, — а число стаканов внутри одной строки её не двигает: строка как была
 * одной из трёх, так и осталась. То же правило, по которому молчат значок и время суток.
 */
function withPromotedTarget(
  days: Day[],
  today: string,
  taskId: string,
  target: TaskTemplate['target'],
  together: boolean,
): Day[] {
  if (!target || target.count < 1) return days
  let touched = false
  const next = days.map((day) => {
    if (day.date !== today) return day
    const tasks = day.tasks.map((t) => {
      if (t.taskTemplateId !== taskId || t.isDone || t.pending === true) return t
      if ((t.progress ?? 0) < target.count) return t
      touched = true
      // Часа у такой отметки нет, и выдумывать его нечем: строку закрыла не отметка, а правка
      // цели, а секунда правки — это не секунда, когда человек пил четвёртый стакан. `logicalHourOf`
      // отвечает на это `null`, и время суток такой день просто не считает.
      // Привычку, которую держат вдвоём, правка цели закрыть не может: закрывает её второй
      // человек, и обойти его собственной правкой значило бы дать себе ключ от общей двери.
      return together ? { ...t, pending: true } : { ...t, isDone: true }
    })
    return touched ? withRecomputedRate(day, tasks) : day
  })
  return touched ? next : days
}

/**
 * Edits a task that is already running: its name and its weekdays.
 *
 * Until this existed the only way to fix a typo or move a habit from «Пн Ср Пт» to «Вт Чт» was to
 * delete the task and make a new one, which restarts `cycleStartDate` and takes every rank with
 * it. That is a punishment for changing your mind, and changing your mind about *when* is how a
 * habit survives a new job.
 *
 * Two rules hold the record honest:
 *
 * - **the past is not rewritten.** Milestones read the per-day stamps in `day.tasks`, never the
 *   template's weekdays, so yesterday keeps being judged by what it actually asked. Only today and
 *   the days ahead follow the new schedule;
 * - **a new schedule leaves a mark on today** (`kind: 'rescheduled'`), like adding or dropping a
 *   task, because it moves what every following day is counted out of.
 */
export function editTaskInGoal(
  state: AppState,
  goalId: string,
  taskId: string,
  input: TaskEdit,
  now: Date = new Date(),
): AppState {
  const goal = state.user.goals.find((g) => g.id === goalId)
  const task = goal?.tasks.find((t) => t.id === taskId)
  if (!goal || !task) return state

  const title = input.title.trim()
  if (!title) return state

  const weekdays = input.weekdays
  const rescheduled = !sameWeekdays(task.weekdays, weekdays)

  // Время дня, значок и тишина меняются молча: ни одно из трёх не двигает планку, по которой
  // считается день, — а метка на дороге существует ровно для того, чтобы объяснить сдвинутую планку.
  const next: TaskTemplate = {
    ...task,
    title,
    weekdays,
    partOfDay: input.partOfDay,
    icon: input.icon,
    private: input.private,
    quit: input.quit,
    target: input.target,
    together: input.together,
  }

  const user: User = {
    ...state.user,
    goals: state.user.goals.map((g) =>
      g.id === goalId ? { ...g, tasks: g.tasks.map((t) => (t.id === taskId ? next : t)) } : g,
    ),
  }

  // Счёт, набранный сегодня, мог уже дойти до новой цели: человек, снявший планку с восьми
  // стаканов до трёх, выпив четыре, обязан увидеть закрытую строку, а не «4 из 3».
  //
  // Только вверх. Поднятая цель закрытую строку не открывает обратно — отметка это запись о том,
  // что случилось, а не правило, которое всё ещё в силе; то же самое правило держит ниже
  // переехавшее расписание. И только сегодня: вчера считали по вчерашней цели.
  const today = getLogicalToday(now)
  const retargeted = withPromotedTarget(state.days, today, taskId, next.target, next.together === true)

  if (!rescheduled) {
    if (retargeted === state.days) return { ...state, user }
    return { user, days: applyPathGeometry(retargeted) }
  }

  const changes: TaskChange[] = [{ taskId, goalId, title, kind: 'rescheduled', at: now.toISOString() }]
  const days = stampChanges(retargeted, today, changes, (day) => {
    const existing = day.tasks.find((t) => t.taskTemplateId === taskId)
    const scheduled = isTaskScheduledOn(next, today)

    // A mark already made is a record of something that happened, not a rule still in force: a
    // task done this morning stays done even if today just stopped being one of its days.
    if (existing?.isDone) return day
    if (scheduled && !existing) {
      const newDayTask: DayTask = {
        taskTemplateId: taskId,
        dayId: day.id,
        isDone: false,
        skipped: false,
        completedAt: null,
      }
      return withRecomputedRate(day, [...day.tasks, newDayTask])
    }
    if (!scheduled && existing) return withRecomputedRate(day, day.tasks.filter((t) => t.taskTemplateId !== taskId))
    return day
  })

  return { user, days: applyPathGeometry(days) }
}
