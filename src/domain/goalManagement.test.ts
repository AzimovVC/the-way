import { describe, expect, it } from 'vitest'
import { addGoalMidPath, addTaskToGoal, archiveGoal, removeTaskFromGoal } from './goalManagement'
import type { AppState, Day, Goal, TaskTemplate } from './models'

/** 03:00 local is the day boundary, so noon is unambiguously "today" in any timezone the tests run in. */
const NOW = new Date('2026-01-03T12:00:00')
const TODAY = '2026-01-03'
const YESTERDAY = '2026-01-02'

function makeTask(id: string, over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id, goalId: 'g1', title: `Задача ${id}`, frequency: 'daily', habitLevel: 0,
    habitExp: 0, targetDays: 21, cycleStartDate: YESTERDAY, ...over,
  }
}

/** Two days, two tasks each: yesterday fully done, today with the first task done. */
function makeState(tasks: TaskTemplate[]): AppState {
  const day = (date: string, doneCount: number): Day => ({
    id: date,
    date,
    tasks: tasks.map((t, i) => ({
      id: `${t.id}-${date}`,
      taskTemplateId: t.id,
      dayId: date,
      isDone: i < doneCount,
      skipped: false,
      completedAt: null,
    })),
    completionRate: tasks.length === 0 ? 0 : doneCount / tasks.length,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: doneCount === tasks.length ? 'gold' : 'red',
    frozen: false,
    newGoalIds: [],
    taskChanges: [],
  })

  const goal: Goal = { id: 'g1', title: 'Быть здоровым', tasks, archived: false }
  return {
    user: {
      id: 'u1', name: 'Тестер', timezone: 'UTC', notificationsEnabled: false,
      freezesRemaining: 2, freezesRefilledMonth: '2026-01', goals: [goal],
    },
    days: [day(YESTERDAY, tasks.length), day(TODAY, 1)],
  }
}

const today = (state: AppState) => state.days.find((d) => d.date === TODAY)!
const yesterday = (state: AppState) => state.days.find((d) => d.date === YESTERDAY)!

describe('changes to the daily set', () => {
  it('marks today when a task is added, and names it for the day card', () => {
    const next = addTaskToGoal(makeState([makeTask('a'), makeTask('b')]), 'g1', { title: 'Растяжка', difficulty: 'medium', targetDays: 21 }, NOW)

    expect(today(next).taskChanges).toHaveLength(1)
    expect(today(next).taskChanges?.[0]).toMatchObject({ kind: 'added', title: 'Растяжка', goalId: 'g1' })
    expect(yesterday(next).taskChanges ?? []).toHaveLength(0)
  })

  it('marks today when a task is dropped, and keeps its name after the template is gone', () => {
    const next = removeTaskFromGoal(makeState([makeTask('a', { title: 'Бег' }), makeTask('b')]), 'g1', 'a', NOW)

    expect(next.user.goals[0].tasks.map((t) => t.id)).toEqual(['b'])
    expect(today(next).taskChanges?.[0]).toMatchObject({ kind: 'removed', title: 'Бег' })
  })

  it('leaves earlier days with the task they were actually judged on', () => {
    const before = makeState([makeTask('a'), makeTask('b')])
    const next = removeTaskFromGoal(before, 'g1', 'b', NOW)

    expect(yesterday(next).tasks).toHaveLength(2)
    expect(yesterday(next).completionRate).toBe(yesterday(before).completionRate)
    expect(today(next).tasks).toHaveLength(1)
  })

  it('re-counts today against what it now asks for — one of two done becomes one of one', () => {
    // 'a' is the done task; dropping the undone 'b' leaves today complete rather than half-done.
    const next = removeTaskFromGoal(makeState([makeTask('a'), makeTask('b')]), 'g1', 'b', NOW)

    expect(today(next).completionRate).toBe(1)
  })

  it('refuses to drop the goal\u2019s last task — an empty goal asks nothing, and archiveGoal is the way out', () => {
    const before = makeState([makeTask('a')])
    const next = removeTaskFromGoal(before, 'g1', 'a', NOW)

    expect(next).toBe(before)
  })

  it('archives a goal as a removal per task, so the road says what left it', () => {
    const next = archiveGoal(makeState([makeTask('a'), makeTask('b')]), 'g1', NOW)

    expect(next.user.goals[0].archived).toBe(true)
    expect(today(next).taskChanges).toHaveLength(2)
    expect(today(next).taskChanges?.every((c) => c.kind === 'removed')).toBe(true)
    expect(today(next).tasks).toHaveLength(0)
    expect(yesterday(next).tasks).toHaveLength(2)
  })

  it('does not stamp an already archived goal twice', () => {
    const once = archiveGoal(makeState([makeTask('a')]), 'g1', NOW)
    expect(archiveGoal(once, 'g1', NOW)).toBe(once)
  })

  it('lets a new goal stand on its flag alone, without one mark per starting task', () => {
    const next = addGoalMidPath(
      makeState([makeTask('a')]),
      { title: 'Французский', tasks: [{ title: 'Урок', difficulty: 'simple', targetDays: 14 }, { title: 'Слова', difficulty: 'simple', targetDays: 14 }] },
      NOW,
    )

    expect(today(next).newGoalIds).toHaveLength(1)
    expect(today(next).taskChanges ?? []).toHaveLength(0)
    expect(today(next).tasks).toHaveLength(3)
  })
})
