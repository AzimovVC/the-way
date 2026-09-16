import { describe, expect, it } from 'vitest'
import { upcomingMarkers } from './horizon'
import { computeMilestones, type PathMilestone } from './pathEngine'
import type { AppState, Day, Goal, TaskTemplate } from './models'

const isoDate = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10)

function makeTask(over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 't1', goalId: 'g1', title: 'Пробежка', cycleStartDate: isoDate(0), ...over,
  }
}

function makeState(dayCount: number, done: boolean, tasks: TaskTemplate[]): AppState {
  const days: Day[] = Array.from({ length: dayCount }, (_, i) => ({
    id: isoDate(i),
    date: isoDate(i),
    tasks: tasks.map((t) => ({
      id: `${t.id}-${i}`,
      taskTemplateId: t.id,
      dayId: isoDate(i),
      isDone: done,
      skipped: false,
      completedAt: null,
    })),
    completionRate: done ? 1 : 0,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: done ? 'gold' : 'red',
    frozen: false,
  }))
  const goal: Goal = { id: 'g1', title: 'Быть здоровым', tasks, archived: false }
  return {
    user: { name: 'Тестер', timezone: 'UTC', notificationsEnabled: false, freezesRemaining: 2, goals: [goal] },
    days,
  } as AppState
}

describe('upcomingMarkers', () => {
  it('has nothing to point at before there is a path', () => {
    expect(upcomingMarkers(makeState(0, true, [makeTask()]))).toEqual([])
  })

  it('counts the next weekly mark from days elapsed, not from the calendar', () => {
    // Ten recorded days means nine have *elapsed* since the first, so week 1 is behind and week 2
    // lands at 14 elapsed days — five out. Counting the days rather than the rows is the whole
    // distinction: computeMilestones places its chips by elapsed time too.
    const week = upcomingMarkers(makeState(10, true, [makeTask()])).find((m) => m.label.startsWith('НЕДЕЛЯ'))
    expect(week).toMatchObject({ kind: 'calendar', label: 'НЕДЕЛЯ 2', daysAhead: 5 })
  })

  it('says which badge each calendar mark will become, and which has none', () => {
    // The horizon band draws the mark ahead as the very badge that will stand there once the road
    // reaches it, in grey. That only works while the marker carries the badge's identity — a label
    // string cannot be turned back into one, and a tier has no badge on the road at all.
    const markers = upcomingMarkers(makeState(10, true, [makeTask()]))
    expect(markers.find((m) => m.label === 'НЕДЕЛЯ 2')).toMatchObject({ milestone: 'week', milestoneN: 2 })
    expect(markers.find((m) => m.label === 'МЕСЯЦ')).toMatchObject({ milestone: 'month' })
    expect(markers.find((m) => m.kind === 'tier')!.milestone).toBeUndefined()
  })

  it('measures a habit in days still to be put in, not days on the calendar', () => {
    // 10 kept days puts «Ученик» — the 21-day rung — 11 days out, however long those ten took.
    const tier = upcomingMarkers(makeState(10, true, [makeTask()])).find((m) => m.kind === 'tier')
    expect(tier).toMatchObject({ label: 'Пробежка · Ученик', daysAhead: 11 })
  })

  it('pushes a level further away when days are missed, rather than merely not advancing', () => {
    // Both runs are walking to the same rung — «Новичок», at seven days — so the two numbers are
    // comparable: five kept days leave two to go, five missed ones leave the whole seven.
    const kept = upcomingMarkers(makeState(5, true, [makeTask()])).find((m) => m.kind === 'tier')!
    const missed = upcomingMarkers(makeState(5, false, [makeTask()])).find((m) => m.kind === 'tier')!
    expect(kept.daysAhead).toBe(2)
    expect(missed.daysAhead).toBe(7)
  })

  it('ignores archived goals, which the road is no longer heading toward', () => {
    const state = makeState(10, true, [makeTask()])
    state.user.goals[0].archived = true
    expect(upcomingMarkers(state).some((m) => m.kind === 'tier')).toBe(false)
  })

  it('sorts nearest first, so the caller can just take the head of the list', () => {
    const markers = upcomingMarkers(makeState(10, true, [makeTask(), makeTask({ id: 't2', title: 'Вода' })]))
    for (let i = 1; i < markers.length; i++) {
      expect(markers[i].daysAhead).toBeGreaterThanOrEqual(markers[i - 1].daysAhead)
    }
  })
})

