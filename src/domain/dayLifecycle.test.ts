import { describe, expect, it } from 'vitest'
import { ensureTodayDay, rollForwardToToday, stepDayTaskProgress } from './dayLifecycle'
import type { AppState, Day, Goal, TaskTemplate } from './models'
import { addDaysISO } from './pathEngine'

/** 03:00 — граница дня, поэтому полдень однозначно «сегодня» в любой зоне, где идут тесты. */
const NOW = new Date('2026-01-14T12:00:00')
const TODAY = '2026-01-14' // среда
const MON = 0
const WED = 2
const FRI = 4

function task(id: string, over: Partial<TaskTemplate> = {}): TaskTemplate {
  return { id, goalId: 'g1', title: `Задача ${id}`, cycleStartDate: '2025-01-01', ...over }
}

function emptyDay(date: string, over: Partial<Day> = {}): Day {
  return {
    id: date, date, tasks: [], completionRate: 0, pathAngleDelta: 0,
    columnDriftX: 0, colorTier: 'gray', frozen: false, ...over,
  }
}

function stateWith(tasks: TaskTemplate[], days: Day[], over: Partial<AppState['user']> = {}): AppState {
  const goal: Goal = { id: 'g1', title: 'Быть здоровым', tasks, archived: false }
  return {
    user: {
      id: 'u1', name: 'Тестер', timezone: 'UTC', notificationsEnabled: false,
      // Тот же месяц, что и NOW: иначе пополнение выдаст заморозки посреди теста про дыру.
      freezesRemaining: 0, freezesRefilledMonth: '2026-01', goals: [goal], ...over,
    },
    days,
  }
}

const dayOn = (state: AppState, date: string) => state.days.find((d) => d.date === date)!

describe('ensureTodayDay', () => {
  it('asks only for what the schedule put on this day', () => {
    const state = stateWith([task('t1'), task('t2', { weekdays: [MON] })], [])
    const today = dayOn(ensureTodayDay(state, NOW), TODAY)

    expect(today.tasks.map((t) => t.taskTemplateId)).toEqual(['t1'])
  })

  it('calls a day nothing was asked of a rest day, not a miss', () => {
    // Привычка только по понедельникам, сегодня среда: день ничего не спросил, и ему нечего
    // ставить в вину — иначе расписание «Пн Ср Пт» красило бы дорогу красным четыре дня в неделю.
    const today = dayOn(ensureTodayDay(stateWith([task('t1', { weekdays: [MON] })], []), NOW), TODAY)

    expect(today.tasks).toHaveLength(0)
    expect(today.rest).toBe(true)
    expect(today.colorTier).toBe('rest')
  })

  it('leaves a day that already exists exactly as it was', () => {
    const state = stateWith([task('t1')], [emptyDay(TODAY)])
    expect(ensureTodayDay(state, NOW)).toBe(state)
  })

  it('does not ask for a habit that starts tomorrow', () => {
    const state = stateWith([task('t1', { cycleStartDate: addDaysISO(TODAY, 1) })], [])
    expect(dayOn(ensureTodayDay(state, NOW), TODAY).tasks).toHaveLength(0)
  })

  it('does not ask for the tasks of an archived goal', () => {
    const state = stateWith([task('t1')], [])
    const archived: AppState = {
      ...state,
      user: { ...state.user, goals: state.user.goals.map((g) => ({ ...g, archived: true })) },
    }
    expect(dayOn(ensureTodayDay(archived, NOW), TODAY).tasks).toHaveLength(0)
  })
})

