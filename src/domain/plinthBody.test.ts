import { describe, expect, it } from 'vitest'
import { PLINTH_MIN_BASE_RATIO } from './config'
import { plinthBaseRadius, plinthBodyPath } from './plinthBody'

describe('plinthBaseRadius', () => {
  it('никогда не шире лица — иначе силуэт снова читается как два диска', () => {
    for (let depth = 0; depth <= 40; depth += 1) {
      expect(plinthBaseRadius(22, depth)).toBeLessThanOrEqual(22)
    }
  })

  it('сужается монотонно: чем выше поднят круг, тем уже он у земли', () => {
    let prev = Infinity
    for (let depth = 0; depth <= 40; depth += 1) {
      const base = plinthBaseRadius(22, depth)
      expect(base).toBeLessThanOrEqual(prev)
      prev = base
    }
  })

  it('на обычной высоте почти не отличается от лица — дорога выглядит как раньше', () => {
    expect(22 - plinthBaseRadius(22, 6)).toBeLessThan(2)
  })

  it('не встаёт на иголку даже на предельной высоте ползунка', () => {
    expect(plinthBaseRadius(22, 200)).toBeCloseTo(22 * PLINTH_MIN_BASE_RATIO)
  })
})

describe('plinthBodyPath', () => {
  it('замкнут и начинается от левого края лица', () => {
    const d = plinthBodyPath(100, 50, 22, 6)
    expect(d.startsWith('M 78 50')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })

  it('доводит тело ровно до земли — до низа подставки, не дальше', () => {
    expect(plinthBodyPath(0, 50, 22, 14)).toContain('64')
  })

  it('верхняя дуга идёт полным радиусом лица, чтобы лицо закрыло её без шва', () => {
    expect(plinthBodyPath(0, 0, 22, 14)).toContain('A 22 22 0 0 1 -22 0')
  })
})
