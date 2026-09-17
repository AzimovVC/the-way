import { describe, expect, it } from 'vitest'
import { rollDayShown, rollMonthRows, rollPlacement, rollSide } from './dateRoll'

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

describe('rollSide', () => {
  const chip = { width: 80, height: 22, gap: 8, radius: 22 }
  const circle = (x: number, y: number) => ({ x, y, halfW: 22, halfH: 22 })

  it('на прямом участке сторона одна и та же — не монетка', () => {
    expect(rollSide(200, 400, chip, [])).toBe(-1)
    expect(rollSide(200, 400, chip, [circle(200, 300), circle(200, 500)])).toBe(-1)
  })

  it('уходит от соседа, который занял левую сторону', () => {
    expect(rollSide(200, 400, chip, [circle(140, 400)])).toBe(1)
  })

  it('и от того, кто занял правую', () => {
    expect(rollSide(200, 400, chip, [circle(260, 400)])).toBe(-1)
  })

  it('выбирает меньшее из двух зол, когда заняты обе', () => {
    // Слева сосед перекрывает чип целиком по высоте, справа — краем.
    expect(rollSide(200, 400, chip, [circle(140, 400), { x: 260, y: 400, halfW: 4, halfH: 4 }])).toBe(1)
  })

  it('не считает помехой то, что стоит выше или ниже строки', () => {
    expect(rollSide(200, 400, chip, [circle(140, 300)])).toBe(-1)
  })
})

describe('rollSide — удержание стороны', () => {
  const chip = { width: 80, height: 22, gap: 8, radius: 22 }
  const circle = (x: number, y: number) => ({ x, y, halfW: 22, halfH: 22 })
  /** Чужой край, заходящий на левую сторону на `px`. */
  const sliver = (px: number) => [{ x: 200 - 22 - 8 - px, y: 400, halfW: px, halfH: 22 }]

  it('не уходит с левой стороны ради края, которого не видно', () => {
    expect(rollSide(200, 400, chip, sliver(2), -1)).toBe(-1)
  })

  it('уходит, когда сосед занял левую сторону всерьёз', () => {
    expect(rollSide(200, 400, chip, [circle(140, 400)], -1)).toBe(1)
  })

  it('стоя справа, держится, пока слева не стало чисто', () => {
    expect(rollSide(200, 400, chip, sliver(4), 1)).toBe(1)
    expect(rollSide(200, 400, chip, sliver(1), 1)).toBe(-1)
  })

  it('на узком месте, где заняты обе стороны, остаётся дома', () => {
    expect(rollSide(200, 400, chip, [circle(140, 400), circle(260, 400)], -1)).toBe(-1)
  })
})
