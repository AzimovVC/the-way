import { describe, expect, it } from 'vitest'
import type { Day, DayTask } from './models'
import { dailyQuestsFor } from './quests'

function mark(id: string, over: Partial<DayTask> = {}): DayTask {
  return { id, taskTemplateId: id, dayId: 'd', isDone: true, skipped: false, completedAt: null, ...over }
}

function day(date: string, tasks: DayTask[], over: Partial<Day> = {}): Day {
  return {
    id: date, date, tasks, completionRate: tasks.length === 0 ? 0 : tasks.filter((t) => t.isDone).length / tasks.length,
    pathAngleDelta: 0, columnDriftX: 0, colorTier: 'gray', frozen: false, ...over,
  }
}

/** Задания выбираются по дате, поэтому нужное вытаскивается перебором дат, а не подстройкой хеша. */
function questOn(id: string, make: (date: string) => Day, makeHistory: (date: string) => Day[] = () => []) {
  // С третьего числа, чтобы у истории на три дня назад были настоящие даты.
  for (let n = 3; n <= 31; n++) {
    const date = `2026-03-${String(n).padStart(2, '0')}`
    const subject = make(date)
    const found = dailyQuestsFor(subject, makeHistory(date)).find((q) => q.id === id)
    if (found) return found
  }
  throw new Error(`задание ${id} не выпало ни на один день месяца`)
}

describe('dailyQuestsFor', () => {
  it('gives a rest day no quest at all', () => {
    // «Выполни 2 задачи» в день, который ничего не просил, — это вызов сломать своё же расписание.
    expect(dailyQuestsFor(day('2026-03-02', [], { rest: true, colorTier: 'rest' }), [])).toEqual([])
  })

  it('picks the same quests for the same date every time', () => {
    const subject = day('2026-03-02', [mark('a'), mark('b')])
    expect(dailyQuestsFor(subject, [subject])).toEqual(dailyQuestsFor(subject, [subject]))
  })

  it('does not count a mark at 00:40 as done before noon', () => {
    // Час читается на шкале 3..27: 00:40 — хвост закрывающегося дня, а не самое раннее утро.
    const late = questOn('before_noon', (date) => day(date, [mark('a', { completedLocal: '00:40' })]))
    expect(late.isComplete).toBe(false)

    const morning = questOn('before_noon', (date) => day(date, [mark('a', { completedLocal: '08:10' })]))
    expect(morning.isComplete).toBe(true)
  })

  it('steps over a rest day inside the three-day streak instead of breaking on it', () => {
    // Выходной не считается против тебя нигде — значит и здесь серия об него не рвётся.
    const history = (date: string): Day[] => {
      const n = Number(date.slice(-2))
      const before = (k: number) => `2026-03-${String(n - k).padStart(2, '0')}`
      return [
        day(before(2), [mark('a')], { colorTier: 'gold' }),
        day(before(1), [], { rest: true, colorTier: 'rest' }),
        day(date, [mark('a')], { colorTier: 'gold' }),
      ]
    }
    const quest = questOn('streak_3', (date) => history(date)[2], history)
    expect(quest.isComplete).toBe(true)
  })

  it('does not call three days a streak when the middle one was missed', () => {
    const history = (date: string): Day[] => {
      const n = Number(date.slice(-2))
      const before = (k: number) => `2026-03-${String(n - k).padStart(2, '0')}`
      return [
        day(before(2), [mark('a')], { colorTier: 'gold' }),
        day(before(1), [mark('a', { isDone: false })], { colorTier: 'red' }),
        day(date, [mark('a')], { colorTier: 'gold' }),
      ]
    }
    const quest = questOn('streak_3', (date) => history(date)[2], history)
    expect(quest.isComplete).toBe(false)
  })
})
