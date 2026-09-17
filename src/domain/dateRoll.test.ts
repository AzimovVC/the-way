import { describe, expect, it } from 'vitest'
import { rollAnchor, rollDayShown, rollMonthRows, rollPlacement } from './dateRoll'

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

describe('rollAnchor', () => {
  const chip = { width: 52, height: 48, gap: 8, radius: 22 }
  const focus = { x: 200, y: 350 }
  const up = { x: 0, y: -1 }

  it('на вертикальном участке встаёт справа, на той же строке', () => {
    const a = rollAnchor(focus, up, chip)
    expect(a.x).toBeGreaterThan(focus.x)
    expect(a.y).toBeCloseTo(focus.y)
  })

  it('на диагонали уходит по нормали, а не вбок: и правее, и ниже', () => {
    const a = rollAnchor(focus, { x: 1, y: -1 }, chip)
    expect(a.x).toBeGreaterThan(focus.x)
    expect(a.y).toBeGreaterThan(focus.y)
  })

  it('и там он расходится с соседним днём, с которым разошёлся бы не всякий', () => {
    // Соседний день по диагонали: 64 px шага под 45°.
    const next = { x: focus.x + 45, y: focus.y - 45, halfW: 22, halfH: 22 }
    const overlap = (c: { x: number; y: number }) => {
      const w = Math.min(c.x + chip.width / 2, next.x + next.halfW) - Math.max(c.x - chip.width / 2, next.x - next.halfW)
      const h = Math.min(c.y + chip.height / 2, next.y + next.halfH) - Math.max(c.y - chip.height / 2, next.y - next.halfH)
      return w > 0 && h > 0 ? w * h : 0
    }
    expect(overlap(rollAnchor(focus, { x: 1, y: -1 }, chip))).toBe(0)
    // Строго вбок — то, как чип стоял бы без нормали.
    expect(overlap({ x: focus.x + chip.radius + chip.gap + chip.width / 2, y: focus.y })).toBeGreaterThan(0)
  })

  it('с какой стороны ни шла бы дорога, чип справа: место узнаётся по экрану, а не по дороге', () => {
    for (const direction of [{ x: 0, y: -1 }, { x: 1, y: -1 }, { x: -1, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 1 }]) {
      expect(rollAnchor(focus, direction, chip).x).toBeGreaterThan(focus.x)
    }
  })

  it('на истории из одного дня дорога смотрит вверх, а не в никуда', () => {
    const a = rollAnchor(focus, { x: 0, y: 0 }, chip)
    expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true)
    expect(a.x).toBeGreaterThan(focus.x)
  })
})
