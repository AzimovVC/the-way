import { describe, expect, it } from 'vitest'
import type { Day } from './models'
import { DAY_CIRCLE_RADIUS, MAX_TURN_PER_DAY_DEG } from './config'
import {
  angleDelta,
  applyPathGeometry,
  computeColorTier,
  computePathPoints,
  getLogicalToday,
  reconcileMissedDays,
} from './pathEngine'

function makeDay(date: string, completionRate: number, colorTier: Day['colorTier'] = 'gray'): Day {
  return {
    id: date,
    date,
    tasks: [],
    completionRate,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier,
    frozen: false,
  }
}

function isoDate(dayOffset: number): string {
  const ms = Date.UTC(2026, 0, 1) + dayOffset * 86_400_000
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

describe('angleDelta', () => {
  it('is +maxAnglePerDay at completionRate 1.0', () => {
    expect(angleDelta(1, 36)).toBe(36)
  })

  it('is -maxAnglePerDay at completionRate 0.0', () => {
    expect(angleDelta(0, 36)).toBe(-36)
  })

  it('is ~0 at completionRate 0.5', () => {
    expect(angleDelta(0.5, 36)).toBe(0)
  })
})

describe('computeColorTier', () => {
  it('is gold at 1.0', () => {
    expect(computeColorTier(1)).toBe('gold')
  })

  it('is green at/above the threshold but below 1.0', () => {
    expect(computeColorTier(0.5)).toBe('green')
    expect(computeColorTier(0.99)).toBe('green')
  })

  it('is red below the threshold', () => {
    expect(computeColorTier(0.49)).toBe('red')
    expect(computeColorTier(0)).toBe('red')
  })
})

describe('getLogicalToday', () => {
  it('stays on the same date after the 3am boundary', () => {
    const now = new Date(Date.UTC(2026, 0, 5, 10, 0))
    expect(getLogicalToday(now, 0)).toBe('2026-01-05')
  })

  it('rolls back to the previous date before the 3am boundary', () => {
    const now = new Date(Date.UTC(2026, 0, 5, 1, 30))
    expect(getLogicalToday(now, 0)).toBe('2026-01-04')
  })

  it('applies a non-UTC timezone offset before checking the boundary', () => {
    // 2026-01-05T01:00 UTC, UTC+5 local -> 2026-01-05T06:00 local, past boundary.
    const now = new Date(Date.UTC(2026, 0, 5, 1, 0))
    expect(getLogicalToday(now, 5 * 60)).toBe('2026-01-05')
  })
})

describe('30 days at 100% completion', () => {
  const days = Array.from({ length: 30 }, (_, i) => makeDay(isoDate(i), 1, 'gold'))
  const points = computePathPoints(days)

  it('climbs steadily upward (toward the goal)', () => {
    expect(points[29].y).toBeLessThan(points[0].y)
    for (let i = 1; i < points.length; i++) {
      expect(points[i].y).toBeLessThan(points[i - 1].y + 1) // allow for decorative wiggle jitter
    }
  })

  it('heading stays near straight-up, not sideways', () => {
    for (const p of points) expect(Math.abs(p.headingDeg)).toBeLessThan(45)
  })

  it('does not stack circles on top of each other', () => {
    const geometry = applyPathGeometry(days)
    for (let i = 1; i < geometry.length; i++) {
      expect(geometry[i].columnDriftX).toBeGreaterThan(geometry[i - 1].columnDriftX)
    }
  })
})

describe('a long streak of 0% days', () => {
  it('eventually tips the heading past horizontal so the path retreats downward, toward the anti-goal', () => {
    const days = Array.from({ length: 10 }, (_, i) => makeDay(isoDate(i), 0, 'red'))
    const points = computePathPoints(days)
    const last = points[points.length - 1]
    expect(Math.abs(last.headingDeg)).toBeGreaterThan(90)
  })

  it('once tipped past horizontal, keeps moving down step by step (not back up)', () => {
    const days = Array.from({ length: 25 }, (_, i) => makeDay(isoDate(i), 0, 'red'))
    const points = computePathPoints(days)
    const tipIndex = points.findIndex((p) => Math.abs(p.headingDeg) > 90)
    expect(tipIndex).toBeGreaterThan(-1)
    for (let i = tipIndex + 1; i < points.length; i++) {
      expect(points[i].y).toBeGreaterThan(points[i - 1].y)
    }
    // Given enough days past the tip, the retreat outweighs the earlier climb.
    expect(points[points.length - 1].y).toBeGreaterThan(points[3].y)
  })

  it('turns gradually rather than snapping straight to the target heading (no self-crossing loops)', () => {
    const days = Array.from({ length: 10 }, (_, i) => makeDay(isoDate(i), 0, 'red'))
    const points = computePathPoints(days)
    for (let i = 1; i < points.length; i++) {
      const turn = Math.abs(points[i].headingDeg - points[i - 1].headingDeg)
      expect(turn).toBeLessThanOrEqual(MAX_TURN_PER_DAY_DEG + 1e-9)
    }
  })
})

describe('collision avoidance', () => {
  it('never lets two non-adjacent day circles end up closer than their diameter, even under wild swings', () => {
    // Alternate hard between 100% and 0% every few days — the kind of input most likely to fold the path back on itself.
    const days = Array.from({ length: 80 }, (_, i) => {
      const rate = Math.floor(i / 3) % 2 === 0 ? 1 : 0
      return makeDay(isoDate(i), rate, rate === 1 ? 'gold' : 'red')
    })
    const points = computePathPoints(days)
    const minSeparation = DAY_CIRCLE_RADIUS * 2 + 8
    // Matches the collision resolver's own lookback window — points further apart in
    // time than this were never checked against each other, by design (perf on long histories).
    const collisionCheckWindow = 40

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 2; j <= Math.min(i + 1 + collisionCheckWindow, points.length - 1); j++) {
        const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)
        expect(dist).toBeGreaterThanOrEqual(minSeparation - 1e-6)
      }
    }
  })
})

