import { describe, expect, it } from 'vitest'
import { applyAction, type AppAction } from './actions'
import { addChore } from './chores'
import { ensureTodayDay } from './dayLifecycle'
import type { AppState, Goal, TaskTemplate } from './models'

const NOW = new Date('2026-01-14T09:30:00')
const TODAY = '2026-01-14'

function task(id: string, over: Partial<TaskTemplate> = {}): TaskTemplate {
  return { id, goalId: 'g1', title: `Задача ${id}`, cycleStartDate: '2025-01-01', ...over }
}

function freshState(tasks: TaskTemplate[] = [task('t1'), task('t2')]): AppState {
  const goal: Goal = { id: 'g1', title: 'Быть здоровым', tasks, archived: false }
  const empty: AppState = {
    user: {
      id: 'u1', name: 'Тестер', timezone: 'UTC', notificationsEnabled: false,
      freezesRemaining: 1, freezesRefilledMonth: '2026-01', goals: [goal],
    },
    days: [],
  }
  return ensureTodayDay(empty, NOW)
}

/** Ключи, выданные `crypto.randomUUID` по дороге: два прогона получают разные, и это не разница. */
const withoutMintedIds = (state: AppState): unknown =>
  JSON.parse(JSON.stringify(state).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'id'))

const markIdOf = (state: AppState, templateId: string) =>
  state.days.find((d) => d.id === TODAY)!.tasks.find((t) => t.taskTemplateId === templateId)!.id

