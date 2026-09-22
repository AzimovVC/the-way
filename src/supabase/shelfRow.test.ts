import { describe, expect, it } from 'vitest'
import type { ShowcaseHabit } from '../domain/showcase'
import { toShelf, toShelfRows } from './shelfRow'

/**
 * Что уезжает с витрины наружу. Проверяется не раскладка колонок — она видна глазами, — а граница:
 * названия привычек это единственный личный текст в приложении, и лишняя строка здесь стоит
 * дороже, чем недостающая.
 */

function habit(over: Partial<ShowcaseHabit> = {}): ShowcaseHabit {
  return {
    taskId: 't1',
    title: 'Пробежка',
    goalTitle: null,
    status: 'active',
    rank: null,
    history: [],
    daysWalked: 66,
    nextRank: null,
    markDate: null,
    finishedOn: null,
    ...over,
  }
}

describe('toShelf', () => {
  it('берёт с витрины название, значок и дни', () => {
    expect(toShelf([habit({ icon: '🏃' })])).toEqual([{ habitId: 't1', title: 'Пробежка', icon: '🏃', days: 66 }])
  })

  it('оставляет завершённую привычку дома', () => {
    // На своей витрине она стоит нарочно — иначе честный конец стоил бы дороже. Но дней у неё
    // нет, и чужому она приехала бы строкой без единственного числа, ради которого полку смотрят.
    const finished = habit({ taskId: 't2', status: 'finished', daysWalked: null, finishedOn: '2026-09-01' })
    expect(toShelf([habit(), finished])).toEqual([{ habitId: 't1', title: 'Пробежка', days: 66 }])
  })

  it('оставляет тихую привычку дома', () => {
    // Название — единственный личный текст в приложении, и «только для меня» обещает ровно то,
    // что оно никуда не уедет.
    const quiet = habit({ taskId: 't2', title: 'Таблетки', private: true })
    expect(toShelf([habit(), quiet])).toEqual([{ habitId: 't1', title: 'Пробежка', days: 66 }])
  })

  it('без значка поля нет вовсе', () => {
    expect(toShelf([habit()])[0]).not.toHaveProperty('icon')
  })

  it('пустая витрина — пустая полка, а не строка ни о чём', () => {
    expect(toShelf([])).toEqual([])
  })
})

describe('toShelfRows', () => {
  it('раскладывает полку по колонкам', () => {
    expect(toShelfRows('u1', [{ habitId: 't1', title: 'Пробежка', icon: '🏃', days: 66 }])).toEqual([
      { user_id: 'u1', habit_id: 't1', title: 'Пробежка', icon: '🏃', days: 66 },
    ])
  })

  it('снятый значок уезжает как `null`, а не как пропущенная колонка', () => {
    // Строка едет в `upsert`: пропущенная колонка оставила бы на сервере прежний значок у
    // привычки, с которой его только что сняли.
    expect(toShelfRows('u1', [{ habitId: 't1', title: 'Пробежка', days: 7 }])[0].icon).toBeNull()
  })
})
