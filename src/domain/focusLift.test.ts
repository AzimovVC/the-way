import { describe, expect, it } from 'vitest'
import { FOCUS_LIFT_FALLOFF_DAYS, FOCUS_LIFT_PX } from './config'
import { focusLift } from './focusLift'

describe('focusLift', () => {
  it('поднимает на полную высоту ровно в точке фокуса', () => {
    expect(focusLift(0)).toBeCloseTo(FOCUS_LIFT_PX)
  })

  it('не поднимает ничего за радиусом затухания', () => {
    expect(focusLift(FOCUS_LIFT_FALLOFF_DAYS)).toBe(0)
    expect(focusLift(FOCUS_LIFT_FALLOFF_DAYS + 5)).toBe(0)
  })

  it('симметричен: сосед позади и сосед впереди подняты одинаково', () => {
    expect(focusLift(-0.7)).toBeCloseTo(focusLift(0.7))
  })

  it('убывает монотонно — ни один дальний день не стоит выше ближнего', () => {
    let prev = Infinity
    for (let d = 0; d <= 3; d += 0.05) {
      const lift = focusLift(d)
      expect(lift).toBeLessThanOrEqual(prev + 1e-9)
      prev = lift
    }
  })

  it('гладок на краю: у границы затухания лифт уходит в ноль без ступеньки', () => {
    const edge = focusLift(FOCUS_LIFT_FALLOFF_DAYS - 0.02)
    expect(edge).toBeGreaterThan(0)
    expect(edge).toBeLessThan(FOCUS_LIFT_PX * 0.01)
  })

  it('никогда не опускает круг ниже дороги', () => {
    for (let d = -4; d <= 4; d += 0.1) expect(focusLift(d)).toBeGreaterThanOrEqual(0)
  })
})

describe('соседи', () => {
  it('сосед встаёт ровно посередине между дорогой и вершиной', () => {
    expect(focusLift(1)).toBeCloseTo(FOCUS_LIFT_PX / 2)
    expect(focusLift(-1)).toBeCloseTo(FOCUS_LIFT_PX / 2)
  })

  it('второй сосед остаётся плоским — поднятых высот ровно три', () => {
    expect(focusLift(2)).toBe(0)
    expect(new Set([focusLift(0), focusLift(1), focusLift(2)]).size).toBe(3)
  })
})

describe('ручки DevPanel', () => {
  it('высота и радиус берутся из аргументов, когда их передали', () => {
    expect(focusLift(0, 20, 4)).toBeCloseTo(20)
    expect(focusLift(2, 20, 4)).toBeCloseTo(10)
    expect(focusLift(4, 20, 4)).toBe(0)
  })

  it('нулевой радиус выключает лифт, а не роняет его в NaN', () => {
    for (const d of [0, 0.5, 3]) expect(focusLift(d, 8, 0)).toBe(0)
  })
})