describe('the slot a mark ahead stands in', () => {
  // The road draws a mark it has not reached yet as a grey badge standing in a ghost slot, and the
  // whole point of standing there rather than off to the side is that it is the *same* slot the
  // real chip will take: nothing shifts on the handover, the badge just goes gold in place.
  //
  // A chip is laid in the slot before the day that crosses its threshold, so slots run
  // day, day, chip, day... — which makes a slot number countable: the slot of day i is i plus the
  // chips laid before it, and the slot of the j-th chip (chips come sorted by the day they precede)
  // is its day index plus j.
  const slotOfDay = (chips: PathMilestone[], i: number) => i + chips.filter((c) => c.index <= i).length
  const slotOfChip = (chips: PathMilestone[], j: number) => chips[j].index + j

  it('is the slot the real chip will take, d days later', () => {
    const before = makeState(10, true, [makeTask()])
    const week = upcomingMarkers(before).find((m) => m.milestone === 'week')!

    // The badge stands in ghosts[slotsAhead - 1], which is that many slots past today.
    const todaySlot = slotOfDay(computeMilestones(before.days), before.days.length - 1)
    const badgeSlot = todaySlot + week.slotsAhead!

    const after = makeState(10 + week.daysAhead, true, [makeTask()])
    const chips = computeMilestones(after.days)
    const j = chips.findIndex((c) => c.kind === 'week' && c.n === week.milestoneN)
    expect(j).toBeGreaterThanOrEqual(0)
    expect(slotOfChip(chips, j)).toBe(badgeSlot)
  })

  it('counts the chips laid on the way, not just the days', () => {
    // The month mark is 21 days out from a ten-day history, and the road lays weeks 2, 3 and 4
    // before it gets there. Placing the badge by days alone would put it three slots short — which
    // is exactly what this test caught.
    const before = makeState(10, true, [makeTask()])
    const month = upcomingMarkers(before).find((m) => m.milestone === 'month')!
    expect(month.daysAhead).toBe(21)
    expect(month.slotsAhead).toBe(24)

    const todaySlot = slotOfDay(computeMilestones(before.days), before.days.length - 1)
    const chips = computeMilestones(makeState(10 + month.daysAhead, true, [makeTask()]).days)
    const j = chips.findIndex((c) => c.kind === 'month')
    expect(slotOfChip(chips, j)).toBe(todaySlot + month.slotsAhead!)
  })

  it('separates the half-year mark from week 26, which fall on the same day', () => {
    // 182 is 7 x 26. The road gives each its own slot, the week first, so the two badges must not
    // land on top of each other: same day, consecutive slots.
    const markers = upcomingMarkers(makeState(180, true, [makeTask()]))
    const week = markers.find((m) => m.milestone === 'week')!
    const half = markers.find((m) => m.milestone === 'halfYear')!
    expect(week.daysAhead).toBe(half.daysAhead)
    expect(half.slotsAhead).toBe(week.slotsAhead! + 1)

    const chips = computeMilestones(makeState(180 + half.daysAhead, true, [makeTask()]).days)
    const weekJ = chips.findIndex((c) => c.kind === 'week' && c.n === 26)
    const halfJ = chips.findIndex((c) => c.kind === 'halfYear')
    expect(slotOfChip(chips, halfJ)).toBe(slotOfChip(chips, weekJ) + 1)
  })
})
