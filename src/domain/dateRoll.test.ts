import { describe, expect, it } from 'vitest'
import { rollDayShown, rollMonthRows, rollPlacement } from './dateRoll'

describe('rollPlacement', () => {
  it('ставит показанный день в середину окна', () => {
    const rowHeight = 20
    const boxHeight = 60
    for (const index of [0, 3, 17.5, 364]) {
      const { offsetPx } = rollPlacement(index, rowHeight, boxHeight)
      // Где оказался верх строки этого дня после сдвига — он обязан стоять по центру окна.
      const rowTop = offsetPx + index * rowHeight
      expect(rowTop + rowHeight / 2).toBeCloseTo(boxHeight / 2)
    }
  })

  it('поздние дни поднимаются снизу — лента едет вверх вместе с ходом времени', () => {
    expect(rollPlacement(10, 20, 60).offsetPx).toBeLessThan(rollPlacement(9, 20, 60).offsetPx)
  })
})

describe('rollDayShown', () => {
  it('показывает целый день, а не половину двух', () => {
    expect(rollDayShown(4.2)).toBe(4)
    expect(rollDayShown(4.9)).toBe(5)
  })

  it('меняется на середине перегона между днями', () => {
    expect(rollDayShown(4.49)).toBe(4)
    expect(rollDayShown(4.51)).toBe(5)
  })

  it('на самом дне стоит на нём же — в покое окно не дрожит', () => {
    for (const i of [0, 7, 365]) expect(rollDayShown(i)).toBe(i)
  })
})

describe('rollMonthRows', () => {
  const august = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']

  it('даёт по строке на месяц, а не на день', () => {
    expect(rollMonthRows(august).rows).toEqual(['2026-08', '2026-09'])
  })

  it('держит месяц неподвижным все его дни', () => {
    const { rowOfIndex } = rollMonthRows(august)
    expect(rowOfIndex).toEqual([0, 0, 1, 1])
  })

  it('трогается ровно на смене месяца', () => {
    const { rowOfIndex } = rollMonthRows(august)
    expect(rowOfIndex[2] - rowOfIndex[1]).toBe(1)
  })

  it('на пустой истории не выдумывает строк', () => {
    expect(rollMonthRows([])).toEqual({ rows: [], rowOfIndex: [] })
  })

  it('тот же месяц следующего года — своя строка: лента идёт по времени, а не по имени', () => {
    const { rows, rowOfIndex } = rollMonthRows(['2026-08-31', '2027-08-01'])
    expect(rows).toEqual(['2026-08', '2027-08'])
    expect(rowOfIndex).toEqual([0, 1])
  })
})
