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
  const bounds = { width: 390, height: 700, edge: 12 }
  const focus = { x: 200, y: 350 }
  const up = { x: 0, y: -1 }
  const upRight = { x: 1, y: -1 }
  const circleAt = (x: number, y: number) => ({ x, y, halfW: 22, halfH: 22 })

  it('на вертикальном участке встаёт слева, на той же строке', () => {
    const a = rollAnchor(focus, up, chip, [], bounds)
    expect(a.x).toBeLessThan(focus.x)
    expect(a.y).toBeCloseTo(focus.y)
  })

  it('на диагонали уходит по нормали, а не вбок: и выше, и левее', () => {
    const a = rollAnchor(focus, upRight, chip, [], bounds)
    expect(a.x).toBeLessThan(focus.x)
    expect(a.y).toBeLessThan(focus.y)
  })

  it('и там он расходится с соседним днём, с которым разошёлся бы не всякий', () => {
    // Соседний день по диагонали: 64 px шага под 45°.
    const next = { x: focus.x + 45, y: focus.y - 45, halfW: 22, halfH: 22 }
    const overlap = (c: { x: number; y: number }) => {
      const w = Math.min(c.x + chip.width / 2, next.x + next.halfW) - Math.max(c.x - chip.width / 2, next.x - next.halfW)
      const h = Math.min(c.y + chip.height / 2, next.y + next.halfH) - Math.max(c.y - chip.height / 2, next.y - next.halfH)
      return w > 0 && h > 0 ? w * h : 0
    }
    const byNormal = rollAnchor(focus, upRight, chip, [next], bounds)
    // Строго вбок — то, как чип стоял раньше.
    const sideways = { x: focus.x + chip.radius + chip.gap + chip.width / 2, y: focus.y }
    expect(overlap(byNormal)).toBe(0)
    expect(overlap(sideways)).toBeGreaterThan(0)
  })

  it('держится дома, пока туда заходит только чужой край', () => {
    const sliver = { x: 200 - 22 - 8 - chip.width, y: 350, halfW: 2, halfH: 24 }
    expect(rollAnchor(focus, up, chip, [sliver], bounds).side).toBe(-1)
  })

  it('дома тесно — сначала съезжает вдоль дороги, а не прыгает через неё', () => {
    const a = rollAnchor(focus, up, chip, [circleAt(140, 350)], bounds)
    expect(a.side).toBe(-1)
    expect(Math.abs(a.y - focus.y)).toBeGreaterThan(0)
  })

  it('уходит на другую сторону, когда занята вся домашняя', () => {
    // Стена вдоль всей левой обочины: съезжать вдоль дороги там некуда.
    const wall = { x: 140, y: 350, halfW: 22, halfH: 200 }
    expect(rollAnchor(focus, up, chip, [wall], bounds).side).toBe(1)
  })

  it('стоя не дома, возвращается только когда дома стало чисто', () => {
    const wall = { x: 140, y: 350, halfW: 22, halfH: 200 }
    expect(rollAnchor(focus, up, chip, [wall], bounds, 1).side).toBe(1)
    expect(rollAnchor(focus, up, chip, [], bounds, 1).side).toBe(-1)
  })

  it('на узком месте, где заняты обе стороны, остаётся дома', () => {
    const both = [circleAt(140, 350), circleAt(260, 350)]
    expect(rollAnchor(focus, up, chip, both, bounds).side).toBe(-1)
  })

  it('не вылезает за край экрана — это такая же помеха, как чужой кружок', () => {
    const atEdge = { x: 30, y: 350 }
    expect(rollAnchor(atEdge, up, chip, [], bounds).side).toBe(1)
  })

  it('на крутом повороте, где заняты обе нормали, съезжает вдоль дороги, а не ложится на кружок', () => {
    // Оба перпендикуляра заняты соседями: без сдвига вдоль дороги встать некуда.
    const both = [circleAt(focus.x - 60, focus.y), circleAt(focus.x + 60, focus.y)]
    const a = rollAnchor(focus, up, chip, both, bounds)
    const overlaps = both.some((o) => {
      const w = Math.min(a.x + chip.width / 2, o.x + o.halfW) - Math.max(a.x - chip.width / 2, o.x - o.halfW)
      const h = Math.min(a.y + chip.height / 2, o.y + o.halfH) - Math.max(a.y - chip.height / 2, o.y - o.halfH)
      return w > 0 && h > 0
    })
    expect(overlaps).toBe(false)
    expect(Math.abs(a.y - focus.y)).toBeGreaterThan(0)
  })

  it('но не съезжает, когда и так свободно: напротив своего дня читается без вопросов', () => {
    expect(rollAnchor(focus, up, chip, [], bounds).y).toBeCloseTo(focus.y)
  })

  it('считает тесным и место впритык: зажатая подпись читается не лучше наехавшей', () => {
    // Бокс не касается чипа, стоящего дома, — между ними пара пикселей.
    const box = { x: focus.x - 22 - 8 - chip.width - 2 - 20, y: focus.y, halfW: 20, halfH: 20 }
    const a = rollAnchor(focus, up, chip, [box], bounds)
    // Место напротив своего дня слева — то самое, где чип оказывался зажат: он его больше не берёт.
    const cramped = { x: focus.x - chip.radius - chip.gap - chip.width / 2, y: focus.y }
    expect(Math.hypot(a.x - cramped.x, a.y - cramped.y)).toBeGreaterThan(chip.gap)
  })

  it('сходит с домашней стороны заранее, когда занята она у следующего дня', () => {
    // Бокс стоит на левой обочине следующего дня, а не этого: сегодня слева ещё свободно.
    const next = { x: focus.x, y: focus.y - 64 }
    const box = circleAt(next.x - 22 - 8 - chip.width / 2, next.y)
    const ahead = [{ focus: next, direction: up, weight: 0.5 }]
    expect(rollAnchor(focus, up, chip, [box], bounds).side).toBe(-1)
    expect(rollAnchor(focus, up, chip, [box], bounds, -1, ahead).side).toBe(1)
  })

  it('но не считает помехой сам кружок дня, к которому идёт', () => {
    const next = { x: focus.x, y: focus.y - 64 }
    const ahead = [{ focus: next, direction: up, weight: 0.5 }]
    expect(rollAnchor(focus, up, chip, [circleAt(next.x, next.y)], bounds, -1, ahead).side).toBe(-1)
  })

  it('на истории из одного дня дорога смотрит вверх, а не в никуда', () => {
    const a = rollAnchor(focus, { x: 0, y: 0 }, chip, [], bounds)
    expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true)
    expect(a.x).toBeLessThan(focus.x)
  })
})
