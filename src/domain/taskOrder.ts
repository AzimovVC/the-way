import type { AppState, DayTask, Goal, TaskTemplate } from './models'
import { type PartOfDay, partRank } from './partOfDay'

/**
 * Порядок привычек внутри дня — одна плоская шкала на все цели.
 *
 * Список, который человек переставляет, и список, который он видит в дне, — один и тот же, а он
 * не разбит по целям: в дне стоят просто привычки. Поэтому `order` сквозной, а не «внутри цели».
 *
 * Перестановка ничего не меняет в том, о чём день спрашивает, — значит она не оставляет метку на
 * дороге и не трогает `days`. Это единственная настройка привычки, у которой нет `TaskChange`:
 * метки существуют, чтобы отрезок пути был читаем, а порядок строк на прошлое не влияет никак.
 */

/** Все привычки всех целей в том порядке, в каком они стоят в дне. */
export function orderedTemplates(goals: Goal[]): TaskTemplate[] {
  return goals
    .flatMap((goal) => goal.tasks)
    // Натуральная позиция — запасной ключ для всего, что заведено до порядка: пока никто ничего
    // не двигал, список стоит так же, как стоял, а не схлопывается в произвольную кучу нулей.
    .map((task, natural) => ({ task, key: task.order ?? natural }))
    .sort((a, b) => partRank(a.task.partOfDay) - partRank(b.task.partOfDay) || a.key - b.key)
    .map((entry) => entry.task)
}

/** Следующий свободный номер — новая привычка встаёт в конец своего отрезка дня. */
export function nextOrder(goals: Goal[]): number {
  const used = goals.flatMap((goal) => goal.tasks).map((task) => task.order ?? -1)
  return Math.max(-1, ...used) + 1
}

/** Соседи по перестановке — только внутри своего отрезка дня: «выше вечера» не значит ничего. */
function neighbourhood(goals: Goal[], part: PartOfDay | undefined): TaskTemplate[] {
  return orderedTemplates(goals).filter((task) => partRank(task.partOfDay) === partRank(part))
}

/** Можно ли сдвинуть привычку — чтобы стрелка на экране гасла, а не молчала в ответ на тап. */
export function canMoveTask(goals: Goal[], taskId: string, delta: -1 | 1): boolean {
  const task = goals.flatMap((g) => g.tasks).find((t) => t.id === taskId)
  if (!task) return false
  const list = neighbourhood(goals, task.partOfDay)
  const at = list.findIndex((t) => t.id === taskId)
  return at !== -1 && at + delta >= 0 && at + delta < list.length
}

/**
 * Меняет привычку местами с соседом.
 *
 * Номера после этого проставляются **всем** привычкам подряд, а не только двум переставленным:
 * пока часть списка живёт на запасном ключе, а часть на настоящем, две шкалы стоят рядом и первая
 * же новая привычка встанет между ними не туда.
 */
export function moveTask(state: AppState, taskId: string, delta: -1 | 1): AppState {
  const goals = state.user.goals
  if (!canMoveTask(goals, taskId, delta)) return state

  const task = goals.flatMap((g) => g.tasks).find((t) => t.id === taskId)!
  const list = neighbourhood(goals, task.partOfDay)
  const at = list.findIndex((t) => t.id === taskId)
  const swapped = [...list]
  ;[swapped[at], swapped[at + delta]] = [swapped[at + delta], swapped[at]]

  const moved = new Set(list.map((t) => t.id))
  const flat = orderedTemplates(goals)
  // Обратно в общий список: позиции отрезка заняты теми же строками, только в новом порядке.
  let cursor = 0
  const resequenced = flat.map((t) => (moved.has(t.id) ? swapped[cursor++] : t))
  const orderById = new Map(resequenced.map((t, i) => [t.id, i]))

  return {
    ...state,
    user: {
      ...state.user,
      goals: goals.map((goal) => ({
        ...goal,
        tasks: goal.tasks.map((t) => ({ ...t, order: orderById.get(t.id) ?? t.order })),
      })),
    },
  }
}

export interface DayTaskGroup {
  part: PartOfDay | undefined
  tasks: DayTask[]
}

/**
 * Отметки дня, разложенные по отрезкам дня и упорядоченные внутри каждого.
 *
 * Отрезок без единой привычки не возвращается вовсе — пустой заголовок «Вечер» сообщал бы, что
 * вечером что-то было и не сделано, хотя вечером ничего не запланировано.
 */
export function groupDayTasks(dayTasks: DayTask[], templates: Map<string, TaskTemplate>): DayTaskGroup[] {
  const rankOf = (t: DayTask) => partRank(templates.get(t.taskTemplateId)?.partOfDay)
  const orderOf = (t: DayTask, i: number) => templates.get(t.taskTemplateId)?.order ?? i

  const sorted = dayTasks
    .map((task, i) => ({ task, rank: rankOf(task), key: orderOf(task, i) }))
    .sort((a, b) => a.rank - b.rank || a.key - b.key)

  const groups: DayTaskGroup[] = []
  for (const { task } of sorted) {
    const part = templates.get(task.taskTemplateId)?.partOfDay
    const last = groups[groups.length - 1]
    if (last && last.part === part) last.tasks.push(task)
    else groups.push({ part, tasks: [task] })
  }
  return groups
}
