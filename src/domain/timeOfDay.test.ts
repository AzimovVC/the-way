import { describe, expect, it } from 'vitest'
import type { Day, DayTask } from './models'
import { addDaysISO } from './pathEngine'
import {
  anchorTask,
  buildMarks,
  earlyStartLink,
  habitWindow,
  logicalHourOf,
  markingStyle,
  pointOfNoReturn,
  timeDrift,
} from './timeOfDay'

/** `at` is local 'HH:mm'; omitted means the task was asked for and not done. */
interface Entry {
  task: string
  at?: string
}

function makeDay(date: string, entries: Entry[], over: Partial<Day> = {}): Day {
  const tasks: DayTask[] = entries.map((e, i) => ({
    id: `${date}-${i}`,
    taskTemplateId: e.task,
    dayId: date,
    isDone: e.at !== undefined,
    skipped: false,
    completedAt: e.at === undefined ? null : `${date}T${e.at}:00.000Z`,
    completedLocal: e.at,
  }))
  const done = tasks.filter((t) => t.isDone).length
  return {
    id: date,
    date,
    tasks,
    completionRate: tasks.length === 0 ? 0 : done / tasks.length,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: 'red',
    frozen: false,
    ...over,
  }
}

/** Builds `count` days from a Monday, handing the index to the caller. */
function series(count: number, build: (i: number, date: string) => Day): Day[] {
  const start = '2026-01-05'
  return Array.from({ length: count }, (_, i) => build(i, addDaysISO(start, i)))
}

describe('reading the hour of a mark', () => {
  it('puts a mark made after midnight at the end of its day, not the start', () => {
    // 00:40 is the tail of the day that is closing. Read as a clock hour it would be 0 — the
    // earliest moment there is — and every statistic here would have the day backwards.
    expect(logicalHourOf({ completedAt: null, completedLocal: '00:40' })).toBeCloseTo(24.67, 1)
    expect(logicalHourOf({ completedAt: null, completedLocal: '07:30' })).toBeCloseTo(7.5, 5)
    expect(logicalHourOf({ completedAt: null, completedLocal: '03:00' })).toBeCloseTo(3, 5)
  })

  it('prefers the clock the person saw over the timestamp read in today’s zone', () => {
    const at = { completedAt: '2026-01-05T23:00:00.000Z', completedLocal: '06:15' }
    expect(logicalHourOf(at)).toBeCloseTo(6.25, 5)
  })

  it('has no hour for a task that was never marked', () => {
    expect(logicalHourOf({ completedAt: null })).toBeNull()
  })
})

describe('flattening history into marks', () => {
  it('numbers the day’s marks in the order they happened', () => {
    const marks = buildMarks([makeDay('2026-01-05', [{ task: 'b', at: '19:00' }, { task: 'a', at: '07:00' }])])
    expect(marks.find((m) => m.taskId === 'a')?.order).toBe(1)
    expect(marks.find((m) => m.taskId === 'b')?.order).toBe(2)
  })

  it('leaves out excused days, so a planned day off is never evidence of giving up', () => {
    const days = [
      makeDay('2026-01-05', [{ task: 'a', at: '08:00' }]),
      makeDay('2026-01-06', [{ task: 'a' }], { rest: true }),
      makeDay('2026-01-07', [{ task: 'a' }], { frozen: true }),
    ]
    expect(buildMarks(days).map((m) => m.date)).toEqual(['2026-01-05'])
  })

  it('keeps the order when everything was marked inside the same minute', () => {
    // completedLocal holds only minutes, and the person most likely to lose the order is exactly
    // the one who fills the app in at one sitting. Ordering reads the timestamp, which keeps seconds.
    const day = makeDay('2026-01-05', [{ task: 'b', at: '22:40' }, { task: 'a', at: '22:40' }])
    day.tasks[0].completedAt = '2026-01-05T22:40:50.000Z'
    day.tasks[1].completedAt = '2026-01-05T22:40:10.000Z'
    const marks = buildMarks([day])
    expect(marks.find((m) => m.taskId === 'a')?.order).toBe(1)
    expect(marks.find((m) => m.taskId === 'b')?.order).toBe(2)
  })

  it('records how many tasks the day asked for', () => {
    const marks = buildMarks([makeDay('2026-01-05', [{ task: 'a', at: '08:00' }, { task: 'b' }])])
    expect(marks.every((m) => m.askedThatDay === 2)).toBe(true)
  })
})

describe('the habit window', () => {
  const steady = series(20, (i, date) => makeDay(date, [{ task: 'a', at: i % 2 === 0 ? '07:10' : '08:30' }]))

  it('says nothing until there are enough marks to say it with', () => {
    expect(habitWindow(buildMarks(steady.slice(0, 14)), 'a')).toBeNull()
    expect(habitWindow(buildMarks(steady), 'a')).not.toBeNull()
  })

  it('is not dragged away by one late night', () => {
    const withOutlier = [...steady.slice(0, 19), makeDay('2026-02-01', [{ task: 'a', at: '23:50' }])]
    const window = habitWindow(buildMarks(withOutlier), 'a')
    expect(window!.median).toBeLessThan(9)
    expect(window!.low).toBeCloseTo(7.17, 1)
  })
})

