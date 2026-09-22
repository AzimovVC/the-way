import { GREEN_THRESHOLD } from './config'
import { autoApplyFreezesToGaps, replenishFreezesIfNeeded } from './freezes'
import type { AppState, Day, DayTask, TaskTemplate } from './models'
import { addDaysISO, applyPathGeometry, getLogicalToday, reconcileMissedDays } from './pathEngine'
import { isTaskScheduledOn, templatesAskedOn } from './schedule'

function activeTaskTemplates(state: AppState): TaskTemplate[] {
  return state.user.goals.filter((g) => !g.archived).flatMap((g) => g.tasks)
}

/**
 * The day asks only for what is scheduled on it. A task the user set to Mon/Wed/Fri does not
 * appear on Tuesday at all — not greyed out, not pre-skipped: the day simply never owed it.
 *
 * First `doneCount` templates (in order) are marked done — good enough for a fixed completion
 * rate; order doesn't carry meaning.
 */
function buildDayTasks(templates: TaskTemplate[], dayId: string, doneCount: number, completedAt: string | null): DayTask[] {
  return templatesAskedOn(templates, dayId).map((task, i) => ({
    taskTemplateId: task.id,
    dayId,
    isDone: i < doneCount,
    skipped: false,
    completedAt: i < doneCount ? completedAt : null,
  }))
}

/**
 * Creates today's real Day (with a DayTask per active goal task) if it doesn't
 * exist yet. The gap-reconciliation effect only backfills empty gray days for
 * dates the app was never opened on — this is what turns "today" into an
 * actually actionable day once a new calendar day starts, the same way
 * onboarding builds day one.
 */
export function ensureTodayDay(state: AppState, now: Date = new Date()): AppState {
  const today = getLogicalToday(now)
  if (state.days.some((d) => d.date === today)) return state

  const templates = activeTaskTemplates(state)
  const tasks = buildDayTasks(templates, today, 0, null)
  const newDay: Day = {
    id: today,
    date: today,
    tasks,
    completionRate: 0,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: tasks.length === 0 ? 'rest' : 'red',
    frozen: false,
    rest: tasks.length === 0,
    newGoalIds: [],
    taskChanges: [],
  }

  return { ...state, days: [...state.days, newDay] }
}

/**
 * Everything that has to happen to a state before it is shown: freezes replenished, the days the
 * app was closed through filled in, today's day created, geometry recomputed. Returns the same
 * state it was given when nothing was owed, so the caller can tell a start that changed the save
 * from one that did not.
 *
 * A restored backup goes through here too, and for the same reason: it was written on some past
 * day, and the road has to be current before anything draws it.
 */
export function rollForwardToToday(loaded: AppState, now: Date = new Date()): AppState {
  let next = replenishFreezesIfNeeded(loaded, now)
  if (next.days.length === 0) return next

  const lastDate = next.days.reduce((max, d) => (d.date > max ? d.date : max), next.days[0].date)
  const today = getLogicalToday(now)
  if (lastDate < today) {
    const knownIds = new Set(next.days.map((d) => d.id))
    const reconciled = reconcileMissedDays(lastDate, today, next.days, activeTaskTemplates(next))
    const gapDayIds = new Set(reconciled.filter((d) => !knownIds.has(d.id)).map((d) => d.id))
    next = autoApplyFreezesToGaps({ ...next, days: reconciled }, gapDayIds)
  }

  const withToday = ensureTodayDay(next, now)
  if (withToday !== next || lastDate < today) {
    next = { ...withToday, days: applyPathGeometry(withToday.days) }
  }
  return next
}

