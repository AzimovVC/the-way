import { describe, expect, it } from 'vitest'
import { sharedHabits } from './sharedHabits'
import type { AppState, Goal, TaskTemplate } from '../domain/models'
import type { PersonHabit } from './types'

function makeState(titles: string[], archivedTitles: string[] = []): AppState {
  const goalOf = (title: string, i: number, archived: boolean): Goal => ({
    id: `g${i}-${archived ? 'a' : 'l'}`,
    title,
    tasks: [
      {
        id: `t${i}-${archived ? 'a' : 'l'}`,
        goalId: `g${i}`,
        title,
        cycleStartDate: '2026-01-05',
        icon: '🏃',
      } satisfies TaskTemplate,
    ],
    archived,
  })

  return {
    user: {
      id: 'u1',
      name: 'Тестер',
      timezone: 'UTC',
      notificationsEnabled: false,
      freezesRemaining: 2,
      freezesRefilledMonth: '2026-01',
      goals: [
        ...titles.map((title, i) => goalOf(title, i, false)),
        ...archivedTitles.map((title, i) => goalOf(title, i + 100, true)),
      ],
    },
    days: [],
  }
}

const theirs = (...titles: string[]): PersonHabit[] =>
  titles.map((title, i) => ({ id: `h${i}`, title, days: 30, icon: '📚' }))

describe('общие привычки', () => {
  it('совпадают по названию, а регистр и лишние пробелы не мешают', () => {
    const shared = sharedHabits(makeState(['Бег', 'Чтение']), theirs('  бег ', 'Немецкий'))
    expect(shared.map((h) => h.title)).toEqual(['Бег'])
  })

  it('«ё» и «е» — одно и то же слово', () => {
    expect(sharedHabits(makeState(['Отжимания на брусьях']), theirs('Отжимания на брусьях')).length).toBe(1)
  })

  it('похожего не выдумывает', () => {
    // «Бег 5 км» и «Пробежка» — одна привычка для человека и разные строки для нас. Промолчать
    // дешевле, чем сказать «вы оба» про две разные вещи доверительным голосом.
    expect(sharedHabits(makeState(['Бег 5 км']), theirs('Пробежка'))).toEqual([])
  })

  it('берёт твоё слово и твой значок — своё название человек узнаёт', () => {
    const shared = sharedHabits(makeState(['Чтение']), theirs('чтение'))
    expect(shared[0]).toMatchObject({ title: 'Чтение', icon: '🏃' })
  })

  it('архивная цель общей привычки не делает', () => {
    expect(sharedHabits(makeState([], ['Бег']), theirs('Бег'))).toEqual([])
  })

  it('пока его привычек не прислали, списка нет', () => {
    expect(sharedHabits(makeState(['Бег']), undefined)).toEqual([])
  })
})