describe('drift', () => {
  it('sees a habit sliding later week by week', () => {
    // Four weeks, two marks each, one hour later every week.
    const days = series(28, (i, date) => makeDay(date, [{ task: 'a', at: i % 7 < 2 ? `0${7 + Math.floor(i / 7)}:00` : undefined }]))
    const drift = timeDrift(buildMarks(days), 'a')
    expect(drift!.weeks).toHaveLength(4)
    expect(drift!.hoursPerWeek).toBeCloseTo(1, 5)
  })

  it('ignores a week represented by a single mark, which has no middle to speak of', () => {
    const days = series(21, (i, date) => makeDay(date, [{ task: 'a', at: i % 7 === 0 ? '08:00' : undefined }]))
    expect(timeDrift(buildMarks(days), 'a')).toBeNull()
  })
})

describe('the point of no return', () => {
  it('finds the hour after which the task stops happening', () => {
    // 12 days done between 06:00 and 11:00, 8 days missed outright.
    const days = series(20, (i, date) =>
      makeDay(date, [{ task: 'a', at: i < 12 ? `${String(6 + (i % 6)).padStart(2, '0')}:00` : undefined }]),
    )
    const point = pointOfNoReturn(buildMarks(days), 'a')
    expect(point!.hour).toBe(11)
    expect(point!.chance).toBe(0)
    expect(point!.openDays).toBeGreaterThanOrEqual(6)
  })

  it('has no answer for someone who does not miss — which is the answer', () => {
    const days = series(20, (_i, date) => makeDay(date, [{ task: 'a', at: '08:00' }]))
    expect(pointOfNoReturn(buildMarks(days), 'a')).toBeNull()
  })
})

describe('starting early and how the day ended', () => {
  it('compares the rest of the day, not the task that started it', () => {
    // Ten early days where the second task also lands, ten late days where it does not.
    const days = series(20, (i, date) =>
      i < 10
        ? makeDay(date, [{ task: 'a', at: '07:00' }, { task: 'b', at: '09:00' }])
        : makeDay(date, [{ task: 'a', at: '20:00' }, { task: 'b' }]),
    )
    const link = earlyStartLink(days)
    expect(link!.earlyDays).toBe(10)
    expect(link!.lateDays).toBe(10)
    expect(link!.earlyRestRate).toBe(1)
    expect(link!.lateRestRate).toBe(0)
    expect(link!.splitHour).toBeGreaterThan(7)
    expect(link!.splitHour).toBeLessThan(20)
  })

  it('stays silent on single-task days, where the comparison would be empty', () => {
    const days = series(30, (_i, date) => makeDay(date, [{ task: 'a', at: '07:00' }]))
    expect(earlyStartLink(days)).toBeNull()
  })
})

describe('the anchor task', () => {
  const days = series(20, (i, date) =>
    i < 12
      ? makeDay(date, [{ task: 'a', at: '07:00' }, { task: 'b', at: i < 8 ? '19:00' : undefined }])
      : makeDay(date, [{ task: 'a' }, { task: 'b', at: i < 14 ? '19:00' : undefined }]),
  )

  it('picks the task the day tends to start with', () => {
    const anchor = anchorTask(days)
    expect(anchor!.taskId).toBe('a')
    expect(anchor!.firstShare).toBeCloseTo(12 / 20, 5)
  })

  it('measures the rest of the day against it, so the link is not true by construction', () => {
    const anchor = anchorTask(days)
    expect(anchor!.restRateWhenDone).toBeCloseTo(8 / 12, 5)
    expect(anchor!.restRateWhenNot).toBeCloseTo(2 / 8, 5)
  })

  it('says nothing when the anchor always happens — there is no other side to compare', () => {
    const always = series(20, (_i, date) => makeDay(date, [{ task: 'a', at: '07:00' }, { task: 'b', at: '19:00' }]))
    expect(anchorTask(always)).toBeNull()
  })
})

describe('how the marks were made', () => {
  it('spots a history filled in at one sitting', () => {
    const days = series(10, (_i, date) => makeDay(date, [{ task: 'a', at: '22:40' }, { task: 'b', at: '22:41' }]))
    const style = markingStyle(days)
    expect(style.batched).toBe(true)
    expect(style.batchedDays).toBe(10)
  })

  it('does not call careful marking batched', () => {
    const days = series(10, (_i, date) => makeDay(date, [{ task: 'a', at: '07:00' }, { task: 'b', at: '19:00' }]))
    expect(markingStyle(days).batched).toBe(false)
  })

  it('will not judge the style on a handful of days', () => {
    const days = series(3, (_i, date) => makeDay(date, [{ task: 'a', at: '22:40' }, { task: 'b', at: '22:41' }]))
    expect(markingStyle(days).batched).toBe(false)
  })
})
