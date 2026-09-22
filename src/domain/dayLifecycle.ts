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
 * Доля выполненного у дня, пересчитанная по его же строкам.
 *
 * Одна на все способы закрыть строку — тап, счётчик, приехавшая вторая половина, — потому что
 * считает она одно и то же: `isDone`. Ожидание второго здесь не участвует вовсе, и это главное,
 * что о нём нужно знать: строка с `pending` для дня не выполнена, как и любая неотмеченная.
 */
function withCompletionRate(day: Day, tasks: DayTask[]): Day {
  const countable = tasks.filter((t) => !t.skipped)
  const completionRate = countable.length === 0 ? 0 : countable.filter((t) => t.isDone).length / countable.length
  return { ...day, tasks, completionRate }
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

  const waits = activeTaskTemplates(state).find((t) => t.id === taskTemplateId)?.together === true

  const days = state.days.map((d) => {
    if (d.id !== dayId) return d
    const tasks = d.tasks.map((t) => {
      if (t.taskTemplateId !== taskTemplateId) return t
      // Снимают отметку одним движением, какой бы она ни была: и «сделано», и «жду второго» —
      // это одна и та же поставленная галочка, и второго тапа, чтобы отменить каждую, не бывает.
      const marking = !t.isDone && t.pending !== true
      if (!marking) {
        return { ...t, isDone: false, pending: undefined, completedAt: null, completedLocal: undefined }
      }
      return {
        ...t,
        isDone: !waits,
        pending: waits ? true : undefined,
        completedAt: now.toISOString(),
        completedLocal: localHhMm(now),
      }
    })
    return withCompletionRate(d, tasks)
  })

  return { ...state, days: applyPathGeometry(days) }
}

/**
 * Вторая половина приехала: строка, ждавшая её, закрывается.
 *
 * Отдельное действие, а не чтение чужих отметок изнутри правила, — иначе в `AppState` попало бы
 * что-то из `src/social/`. Сюда приезжает **вывод**, сделанный снаружи: «в этот день её ответ
 * есть». Что именно она нажала, дорога по-прежнему не знает.
 *
 * Закрывается только **живой** день. Её галочка приходит когда придёт — в 23:40 или назавтра в
 * самолёте, — и достроить ею вчерашний день значило бы переписать закрытый счёт задним числом:
 * ровно то, от чего кружок закрыт с самого начала. Ставка на день впереди, а не счёт к прожитому.
 *
 * Час при этом остаётся **твой**: он записан в тот момент, когда ты нажал, и переписывать его
 * чужой секундой нельзя — `timeOfDay` читает эти часы как время, когда дело делал ты.
 */
export function settleTogetherMark(state: AppState, dayId: string, taskTemplateId: string, now: Date = new Date()): AppState {
  if (dayId !== getLogicalToday(now)) return state

  const day = state.days.find((d) => d.id === dayId)
  const row = day?.tasks.find((t) => t.taskTemplateId === taskTemplateId)
  if (!day || !row || row.pending !== true) return state

  const days = state.days.map((d) => {
    if (d.id !== dayId) return d
    const tasks = d.tasks.map((t) =>
      t.taskTemplateId === taskTemplateId ? { ...t, isDone: true, pending: undefined } : t,
    )
    return withCompletionRate(d, tasks)
  })

  return { ...state, days: applyPathGeometry(days) }
}

/**
 * Пара кончилась — привычка перестаёт кого-то ждать.
 *
 * Своим действием, а не правкой привычки: правка — это то, что человек сделал с привычкой, а
 * здесь с ней случилось то, что случилось с парой. Метки на дороге оно поэтому не оставляет —
 * планка дня не двинулась, спрашивает день ровно то же самое.
 *
 * Отметка, застрявшая в ожидании, засчитывается: она твоя, ты её поставил, и отнять её за то, что
 * второй ушёл, значило бы наказать оставшегося чужим решением. Выход не отбирает дни.
 */
export function stopWaitingTogether(state: AppState, taskTemplateId: string, now: Date = new Date()): AppState {
  const waiting = state.user.goals.some((goal) => goal.tasks.some((t) => t.id === taskTemplateId && t.together === true))
  if (!waiting) return state

  const goals = state.user.goals.map((goal) => ({
    ...goal,
    tasks: goal.tasks.map((t) => (t.id === taskTemplateId ? { ...t, together: undefined } : t)),
  }))

  const today = getLogicalToday(now)
  const days = state.days.map((d) => {
    if (d.date !== today) return d
    const row = d.tasks.find((t) => t.taskTemplateId === taskTemplateId)
    if (row?.pending !== true) return d
    const tasks = d.tasks.map((t) =>
      t.taskTemplateId === taskTemplateId ? { ...t, isDone: true, pending: undefined } : t,
    )
    return withCompletionRate(d, tasks)
  })

  return { ...state, user: { ...state.user, goals }, days: applyPathGeometry(days) }
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
  const waits = template?.together === true

  const day = state.days.find((d) => d.id === dayId)
  if (!day || !day.tasks.some((t) => t.taskTemplateId === taskTemplateId)) return state

  const days = state.days.map((d) => {
    if (d.id !== dayId) return d
    const tasks = d.tasks.map((t) => {
      if (t.taskTemplateId !== taskTemplateId) return t
      const progress = Math.max(0, Math.min(target.count, (t.progress ?? 0) + delta))
      const filled = progress >= target.count
      // Набранное число закрывает строку **ровно так же**, как тап: если привычку держат вдвоём,
      // восьмой стакан ставит то же самое ожидание, что и палец. Иначе счётчик оказался бы вторым
      // способом закрыть день в обход второго человека.
      const isDone = filled && !waits
      const pending = filled && waits ? true : undefined
      // Час записывается один раз — в тот шаг, который закрыл строку. Переписывать его на каждом
      // стакане значило бы сказать, что привычка случилась в последнюю секунду дня, а `timeOfDay`
      // читает эти часы как время, когда человек делал дело.
      if (isDone === t.isDone && pending === t.pending) return { ...t, progress }
      return {
        ...t,
        progress,
        isDone,
        pending,
        completedAt: filled ? now.toISOString() : null,
        completedLocal: filled ? localHhMm(now) : undefined,
      }
    })
    return withCompletionRate(d, tasks)
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
