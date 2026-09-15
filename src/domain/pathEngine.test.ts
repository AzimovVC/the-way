import { describe, expect, it } from 'vitest'
import type { Day } from './models'
import {
  DAY_CIRCLE_RADIUS,
  DAY_SPACING_PX,
  MILESTONE_CLEARANCE_PX,
  WEEK_BOX_SIZE_RATIO,
  MAX_TURN_PER_DAY_DEG,
  MAX_WOBBLE_PX,
  MAX_TURN_PER_DAY_CAP,
  MAX_WOBBLE_CAP,
  MIN_POINT_SEPARATION_PX,
  ZIGZAG_AMPLITUDE_CAP,
  ZIGZAG_AMPLITUDE_PX,
  reversalLaneWidthPx,
} from './config'
import { boxIntrusionPx, chipFitScale, distanceToChip } from './chipFit'
import { WEEK_BOX_CLEARANCE_PX, computeWeekBoxGeometry, widestMilestoneChipBox } from './decorGeometry'
import {
  angleDelta,
  applyPathGeometry,
  computeColorTier,
  computeMilestones,
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

// --- Path geometry -----------------------------------------------------------------------
//
// These pin the three properties the curve model exists to guarantee (see pathCurve.ts):
// exact spacing, bounded turning, and no overlap. They are written against *measured* geometry
// rather than against internals, so they keep their meaning if the curvature terms are retuned.

/** Every position that takes a slot in the snake, in path order: days with chips interleaved. */
function slotPositions(days: Day[], options?: Parameters<typeof computePathPoints>[1]) {
  const { points, milestones } = computePathPoints(days, options)
  const chipsByDayIndex = new Map<number, number[]>()
  computeMilestones(days).forEach((m) => {
    const at = chipsByDayIndex.get(m.index) ?? []
    at.push(m.index)
    chipsByDayIndex.set(m.index, at)
  })
  const out: { x: number; y: number }[] = []
  let chipCursor = 0
  for (let i = 0; i < points.length; i++) {
    for (let c = 0; c < (chipsByDayIndex.get(i)?.length ?? 0); c++) out.push(milestones[chipCursor++])
    out.push(points[i])
  }
  return out
}

function chordLengths(positions: { x: number; y: number }[]): number[] {
  const out: number[] = []
  for (let i = 1; i < positions.length; i++) {
    out.push(Math.hypot(positions[i].x - positions[i - 1].x, positions[i].y - positions[i - 1].y))
  }
  return out
}

function turnAngles(positions: { x: number; y: number }[]): number[] {
  const out: number[] = []
  for (let i = 2; i < positions.length; i++) {
    const a = Math.atan2(positions[i - 1].y - positions[i - 2].y, positions[i - 1].x - positions[i - 2].x)
    const b = Math.atan2(positions[i].y - positions[i - 1].y, positions[i].x - positions[i - 1].x)
    let d = ((b - a) * 180) / Math.PI
    while (d > 180) d -= 360
    while (d <= -180) d += 360
    out.push(Math.abs(d))
  }
  return out
}

function segmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
) {
  const cross = (a: typeof a1, b: typeof a1, c: typeof a1) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const d1 = cross(b1, b2, a1)
  const d2 = cross(b1, b2, a2)
  const d3 = cross(a1, a2, b1)
  const d4 = cross(a1, a2, b2)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

const streak = (n: number, rate: number) => Array.from({ length: n }, (_, i) => makeDay(isoDate(i), rate, rate >= 1 ? 'gold' : 'red'))

/** The inputs most likely to fold the path back on itself, plus the ordinary ones. */
const HISTORIES: Record<string, Day[]> = {
  'perfect streak': streak(60, 1),
  'total collapse': streak(40, 0),
  'climb, collapse, recover': Array.from({ length: 90 }, (_, i) => makeDay(isoDate(i), i < 30 ? 1 : i < 55 ? 0 : 1)),
  'flip every 3 days': Array.from({ length: 90 }, (_, i) => makeDay(isoDate(i), Math.floor(i / 3) % 2 === 0 ? 1 : 0)),
  'flip every 2 days': Array.from({ length: 90 }, (_, i) => makeDay(isoDate(i), Math.floor(i / 2) % 2 === 0 ? 1 : 0)),
  'coin flip': Array.from({ length: 120 }, (_, i) => makeDay(isoDate(i), [1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0][i % 12])),
  'a full year': Array.from({ length: 365 }, (_, i) => makeDay(isoDate(i), i % 11 === 0 ? 0.3 : i % 5 === 0 ? 0.6 : 1)),
}

describe('the lane a reversal opens is wide enough for the path that comes back down it', () => {
  // This is the one piece of arithmetic the no-overlap guarantee rests on, so it is checked here
  // rather than only asserted in a comment: a 180° turn at the tightest allowed radius traces a
  // half-circle whose diameter is the gap between the stretch going up and the stretch coming back
  // down, and both of those weave into it from opposite sides.
  const weavePx = ZIGZAG_AMPLITUDE_PX + MAX_WOBBLE_PX

  it('holds at the shipped constants', () => {
    expect(reversalLaneWidthPx(MAX_TURN_PER_DAY_DEG) - 2 * weavePx).toBeGreaterThan(MIN_POINT_SEPARATION_PX)
  })

  it('still holds with every dev-panel slider pushed to its cap', () => {
    // Each cap is derived from the other two at their defaults, so each is checked that way. The
    // caps aim past MIN_POINT_SEPARATION_PX rather than at it (see LANE_SAFETY_MARGIN_PX), so even
    // the extreme of a slider leaves visible daylight instead of two circles exactly touching.
    expect(reversalLaneWidthPx(MAX_TURN_PER_DAY_CAP) - 2 * weavePx).toBeGreaterThan(MIN_POINT_SEPARATION_PX)
    for (const weave of [ZIGZAG_AMPLITUDE_CAP + MAX_WOBBLE_PX, ZIGZAG_AMPLITUDE_PX + MAX_WOBBLE_CAP]) {
      expect(reversalLaneWidthPx(MAX_TURN_PER_DAY_DEG) - 2 * weave).toBeGreaterThan(MIN_POINT_SEPARATION_PX)
    }
  })

  it('leaves the caps usefully above the defaults, not pinned to them', () => {
    // A cap that has crept below its own default would silently override the shipped value — which
    // is exactly what the old hardcoded 20°/day cap did to a 44°/day default.
    expect(MAX_TURN_PER_DAY_CAP).toBeGreaterThan(MAX_TURN_PER_DAY_DEG)
    expect(ZIGZAG_AMPLITUDE_CAP).toBeGreaterThan(ZIGZAG_AMPLITUDE_PX)
    expect(MAX_WOBBLE_CAP).toBeGreaterThan(MAX_WOBBLE_PX)
  })
})

/**
 * The widest chip the app can ever draw. Every footprint check below uses this one rather than each
 * milestone's real label: proving it for the widest chip that can exist proves it for every chip
 * that actually renders.
 */
const WIDEST_CHIP_BOX = widestMilestoneChipBox()

/**
 * The shipped week-box geometry, un-shrunk by any container — the same function PathView renders
 * from, not a copy of its arithmetic, so retuning the box can't leave these proofs passing against
 * numbers the app no longer uses. The width is far wider than any phone so the container-fit
 * shrinking never kicks in.
 */
const WEEK_BOX_GEOMETRY = computeWeekBoxGeometry(100_000, 1, DAY_CIRCLE_RADIUS * WEEK_BOX_SIZE_RATIO)
const WEEK_BOX_FOOTPRINT = WEEK_BOX_GEOMETRY.footprint

describe.each(Object.entries(HISTORIES))('path geometry: %s', (_name, days) => {
  const weekBoxGeometry = WEEK_BOX_GEOMETRY
  const layout = computePathPoints(days, { weekBoxGeometry })
  const slots = slotPositions(days, { weekBoxGeometry })

  it('puts every slot exactly one day-spacing of road from the last', () => {
    // Arc length is exact by construction; the chord across a bend is a hair shorter, and the
    // tightest bend the path can make (see MAX_TURN_PER_DAY_DEG) costs about a pixel of it.
    for (const chord of chordLengths(slots)) {
      expect(chord).toBeGreaterThan(DAY_SPACING_PX - 2)
      expect(chord).toBeLessThanOrEqual(DAY_SPACING_PX + 1e-6)
    }
  })

  it('never kinks: the turn between consecutive steps stays within the curvature budget', () => {
    // One step is DAY_SPACING_PX of road, so it cannot turn more than the per-day budget; two
    // consecutive steps meeting at a point can differ by at most twice that.
    for (const turn of turnAngles(slots)) expect(turn).toBeLessThanOrEqual(2 * MAX_TURN_PER_DAY_DEG)
  })

  it('never lets two non-adjacent circles overlap', () => {
    const { points } = layout
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 2; j < points.length; j++) {
        const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)
        expect(dist).toBeGreaterThanOrEqual(MIN_POINT_SEPARATION_PX)
      }
    }
  })

  it('never draws one stretch of road across another', () => {
    for (let i = 1; i < slots.length; i++) {
      for (let j = 1; j < i - 1; j++) {
        expect(segmentsIntersect(slots[i - 1], slots[i], slots[j - 1], slots[j])).toBe(false)
      }
    }
  })

  it('keeps every milestone chip one slot from its neighbours, not a crater', () => {
    for (const chip of layout.milestones) {
      const nearest = Math.min(...layout.points.map((p) => Math.hypot(p.x - chip.x, p.y - chip.y)))
      expect(nearest).toBeGreaterThan(DAY_SPACING_PX - 2)
      expect(nearest).toBeLessThanOrEqual(DAY_SPACING_PX + 1e-6)
    }
  })

  it('holds every weekly box at its offset, clear of the path and of other boxes', () => {
    for (const box of layout.weekBoxes) {
      for (const p of [...layout.points, ...layout.ghosts]) {
        expect(Math.hypot(p.x - box.x, p.y - box.y)).toBeGreaterThanOrEqual(weekBoxGeometry.offsetPx - 1e-6)
      }
    }
  })

  // The three checks below are about *footprints*, not centres — a chip is a ~160px-wide pill and a
  // weekly box a ~50px square, so two things can be a comfortable slot apart by their centres and
  // still visibly collide. That gap is exactly what let a chip sit on top of a day circle whenever
  // the road under it ran more than ~45° off vertical.

  it('never lets a milestone chip touch a day circle', () => {
    for (const chip of layout.milestones) {
      const scale = chipFitScale(chip.x, chip.y, WIDEST_CHIP_BOX, layout.points, DAY_CIRCLE_RADIUS, MILESTONE_CLEARANCE_PX)
      for (const p of layout.points) {
        const gap = distanceToChip(chip.x, chip.y, WIDEST_CHIP_BOX, scale, p.x, p.y)
        expect(gap).toBeGreaterThanOrEqual(DAY_CIRCLE_RADIUS + MILESTONE_CLEARANCE_PX - 1e-6)
      }
    }
  })

  it('keeps every chip readable while doing it', () => {
    // Shrinking is the last resort, for a chip that lands mid-hairpin where the turn budget is
    // already spent; straightening the road under the chip is what handles every ordinary case (see
    // CHIP_STRAIGHTEN_RESPONSE_PX). If this starts failing, the straightening has stopped working
    // and chips are silently getting smaller to cover for it.
    for (const chip of layout.milestones) {
      const scale = chipFitScale(chip.x, chip.y, WIDEST_CHIP_BOX, layout.points, DAY_CIRCLE_RADIUS, MILESTONE_CLEARANCE_PX)
      expect(scale).toBeGreaterThan(0.7)
    }
  })

  it('keeps the road near a chip close to vertical, so the chip rarely has to shrink at all', () => {
    const tilts = layout.milestones.map((m) => Math.abs(Math.abs(Math.abs(m.headingDeg) - 90) - 90))
    const median = tilts.sort((a, b) => a - b)[Math.floor(tilts.length / 2)] ?? 0
    expect(median).toBeLessThan(25)
  })

  it('never lets a weekly box overlap a chip or another box', () => {
    for (const box of layout.weekBoxes) {
      for (const chip of layout.milestones) {
        const intrusion = boxIntrusionPx(chip.x - box.x, chip.y - box.y, WEEK_BOX_FOOTPRINT, WIDEST_CHIP_BOX, WEEK_BOX_CLEARANCE_PX)
        expect(intrusion).toBeLessThanOrEqual(1e-6)
      }
      for (const other of layout.weekBoxes) {
        if (other === box) continue
        const intrusion = boxIntrusionPx(other.x - box.x, other.y - box.y, WEEK_BOX_FOOTPRINT, WEEK_BOX_FOOTPRINT, WEEK_BOX_CLEARANCE_PX)
        expect(intrusion).toBeLessThanOrEqual(1e-6)
      }
    }
  })
})

