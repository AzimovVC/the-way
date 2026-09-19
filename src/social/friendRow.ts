/**
 * То, что приезжает с сервера, и всё, что про это можно сказать, **не спрашивая его**: как строки
 * ложатся в `Person`, `FriendsView` и `Acquaintance`.
 *
 * Отдельным файлом по той же причине, что и `profileRow.ts` у профиля: это единственная часть
 * работы с сервером, у которой есть правильный ответ на берегу. Всё остальное в
 * [supabaseClient.ts](./supabaseClient.ts) — запрос, и проверяется он живым прогоном; здесь чистый
 * TypeScript и тест рядом.
 *
 * Разбор недоверчивый — не потому, что сервер врёт, а потому, что он **меняется отдельно от
 * приложения**: миграция уезжает раньше сборки, сборка живёт на телефоне неделями. Ответ, в
 * котором чего-то не хватает, обязан дать короткий список, а не уронить экран друзей целиком.
 */

import type { Acquaintance, FriendsView } from './client'
import type { FriendState, Person } from './types'

/**
 * Человек, как его отдаёт сервер. Имена колонок — как в таблице: раскладывает их этот файл, и
 * второй словарь имён на той стороне означал бы, что `select` нельзя прочитать, не заглянув сюда.
 *
 * Числа необязательные, и это не оборона: в списке общих друзей их нет вовсе — строка там отвечает
 * на «кто это», а не «докуда он дошёл».
 */
export interface PersonRow {
  id: string
  handle: string
  name: string
  days_on_road?: number | null
  current_streak?: number | null
  habit_count?: number | null
}

const STATES: readonly FriendState[] = ['none', 'outgoing', 'incoming', 'friends', 'blocked']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Число или его отсутствие. `null` с той стороны — это «не спрашивали», то есть то же самое. */
function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Строка в человека. `null` — строка, которую нельзя показать: без `id` её не с кем связать, без
 * ника по ней не откроешь профиль, и нарисованная она была бы кнопкой в никуда.
 */
export function toPerson(value: unknown): Person | null {
  if (!isObject(value)) return null
  const id = text(value.id)
  const handle = text(value.handle)
  if (id === null || handle === null) return null

  const person: Person = { id, handle, name: text(value.name) ?? '' }

  // Поля кладутся, только когда они есть: `daysOnRoad: undefined` и отсутствие поля экран читает
  // одинаково, а вот `0` — это уже утверждение «нисколько», и выдумывать его здесь нельзя.
  const daysOnRoad = count(value.days_on_road)
  if (daysOnRoad !== undefined) person.daysOnRoad = daysOnRoad
  const currentStreak = count(value.current_streak)
  if (currentStreak !== undefined) person.currentStreak = currentStreak
  const habitCount = count(value.habit_count)
  if (habitCount !== undefined) person.habitCount = habitCount

  return person
}

function toPeople(value: unknown): Person[] {
  if (!Array.isArray(value)) return []
  return value.map(toPerson).filter((p): p is Person => p !== null)
}

/**
 * Вид целиком. Пропавший список — это пустой список, а не ошибка: человек без друзей и человек,
 * чей список не приехал, видят один и тот же экран, и второй из них по крайней мере не заперт.
 */
export function toFriendsView(value: unknown): FriendsView {
  const source = isObject(value) ? value : {}
  return {
    friends: toPeople(source.friends),
    incoming: toPeople(source.incoming),
    outgoing: toPeople(source.outgoing),
    blocked: toPeople(source.blocked),
  }
}

function toState(value: unknown): FriendState {
  const found = STATES.find((state) => state === value)
  // Незнакомое слово — это `none`: связь, в которой мы не уверены, не имеет права нарисовать
  // кнопку «Принять». Худшее, что случится, — человек увидит «Позвать» там, где уже позвал.
  return found ?? 'none'
}

/** Человек вместе с тем, кем он тебе приходится. `null` — та же нечитаемая строка, что и выше. */
export function toAcquaintance(value: unknown): Acquaintance | null {
  if (!isObject(value)) return null
  const person = toPerson(value.person)
  if (person === null) return null

  const seen: Acquaintance = { person, state: toState(value.state) }
  // Общие друзья необязательны, и пустой список от их отсутствия здесь **отличается**: пусто —
  // это «посчитали, никого», а отсутствие — «не спрашивали». Экран рисует строку про общих
  // друзей только по непустому списку, так что разница ему не видна, но врать ею незачем.
  if (Array.isArray(value.mutual)) seen.mutual = toPeople(value.mutual)
  return seen
}

export function toAcquaintances(value: unknown): Acquaintance[] {
  if (!Array.isArray(value)) return []
  return value.map(toAcquaintance).filter((a): a is Acquaintance => a !== null)
}
