import { supabase } from './client'
import { toShelfRows, type ShelfHabit } from './shelfRow'

export { toShelf } from './shelfRow'
export type { ShelfHabit } from './shelfRow'

/**
 * Выгрузить свою полку.
 *
 * Два запроса, и оба обязательны: `upsert` кладёт то, что есть сейчас, а `delete` убирает то, чего
 * на полке больше нет. Без второго удалённая привычка жила бы на чужих экранах вечно — у себя её
 * нет, а спросить сервер, что у него лежит, никто не приходит.
 *
 * Полка уезжает **всегда**, независимо от `habitsPublic`. Кому её показать, решает политика на
 * сервере (`0006_habit_shelf.sql`), и это не перестраховка: правило здесь звучит «друзьям, а
 * остальным по настройке», и клиент, придержавший выгрузку по флажку, спрятал бы полку заодно и от
 * друзей — то есть сделал бы не то, о чём его просили.
 *
 * Отдельного «ничего не изменилось» здесь нет, в отличие от дороги: там речь о полумегабайте, а
 * тут о горстке строк на том же таймере, что и числа профиля. Отпечаток был бы вторым ответом на
 * вопрос, на который уже отвечает таймер.
 */
export async function saveShelf(userId: string, shelf: ShelfHabit[]): Promise<void> {
  if (!supabase) return

  if (shelf.length > 0) {
    // Цель конфликта названа вслух, хотя ключ таблицы и так этот: умолчание разрешается на той
    // стороне, и день, когда оно разрешится иначе, выглядит как «duplicate key» у живых людей.
    const { error } = await supabase
      .from('habit_shelf')
      .upsert(toShelfRows(userId, shelf), { onConflict: 'user_id,habit_id' })
    if (error) throw error
  }

  const keep = shelf.map((habit) => habit.habitId)
  // Пустая полка — это «убрать всё», и отдельная ветка нужна ей потому, что `not in ()` не значит
  // ничего: список условий, из которого убрали последнее условие, перестаёт быть условием.
  const query = supabase.from('habit_shelf').delete().eq('user_id', userId)
  const { error } = await (keep.length === 0 ? query : query.not('habit_id', 'in', asList(keep)))
  if (error) throw error
}

/**
 * Список для `not in`. Собирается руками, потому что `in` у PostgREST — часть строки запроса, а не
 * параметр: ключ привычки чеканим мы сами (`newId`), но полагаться на это здесь нельзя — запятая
 * или скобка, приехавшая из восстановленной копии, разобрала бы условие на два.
 */
function asList(values: string[]): string {
  return `(${values.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')})`
}
