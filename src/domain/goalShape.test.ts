import { describe, expect, it } from 'vitest'
import { isSingleTaskGoal, tasksForGoal } from './goalShape'
import type { Goal, TaskTemplate } from './models'

function makeTask(title: string): TaskTemplate {
  return {
    id: title, goalId: 'g1', title, cycleStartDate: '2026-01-01',
  }
}

const goalWith = (title: string, tasks: TaskTemplate[]): Goal => ({ id: 'g1', title, tasks, archived: false })

describe('tasksForGoal', () => {
  it('turns a goal with nothing under it into one task under its own name', () => {
    expect(tasksForGoal('Больше читать', [])).toEqual([{ title: 'Больше читать' }])
  })

  it('leaves a split goal exactly as split', () => {
    const split = [{ title: 'Пробежка' }]
    expect(tasksForGoal('Спортсмен', split)).toBe(split)
  })
})

describe('the guess', () => {
  it('rides along with the single habit a goal turns into', () => {
    expect(tasksForGoal('Бег', [], { weekdays: [0, 2, 4], predictedDays: 30 })).toEqual([
      { title: 'Бег', weekdays: [0, 2, 4], predictedDays: 30 },
    ])
  })

  it('is simply absent when the question was skipped', () => {
    expect(tasksForGoal('Бег', [])[0].predictedDays).toBeUndefined()
  })
})

describe('isSingleTaskGoal', () => {
  it('holds while the goal is still its own single action', () => {
    expect(isSingleTaskGoal(goalWith('Больше читать', [makeTask('Больше читать')]))).toBe(true)
  })

  it('does not hold once a second task joins', () => {
    expect(isSingleTaskGoal(goalWith('Спортсмен', [makeTask('Спортсмен'), makeTask('Зарядка')]))).toBe(false)
  })

  it('does not hold when the one task is named something of its own — that is two real facts', () => {
    expect(isSingleTaskGoal(goalWith('Французский', [makeTask('20 слов')]))).toBe(false)
  })

  it('does not hold for a goal left with no tasks at all', () => {
    expect(isSingleTaskGoal(goalWith('Пустая', []))).toBe(false)
  })
})
