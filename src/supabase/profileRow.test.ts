import { describe, expect, it } from 'vitest'
import {
  COLUMNS,
  isDeletedAccount,
  isHandleTaken,
  toProfile,
  toProjectionPatch,
  toRow,
  type ProfileProjection,
  type ProfileRow,
} from './profileRow'

const row: ProfileRow = {
  id: 'ec0f8e0a-0000-4000-8000-000000000001',
  handle: 'sergey',
  name: 'Сергей',
  days_on_road: 34,
  current_streak: 5,
  habit_count: 3,
  habits_public: true,
}

const projection: ProfileProjection = {
  name: 'Сергей',
  daysOnRoad: 34,
  currentStreak: 5,
  habitCount: 3,
  habitsPublic: true,
}

describe('перекладка строки', () => {
  it('туда и обратно возвращает ту же строку', () => {
    const profile = toProfile(row)
    expect(toRow(profile.id, profile.handle, profile)).toEqual(row)
  })

  it('читает числа именно из своих колонок', () => {
    // Все три числа одного типа и стоят рядом: перепутанные местами days_on_road и habit_count
    // не уронили бы ни один запрос, а на чужом экране показали бы 3 дня пути вместо 34.
    const profile = toProfile({ ...row, days_on_road: 34, current_streak: 5, habit_count: 3 })
    expect(profile.daysOnRoad).toBe(34)
    expect(profile.currentStreak).toBe(5)
    expect(profile.habitCount).toBe(3)
  })

  it('спрашивает у сервера ровно те колонки, которые умеет разобрать', () => {
    const asked = COLUMNS.split(',').map((column) => column.trim())
    expect(asked.sort()).toEqual(Object.keys(row).sort())
  })
})

describe('проекция', () => {
  it('не несёт ни ника, ни id', () => {
    // Ник принадлежит серверу, а проекция уходит наверх из фонового таймера: ник, приехавший
    // вместе с числами, затёр бы выбранный на другом устройстве.
    const patch: Record<string, unknown> = toProjectionPatch(projection)
    expect(patch).not.toHaveProperty('handle')
    expect(patch).not.toHaveProperty('id')
  })

  it('несёт все остальные колонки — иначе поле молча отстаёт от состояния', () => {
    const patch = toProjectionPatch(projection)
    const { id: _id, handle: _handle, ...rest } = row
    expect(Object.keys(patch).sort()).toEqual(Object.keys(rest).sort())
  })
})

describe('коды отказа', () => {
  it('23505 — ник заняли между проверкой и записью', () => {
    expect(isHandleTaken({ code: '23505', message: 'duplicate key value' })).toBe(true)
    expect(isDeletedAccount({ code: '23505' })).toBe(false)
  })

  it('23503 — аккаунта, которому выдана сессия, больше нет', () => {
    expect(isDeletedAccount({ code: '23503', message: 'not present in table "users"' })).toBe(true)
    expect(isHandleTaken({ code: '23503' })).toBe(false)
  })

  it('чужой отказ не притворяется ни тем, ни другим', () => {
    // 42501 — отказ политики RLS. Ответить на него «ник занят» значило бы предложить человеку
    // переименоваться там, где дело в доступе.
    expect(isHandleTaken({ code: '42501' })).toBe(false)
    expect(isDeletedAccount({ code: '42501' })).toBe(false)
  })

  it('сеть падает без кода, и это не повод выйти из аккаунта', () => {
    // Выход по ошибке сети — это подписанный ключ, выброшенный из-за потерянного Wi-Fi.
    expect(isDeletedAccount(new TypeError('Failed to fetch'))).toBe(false)
    expect(isDeletedAccount(null)).toBe(false)
    expect(isDeletedAccount(undefined)).toBe(false)
    expect(isDeletedAccount('23503')).toBe(false)
    expect(isDeletedAccount({ code: 23503 })).toBe(false)
  })
})
