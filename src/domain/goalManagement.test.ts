import { describe, expect, it } from 'vitest'
import { addGoalMidPath, addTaskToGoal, archiveGoal, editTaskInGoal, removeTaskFromGoal } from './goalManagement'
import type { AppState, Day, Goal, TaskTemplate } from './models'
import { toggleDayTaskMark } from './dayLifecycle'
import { EVERY_DAY } from './schedule'

/** 03:00 local is the day boundary, so noon is unambiguously "today" in any timezone the tests run in. */
const NOW = new Date('2026-01-03T12:00:00')
const TODAY = '2026-01-03'
const YESTERDAY = '2026-01-02'

function makeTask(id: string, over: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id, goalId: 'g1', title: `Задача ${id}`, cycleStartDate: YESTERDAY, ...over,
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
  it('keeps the guess the habit was made with', () => {
    const next = addTaskToGoal(makeState([makeTask('a')]), 'g1', { id: 't-растяжка', title: 'Растяжка', predictedDays: 30 }, NOW)
    expect(next.user.goals[0].tasks.at(-1)?.predictedDays).toBe(30)
  })

  it('marks today when a task is added, and names it for the day card', () => {
    const next = addTaskToGoal(makeState([makeTask('a'), makeTask('b')]), 'g1', { id: 't-растяжка', title: 'Растяжка' }, NOW)

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
      { id: 'g-фр', title: 'Французский', tasks: [{ id: 't-урок', title: 'Урок' }, { id: 't-слова', title: 'Слова' }] },
      NOW,
    )

    expect(today(next).newGoalIds).toHaveLength(1)
    expect(today(next).taskChanges ?? []).toHaveLength(0)
    expect(today(next).tasks).toHaveLength(3)
  })
})

describe('editing a task that is already running', () => {
  const edit = (over: Partial<{ title: string; weekdays: number[] }> = {}) => ({
    title: 'Задача a', weekdays: [0, 1, 2, 3, 4, 5, 6], ...over,
  })

  it('leaves the guess alone', () => {
    // The editor does not offer the question for a running habit, and this is the backstop: a
    // guess revised halfway is not a guess, and the edit sheet must not be able to rewrite one.
    const state = makeState([makeTask('a', { predictedDays: 14 })])
    const next = editTaskInGoal(state, 'g1', 'a', edit({ title: 'Бег' }), NOW)
    expect(next.user.goals[0].tasks[0].predictedDays).toBe(14)
  })

  it('keeps the day count when the name changes, and leaves no mark on the road', () => {
    const state = makeState([makeTask('a'), makeTask('b')])
    const next = editTaskInGoal(state, 'g1', 'a', edit({ title: 'Пробежка утром' }), NOW)

    const task = next.user.goals[0].tasks[0]
    expect(task.title).toBe('Пробежка утром')
    // The one number a rename must never touch: it is where every rank is counted from.
    expect(task.cycleStartDate).toBe(state.user.goals[0].tasks[0].cycleStartDate)
    expect(today(next).taskChanges ?? []).toHaveLength(0)
  })

  it('marks today when the schedule changes, and leaves earlier days alone', () => {
    const next = editTaskInGoal(makeState([makeTask('a'), makeTask('b')]), 'g1', 'a', edit({ weekdays: [0, 2, 4] }), NOW)

    expect(today(next).taskChanges?.[0]).toMatchObject({ kind: 'rescheduled', taskId: 'a', goalId: 'g1' })
    expect(yesterday(next).taskChanges ?? []).toHaveLength(0)
    // 2026-01-03 is a Saturday — index 5, and no longer one of the task's days.
    expect(yesterday(next).tasks.some((t) => t.taskTemplateId === 'a')).toBe(true)
  })

  it('keeps a mark already made when today stops being one of the task\'s days', () => {
    // Task 'a' is the one done today in makeState.
    const next = editTaskInGoal(makeState([makeTask('a'), makeTask('b')]), 'g1', 'a', edit({ weekdays: [0, 2, 4] }), NOW)

    const mark = today(next).tasks.find((t) => t.taskTemplateId === 'a')
    expect(mark?.isDone).toBe(true)
  })

})

