import { describe, expect, it } from 'vitest'
import { toFriendEvent, toHeart, toSocialFeed } from './feedRow'

/**
 * Разбор ответа сервера про ленту.
 *
 * Проверяется не раскладка колонок — она видна глазами, — а то, что происходит со строкой, которую
 * **нельзя показать**. Миграция уезжает раньше сборки, сборка живёт на телефоне неделями, и ответ
 * из будущего обязан дать ленту короче на одну новость, а не пустой экран.
 */

const LENA = { id: 'u1', handle: 'lena', name: 'Лена' }

const RANK = {
  id: '2026-09-20:rank:task-1:apprentice',
  person: LENA,
  happened_on: '2026-09-20',
  kind: 'rank',
  title: 'Пробежка',
  rank: 'apprentice',
  days: 21,
  mark: null,
}

describe('toFriendEvent', () => {
  it('разбирает ступень целиком', () => {
    expect(toFriendEvent(RANK)).toEqual({
      id: RANK.id,
      person: LENA,
      date: '2026-09-20',
      kind: 'rank',
      title: 'Пробежка',
      rank: 'apprentice',
      days: 21,
    })
  })

  it('выбрасывает ступень, которой нет на лестнице', () => {
    // Слово из будущего — это медаль без цвета и подпись «undefined». Лестница живёт в ranks.ts,
    // и новая ступень обязана появиться сначала в приложении, а потом уже в чужой ленте.
    expect(toFriendEvent({ ...RANK, rank: 'grandmaster' })).toBeNull()
  })

  it('выбрасывает ступень без названия привычки', () => {
    expect(toFriendEvent({ ...RANK, title: null })).toBeNull()
  })

  it('выбрасывает событие без человека: нечьим лицом его не нарисовать', () => {
    expect(toFriendEvent({ ...RANK, person: null })).toBeNull()
  })

  it('выбрасывает событие незнакомого рода', () => {
    // Род обязан иметь свою строку на экране. Событие, которое некому нарисовать, — это пустая
    // строка на месте новости.
    expect(toFriendEvent({ ...RANK, kind: 'comeback' })).toBeNull()
  })

  it('выбрасывает день, который не день', () => {
    expect(toFriendEvent({ ...RANK, happened_on: 'вчера' })).toBeNull()
  })

  it('разбирает метку дороги и не требует у неё названия', () => {
    const event = toFriendEvent({
      id: '2026-09-20:calendar:halfYear',
      person: LENA,
      happened_on: '2026-09-20',
      kind: 'calendar',
      title: null,
      rank: null,
      days: null,
      mark: 'halfYear',
    })
    expect(event).toEqual({
      id: '2026-09-20:calendar:halfYear',
      person: LENA,
      date: '2026-09-20',
      kind: 'calendar',
      mark: 'halfYear',
    })
  })

  it('выбрасывает метку дороги без самой метки', () => {
    expect(
      toFriendEvent({ ...RANK, kind: 'calendar', rank: null, days: null, title: null, mark: null }),
    ).toBeNull()
  })
})

describe('toHeart', () => {
  it('требует все три части', () => {
    const heart = { owner_id: 'u1', event_id: 'e1', person_id: 'me' }
    expect(toHeart(heart)).toEqual({ ownerId: 'u1', eventId: 'e1', personId: 'me' })
    expect(toHeart({ ...heart, person_id: null })).toBeNull()
    expect(toHeart({ ...heart, owner_id: null })).toBeNull()
  })
})

describe('toSocialFeed', () => {
  it('не разобранный ответ — пустая лента, а не упавший экран', () => {
    expect(toSocialFeed(null)).toEqual({ events: [], hearts: [] })
    expect(toSocialFeed('что-то не то')).toEqual({ events: [], hearts: [] })
    expect(toSocialFeed({})).toEqual({ events: [], hearts: [] })
  })

  it('одна испорченная строка не уносит остальные', () => {
    const feed = toSocialFeed({
      events: [RANK, { ...RANK, kind: 'что-то' }],
      hearts: [{ owner_id: 'u1', event_id: RANK.id, person_id: 'me' }, null],
    })
    expect(feed.events).toHaveLength(1)
    expect(feed.hearts).toHaveLength(1)
  })
})
