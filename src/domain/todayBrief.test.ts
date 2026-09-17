import { describe, expect, it } from 'vitest'
import type { AppState, Day, DayTask, Goal, TaskTemplate } from './models'
import { describeToday, fitNames, tomorrowPlan } from './todayBrief'

// 2026-01-05 is a Monday, so weekday indices 0..6 run Mon..Sun from here.
const MONDAY = '2026-01-05'

function makeTask(over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 't1', goalId: 'g1', title: 'Пробежка', cycleStartDate: MONDAY, ...over,
  }
}

function makeGoal(tasks: TaskTemplate[], over: Partial<Goal> = {}): Goal {
  return { id: 'g1', title: 'Бегать по утрам', tasks, archived: false, ...over }
}

function makeDay(date: string, over: Partial<Day> = {}): Day {
  return {
    id: date, date, tasks: [], completionRate: 0, pathAngleDelta: 0,
    columnDriftX: 0, colorTier: 'red', frozen: false, ...over,
  }
}

function dayTask(id: string, isDone: boolean): DayTask {
  return { id, taskTemplateId: id, dayId: MONDAY, isDone, skipped: false, completedAt: null }
}

function makeState(goals: Goal[], days: Day[]): AppState {
  return {
    user: {
      id: 'u1', name: 'Тестер', timezone: 'UTC', notificationsEnabled: false,
      freezesRemaining: 2, freezesRefilledMonth: '2026-01', goals,
    },
    days,
  }
}

describe('describeToday', () => {
  it('names what is left and counts it, and says nothing else — the plate reports, it does not judge', () => {
    const state = makeState(
      [makeGoal([makeTask({ id: 'a', title: 'Читать' }), makeTask({ id: 'b', title: 'Плавать' })])],
      [makeDay(MONDAY, { tasks: [dayTask('a', true), dayTask('b', false)] })],
    )
    expect(describeToday(state)).toEqual({
      label: 'Осталось', count: '1 из 2', headline: 'Плавать', more: 0, settled: false,
    })
  })

  it('keeps the verb with the number, because «1 из 3» alone reads as one *done* of three', () => {
    const state = makeState(
      [makeGoal([makeTask({ id: 'a', title: 'Читать' }), makeTask({ id: 'b', title: 'Плавать' })])],
      [makeDay(MONDAY, { tasks: [dayTask('a', false), dayTask('b', false)] })],
    )
    expect(describeToday(state).label).toBe('Осталось')
  })

  it('prints no count on a one-habit day: «1 из 1» is all it could ever say', () => {
    const state = makeState(
      [makeGoal([makeTask({ id: 'a', title: 'Читать' })])],
      [makeDay(MONDAY, { tasks: [dayTask('a', false)] })],
    )
    expect(describeToday(state)).toEqual({
      label: 'Осталось', count: '', headline: 'Читать', more: 0, settled: false,
    })
  })

  it('drops the count once nothing is left: «2 из 2» could not have been anything else', () => {
    const goals = [makeGoal([makeTask({ id: 'a' })])]
    const open = makeState(goals, [makeDay(MONDAY, { tasks: [dayTask('a', false)] })])
    const closed = makeState(goals, [makeDay(MONDAY, { tasks: [dayTask('a', true)] })])
    expect(describeToday(open).settled).toBe(false)
    expect(describeToday(closed)).toEqual({
      label: '', count: '', headline: 'Сегодня всё', more: 0, settled: true,
    })
  })

  it('separates a planned rest day from a freeze that was paid for', () => {
    const goals = [makeGoal([makeTask()])]
    const rest = makeState(goals, [makeDay(MONDAY, { rest: true, colorTier: 'rest' })])
    const frozen = makeState(goals, [makeDay(MONDAY, { frozen: true, tasks: [dayTask('a', false)] })])
    expect(describeToday(rest)).toEqual({
      label: '', count: '', headline: 'Сегодня выходной', more: 0, settled: true,
    })
    expect(describeToday(frozen).headline).toBe('Сегодня под заморозкой')
  })

  it('falls back to the count when no name can be read, rather than leaving the big line empty', () => {
    const state = makeState([makeGoal([])], [makeDay(MONDAY, { tasks: [dayTask('gone', false)] })])
    expect(describeToday(state)).toEqual({
      label: '', count: '', headline: 'Осталось 1 из 1', more: 0, settled: false,
    })
  })

  it('has something to say before the first day exists', () => {
    expect(describeToday(makeState([], []))).toEqual({
      label: '', count: '', headline: 'Путь ещё не начат', more: 0, settled: false,
    })
  })
})

describe('fitNames', () => {
  it('keeps the first name whole, because the last habit left is the reason the screen was opened', () => {
    expect(fitNames(['Плавать 10 мин.'])).toEqual({ line: 'Плавать 10 мин.', more: 0 })
  })

  it('joins names with · while they fit', () => {
    expect(fitNames(['Читать', 'Плавать'])).toEqual({ line: 'Читать · Плавать', more: 0 })
  })

  it('counts the rest instead of cutting a name to «Плава…»', () => {
    expect(fitNames(['Читать 10 мин.', 'Плавать 10 мин.', 'Пробежка'])).toEqual({
      line: 'Читать 10 мин.', more: 2,
    })
  })

  it('never lets the tail push the line past the budget', () => {
    const { line, more } = fitNames(['Йога', 'Душ', 'Читать', 'Плавать'])
    expect(line.length + (more > 0 ? ` +${more}`.length : 0)).toBeLessThanOrEqual(20)
  })

  it('says nothing when there is nothing left', () => {
    expect(fitNames([])).toEqual({ line: '', more: 0 })
  })
})

describe('tomorrowPlan', () => {
  it('reads tomorrow through the schedule, not through today: a task off duty tomorrow is not listed', () => {
    // Пробежка runs Mon/Wed, Чтение every day. Tomorrow is Tuesday.
    const state = makeState(
      [makeGoal([makeTask({ weekdays: [0, 2] }), makeTask({ id: 't2', title: 'Чтение' })])],
      [makeDay(MONDAY)],
    )
    expect(tomorrowPlan(state)).toEqual({ date: '2026-01-06', titles: ['Чтение'] })
  })

  it('leaves the list empty on a day nothing falls on — that is a rest day, not an oversight', () => {
    const state = makeState([makeGoal([makeTask({ weekdays: [0] })])], [makeDay(MONDAY)])
    expect(tomorrowPlan(state).titles).toEqual([])
  })

  it('crosses the month boundary in UTC, so no timezone shows the wrong tomorrow', () => {
    // 2026-02-01 is a Sunday; the task runs Sundays only.
    const state = makeState([makeGoal([makeTask({ weekdays: [6] })])], [makeDay('2026-01-31')])
    expect(tomorrowPlan(state)).toEqual({ date: '2026-02-01', titles: ['Пробежка'] })
  })

  it('ignores an archived goal', () => {
    const state = makeState([makeGoal([makeTask()], { archived: true })], [makeDay(MONDAY)])
    expect(tomorrowPlan(state).titles).toEqual([])
  })
})
