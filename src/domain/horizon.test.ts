import { describe, expect, it } from 'vitest'
import { upcomingMarkers } from './horizon'
import type { AppState, Day, Goal, TaskTemplate } from './models'

const isoDate = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10)

function makeTask(over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 't1', goalId: 'g1', title: 'Пробежка', frequency: 'daily', habitLevel: 0,
    habitExp: 0, targetDays: 21, currentTier: 'none', cycleStartDate: isoDate(0), ...over,
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
  const goal: Goal = { id: 'g1', title: 'Быть здоровым', antiGoalTitle: '', tasks, archived: false }
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

  it('measures a habit tier in days still to be put in, not days on the calendar', () => {
    // 10 kept days against a 21-day bronze leaves 11 to go, however long they took.
    const tier = upcomingMarkers(makeState(10, true, [makeTask()])).find((m) => m.kind === 'tier')
    expect(tier).toMatchObject({ label: 'Пробежка · Закреплено', daysAhead: 11 })
  })

  it('pushes a tier further away when days are missed, rather than merely not advancing', () => {
    const kept = upcomingMarkers(makeState(10, true, [makeTask()])).find((m) => m.kind === 'tier')!
    const missed = upcomingMarkers(makeState(10, false, [makeTask()])).find((m) => m.kind === 'tier')!
    expect(missed.daysAhead).toBe(21)
    expect(missed.daysAhead).toBeGreaterThan(kept.daysAhead)
  })

  it('ignores archived goals, which the road is no longer heading toward', () => {
    const state = makeState(10, true, [makeTask()])
    state.user.goals[0].archived = true
    expect(upcomingMarkers(state).some((m) => m.kind === 'tier')).toBe(false)
  })

  it('sorts nearest first, so the caller can just take the head of the list', () => {
    const markers = upcomingMarkers(makeState(10, true, [makeTask(), makeTask({ id: 't2', title: 'Вода', targetDays: 90 })]))
    for (let i = 1; i < markers.length; i++) {
      expect(markers[i].daysAhead).toBeGreaterThanOrEqual(markers[i - 1].daysAhead)
    }
  })
})