describe('привычка, которую бросают', () => {
  /**
   * Правило одно и держать его нужно вечно: `quit` — это слово, а не вторые правила. День
   * спрашивает такую привычку, считает и проходит ровно так же, и ни одна арифметика её не
   * отличает. Иначе на одной дороге завелись бы два разных золотых дня.
   */
  it('считается в дне ровно как обычная', () => {
    const plain = makeState([makeTask('t1'), makeTask('t2')])
    const quitting = makeState([makeTask('t1', { quit: true }), makeTask('t2')])

    expect(today(quitting).completionRate).toBe(today(plain).completionRate)
    expect(toggleMark(quitting)).toEqual(toggleMark(plain))
  })

  function toggleMark(state: AppState): number[] {
    const next = toggleDayTaskMark(state, TODAY, 't2', NOW)
    return next.days.map((d) => d.completionRate)
  }

  it('заводится каждодневной и без часа', () => {
    const state = makeState([makeTask('t1')])
    const next = addTaskToGoal(
      state,
      'g1',
      { id: 't9', title: 'Не курить', quit: true, weekdays: EVERY_DAY },
      NOW,
    )
    const task = next.user.goals[0].tasks.find((t) => t.id === 't9')!
    expect(task.quit).toBe(true)
    expect(task.partOfDay).toBeUndefined()
    expect(today(next).tasks.some((t) => t.taskTemplateId === 't9')).toBe(true)
  })

  it('переключается на существующей привычке и метки на дороге не оставляет', () => {
    const state = makeState([makeTask('t1'), makeTask('t2')])
    const next = editTaskInGoal(
      state,
      'g1',
      't1',
      { title: 'Не курить', weekdays: EVERY_DAY, quit: true },
      NOW,
    )
    expect(next.user.goals[0].tasks[0].quit).toBe(true)
    // Планка не двинулась: день спрашивает столько же строк, сколько спрашивал.
    expect(today(next).taskChanges).toEqual([])
  })
})

describe('цель счётчика', () => {
  it('опустившись до набранного, закрывает сегодняшнюю строку', () => {
    const state = makeState([makeTask('t1', { target: { count: 8, unit: 'стаканов' } }), makeTask('t2')])
    // Четыре стакана из восьми: строка сегодня открыта, и это правильно.
    state.days[1].tasks[0] = { ...state.days[1].tasks[0], isDone: false, progress: 4 }
    state.days[1].completionRate = 0

    const next = editTaskInGoal(
      state,
      'g1',
      't1',
      { title: 'Задача t1', weekdays: EVERY_DAY, target: { count: 3, unit: 'стаканов' } },
      NOW,
    )
    expect(today(next).tasks[0].isDone).toBe(true)
    expect(today(next).completionRate).toBe(0.5)
    // Планка дня не двинулась: строк в нём столько же, и объяснять на дороге нечего.
    expect(today(next).taskChanges).toEqual([])
  })

  it('поднявшись, уже закрытую строку обратно не открывает', () => {
    const state = makeState([makeTask('t1', { target: { count: 3, unit: '' } }), makeTask('t2')])
    state.days[1].tasks[0] = { ...state.days[1].tasks[0], isDone: true, progress: 3 }

    const next = editTaskInGoal(
      state,
      'g1',
      't1',
      { title: 'Задача t1', weekdays: EVERY_DAY, target: { count: 9, unit: '' } },
      NOW,
    )
    // Отметка — запись о том, что случилось, а не правило, которое всё ещё в силе.
    expect(today(next).tasks[0].isDone).toBe(true)
  })

  it('вчерашний день новую цель не перечитывает', () => {
    const state = makeState([makeTask('t1', { target: { count: 8, unit: '' } }), makeTask('t2')])
    state.days[0].tasks[0] = { ...state.days[0].tasks[0], isDone: false, progress: 5 }

    const next = editTaskInGoal(
      state,
      'g1',
      't1',
      { title: 'Задача t1', weekdays: EVERY_DAY, target: { count: 2, unit: '' } },
      NOW,
    )
    expect(yesterday(next).tasks[0].isDone).toBe(false)
  })
})
