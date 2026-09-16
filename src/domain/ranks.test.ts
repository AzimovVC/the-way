import { describe, expect, it } from 'vitest'
import { RANK_LADDER, rankAfter, rankLabel, rankReachedAt } from './ranks'

describe('the rank ladder', () => {
  it('means the same number of days for every habit', () => {
    // The whole point of the change: the rung is a duration, not a multiple of somebody's target.
    expect(RANK_LADDER.map((r) => r.days)).toEqual([7, 21, 66, 180, 365])
  })

  it('gives nothing for the first six days and the first rung on the seventh', () => {
    expect(rankReachedAt(6)).toBeNull()
    expect(rankReachedAt(7)?.id).toBe('novice')
    expect(rankAfter(6)).toMatchObject({ id: 'novice', days: 7 })
  })

  it('names the rung that was passed, not the one being walked to', () => {
    expect(rankReachedAt(65)?.id).toBe('apprentice')
    expect(rankReachedAt(66)?.id).toBe('practitioner')
    expect(rankAfter(66)).toMatchObject({ id: 'master', days: 180 })
  })

  it('counts years past the last name instead of inventing new ones', () => {
    expect(rankLabel(rankReachedAt(365)!)).toBe('Легенда')
    expect(rankLabel(rankReachedAt(800)!)).toBe('Легенда · 2 года')
    expect(rankLabel(rankReachedAt(1000)!)).toBe('Легенда · 2 года')
    expect(rankAfter(1000)).toMatchObject({ id: 'legend', days: 1095, year: 3 })
    expect(rankLabel(rankAfter(1825))).toBe('Легенда · 6 лет')
  })
})
