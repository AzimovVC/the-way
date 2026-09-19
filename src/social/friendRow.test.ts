import { describe, expect, it } from 'vitest'
import { toAcquaintance, toAcquaintances, toFriendsView, toPerson } from './friendRow'

/**
 * Разбор ответа сервера. Проверяется не «как раскладываются колонки» — это видно глазами, — а то,
 * что происходит с ответом, в котором чего-то нет: миграция уезжает раньше сборки, а сборка живёт
 * на телефоне неделями, и экран друзей обязан пережить лишнее и недостающее поле.
 */

const LENA = {
  id: 'u1',
  handle: 'lena',
  name: 'Лена',
  days_on_road: 188,
  current_streak: 12,
  habit_count: 4,
}

describe('toPerson', () => {
  it('раскладывает колонки в поля', () => {
    expect(toPerson(LENA)).toEqual({
      id: 'u1',
      handle: 'lena',
      name: 'Лена',
      daysOnRoad: 188,
      currentStreak: 12,
      habitCount: 4,
    })
  })

  it('не выдумывает нулей: чего не прислали, того нет', () => {
    const short = toPerson({ id: 'u1', handle: 'lena', name: 'Лена' })
    expect(short).toEqual({ id: 'u1', handle: 'lena', name: 'Лена' })
    expect(short?.daysOnRoad).toBeUndefined()
  })

  it('пустое имя — это имя, а не потеря строки', () => {
    expect(toPerson({ id: 'u1', handle: 'lena' })?.name).toBe('')
  })

  it('без ника строку не показывают: по ней некуда нажать', () => {
    expect(toPerson({ id: 'u1', name: 'Лена' })).toBeNull()
    expect(toPerson({ handle: 'lena', name: 'Лена' })).toBeNull()
    expect(toPerson(null)).toBeNull()
  })
})

describe('toFriendsView', () => {
  it('собирает четыре полки', () => {
    const view = toFriendsView({
      friends: [LENA],
      incoming: [{ id: 'u2', handle: 'anton', name: 'Антон' }],
      outgoing: [],
      blocked: [{ id: 'u3', handle: 'oleg', name: 'Олег' }],
    })
    expect(view.friends.map((p) => p.handle)).toEqual(['lena'])
    expect(view.incoming.map((p) => p.handle)).toEqual(['anton'])
    expect(view.outgoing).toEqual([])
    expect(view.blocked.map((p) => p.handle)).toEqual(['oleg'])
  })

  it('пропавшая полка — пустая полка, а не сломанный экран', () => {
    expect(toFriendsView({})).toEqual({ friends: [], incoming: [], outgoing: [], blocked: [] })
    expect(toFriendsView(null)).toEqual({ friends: [], incoming: [], outgoing: [], blocked: [] })
  })

  it('нечитаемая строка выпадает, остальные остаются', () => {
    const view = toFriendsView({ friends: [LENA, { name: 'без ника' }] })
    expect(view.friends.map((p) => p.handle)).toEqual(['lena'])
  })
})

describe('toAcquaintance', () => {
  it('несёт человека и то, кем он приходится', () => {
    const seen = toAcquaintance({ person: LENA, state: 'friends' })
    expect(seen?.person.handle).toBe('lena')
    expect(seen?.state).toBe('friends')
  })

  it('незнакомое состояние читается как «никто»: кнопки «Принять» на нём не будет', () => {
    expect(toAcquaintance({ person: LENA, state: 'соседи' })?.state).toBe('none')
    expect(toAcquaintance({ person: LENA })?.state).toBe('none')
  })

  it('общие друзья приезжают списком, а без них поля просто нет', () => {
    const withMutual = toAcquaintance({
      person: LENA,
      state: 'none',
      mutual: [{ id: 'u2', handle: 'anton', name: 'Антон' }],
    })
    expect(withMutual?.mutual?.map((p) => p.handle)).toEqual(['anton'])
    expect(toAcquaintance({ person: LENA, state: 'none' })?.mutual).toBeUndefined()
  })

  it('без человека знакомства нет', () => {
    expect(toAcquaintance({ state: 'friends' })).toBeNull()
  })
})

describe('toAcquaintances', () => {
  it('не список — пустой список', () => {
    expect(toAcquaintances(null)).toEqual([])
    expect(toAcquaintances([{ person: LENA, state: 'none' }, {}])).toHaveLength(1)
  })
})
