import { describe, expect, it } from 'vitest'
import type { Day, DayTask } from '../domain/models'
import {
  circleRowState,
  pairProgress,
  pairVerdict,
  partnerDoneOn,
  zoneNote,
  type Circle,
  type CircleMark,
} from './circles'

const THEM = 'p-lena'

function day(date: string, mine: boolean | 'absent', extra: Partial<Day> = {}): Day {
  const tasks: DayTask[] =
    mine === 'absent'
      ? []
      : [{ taskTemplateId: 't-run', dayId: date, isDone: mine, skipped: false, completedAt: null }]
  return {
    id: date,
    date,
    tasks,
    completionRate: mine === true ? 1 : 0,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: mine === true ? 'gold' : 'red',
    frozen: false,
    ...extra,
  }
}

function circle(theirDates: string[], excused: string[] = [], startedOn = '2026-09-01'): Circle {
  const marks: CircleMark[] = theirDates.map((date) => ({
    circleId: 'c1',
    personId: THEM,
    date,
    doneAt: `${date}T08:00:00.000Z`,
  }))
  return {
    id: 'c1',
    title: 'Бег',
    taskId: 't-run',
    partner: { person: { id: THEM, handle: 'lena_k', name: 'Лена' }, excused },
    startedOn,
    timezone: 'Europe/Kyiv',
    marks,
  }
}

describe('circleRowState', () => {
  it('различает все четыре состояния', () => {
    expect(circleRowState(false, false)).toBe('nobody')
    expect(circleRowState(true, false)).toBe('you')
    expect(circleRowState(false, true)).toBe('them')
    expect(circleRowState(true, true)).toBe('both')
  })
})

describe('partnerDoneOn', () => {
  it('читает только её отметки — своя половина живёт в дне, а не здесь', () => {
    const c = circle(['2026-09-02'])
    c.marks.push({ circleId: 'c1', personId: 'me', date: '2026-09-03', doneAt: '2026-09-03T09:00:00.000Z' })
    expect(partnerDoneOn(c, '2026-09-02')).toBe(true)
    expect(partnerDoneOn(c, '2026-09-03')).toBe(false)
  })
})

describe('pairVerdict', () => {
  it('засчитывает день, когда отметились оба', () => {
    expect(pairVerdict(circle(['2026-09-02']), day('2026-09-02', true), '2026-09-02')).toBe('counted')
  })

  it('рвёт день, когда не отметился один из двоих', () => {
    expect(pairVerdict(circle([]), day('2026-09-02', true), '2026-09-02')).toBe('broken')
    expect(pairVerdict(circle(['2026-09-02']), day('2026-09-02', false), '2026-09-02')).toBe('broken')
  })

  it('засчитывает день, в который она заморозилась, а он сделал', () => {
    const c = circle([], ['2026-09-02'])
    expect(pairVerdict(c, day('2026-09-02', true), '2026-09-02')).toBe('counted')
  })

  it('засчитывает день, в который он заморозился, а она сделала', () => {
    const frozen = day('2026-09-02', false, { frozen: true, colorTier: 'rest' })
    expect(pairVerdict(circle(['2026-09-02']), frozen, '2026-09-02')).toBe('counted')
  })

  it('не считает день, в который заморозились оба', () => {
    const frozen = day('2026-09-02', false, { frozen: true, colorTier: 'rest' })
    expect(pairVerdict(circle([], ['2026-09-02']), frozen, '2026-09-02')).toBe('skipped')
  })

  it('пропускает день, в который кружок не спрашивали', () => {
    // Строки кружка в дне нет — расписание его сюда не поставило. Второго предиката «а спрашивали
    // ли сегодня» здесь нет нарочно: день уже ответил на это, когда собирался.
    expect(pairVerdict(circle([]), day('2026-09-02', 'absent'), '2026-09-02')).toBe('skipped')
  })

  it('пропускает день, которого в истории нет', () => {
    expect(pairVerdict(circle([]), undefined, '2026-09-02')).toBe('skipped')
  })
})

describe('pairProgress', () => {
  const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']

  it('считает серию подряд и общее число', () => {
    const days = dates.map((date) => day(date, true))
    const progress = pairProgress(circle(dates), days, '2026-09-04')
    expect(progress).toEqual({ streak: 4, together: 4 })
  })

  it('её пропуск рвёт серию, а общее число не отбирает', () => {
    const days = dates.map((date) => day(date, true))
    // Она пропустила второго: серия идёт от третьего, а «вместе» помнит три дня.
    const progress = pairProgress(circle(['2026-09-01', '2026-09-03', '2026-09-04']), days, '2026-09-04')
    expect(progress).toEqual({ streak: 2, together: 3 })
  })

  it('заморозка одного серию не рвёт', () => {
    const days = [
      day('2026-09-01', true),
      day('2026-09-02', false, { frozen: true, colorTier: 'rest' }),
      day('2026-09-03', true),
      day('2026-09-04', true),
    ]
    expect(pairProgress(circle(dates), days, '2026-09-04').streak).toBe(4)
  })

  it('день, в который заморозились оба, держит серию и не растит её', () => {
    const days = [
      day('2026-09-01', true),
      day('2026-09-02', false, { frozen: true, colorTier: 'rest' }),
      day('2026-09-03', true),
      day('2026-09-04', true),
    ]
    const c = circle(['2026-09-01', '2026-09-03', '2026-09-04'], ['2026-09-02'])
    expect(pairProgress(c, days, '2026-09-04')).toEqual({ streak: 3, together: 3 })
  })

  it('незакрытый сегодняшний день серию не рвёт', () => {
    const days = [...dates.slice(0, 3).map((date) => day(date, true)), day('2026-09-04', false)]
    const progress = pairProgress(circle(dates.slice(0, 3)), days, '2026-09-04')
    expect(progress).toEqual({ streak: 3, together: 3 })
  })

  it('дни до начала кружка не считаются', () => {
    const days = dates.map((date) => day(date, true))
    const c = circle(dates, [], '2026-09-03')
    expect(pairProgress(c, days, '2026-09-04')).toEqual({ streak: 2, together: 2 })
  })
})

describe('zoneNote', () => {
  it('молчит, пока разница поясов мала', () => {
    expect(zoneNote(circle([]), 'Europe/Paris', new Date('2026-09-04T12:00:00Z'))).toBeNull()
  })

  it('называет пояс, когда разница доезжает до живого вечера', () => {
    const note = zoneNote(circle([]), 'Asia/Tokyo', new Date('2026-09-04T12:00:00Z'))
    expect(note).toContain('Europe/Kyiv')
  })
})
