import { describe, expect, it } from 'vitest'
import type { AppState, Day, DayTask, Goal, TaskTemplate } from './models'
import { describeToday, tomorrowPlan } from './todayBrief'

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
  it('counts what is left, and says nothing else — the plate reports, it does not judge', () => {
    const state = makeState(
      [makeGoal([makeTask()])],
      [makeDay(MONDAY, { tasks: [dayTask('a', true), dayTask('b', false), dayTask('c', false)] })],
    )
    expect(describeToday(state)).toEqual({
      goalLabel: 'Бегать по утрам', headline: 'Осталось 2 из 3', settled: false,
    })
  })

  it('calls a day settled only once nothing more is owed on it', () => {
    const goals = [makeGoal([makeTask()])]
    const open = makeState(goals, [makeDay(MONDAY, { tasks: [dayTask('a', false)] })])
    const closed = makeState(goals, [makeDay(MONDAY, { tasks: [dayTask('a', true)] })])
    expect(describeToday(open).settled).toBe(false)
    expect(describeToday(closed)).toEqual({
      goalLabel: 'Бегать по утрам', headline: 'Сегодня всё', settled: true,
    })
  })

  it('separates a planned rest day from a freeze that was paid for', () => {
    const goals = [makeGoal([makeTask()])]
    const rest = makeState(goals, [makeDay(MONDAY, { rest: true, colorTier: 'rest' })])
    const frozen = makeState(goals, [makeDay(MONDAY, { frozen: true, tasks: [dayTask('a', false)] })])
    expect(describeToday(rest)).toEqual({ goalLabel: 'Бегать по утрам', headline: 'Сегодня выходной', settled: true })
    expect(describeToday(frozen).headline).toBe('Сегодня под заморозкой')
  })

  it('stops naming one goal once there are two, because the two lines read as one sentence', () => {
    const second = makeGoal([makeTask({ id: 't2', goalId: 'g2', title: 'Читать' })], { id: 'g2', title: 'Читать больше' })
    const day = makeDay(MONDAY, { tasks: [dayTask('a', false)] })
    expect(describeToday(makeState([makeGoal([makeTask()]), second], [day])).goalLabel).toBe('Твои привычки')
    // An archived goal is not a second goal: the plate still has exactly one to name.
    expect(describeToday(makeState([makeGoal([makeTask()]), { ...second, archived: true }], [day])).goalLabel)
      .toBe('Бегать по утрам')
  })

  it('has something to say before the first day exists', () => {
    expect(describeToday(makeState([], []))).toEqual({
      goalLabel: 'Твоя привычка', headline: 'Путь ещё не начат', settled: false,
    })
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
