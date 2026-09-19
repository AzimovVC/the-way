import { describe, expect, it } from 'vitest'
import type { AppState, DayTask, Goal, TaskTemplate } from './models'
import type { PartOfDay } from './partOfDay'
import { groupDayTasks, groupTemplates, nextOrder, orderedTemplates, reorderTasks } from './taskOrder'

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

describe('reorderTasks', () => {
  it('puts the named habits in the order given', () => {
    const state = stateWith([goalWith('g1', [task('a', { order: 0 }), task('b', { order: 1 }), task('c', { order: 2 })])])
    expect(idsOf(reorderTasks(state, ['c', 'a', 'b']).user.goals)).toEqual(['c', 'a', 'b'])
  })

  it('leaves habits that were not listed exactly where they stood', () => {
    // Это и есть случай дня: «Пробежка» сегодня не спрашивается, её строки в карточке нет, и
    // порядок приходит только по тем двум, что видны.
    const state = stateWith([
      goalWith('g1', [task('пробежка', { order: 0 }), task('читать', { order: 1 }), task('вода', { order: 2 })]),
    ])
    expect(idsOf(reorderTasks(state, ['вода', 'читать']).user.goals)).toEqual(['пробежка', 'вода', 'читать'])
  })

  it('fills only the places those habits already occupied', () => {
    const state = stateWith([
      goalWith('g1', [task('a', { order: 0 }), task('между', { order: 1 }), task('b', { order: 2 })]),
    ])
    expect(idsOf(reorderTasks(state, ['b', 'a']).user.goals)).toEqual(['b', 'между', 'a'])
  })

  it('reorders across goals when the goals interleave in the day', () => {
    const state = stateWith([goalWith('g1', [task('a', { order: 0 })]), goalWith('g2', [task('b', { order: 1 })])])
    expect(idsOf(reorderTasks(state, ['b', 'a']).user.goals)).toEqual(['b', 'a'])
  })

  it('does nothing when the order did not actually change', () => {
    const state = stateWith([goalWith('g1', [task('a', { order: 0 }), task('b', { order: 1 })])])
    expect(reorderTasks(state, ['a', 'b'])).toBe(state)
  })

  it('ignores ids it does not know', () => {
    const state = stateWith([goalWith('g1', [task('a', { order: 0 }), task('b', { order: 1 })])])
    expect(idsOf(reorderTasks(state, ['b', 'исчезнувшая', 'a']).user.goals)).toEqual(['b', 'a'])
  })

  it('numbers every habit, not just the ones that moved', () => {
    // Пока часть списка живёт на запасном ключе, а часть на настоящем, рядом стоят две шкалы.
    const state = stateWith([goalWith('g1', [task('a'), task('b'), task('c')])])
    const moved = reorderTasks(state, ['a', 'c', 'b'])
    expect(moved.user.goals[0].tasks.map((t: TaskTemplate) => t.order)).toEqual([0, 2, 1])
  })

  it('leaves the road alone: reordering changes nothing a day is judged by', () => {
    const state = stateWith([goalWith('g1', [task('a', { order: 0 }), task('b', { order: 1 })])])
    const moved = reorderTasks(state, ['b', 'a'])
    expect(moved.days).toBe(state.days)
    expect(moved.user.goals[0].tasks.every((t: TaskTemplate) => t.cycleStartDate === '2026-01-01')).toBe(true)
  })
})

describe('nextOrder', () => {
  it('sends a new habit to the end of the list', () => {
    expect(nextOrder([goalWith('g1', [task('a', { order: 0 }), task('b', { order: 1 })])])).toBe(2)
  })

  it('does not collide with habits that have no number yet', () => {
    // Всё, что заведено до порядка, стоит на натуральной позиции — 0 и 1. Новая привычка,
    // получившая 0, встала бы на одно место с первой, и кто выше решал бы порядок в массиве.
    const goals = [goalWith('g1', [task('старая-1'), task('старая-2')])]
    const state = stateWith([...goals])
    state.user.goals[0].tasks.push(task('новая', { order: nextOrder(goals) }))
    expect(idsOf(state.user.goals)).toEqual(['старая-1', 'старая-2', 'новая'])
  })

  it('starts at zero when there is nothing yet', () => {
    expect(nextOrder([])).toBe(0)
  })
})

describe('groupDayTasks', () => {
  const dayTask = (templateId: string): DayTask => ({
    taskTemplateId: templateId, dayId: 'd1', isDone: false, skipped: false, completedAt: null,
  })

  function templates(entries: [string, PartOfDay | undefined, number][]) {
    return new Map(entries.map(([id, partOfDay, order]) => [id, task(id, { partOfDay, order })]))
  }

  it('splits the day into its parts, in order', () => {
    const map = templates([['t1', 'evening', 0], ['t2', 'morning', 1]])
    const groups = groupDayTasks([dayTask('t1'), dayTask('t2')], map)
    expect(groups.map((g) => g.part)).toEqual(['morning', 'evening'])
  })

  it('returns no group for a part of the day nothing was planned in', () => {
    const map = templates([['t1', 'morning', 0]])
    const groups = groupDayTasks([dayTask('t1')], map)
    expect(groups).toHaveLength(1)
  })

  it('keeps a day with no times at all as one plain list', () => {
    const map = templates([['t1', undefined, 1], ['t2', undefined, 0]])
    const groups = groupDayTasks([dayTask('t1'), dayTask('t2')], map)
    expect(groups).toHaveLength(1)
    expect(groups[0].tasks.map((t) => t.taskTemplateId)).toEqual(['t2', 't1'])
  })

  it('sinks what is done to the bottom of its own segment', () => {
    const map = templates([['t1', 'morning', 0], ['t2', 'morning', 1], ['t3', 'evening', 2]])
    const done = { ...dayTask('t1'), isDone: true }
    const groups = groupDayTasks([done, dayTask('t2'), dayTask('t3')], map)
    expect(groups[0].tasks.map((t) => t.taskTemplateId)).toEqual(['t2', 't1'])
    // Вечер остаётся вечером: сделанное утро под него не уезжает.
    expect(groups[1].tasks.map((t) => t.taskTemplateId)).toEqual(['t3'])
  })

  it('does not lose a mark whose template is gone', () => {
    const groups = groupDayTasks([dayTask('исчезнувшая')], new Map())
    expect(groups.flatMap((g) => g.tasks)).toHaveLength(1)
  })
})

describe('groupTemplates', () => {
  it('splits the habits into the same segments the day card draws', () => {
    const goals = [
      goalWith('g1', [task('зарядка', { partOfDay: 'morning', order: 0 }), task('ужин', { partOfDay: 'evening', order: 1 })]),
      goalWith('g2', [task('душ', { partOfDay: 'morning', order: 2 })]),
    ]
    expect(groupTemplates(goals).map((g) => [g.part, g.tasks.map((t) => t.id)])).toEqual([
      ['morning', ['зарядка', 'душ']],
      ['evening', ['ужин']],
    ])
  })

  it('gives an empty segment no group at all', () => {
    const goals = [goalWith('g1', [task('днём', { partOfDay: 'day', order: 0 })])]
    expect(groupTemplates(goals).map((g) => g.part)).toEqual(['day'])
  })

  it('keeps habits with no time in one group of their own, at the end', () => {
    const goals = [goalWith('g1', [task('когда-нибудь', { order: 0 }), task('утро', { partOfDay: 'morning', order: 1 })])]
    expect(groupTemplates(goals).map((g) => [g.part, g.tasks.map((t) => t.id)])).toEqual([
      ['morning', ['утро']],
      [undefined, ['когда-нибудь']],
    ])
  })
})
