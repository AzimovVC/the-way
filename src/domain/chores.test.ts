import { describe, expect, it } from 'vitest'
import {
  addChore, choresForToday, choresOnDay, daysWithDoneChores, removeChore, toggleChore, upcomingChores,
} from './chores'
import type { AppState, Day } from './models'

function day(date: string): Day {
  return {
    id: date, date, tasks: [], completionRate: 0, pathAngleDelta: 0,
    columnDriftX: 0, colorTier: 'gray', frozen: false,
  }
}

function stateWith(dates: string[]): AppState {
  return {
    user: {
      id: 'u1', name: 'Т', timezone: 'UTC', notificationsEnabled: false,
      freezesRemaining: 0, freezesRefilledMonth: '2026-09', goals: [],
    },
    days: dates.map(day),
  }
}

const at = (iso: string) => new Date(iso)

describe('the road never sees a chore', () => {
  it('adds nothing to days and rewrites no day', () => {
    const state = stateWith(['2026-09-16', '2026-09-17'])
    const next = addChore(state, { id: 'c1', title: 'Забрать посылку', date: '2026-09-17' })
    expect(next.days).toBe(state.days)
    expect(next.days.every((d) => d.tasks.length === 0)).toBe(true)
  })

  it('leaves every day untouched when a chore is done', () => {
    const state = addChore(stateWith(['2026-09-17']), { id: 'c2', title: 'Дело', date: '2026-09-17' })
    const done = toggleChore(state, state.chores![0].id, at('2026-09-17T10:00:00'))
    expect(done.days).toBe(state.days)
    expect(done.days[0].completionRate).toBe(0)
    expect(done.days[0].colorTier).toBe('gray')
  })
})

describe('choresForToday', () => {
  it('keeps an unfinished chore from a past day on the list', () => {
    // Дело, тихо утонувшее во вчера, потеряно. Показанное — просто ещё не сделано.
    let state = addChore(stateWith(['2026-09-17']), { id: 'c3', title: 'Позвонить', date: '2026-09-14' })
    state = addChore(state, { id: 'c4', title: 'Сегодняшнее', date: '2026-09-17' })
    expect(choresForToday(state, '2026-09-17').map((c) => c.title)).toEqual(['Позвонить', 'Сегодняшнее'])
  })

  it('does not show a chore planned for tomorrow', () => {
    const state = addChore(stateWith(['2026-09-17']), { id: 'c5', title: 'Завтрашнее', date: '2026-09-18' })
    expect(choresForToday(state, '2026-09-17')).toHaveLength(0)
  })

  it('keeps a chore done today in place, so the tick can be seen and taken back', () => {
    const state = addChore(stateWith(['2026-09-17']), { id: 'c6', title: 'Дело', date: '2026-09-14' })
    const done = toggleChore(state, state.chores![0].id, at('2026-09-17T10:00:00'))
    expect(choresForToday(done, '2026-09-17')).toHaveLength(1)
  })

  it('drops a chore done on an earlier day', () => {
    const state = addChore(stateWith(['2026-09-17']), { id: 'c7', title: 'Дело', date: '2026-09-14' })
    const done = toggleChore(state, state.chores![0].id, at('2026-09-15T10:00:00'))
    expect(choresForToday(done, '2026-09-17')).toHaveLength(0)
  })
})

describe('toggleChore', () => {
  it('records the day it was actually done, not the day it was planned for', () => {
    // Знак на круге значит «в этот день ты разобрался с делом», и ставить его во вчера значило бы
    // дорисовать событие в уже прожитый день.
    const state = addChore(stateWith(['2026-09-17']), { id: 'c8', title: 'Дело', date: '2026-09-14' })
    const done = toggleChore(state, state.chores![0].id, at('2026-09-17T10:00:00'))
    expect(done.chores![0].doneOn).toBe('2026-09-17')
  })

  it('reads the logical day, so a mark at 00:40 belongs to the day that is ending', () => {
    const state = addChore(stateWith(['2026-09-17']), { id: 'c9', title: 'Дело', date: '2026-09-17' })
    const done = toggleChore(state, state.chores![0].id, at('2026-09-18T00:40:00'))
    expect(done.chores![0].doneOn).toBe('2026-09-17')
  })

  it('takes the tick back, and the day with it', () => {
    const state = addChore(stateWith(['2026-09-17']), { id: 'c10', title: 'Дело', date: '2026-09-17' })
    const id = state.chores![0].id
    const back = toggleChore(toggleChore(state, id, at('2026-09-17T10:00:00')), id, at('2026-09-17T11:00:00'))
    expect(back.chores![0].doneOn).toBeNull()
    expect(back.chores![0].doneAt).toBeNull()
  })
})