describe('rollForwardToToday', () => {
  it('hands back the very same state when nothing is owed', () => {
    // На это опирается вызывающий: он отличает запуск, изменивший сейв, от запуска, который его
    // не тронул, — и лишняя запись в localStorage здесь означала бы запись при каждом открытии.
    const state = stateWith([task('t1')], [emptyDay(TODAY)])
    expect(rollForwardToToday(state, NOW)).toBe(state)
  })

  it('fills in every day the app was closed through, and today', () => {
    const state = stateWith([task('t1')], [emptyDay('2026-01-07', { completionRate: 1, colorTier: 'gold' })])
    const next = rollForwardToToday(state, NOW)

    expect(next.days.map((d) => d.date)).toEqual([
      '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10',
      '2026-01-11', '2026-01-12', '2026-01-13', TODAY,
    ])
    // Дыра — серые дни: приложение не знает, что в них было, и запись об этом не придумывает.
    expect(dayOn(next, '2026-01-08').colorTier).toBe('gray')
  })

  it('spends the freezes on the gap oldest first, and stops when they run out', () => {
    const state = stateWith(
      [task('t1')],
      [emptyDay('2026-01-10', { completionRate: 1, colorTier: 'gold' })],
      { freezesRemaining: 2 },
    )
    const next = rollForwardToToday(state, NOW)

    expect(next.days.filter((d) => d.frozen).map((d) => d.date)).toEqual(['2026-01-11', '2026-01-12'])
    expect(next.user.freezesRemaining).toBe(0)
    expect(dayOn(next, '2026-01-13').frozen).toBe(false)
  })

  it('never spends a freeze on a rest day inside the gap', () => {
    // Два тихих выходных внутри отсутствия опустошили бы месячный запас до дней, которым он нужен.
    const state = stateWith(
      [task('t1', { weekdays: [MON, WED, FRI] })],
      [emptyDay('2026-01-07', { completionRate: 1, colorTier: 'gold' })],
      { freezesRemaining: 2 },
    )
    const next = rollForwardToToday(state, NOW)

    expect(next.days.filter((d) => d.frozen).map((d) => d.date)).toEqual(['2026-01-09', '2026-01-12'])
    // Четверг и суббота-воскресенье ничего не спросили — они и так ни в чём не виноваты.
    expect(dayOn(next, '2026-01-08').rest).toBe(true)
    expect(dayOn(next, '2026-01-08').frozen).toBe(false)
  })

  it('recomputes the geometry, and an excused day keeps the road up where a miss takes it down', () => {
    // Сравниваются две одинаковые истории: в одной заморозка на пропущенный день нашлась, в другой
    // нет. Проверяется не само число — оно приходит из сглаживания и настраивается, — а то, ради
    // чего заморозка существует: тот же день не тянет дорогу вниз.
    const history = [emptyDay('2026-01-11', { completionRate: 1, colorTier: 'gold' })]
    const excused = rollForwardToToday(stateWith([task('t1')], history, { freezesRemaining: 1 }), NOW)
    const missed = rollForwardToToday(stateWith([task('t1')], history, { freezesRemaining: 0 }), NOW)

    expect(dayOn(excused, '2026-01-12').colorTier).toBe('rest')
    expect(dayOn(missed, '2026-01-12').colorTier).toBe('gray')
    expect(dayOn(excused, '2026-01-12').pathAngleDelta).toBeGreaterThan(
      dayOn(missed, '2026-01-12').pathAngleDelta,
    )
    // И геометрия действительно пересчитана, а не оставлена нулями с прошлого сохранения.
    expect(dayOn(excused, '2026-01-11').pathAngleDelta).toBeGreaterThan(0)
  })

  it('brings a backup made months ago up to today before anything draws it', () => {
    const state = stateWith([task('t1')], [emptyDay('2025-12-20', { completionRate: 1, colorTier: 'gold' })])
    const next = rollForwardToToday(state, NOW)

    expect(next.days[next.days.length - 1].date).toBe(TODAY)
    // Без дыр и по порядку: дорогу рисуют по этому массиву подряд.
    next.days.forEach((d, i) => {
      if (i > 0) expect(d.date).toBe(addDaysISO(next.days[i - 1].date, 1))
    })
  })

  it('does not invent a first day for an empty history', () => {
    // Первый день заводит онбординг: человек ещё не сказал, о чём его спрашивать.
    const state = stateWith([task('t1')], [])
    expect(rollForwardToToday(state, NOW).days).toHaveLength(0)
  })
})

describe('привычка, которую считают по разам', () => {
  const AT = new Date('2026-01-03T12:00:00')
  const DAY = '2026-01-03'

  function counted(count: number): AppState {
    const task: TaskTemplate = {
      id: 't1', goalId: 'g1', title: 'Вода', cycleStartDate: DAY, target: { count, unit: 'стаканов' },
    }
    const plain: TaskTemplate = { id: 't2', goalId: 'g1', title: 'Пробежка', cycleStartDate: DAY }
    return {
      user: {
        id: 'u1', name: '', timezone: 'UTC', notificationsEnabled: false,
        freezesRemaining: 2, freezesRefilledMonth: '2026-01',
        goals: [{ id: 'g1', title: 'Быть здоровым', tasks: [task, plain], archived: false }],
      },
      days: [{
        id: DAY, date: DAY,
        tasks: [task, plain].map((t) => ({
          taskTemplateId: t.id, dayId: DAY, isDone: false, skipped: false, completedAt: null,
        })),
        completionRate: 0, pathAngleDelta: 0, columnDriftX: 0, colorTier: 'red', frozen: false,
      }],
    }
  }

  const row = (state: AppState) => state.days[0].tasks[0]
  const step = (state: AppState, delta: number) => stepDayTaskProgress(state, DAY, 't1', delta, AT)

  it('до цели строка не закрыта, и день её так и считает', () => {
    let state = counted(3)
    state = step(state, 1)
    state = step(state, 1)

    expect(row(state).progress).toBe(2)
    expect(row(state).isDone).toBe(false)
    // Вот вся защита разом: «2 из 3» не даёт дню двух третей. Это «не отмечено» с числом.
    expect(state.days[0].completionRate).toBe(0)
  })

  it('на цели закрывается и приносит дню ровно одну строку', () => {
    let state = counted(3)
    for (let i = 0; i < 3; i++) state = step(state, 1)

    expect(row(state).isDone).toBe(true)
    expect(row(state).completedAt).not.toBeNull()
    expect(state.days[0].completionRate).toBe(0.5)
  })

  it('выше цели не растёт и ниже нуля не падает', () => {
    let state = counted(2)
    state = step(state, 5)
    expect(row(state).progress).toBe(2)

    state = step(state, -9)
    expect(row(state).progress).toBe(0)
    expect(row(state).isDone).toBe(false)
    expect(row(state).completedAt).toBeNull()
  })

  it('у привычки без счётчика шага нет', () => {
    const state = counted(3)
    expect(stepDayTaskProgress(state, DAY, 't2', 1, AT)).toBe(state)
  })
})
