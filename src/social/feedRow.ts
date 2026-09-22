import type { FeedCalendarMark } from '../domain/feed'
import type { RankId } from '../domain/ranks'
import type { FeedHeart, FriendEvent, SocialFeed } from './feed'
import { toPerson } from './friendRow'

/**
 * Что приезжает с сервера про ленту, и всё, что про это можно сказать, **не спрашивая его**.
 *
 * Отдельным файлом по той же причине, что `friendRow.ts` и `circleRow.ts`: это единственная часть
 * работы с сервером, у которой есть правильный ответ на берегу — чистый TypeScript и тест рядом.
 *
 * Разбор недоверчивый, и не потому, что сервер врёт: миграция уезжает раньше сборки, а сборка живёт
 * на телефоне неделями. Строка, которую нельзя показать, выбрасывается молча — лента короче на одну
 * новость честнее, чем пустой экран.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function day(value: unknown): string | null {
  const raw = text(value)
  return raw !== null && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

/**
 * Ступени и метки перечислены **здесь списком**, а не приезжают как есть.
 *
 * Строка из ответа попадает прямо в `RankBadge` и в таблицу названий, и незнакомое слово нарисовало
 * бы медаль без цвета и подпись «undefined». Список короткий, и это его достоинство: новая ступень
 * появится сначала в приложении, а потом уже в чужой ленте.
 */
const RANKS: readonly RankId[] = ['novice', 'apprentice', 'practitioner', 'master', 'legend']
const MARKS: readonly FeedCalendarMark[] = ['start', 'month', 'halfYear', 'year']

function rank(value: unknown): RankId | undefined {
  const raw = text(value)
  return raw !== null && (RANKS as readonly string[]).includes(raw) ? (raw as RankId) : undefined
}

function mark(value: unknown): FeedCalendarMark | undefined {
  const raw = text(value)
  return raw !== null && (MARKS as readonly string[]).includes(raw) ? (raw as FeedCalendarMark) : undefined
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * Одно событие.
 *
 * `null` — строка, которую нельзя показать. Условия разные у разных родов, и это не придирчивость:
 * ступень без слова ступени — медаль без цвета, новая привычка без названия — новость ни о чём, а
 * метка дороги без самой метки не отличима от остальных таких же.
 */
export function toFriendEvent(value: unknown): FriendEvent | null {
  if (!isObject(value)) return null

  const id = text(value.id)
  const date = day(value.happened_on)
  const person = toPerson(value.person)
  const kind = text(value.kind)
  if (id === null || date === null || person === null) return null
  if (kind !== 'rank' && kind !== 'goal' && kind !== 'calendar') return null

  const event: FriendEvent = { id, person, date, kind }

  // Момент необязателен и проверяется на разбираемость, а не на форму: строка, которую `Date` не
  // понял, — это строка без момента, и возраст в днях у неё верен по-прежнему.
  const moment = text(value.happened_at)
  if (moment !== null && Number.isFinite(Date.parse(moment))) event.at = moment

  const title = text(value.title)
  if (title !== null && title !== '') event.title = title

  if (kind === 'rank') {
    const step = rank(value.rank)
    const days = count(value.days)
    if (step === undefined || days === undefined || event.title === undefined) return null
    event.rank = step
    event.days = days
  }

  if (kind === 'goal' && event.title === undefined) return null

  if (kind === 'calendar') {
    const which = mark(value.mark)
    if (which === undefined) return null
    event.mark = which
  }

  return event
}

/** Одно сердце. Без любой из трёх частей его некуда поставить и нечьим лицом нарисовать. */
export function toHeart(value: unknown): FeedHeart | null {
  if (!isObject(value)) return null
  const ownerId = text(value.owner_id)
  const eventId = text(value.event_id)
  const personId = text(value.person_id)
  if (ownerId === null || eventId === null || personId === null) return null
  return { ownerId, eventId, personId }
}

/** Лента целиком. Не разобранный ответ — пустая лента, а не упавший экран. */
export function toSocialFeed(value: unknown): SocialFeed {
  if (!isObject(value)) return { events: [], hearts: [] }

  const events = Array.isArray(value.events)
    ? value.events.map(toFriendEvent).filter((event): event is FriendEvent => event !== null)
    : []
  const hearts = Array.isArray(value.hearts)
    ? value.hearts.map(toHeart).filter((heart): heart is FeedHeart => heart !== null)
    : []

  return { events, hearts }
}