describe('30 days at 100% completion', () => {
  const days = streak(30, 1)
  const { points } = computePathPoints(days)

  it('climbs steadily upward (toward the goal)', () => {
    expect(points[29].y).toBeLessThan(points[0].y)
    for (let i = 1; i < points.length; i++) expect(points[i].y).toBeLessThan(points[i - 1].y)
  })

  it('stays in a narrow column instead of drifting off on a diagonal', () => {
    // A steady-state lean drifts sideways forever; a perfect streak aims at exactly vertical, so
    // the only sideways movement left is the decorative weave (see targetHeadingDeg).
    const xs = points.map((p) => p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(4 * (ZIGZAG_AMPLITUDE_PX + MAX_WOBBLE_PX))
  })

  it('weaves to both sides rather than always leaning one way', () => {
    const xs = points.map((p) => p.x)
    const mid = (Math.max(...xs) + Math.min(...xs)) / 2
    expect(xs.some((x) => x < mid - 5)).toBe(true)
    expect(xs.some((x) => x > mid + 5)).toBe(true)
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
    const { points } = computePathPoints(streak(10, 0))
    expect(Math.abs(points[points.length - 1].headingDeg)).toBeGreaterThan(90)
  })

  it('once tipped past horizontal, keeps moving down step by step (not back up)', () => {
    const { points } = computePathPoints(streak(25, 0))
    const tipIndex = points.findIndex((p) => Math.abs(p.headingDeg) > 90)
    expect(tipIndex).toBeGreaterThan(-1)
    for (let i = tipIndex + 1; i < points.length; i++) expect(points[i].y).toBeGreaterThan(points[i - 1].y)
    expect(points[points.length - 1].y).toBeGreaterThan(points[3].y)
  })
})

describe('a slump that reverses the path', () => {
  it('comes back down a lane beside the one it climbed, never through it', () => {
    const days = Array.from({ length: 70 }, (_, i) => makeDay(isoDate(i), i < 30 ? 1 : 0))
    const { points } = computePathPoints(days)
    // The last descending point should sit level with part of the ascent it retreated past...
    const descending = points[points.length - 1]
    const overlappingHeights = points.slice(0, 25).filter((p) => Math.abs(p.y - descending.y) < DAY_SPACING_PX)
    expect(overlappingHeights.length).toBeGreaterThan(0)
    // ...but well to the side of it, not on top of it.
    for (const p of overlappingHeights) {
      expect(Math.abs(p.x - descending.x)).toBeGreaterThan(MIN_POINT_SEPARATION_PX)
    }
  })
})

describe('a single missed day inside a good streak (heading)', () => {
  it('barely dents the heading, keeps the path climbing', () => {
    const withMiss = Array.from({ length: 15 }, (_, i) =>
      makeDay(isoDate(i), i === 10 ? 0 : 1, i === 10 ? 'red' : 'gold'),
    )
    const { points } = computePathPoints(withMiss)
    // Never tips past sideways, and keeps gaining height on every single day.
    for (const p of points) expect(Math.abs(p.headingDeg)).toBeLessThan(90)
    for (let i = 1; i < points.length; i++) expect(points[i].y).toBeLessThan(points[i - 1].y)
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

describe('computeMilestones', () => {
  it('places start, every 7th-day week, and month once history reaches them, but not half-year/year yet', () => {
    const days = Array.from({ length: 31 }, (_, i) => makeDay(isoDate(i), 1, 'gold'))
    const milestones = computeMilestones(days)

    expect(milestones.map((m) => m.kind)).toEqual(['start', 'week', 'week', 'week', 'week', 'month'])
    expect(milestones.find((m) => m.kind === 'start')!.index).toBe(0)
    const weeks = milestones.filter((m) => m.kind === 'week')
    expect(weeks.map((w) => w.index)).toEqual([7, 14, 21, 28])
    expect(weeks.map((w) => w.n)).toEqual([1, 2, 3, 4])
    expect(milestones.find((m) => m.kind === 'month')!.index).toBe(30)
  })

  it('includes half-year and year once the history spans that long', () => {
    const days = Array.from({ length: 366 }, (_, i) => makeDay(isoDate(i), 1, 'gold'))
    const milestones = computeMilestones(days)

    expect(milestones.map((m) => m.kind)).toContain('halfYear')
    expect(milestones.map((m) => m.kind)).toContain('year')
    expect(milestones.filter((m) => m.kind === 'week')).toHaveLength(52)
    expect(milestones.find((m) => m.kind === 'halfYear')!.index).toBe(182)
    expect(milestones.find((m) => m.kind === 'year')!.index).toBe(365)
    // Chronological order throughout (ties possible — e.g. week 26 and half-year both land on day 182).
    for (let i = 1; i < milestones.length; i++) {
      expect(milestones[i].index).toBeGreaterThanOrEqual(milestones[i - 1].index)
    }
  })

  it('is empty for no days', () => {
    expect(computeMilestones([])).toEqual([])
  })

  it('finds milestones correctly even when days are out of order', () => {
    const days = Array.from({ length: 10 }, (_, i) => makeDay(isoDate(i), 1, 'gold')).reverse()
    const milestones = computeMilestones(days)
    expect(milestones.map((m) => m.kind)).toEqual(['start', 'week'])
    expect(milestones.find((m) => m.kind === 'week')!.index).toBe(7)
    expect(milestones.find((m) => m.kind === 'week')!.n).toBe(1)
  })

  it('numbers repeating week milestones sequentially as the history grows', () => {
    const days = Array.from({ length: 22 }, (_, i) => makeDay(isoDate(i), 1, 'gold'))
    const weeks = computeMilestones(days).filter((m) => m.kind === 'week')
    expect(weeks.map((w) => ({ index: w.index, n: w.n }))).toEqual([
      { index: 7, n: 1 },
      { index: 14, n: 2 },
      { index: 21, n: 3 },
    ])
  })
})

describe('milestone chips take one slot, like a day', () => {
  it('sits on the path between the day before and the day after, not in a gap opened for it', () => {
    const days = streak(35, 1)
    const { points, milestones } = computePathPoints(days)
    const chip = milestones.find((m) => m.kind === 'month')!
    const distances = points.map((p) => Math.hypot(p.x - chip.x, p.y - chip.y)).sort((a, b) => a - b)
    // Its two neighbours are one slot away each; nothing is closer.
    expect(distances[0]).toBeGreaterThan(DAY_SPACING_PX - 2)
    expect(distances[1]).toBeLessThan(DAY_SPACING_PX + 1)
  })

  it('gives the path a point per day plus a point per milestone, and nothing else', () => {
    const days = streak(30, 1)
    const { points, milestones } = computePathPoints(days)
    expect(points).toHaveLength(days.length)
    expect(milestones.map((m) => m.kind)).toEqual(computeMilestones(days).map((m) => m.kind))
  })

  it('leans the road toward vertical where a chip sits, so the wide pill fits its slot', () => {
    // A chip is a horizontal pill: on a diagonal stretch its corners would reach into the
    // circles either side. The road straightens to meet it instead of the slot being widened.
    const days = Array.from({ length: 60 }, (_, i) => makeDay(isoDate(i), i % 4 === 0 ? 0.4 : 1))
    const { milestones } = computePathPoints(days)
    for (const chip of milestones) {
      const offVertical = Math.min(Math.abs(chip.headingDeg), 180 - Math.abs(chip.headingDeg))
      expect(offVertical).toBeLessThan(45)
    }
  })
})

describe('ghost circles past today', () => {
  it('continue the same curve at the same spacing', () => {
    const days = streak(20, 1)
    const { points, ghosts } = computePathPoints(days, { ghostDays: 3 })
    expect(ghosts).toHaveLength(3)
    const trail = [points[points.length - 1], ...ghosts]
    for (const chord of chordLengths(trail)) {
      expect(chord).toBeGreaterThan(DAY_SPACING_PX - 2)
      expect(chord).toBeLessThanOrEqual(DAY_SPACING_PX + 1e-6)
    }
  })

  it('places none when asked for none', () => {
    expect(computePathPoints(streak(10, 1), { ghostDays: 0 }).ghosts).toHaveLength(0)
  })
})

describe('the ghost road aims at the goal', () => {
  /**
   * The direction a kept day steers toward, read off a perfect streak rather than assumed, so these
   * tests carry no screen-coordinate convention of their own. Each ghost chord is then scored by its
   * dot product with it: +1 is facing the goal, -1 is facing straight away.
   */
  function goalDirection(): { x: number; y: number } {
    const { points } = computePathPoints(streak(30, 1))
    const a = points[points.length - 2]
    const b = points[points.length - 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    return { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
  }

  function facingPerGhostDay(days: Day[], ghostDays: number): number[] {
    const goal = goalDirection()
    const { points, ghosts } = computePathPoints(days, { ghostDays })
    const trail = [points[points.length - 1], ...ghosts]
    const facing: number[] = []
    for (let i = 1; i < trail.length; i++) {
      const dx = trail[i].x - trail[i - 1].x
      const dy = trail[i].y - trail[i - 1].y
      const len = Math.hypot(dx, dy)
      facing.push((dx * goal.x + dy * goal.y) / len)
    }
    return facing
  }

  it('swings a collapsed road around until it faces the goal again', () => {
    const facing = facingPerGhostDay(streak(40, 0), 8)

    // Today's road points at the anti-goal...
    expect(facing[0]).toBeLessThan(-0.8)
    // ...every ghost day turns further toward the goal than the one before...
    for (let i = 1; i < facing.length; i++) {
      expect(facing[i]).toBeGreaterThan(facing[i - 1])
    }
    // ...and the turn is complete inside the horizon, not somewhere past it.
    expect(facing[facing.length - 1]).toBeGreaterThan(0.95)
  })

  it('takes about eight kept days to come about from a full collapse', () => {
    const facing = facingPerGhostDay(streak(40, 0), 8)
    // The pace is the target slew chased at TREND_RESPONSE_PX, ~18°/day — so the road stops heading
    // away from the goal around day 5 and is square on it by day 8. If a constant changes and this
    // drifts, the ghost horizon (GHOST_FUTURE_DAYS) has to be re-derived against it.
    const firstFacingGoal = facing.findIndex((f) => f > 0)
    expect(firstFacingGoal).toBeGreaterThanOrEqual(3)
    expect(firstFacingGoal).toBeLessThanOrEqual(6)
  })

  it('never moves a real day, however far ahead it reaches', () => {
    // The curve integrates forward and the goal-ward targets are appended past the last slot, so
    // history cannot be rewritten by what is drawn after it. Worth pinning: a future that shifted
    // yesterday's circle would make the road a drawing rather than a record.
    const days = streak(40, 0)
    const withoutGhosts = computePathPoints(days, { ghostDays: 0 }).points
    const withGhosts = computePathPoints(days, { ghostDays: 8 }).points
    expect(withGhosts).toHaveLength(withoutGhosts.length)
    for (let i = 0; i < withoutGhosts.length; i++) {
      expect(withGhosts[i].x).toBeCloseTo(withoutGhosts[i].x, 10)
      expect(withGhosts[i].y).toBeCloseTo(withoutGhosts[i].y, 10)
      expect(withGhosts[i].headingDeg).toBeCloseTo(withoutGhosts[i].headingDeg, 10)
    }
  })

  it('leaves a road that already faces the goal pointing at it', () => {
    // Only the decorative wave moves it off vertical here, and that is worth ±28° at most.
    for (const f of facingPerGhostDay(streak(30, 1), 8)) {
      expect(f).toBeGreaterThan(0.85)
    }
  })
})

describe('weekly side boxes', () => {
  it('creates none when weekBoxGeometry is omitted', () => {
    expect(computePathPoints(streak(60, 1)).weekBoxes).toHaveLength(0)
  })

  it('creates two per week occurrence (early + mid-week), numbered sequentially', () => {
    const { weekBoxes } = computePathPoints(streak(60, 1), {
      weekBoxGeometry: { ...WEEK_BOX_GEOMETRY, offsetPx: 40, separationPx: 30 },
    })
    // Weeks 1-8 fit both boxes within the 60-day history; week 9 has only reached its early slot.
    expect(weekBoxes.map((b) => [b.n, b.slot])).toEqual([
      [1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [4, 1],
      [5, 0], [5, 1], [6, 0], [6, 1], [7, 0], [7, 1], [8, 0], [8, 1], [9, 0],
    ])
  })

  // Boxes land in the bays of the wave, which bulge to alternating sides, and the second box of a
  // week explicitly prefers the side the first didn't take — so a week's two boxes normally sit
  // either side of the road. "Normally", not "always": a box that cannot clear its first choices
  // takes the nearest spot that *is* clear, and not overlapping outranks alternating. These two
  // check the balance that actually results, rather than claiming a guarantee the placement no
  // longer makes.
  //
  // The geometry passed is the shipped one, not an invented one: a box's offset from the path has
  // to exceed the clearance it keeps from a day circle, or no bay is ever legal and every box falls
  // through to the fallback — which is what an earlier version of this test (offset 56 against
  // separation 70) was quietly asking for.
  it('puts most week pairs on opposite sides of the path', () => {
    const { weekBoxes } = computePathPoints(streak(60, 1), { weekBoxGeometry: WEEK_BOX_GEOMETRY })
    let alternating = 0
    for (let n = 1; n <= 8; n++) {
      const pair = weekBoxes.filter((b) => b.n === n)
      expect(pair).toHaveLength(2)
      const sideOf = (b: (typeof pair)[number]) => Math.sign(b.x - b.attachX)
      if (sideOf(pair[0]) !== sideOf(pair[1])) alternating++
    }
    expect(alternating).toBeGreaterThanOrEqual(7)
  })

  it('keeps the two sides of the path evenly used overall', () => {
    const { weekBoxes } = computePathPoints(streak(60, 1), { weekBoxGeometry: WEEK_BOX_GEOMETRY })
    const left = weekBoxes.filter((b) => b.x < b.attachX).length
    expect(Math.abs(left - (weekBoxes.length - left))).toBeLessThanOrEqual(2)
  })
})

function addDaysISOForTest(dateISO: string, n: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const ms = Date.UTC(y, m - 1, d) + n * 86_400_000
  const date = new Date(ms)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