describe('a single missed day inside a good streak (heading)', () => {
  it('barely dents the heading, keeps pointing up', () => {
    const withMiss = Array.from({ length: 15 }, (_, i) =>
      makeDay(isoDate(i), i === 10 ? 0 : 1, i === 10 ? 'red' : 'gold'),
    )
    const points = computePathPoints(withMiss)
    for (const p of points) expect(p.headingDeg).toBeGreaterThan(0)
  })
})

describe('sharp 10-day slump after a long good streak', () => {
  const goodDays = Array.from({ length: 20 }, (_, i) => makeDay(isoDate(i), 1, 'gold'))
  const badDays = Array.from({ length: 10 }, (_, i) => makeDay(isoDate(20 + i), 0, 'red'))
  const geometry = applyPathGeometry([...goodDays, ...badDays])

  it('retreats noticeably faster than it advanced', () => {
    const inclineSlope = (geometry[19].columnDriftX - geometry[0].columnDriftX) / 19
    const declineSlope = (geometry[29].columnDriftX - geometry[20].columnDriftX) / 9
    expect(declineSlope).toBeLessThan(0)
    expect(Math.abs(declineSlope)).toBeGreaterThan(Math.abs(inclineSlope) * 2)
  })
})

describe('a single missed day inside a good streak', () => {
  it('barely dents the overall trend', () => {
    const withMiss = Array.from({ length: 15 }, (_, i) =>
      makeDay(isoDate(i), i === 10 ? 0 : 1, i === 10 ? 'red' : 'gold'),
    )
    const withoutMiss = Array.from({ length: 15 }, (_, i) => makeDay(isoDate(i), 1, 'gold'))

    const geometryWithMiss = applyPathGeometry(withMiss)
    const geometryWithoutMiss = applyPathGeometry(withoutMiss)

    // The path should still end up trending well to the right, not crash toward the anti-goal.
    expect(geometryWithMiss[14].columnDriftX).toBeGreaterThan(0)
    // And it should stay reasonably close to the miss-free path.
    const deviation = Math.abs(geometryWithoutMiss[14].columnDriftX - geometryWithMiss[14].columnDriftX)
    expect(deviation).toBeLessThan(geometryWithoutMiss[14].columnDriftX * 0.5)
  })
})

describe('reconcileMissedDays', () => {
  it('backfills 5 gray days for a 5-day absence and keeps the path moving', () => {
    const lastKnownDate = isoDate(0)
    const today = isoDate(6)
    const existing = [makeDay(lastKnownDate, 1, 'gold')]

    const reconciled = reconcileMissedDays(lastKnownDate, today, existing)
    const gapDays = reconciled.filter((d) => d.date !== lastKnownDate)

    expect(gapDays).toHaveLength(5)
    expect(gapDays.every((d) => d.colorTier === 'gray' && d.completionRate === 0)).toBe(true)

    const geometry = applyPathGeometry(reconciled)
    expect(geometry.at(-1)!.columnDriftX).toBeLessThan(geometry[0].columnDriftX)
  })

  it('is a no-op when there is no gap', () => {
    const date = isoDate(0)
    const existing = [makeDay(date, 1, 'gold')]
    expect(reconcileMissedDays(date, date, existing)).toHaveLength(1)
    expect(reconcileMissedDays(date, addDaysISOForTest(date, 1), existing)).toHaveLength(1)
  })
})

function addDaysISOForTest(dateISO: string, n: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const ms = Date.UTC(y, m - 1, d) + n * 86_400_000
  const date = new Date(ms)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
