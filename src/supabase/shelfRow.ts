/**
 * Строка таблицы `habit_shelf` и всё, что про полку можно сказать, **не спрашивая сервер**: что с
 * неё уезжает и как это ложится в колонки.
 *
 * Отдельным файлом по той же причине, что `profileRow.ts` у профиля: это единственная часть
 * работы с полкой, у которой есть правильный ответ на берегу. Всё остальное в `shelf.ts` — запрос,
 * и проверяется он живым прогоном.
 */

import type { ShowcaseHabit } from '../domain/showcase'

/** Одна привычка, как она уезжает наружу. Ровно то, что стоит на витрине, и ничего сверх. */
export interface ShelfHabit {
  /** Ключ привычки на этом устройстве — им сервер различает строки одной полки, и только им. */
  habitId: string
  title: string
  icon?: string
  days: number
}

export interface ShelfRow {
  user_id: string
  habit_id: string
  title: string
  icon: string | null
  days: number
}

/**
 * Витрина — в полку.
 *
 * Уезжают **только живые** привычки, и это не обрезание ради краткости. Завершённая привычка
 * остаётся на своей витрине нарочно — иначе честный конец стоил бы дороже брошенного, — но её карточка
 * собрана из отметки в прожитом дне: дней у неё нет (`daysWalked === null`), значка нет, шаблона
 * уже нет. Чужому она приехала бы строкой без единственного числа, ради которого полку и смотрят.
 * И ровно столько же привычек считает `habit_count` в профиле: два числа про одно на одном экране
 * обязаны сходиться.
 *
 * Названия не чистятся и не режутся: это то, что человек написал себе сам. Длину держит `check` на
 * колонке — правило живёт там, где его нельзя обойти в обход экрана.
 */
export function toShelf(showcase: ShowcaseHabit[]): ShelfHabit[] {
  const shelf: ShelfHabit[] = []
  for (const habit of showcase) {
    // Тихая привычка не уезжает никуда — ни строкой, ни числом. Отбор здесь, а не в запросе:
    // выгруженная и спрятанная политикой строка — это утечка, до которой один тап в инструментах.
    if (habit.private === true) continue
    if (habit.status !== 'active' || habit.daysWalked === null) continue
    const row: ShelfHabit = { habitId: habit.taskId, title: habit.title, days: habit.daysWalked }
    if (habit.icon !== undefined) row.icon = habit.icon
    shelf.push(row)
  }
  return shelf
}

export function toShelfRows(userId: string, shelf: ShelfHabit[]): ShelfRow[] {
  return shelf.map((habit) => ({
    user_id: userId,
    habit_id: habit.habitId,
    title: habit.title,
    // `null`, а не пропущенное поле: строка едет в `upsert`, и пропущенная колонка оставила бы
    // на сервере прежний значок у привычки, с которой его только что сняли.
    icon: habit.icon ?? null,
    days: habit.days,
  }))
}
