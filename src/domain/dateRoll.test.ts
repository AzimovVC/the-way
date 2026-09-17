import { describe, expect, it } from 'vitest'
import { rollDayShown, rollPlacement } from './dateRoll'

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
