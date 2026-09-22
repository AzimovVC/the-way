import type { Circle, CircleInvite, CircleMark, CirclesView } from './circles'
import type { Notice } from './notices'
import { toPerson } from './friendRow'

/**
 * То, что приезжает с сервера про кружки, и всё, что про это можно сказать, **не спрашивая его**.
 *
 * Отдельным файлом по той же причине, что `friendRow.ts` у друзей: это единственная часть работы с
 * сервером, у которой есть правильный ответ на берегу. Всё остальное в
 * [supabaseClient.ts](./supabaseClient.ts) — запрос, и проверяется он живым прогоном; здесь чистый
 * TypeScript и тест рядом.
 *
 * Разбор недоверчивый — не потому, что сервер врёт, а потому, что он **меняется отдельно от
 * приложения**: миграция уезжает раньше сборки, сборка живёт на телефоне неделями. Ответ, в
 * котором чего-то не хватает, обязан дать короткий список, а не уронить карточку дня.
 *
 * И отдельно — правило, которое этот файл обязан держать физически: **ни одно значение отсюда не
 * попадает в `AppState`**. Здесь нет и не может быть ни дня, ни геометрии, ни чужой дороги: с
 * сервера про пару приезжают только имена, расписание и отметки.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Дата дня, `YYYY-MM-DD`. Postgres отдаёт `date` строкой ровно в этом виде, и это тот же ключ, что
 * у дня на дороге, — но проверить его здесь всё равно надо: по нему ищут день в истории, и мусор
 * в этом месте означал бы отметку, повешенную в никуда.
 */
function day(value: unknown): string | null {
  const raw = text(value)
  return raw !== null && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

/**
 * Дни недели. Пусто и отсутствие — **одно и то же**: «каждый день», как и у обычной привычки
 * (`weekdays` в models.ts). Индекс от понедельника, как везде; чужие числа выбрасываются молча,
 * потому что расписание с восьмым днём недели — это не новость для человека, а испорченная строка.
 */
function weekdays(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const clean = value.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6)
  return clean.length === 0 ? undefined : clean
}

/** Значок. `null` с той стороны — «значка не выбирали», и это то же, что отсутствие поля. */
function icon(value: unknown): string | undefined {
  const raw = text(value)
  return raw !== null && raw !== '' ? raw : undefined
}

/**
 * Одна отметка. `null` — строка, которую нельзя показать: без дня её некуда поставить, без
 * человека непонятно, чья это галочка, а нарисованная наугад она стала бы чужой отметкой в твоём
 * дне — тем самым, чего в кружке не бывает.
 */
export function toCircleMark(value: unknown, circleId: string): CircleMark | null {
  if (!isObject(value)) return null
  const personId = text(value.person_id)
  const date = day(value.date)
  if (personId === null || date === null) return null

  // Момент отметки ничего не судит — ни `timeOfDay`, ни веха, ни цвет его не читают, — поэтому
  // его отсутствие не повод выбросить саму отметку: день важнее часа.
  return { circleId, personId, date, doneAt: text(value.done_at) ?? `${date}T00:00:00.000Z` }
}

/**
 * Один кружок.
 *
 * `null` — кружок, который нельзя показать. Без ключа привычки его нечем привязать к строке дня, а
 * без второго человека он не пара: строка «кружок с кем-то» на карточке дня хуже, чем её отсутствие.
 */
export function toCircle(value: unknown): Circle | null {
  if (!isObject(value)) return null
  const id = text(value.id)
  const title = text(value.title)
  const taskId = text(value.task_id)
  const startedOn = day(value.started_on)
  if (id === null || title === null || taskId === null || startedOn === null) return null

  const partnerRow = isObject(value.partner) ? value.partner : null
  const person = partnerRow === null ? null : toPerson(partnerRow.person)
  if (person === null) return null

  const excusedRaw = partnerRow !== null && Array.isArray(partnerRow.excused) ? partnerRow.excused : []
  const excused = excusedRaw.map(day).filter((d): d is string => d !== null)

  const marksRaw = Array.isArray(value.marks) ? value.marks : []
  const marks = marksRaw
    .map((mark) => toCircleMark(mark, id))
    .filter((mark): mark is CircleMark => mark !== null)

  const circle: Circle = {
    id,
    title,
    taskId,
    startedOn,
    // Пояс нужен одной строке на карточке и только при большой разнице (`zoneNote`). Его
    // отсутствие не повод выбросить кружок: строки просто не будет.
    timezone: text(value.timezone) ?? 'UTC',
    partner: { person, excused },
    marks,
  }

  const habitIcon = icon(value.icon)
  if (habitIcon !== undefined) circle.icon = habitIcon
  const days = weekdays(value.weekdays)
  if (days !== undefined) circle.weekdays = days
  const leftAt = text(value.left_at)
  if (leftAt !== null) circle.leftAt = leftAt

  return circle
}

/**
 * Приглашение. Без человека на той стороне его нельзя ни принять, ни отклонить осмысленно: обе
 * кнопки под безымянной строкой ведут в никуда.
 */
export function toCircleInvite(value: unknown): CircleInvite | null {
  if (!isObject(value)) return null
  const id = text(value.id)
  const title = text(value.title)
  const person = toPerson(value.person)
  if (id === null || title === null || person === null) return null

  const invite: CircleInvite = { id, person, title, timezone: text(value.timezone) ?? 'UTC' }

  const habitIcon = icon(value.icon)
  if (habitIcon !== undefined) invite.icon = habitIcon
  const days = weekdays(value.weekdays)
  if (days !== undefined) invite.weekdays = days
  // Только у отправленного: зовут своей привычкой, и до согласия она уже есть у тебя.
  const taskId = text(value.task_id)
  if (taskId !== null) invite.taskId = taskId

  return invite
}

/**
 * Вид целиком. Пропавший список — это пустой список, а не ошибка: человек без кружков и человек,
 * чей список не приехал, видят один и тот же экран, и второй по крайней мере не заперт.
 */
export function toCirclesView(value: unknown): CirclesView {
  const source = isObject(value) ? value : {}
  const list = <T>(raw: unknown, to: (item: unknown) => T | null): T[] =>
    Array.isArray(raw) ? raw.map(to).filter((item): item is T => item !== null) : []

  return {
    circles: list(source.circles, toCircle),
    incoming: list(source.incoming, toCircleInvite),
    outgoing: list(source.outgoing, toCircleInvite),
  }
}

/**
 * Одно сообщение.
 *
 * Род **проверяется**, и незнакомый выбрасывается: сервер меняется отдельно от сборки, и сообщение
 * рода, которого эта сборка не знает, нарисовать нечем. Пустая карточка «что-то случилось» хуже
 * молчания — она обещает новость и не приносит её.
 */
export function toNotice(value: unknown): Notice | null {
  if (!isObject(value)) return null
  const id = text(value.id)
  if (id === null || value.kind !== 'circle_left') return null

  const payload = isObject(value.payload) ? value.payload : {}
  const circleId = text(payload.circle_id)
  const title = text(payload.title)
  if (circleId === null || title === null) return null

  return {
    id,
    kind: 'circle_left',
    circleId,
    title,
    // Имени может не быть: человек вправе оставить его пустым, и прощание тогда идёт без имени.
    partnerName: text(payload.partner_name) ?? '',
    createdAt: text(value.created_at) ?? '',
  }
}

export function toNotices(value: unknown): Notice[] {
  if (!Array.isArray(value)) return []
  return value.map(toNotice).filter((notice): notice is Notice => notice !== null)
}