describe('applyAction', () => {
  it('puts the mark down and recomputes the day under it', () => {
    const state = freshState()
    const next = applyAction(state, { kind: 'toggleTask', dayId: TODAY, dayTaskId: markIdOf(state, 't1') }, NOW)
    const day = next.days.find((d) => d.id === TODAY)!

    expect(day.completionRate).toBe(0.5)
    expect(day.tasks.find((t) => t.taskTemplateId === 't1')!.completedLocal).toBe('09:30')
    // Часы записываются и в ISO, и такими, какими их видел человек: зону, которой не записали,
    // потом не восстановить.
    expect(day.tasks.find((t) => t.taskTemplateId === 't1')!.completedAt).toBe(NOW.toISOString())
  })

  it('takes the mark back, and the hour with it', () => {
    const state = freshState()
    const markId = markIdOf(state, 't1')
    const on = applyAction(state, { kind: 'toggleTask', dayId: TODAY, dayTaskId: markId }, NOW)
    const off = applyAction(on, { kind: 'toggleTask', dayId: TODAY, dayTaskId: markId }, NOW)

    const mark = off.days.find((d) => d.id === TODAY)!.tasks.find((t) => t.id === markId)!
    expect(mark.isDone).toBe(false)
    expect(mark.completedAt).toBeNull()
    expect(mark.completedLocal).toBeUndefined()
  })

  it('leaves the chores where they are when a habit is marked', () => {
    // Дела лежат рядом с днями, а не внутри них. Состояние, собранное заново из пользователя и
    // дней, теряло их молча — и человек, отметивший привычку, лишался списка, который сам вёл.
    const state = addChore(freshState(), { id: 'ch-1', title: 'Забрать посылку', date: TODAY })
    const next = applyAction(state, { kind: 'toggleTask', dayId: TODAY, dayTaskId: markIdOf(state, 't1') }, NOW)

    expect(next.chores).toEqual(state.chores)
  })

  it('does nothing to a mark that is not there', () => {
    const state = freshState()
    expect(applyAction(state, { kind: 'toggleTask', dayId: TODAY, dayTaskId: 'нет такой' }, NOW)).toBe(state)
    expect(applyAction(state, { kind: 'toggleTask', dayId: '1999-01-01', dayTaskId: 'x' }, NOW)).toBe(state)
  })

  it('replays the same list of actions into the same state', () => {
    // То, ради чего действие вообще стало значением: список воспроизводит историю. Время поэтому
    // приходит аргументом — читай `applyAction` часы сам, повтор давал бы другую запись.
    //
    // Ключ новой вещи — вторая половина того же правила, и теперь он приезжает вместе с действием.
    // Пока он рождался внутри `addChore`, два устройства делали из одной операции **два разных
    // дела** с одинаковым названием, а повтор списка давал другую историю. Здесь это проверяется
    // прямо: дело сверяется целиком, вместе со своим ключом.
    const script: AppAction[] = [
      { kind: 'addChore', input: { id: 'ch-банк', title: 'Позвонить в банк', date: TODAY } },
      { kind: 'toggleTask', dayId: TODAY, dayTaskId: markIdOf(freshState(), 't1') },
      { kind: 'updateProfile', patch: { name: 'Серёжа' } },
      { kind: 'reorderTasks', taskIds: ['t2', 't1'] },
    ]
    const run = () => script.reduce((acc, action) => applyAction(acc, action, NOW), freshState())

    expect(run().chores).toEqual(run().chores)
    expect(run().chores?.[0].id).toBe('ch-банк')
    // Строки дня пока чеканятся внутри: `DayTask.id` — случайный, хотя опознают такую строку
    // везде по паре «день + привычка». Это следующая правка, и до неё сравнение их прощает.
    expect(withoutMintedIds(run())).toEqual(withoutMintedIds(run()))
  })

  it('делает из одной операции одну вещь, а не по вещи на устройство', () => {
    // Ровно то, ради чего ключ переехал в действие. Два независимых состояния — это два телефона
    // одного человека, получивших одну и ту же операцию. Пока ключ чеканился внутри правила, у
    // них получались две разные привычки с одинаковым названием, и слить их потом было нечем:
    // одинаковый заголовок — не тот признак, по которому можно склеивать чужие записи.
    const operation: AppAction = {
      kind: 'addGoal',
      input: { id: 'g-французский', title: 'Французский', tasks: [{ id: 't-слова', title: '20 слов' }] },
    }

    const phone = applyAction(freshState(), operation, NOW)
    const laptop = applyAction(freshState(), operation, NOW)

    expect(phone.user.goals.at(-1)!.id).toBe(laptop.user.goals.at(-1)!.id)
    expect(phone.user.goals.at(-1)!.tasks[0].id).toBe(laptop.user.goals.at(-1)!.tasks[0].id)
  })

  it('spends a freeze on the day it was asked for', () => {
    const state = freshState()
    const next = applyAction(state, { kind: 'spendFreeze', dayId: TODAY }, NOW)

    expect(next.days.find((d) => d.id === TODAY)!.frozen).toBe(true)
    expect(next.user.freezesRemaining).toBe(0)
  })

  it('carries every kind through to the rule that owns it', () => {
    // Диспетчер не должен знать правил — но обязан ничего не ронять по дороге. Здесь проверяется
    // именно доставка: у каждого вида есть свой обработчик, и он меняет то, что должен.
    const state = freshState()
    const cases: { action: AppAction; check: (next: AppState) => unknown; expected: unknown }[] = [
      { action: { kind: 'addGoal', input: { id: 'g-читать', title: 'Читать', tasks: [{ id: 't-читать', title: 'Читать' }] } },
        check: (n) => n.user.goals.length, expected: 2 },
      { action: { kind: 'addTask', goalId: 'g1', input: { id: 't-растяжка', title: 'Растяжка' } },
        check: (n) => n.user.goals[0].tasks.length, expected: 3 },
      { action: { kind: 'editTask', goalId: 'g1', taskId: 't1', input: { title: 'Пробежка', weekdays: [0, 2, 4] } },
        check: (n) => n.user.goals[0].tasks[0].title, expected: 'Пробежка' },
      { action: { kind: 'removeTask', goalId: 'g1', taskId: 't2' },
        check: (n) => n.user.goals[0].tasks.map((t) => t.id), expected: ['t1'] },
      { action: { kind: 'archiveGoal', goalId: 'g1' },
        check: (n) => n.user.goals[0].archived, expected: true },
      { action: { kind: 'setPrediction', taskId: 't1', days: 30 },
        check: (n) => n.user.goals[0].tasks[0].predictedDays, expected: 30 },
      { action: { kind: 'updateProfile', patch: { name: 'Серёжа' } },
        check: (n) => n.user.name, expected: 'Серёжа' },
      { action: { kind: 'addChore', input: { id: 'ch-дело', title: 'Дело', date: TODAY } },
        check: (n) => n.chores?.length, expected: 1 },
    ]

    for (const { action, check, expected } of cases) {
      expect(check(applyAction(state, action, NOW)), action.kind).toEqual(expected)
    }
  })
})
