import { describe, expect, it } from 'vitest'
import type { AppState, DayTask, Goal, TaskTemplate } from './models'
import type { PartOfDay } from './partOfDay'
import { canMoveTask, groupDayTasks, moveTask, nextOrder, orderedTemplates } from './taskOrder'

function task(id: string, extra: Partial<TaskTemplate> = {}): TaskTemplate {
  return { id, goalId: 'g1', title: id, cycleStartDate: '2026-01-01', ...extra }
}

const goalWith = (id: string, tasks: TaskTemplate[]): Goal => ({ id, title: id, tasks, archived: false })

function stateWith(goals: Goal[]): AppState {
  return {
    user: {
      id: 'u1', name: 'Т', timezone: 'UTC', notificationsEnabled: false,
      freezesRemaining: 0, freezesRefilledMonth: '2026-01', goals,
    },
    days: [],
  }
}

const idsOf = (goals: Goal[]) => orderedTemplates(goals).map((t) => t.id)

describe('orderedTemplates', () => {
  it('puts the parts of the day in the order the day happens in', () => {
    const goals = [
      goalWith('g1', [
        task('вечер', { partOfDay: 'evening', order: 0 }),
        task('утро', { partOfDay: 'morning', order: 1 }),
        task('день', { partOfDay: 'day', order: 2 }),
      ]),
    ]
    expect(idsOf(goals)).toEqual(['утро', 'день', 'вечер'])
  })

  it('leaves habits with no time at the end — that is «неважно», not «поздно»', () => {
    const goals = [goalWith('g1', [task('когда-нибудь', { order: 0 }), task('утро', { partOfDay: 'morning', order: 1 })])]
    expect(idsOf(goals)).toEqual(['утро', 'когда-нибудь'])
  })

  it('keeps habits from before ordering existed exactly where they stood', () => {
    // Ни одного `order` — список не должен схлопнуться в произвольную кучу нулей.
    const goals = [goalWith('g1', [task('первая'), task('вторая')]), goalWith('g2', [task('третья')])]
    expect(idsOf(goals)).toEqual(['первая', 'вторая', 'третья'])
  })

  it('runs across goals, because the list it orders is the day, and the day is not split by goal', () => {
    const goals = [goalWith('g1', [task('a', { order: 2 })]), goalWith('g2', [task('b', { order: 0 })])]
    expect(idsOf(goals)).toEqual(['b', 'a'])
  })
})

describe('moveTask', () => {
  it('swaps a habit with its neighbour', () => {
    const state = stateWith([goalWith('g1', [task('a', { order: 0 }), task('b', { order: 1 })])])
    expect(idsOf(moveTask(state, 'b', -1).user.goals)).toEqual(['b', 'a'])
  })

  it('moves across goals when the goals interleave in the day', () => {
    const state = stateWith([goalWith('g1', [task('a', { order: 0 })]), goalWith('g2', [task('b', { order: 1 })])])
    expect(idsOf(moveTask(state, 'b', -1).user.goals)).toEqual(['b', 'a'])
  })

  it('never moves a habit out of its part of the day — «выше вечера» means nothing', () => {
    const goals = [
      goalWith('g1', [task('утро', { partOfDay: 'morning', order: 0 }), task('вечер', { partOfDay: 'evening', order: 1 })]),
    ]
    expect(canMoveTask(goals, 'вечер', -1)).toBe(false)
    expect(moveTask(stateWith(goals), 'вечер', -1).user.goals).toBe(goals)
  })

  it('has no arrow at either end', () => {
    const goals = [goalWith('g1', [task('a', { order: 0 }), task('b', { order: 1 })])]
    expect(canMoveTask(goals, 'a', -1)).toBe(false)
    expect(canMoveTask(goals, 'b', 1)).toBe(false)
  })

  it('numbers every habit, not just the two that moved', () => {
    // Пока часть списка живёт на запасном ключе, а часть на настоящем, рядом стоят две шкалы.
    const state = stateWith([goalWith('g1', [task('a'), task('b'), task('c')])])
    const moved = moveTask(state, 'c', -1)
    expect(moved.user.goals[0].tasks.map((t) => t.order)).toEqual([0, 2, 1])
    expect(idsOf(moved.user.goals)).toEqual(['a', 'c', 'b'])
  })

  it('leaves the road alone: reordering changes nothing a day is judged by', () => {
    const state = stateWith([goalWith('g1', [task('a', { order: 0 }), task('b', { order: 1 })])])
    const moved = moveTask(state, 'b', -1)
    expect(moved.days).toBe(state.days)
    expect(moved.user.goals[0].tasks.every((t) => t.cycleStartDate === '2026-01-01')).toBe(true)
  })
})

describe('nextOrder', () => {
  it('sends a new habit to the end of the list', () => {
    expect(nextOrder([goalWith('g1', [task('a', { order: 0 }), task('b', { order: 4 })])])).toBe(5)
  })

  it('starts at zero when there is nothing yet', () => {
    expect(nextOrder([])).toBe(0)
  })
})

describe('groupDayTasks', () => {
  const dayTask = (id: string, templateId: string): DayTask => ({
    id, taskTemplateId: templateId, dayId: 'd1', isDone: false, skipped: false, completedAt: null,
  })

  function templates(entries: [string, PartOfDay | undefined, number][]) {
    return new Map(entries.map(([id, partOfDay, order]) => [id, task(id, { partOfDay, order })]))
  }

  it('splits the day into its parts, in order', () => {
    const map = templates([['t1', 'evening', 0], ['t2', 'morning', 1]])
    const groups = groupDayTasks([dayTask('d1', 't1'), dayTask('d2', 't2')], map)
    expect(groups.map((g) => g.part)).toEqual(['morning', 'evening'])
  })

  it('returns no group for a part of the day nothing was planned in', () => {
    const map = templates([['t1', 'morning', 0]])
    const groups = groupDayTasks([dayTask('d1', 't1')], map)
    expect(groups).toHaveLength(1)
  })

  it('keeps a day with no times at all as one plain list', () => {
    const map = templates([['t1', undefined, 1], ['t2', undefined, 0]])
    const groups = groupDayTasks([dayTask('d1', 't1'), dayTask('d2', 't2')], map)
    expect(groups).toHaveLength(1)
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['d2', 'd1'])
  })

  it('does not lose a mark whose template is gone', () => {
    const groups = groupDayTasks([dayTask('d1', 'исчезнувшая')], new Map())
    expect(groups.flatMap((g) => g.tasks)).toHaveLength(1)
  })
})