describe('daysWithDoneChores', () => {
  it('gives one day once, however many chores were closed in it', () => {
    let state = addChore(stateWith(['2026-09-17']), { id: 'c11', title: 'Раз', date: '2026-09-17' })
    state = addChore(state, { id: 'c12', title: 'Два', date: '2026-09-17' })
    state = toggleChore(state, state.chores![0].id, at('2026-09-17T10:00:00'))
    state = toggleChore(state, state.chores![1].id, at('2026-09-17T11:00:00'))
    expect([...daysWithDoneChores(state)]).toEqual(['2026-09-17'])
  })

  it('is empty while nothing has been closed', () => {
    const state = addChore(stateWith(['2026-09-17']), { id: 'c13', title: 'Дело', date: '2026-09-17' })
    expect(daysWithDoneChores(state).size).toBe(0)
  })
})

describe('the rest of it', () => {
  it('reads a state saved before chores existed as having none', () => {
    const state = stateWith(['2026-09-17'])
    expect(choresForToday(state, '2026-09-17')).toEqual([])
    expect(daysWithDoneChores(state).size).toBe(0)
  })

  it('refuses a chore with no title', () => {
    const state = stateWith(['2026-09-17'])
    expect(addChore(state, { id: 'c14', title: '   ', date: '2026-09-17' })).toBe(state)
  })

  it('shows a past day the chores that belonged to it', () => {
    const state = addChore(stateWith(['2026-09-17']), { id: 'c15', title: 'Дело', date: '2026-09-14' })
    expect(choresOnDay(state, '2026-09-14')).toHaveLength(1)
    expect(choresOnDay(state, '2026-09-15')).toHaveLength(0)
  })

  it('removes a chore without touching anything else', () => {
    const state = addChore(stateWith(['2026-09-17']), { id: 'c16', title: 'Дело', date: '2026-09-17' })
    const gone = removeChore(state, state.chores![0].id)
    expect(gone.chores).toEqual([])
    expect(gone.days).toBe(state.days)
  })
})

describe('upcomingChores', () => {
  const today = '2026-09-17'

  it('shows a chore set for a day still ahead — otherwise nothing shows it until that day', () => {
    let state = stateWith([today])
    state = addChore(state, { id: 'c17', title: 'Купить подарок', date: '2026-09-19' })
    expect(upcomingChores(state, today).map((c) => c.title)).toEqual(['Купить подарок'])
  })

  it('keeps an undone chore from the past, and puts the earliest first', () => {
    let state = stateWith([today])
    state = addChore(state, { id: 'c18', title: 'Суббота', date: '2026-09-19' })
    state = addChore(state, { id: 'c19', title: 'Позавчера', date: '2026-09-15' })
    expect(upcomingChores(state, today).map((c) => c.title)).toEqual(['Позавчера', 'Суббота'])
  })

  it('keeps today\'s done chore in the list, and drops yesterday\'s', () => {
    let state = stateWith([today])
    state = addChore(state, { id: 'c20', title: 'Сегодняшнее', date: today })
    state = addChore(state, { id: 'c21', title: 'Вчерашнее', date: '2026-09-16' })
    const [todays, yesterdays] = state.chores!
    state = toggleChore(state, todays.id, at(`${today}T10:00:00`))
    state = toggleChore(state, yesterdays.id, at('2026-09-16T10:00:00'))
    expect(upcomingChores(state, today).map((c) => c.title)).toEqual(['Сегодняшнее'])
  })
})
