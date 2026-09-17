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

/**
 * Номер для новой привычки — она встаёт в конец списка.
 *
 * Считается по **количеству** привычек, а не по максимуму проставленных номеров. Пока номеров
 * нет вовсе (всё, что заведено до порядка), максимум равен −1, и новая привычка получала 0 —
 * тот же ключ, что и у первой строки по натуральной позиции. Две строки на одном месте, и какая
 * из них выше, решал порядок в массиве.
 */
export function nextOrder(goals: Goal[]): number {
  return goals.reduce((total, goal) => total + goal.tasks.length, 0)
}

/**
 * Ставит перечисленные привычки в заданном порядке на те места общего списка, которые они и
 * занимали. Всё остальное остаётся там же.
 *
 * Принимается **список id, а не «эту на N-е место»**, и это не вкусовщина. Строк в дне меньше,
 * чем привычек: у сегодняшнего дня нет тех, кого сегодня не спрашивают. Поэтому вторая строка в
 * карточке дня — далеко не всегда вторая привычка, и номер, посчитанный по экрану, попадал бы не
 * туда, а чаще всего никуда: «уже на этом месте».
 *
 * Отсюда же следует и то, что вытащить привычку из её отрезка дня этим нельзя: карточка дня
 * передаёт одну группу, а группа — это один `partOfDay`, значит и занятые места лежат внутри
 * одного отрезка. Время суток меняется в редакторе, где написано, что оно значит.
 *
 * Номера проставляются **всем** привычкам подряд, а не только переставленным: пока часть списка
 * живёт на запасном ключе, а часть на настоящем, две шкалы стоят рядом и первая же новая
 * привычка встанет между ними не туда.
 */
export function reorderTasks(state: AppState, orderedIds: string[]): AppState {
  const goals = state.user.goals
  const flat = orderedTemplates(goals)
  const byId = new Map(flat.map((t) => [t.id, t]))

  const moving = orderedIds.filter((id) => byId.has(id))
  if (moving.length < 2) return state

  const claimed = new Set(moving)
  let cursor = 0
  const resequenced = flat.map((t) => (claimed.has(t.id) ? byId.get(moving[cursor++])! : t))
  if (resequenced.every((t, i) => t.id === flat[i].id)) return state

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
