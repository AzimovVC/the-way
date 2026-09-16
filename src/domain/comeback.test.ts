import { describe, expect, it } from 'vitest'
import { comebackConfirmedOn, comebackRank, findComebacks } from './comeback'
import { COMEBACK_MIN_RETURN_DAYS, COMEBACK_MIN_SLUMP_DAYS, COMEBACK_RANKS } from './config'
import type { Day } from './models'

const START = '2026-01-05'

function dateAt(offset: number): string {
  return new Date(Date.parse(`${START}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
}

/** '-' the road turning down, '+' turning up, '.' a flat day — a rest day or a spent freeze. */
function road(shape: string): Day[] {
  return [...shape].map((c, i) => ({
    id: dateAt(i),
    date: dateAt(i),
    tasks: [],
    completionRate: 0,
    pathAngleDelta: c === '-' ? -2 : c === '+' ? 2 : 0,
    columnDriftX: 0,
    colorTier: 'red' as const,
    frozen: false,
    rest: c === '.' ? true : undefined,
  }))
}

describe('comebacks', () => {
  it('needs both a real fall and a return that is no longer in doubt', () => {
    expect(COMEBACK_MIN_SLUMP_DAYS).toBe(3)
    expect(COMEBACK_MIN_RETURN_DAYS).toBe(3)

    expect(findComebacks(road('++---+++'))).toHaveLength(1)
    // A fall too short to be a slump.
    expect(findComebacks(road('++--+++'))).toHaveLength(0)
    // A return too short to be called yet — one good day after a slump is a good day.
    expect(findComebacks(road('++---++'))).toHaveLength(0)
  })

  it('lands on the day the return was confirmed, not on the day it started', () => {
    const [comeback] = findComebacks(road('+---+++'))

    expect(comeback.slumpStart).toBe(dateAt(1))
    expect(comeback.slumpEnd).toBe(dateAt(3))
    expect(comeback.returnStart).toBe(dateAt(4))
    // The third day back: a screen has to arrive on a day the person is looking at.
    expect(comeback.confirmedDate).toBe(dateAt(6))
  })

  it('steps over flat days instead of letting them break a fall in two', () => {
    // Rest days in the middle of a slump. Counted as the end of it, each half is too short and a
    // return from a week off would register as no slump at all.
    const comebacks = findComebacks(road('+--..-+++'))

    expect(comebacks).toHaveLength(1)
    expect(comebacks[0].slumpLength).toBe(3)
  })

  it('counts returns over the whole road, because that is the number that can only grow by falling', () => {
    const comebacks = findComebacks(road('---+++---+++'))

    expect(comebacks.map((c) => c.ordinal)).toEqual([1, 2])
  })

  it('gives a rank only on the returns that earn one', () => {
    for (const rank of COMEBACK_RANKS) expect(comebackRank(rank.at)).toBe(rank.label)
    expect(comebackRank(2)).toBeNull()
  })

  it('answers what a freshly closed day just confirmed, and nothing else', () => {
    const days = road('+---+++')

    expect(comebackConfirmedOn(days, dateAt(6))?.ordinal).toBe(1)
    expect(comebackConfirmedOn(days, dateAt(5))).toBeNull()
  })
})