function localHhMm(at: Date): string {
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/**
 * Ставит или снимает отметку и пересчитывает день под ней.
 *
 * Чистая часть того, что делает тап по строке: сама отметка, доля выполненного и геометрия. Всё,
 * что за ней следует, — уровень, возвращение, итог дня — решается уже по новому состоянию и живёт
 * в провайдере, потому что это про экраны, а не про запись.
 *
 * Час записывается дважды: ISO — чтобы знать порядок с секундами, и `HH:mm` — те часы, которые
 * человек видел на своих. Зону, которой не записали, потом не восстановить.
 */
export function toggleDayTaskMark(
  state: AppState,
  dayId: string,
  taskTemplateId: string,
  now: Date = new Date(),
): AppState {
  const day = state.days.find((d) => d.id === dayId)
  if (!day || !day.tasks.some((t) => t.taskTemplateId === taskTemplateId)) return state

  const days = state.days.map((d) => {
    if (d.id !== dayId) return d
    const tasks = d.tasks.map((t) => {
      if (t.taskTemplateId !== taskTemplateId) return t
      const willBeDone = !t.isDone
      return {
        ...t,
        isDone: willBeDone,
        completedAt: willBeDone ? now.toISOString() : null,
        completedLocal: willBeDone ? localHhMm(now) : undefined,
      }
    })
    const countable = tasks.filter((t) => !t.skipped)
    const completionRate = countable.length === 0 ? 0 : countable.filter((t) => t.isDone).length / countable.length
    return { ...d, tasks, completionRate }
  })

  return { ...state, days: applyPathGeometry(days) }
}

/**
 * Шаг счётчика: «ещё один стакан» или «нет, промахнулся».
 *
 * Отметка при этом остаётся той же самой двоичной отметкой — она просто ставится не пальцем, а
 * набранным числом. `isDone` включается ровно на цели и выключается, как только счёт от неё ушёл;
 * ничего третьего между ними нет, и `completionRate` считает эту строку так же, как любую другую.
 *
 * Счёт зажат в 0..цель. Верх — потому что «10 из 8» не значит ничего, чего не значит «8 из 8»:
 * день закрыт, и перевыполнения в этом приложении не бывает — оно немедленно стало бы вторым
 * условием. Низ — потому что отрицательного количества стаканов не бывает.
 *
 * У привычки без счётчика шага нет: строку такой привычки ставят тапом, и второй способ поставить
 * ту же отметку — это две записи об одном событии.
 */
export function stepDayTaskProgress(
  state: AppState,
  dayId: string,
  taskTemplateId: string,
  delta: number,
  now: Date = new Date(),
): AppState {
  const template = activeTaskTemplates(state).find((t) => t.id === taskTemplateId)
  const target = template?.target
  if (!target || target.count < 1) return state

  const day = state.days.find((d) => d.id === dayId)
  if (!day || !day.tasks.some((t) => t.taskTemplateId === taskTemplateId)) return state

  const days = state.days.map((d) => {
    if (d.id !== dayId) return d
    const tasks = d.tasks.map((t) => {
      if (t.taskTemplateId !== taskTemplateId) return t
      const progress = Math.max(0, Math.min(target.count, (t.progress ?? 0) + delta))
      const isDone = progress >= target.count
      // Час записывается один раз — в тот шаг, который закрыл строку. Переписывать его на каждом
      // стакане значило бы сказать, что привычка случилась в последнюю секунду дня, а `timeOfDay`
      // читает эти часы как время, когда человек делал дело.
      if (isDone === t.isDone) return { ...t, progress }
      return {
        ...t,
        progress,
        isDone,
        completedAt: isDone ? now.toISOString() : null,
        completedLocal: isDone ? localHhMm(now) : undefined,
      }
    })
    const countable = tasks.filter((t) => !t.skipped)
    const completionRate = countable.length === 0 ? 0 : countable.filter((t) => t.isDone).length / countable.length
    return { ...d, tasks, completionRate }
  })

  return { ...state, days: applyPathGeometry(days) }
}

/**
 * Dev-only: appends `count` fresh days after the last known date, each at the
 * completion rate `completionRateFor(dayIndex)` returns (0..1), so the path's
 * bend over a longer horizon can be previewed without waiting in real time.
 */
export function simulateFutureDays(
  state: AppState,
  count: number,
  completionRateFor: (dayIndex: number) => number,
): AppState {
  const templates = activeTaskTemplates(state)
  let lastDate = state.days.reduce(
    (max, d) => (d.date > max ? d.date : max),
    state.days[0]?.date ?? getLogicalToday(new Date()),
  )
  const newDays: Day[] = []

  for (let i = 0; i < count; i++) {
    lastDate = addDaysISO(lastDate, 1)
    const rate = Math.max(0, Math.min(1, completionRateFor(i)))
    const scheduled = templates.filter((task) => isTaskScheduledOn(task, lastDate))
    const doneCount = Math.round(rate * scheduled.length)
    const completionRate = scheduled.length === 0 ? 0 : doneCount / scheduled.length
    const rest = scheduled.length === 0
    newDays.push({
      id: lastDate,
      date: lastDate,
      tasks: buildDayTasks(templates, lastDate, doneCount, `${lastDate}T12:00:00.000Z`),
      completionRate,
      pathAngleDelta: 0,
      columnDriftX: 0,
      colorTier: rest
        ? 'rest'
        : completionRate >= 1
          ? 'gold'
          : completionRate >= GREEN_THRESHOLD
            ? 'green'
            : 'red',
      frozen: false,
      rest,
      newGoalIds: [],
      taskChanges: [],
    })
  }

  return { ...state, days: applyPathGeometry([...state.days, ...newDays]) }
}

/**
 * Dev-only: drops the most recent `count` days (never below zero left) so a
 * simulated run can be undone without a full reset, and re-derives path
 * geometry for what remains.
 */
export function removeLastDays(state: AppState, count: number): AppState {
  const sorted = [...state.days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const kept = sorted.slice(0, Math.max(0, sorted.length - count))
  return { ...state, days: applyPathGeometry(kept) }
}
