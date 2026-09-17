import { describe, expect, it } from 'vitest'
import {
  MILESTONE_LABEL,
  milestoneBadgeFace,
  milestoneBadgeRadius,
  rosetteBodyPath,
  rosettePathD,
} from './decorGeometry'
import type { MilestoneKind } from './pathEngine'

/**
 * The road's marks split into two families, and a person has to tell them apart at a glance while
 * scrolling. This is the only place that rule is written down as something that can fail.
 */
describe('what a badge carries on its face', () => {
  it('gives the repeating signposts a token, so they read like road signs', () => {
    // The two answer differently on purpose: the week counts, the month names itself. A person
    // scrolling past «ОКТ» knows where they are without adding up the marks behind them, and two
    // signposts that both counted would read as the same mark twice.
    expect(milestoneBadgeFace('week', 6)).toEqual({ kind: 'text', text: 'Н6' })
    expect(milestoneBadgeFace('month', 3, '2026-10-01')).toEqual({ kind: 'text', text: 'окт' })
  })

  it('falls back to the month\'s number when it has no day to stand on yet', () => {
    // The horizon lists a mark before the road has reached it; it still has to draw something.
    expect(milestoneBadgeFace('month', 3)).toEqual({ kind: 'text', text: 'М3' })
  })

  it('gives the road\'s achievements a cup, not a number', () => {
    // «6М» sat three days from «Н6» and looked like the same kind of thing. A half year of road is
    // not a signpost telling you where you are — it is the rarer thing, and the face has to say so
    // without being read.
    expect(milestoneBadgeFace('halfYear')).toEqual({ kind: 'icon', icon: 'trophy' })
    expect(milestoneBadgeFace('year')).toEqual({ kind: 'icon', icon: 'trophy' })
  })

  it('leaves the start a flag, because it is a place and not a claim', () => {
    expect(milestoneBadgeFace('start')).toEqual({ kind: 'icon', icon: 'flag' })
  })

  it('never leaves a face blank, whatever mark is asked for', () => {
    // A kind added later must pick a family rather than fall through to an empty rosette.
    const kinds: MilestoneKind[] = ['start', 'week', 'month', 'halfYear', 'year']
    for (const kind of kinds) {
      const face = milestoneBadgeFace(kind, 1)
      expect(face.kind === 'text' ? face.text.length > 0 : Boolean(face.icon)).toBe(true)
      expect(MILESTONE_LABEL[kind].length).toBeGreaterThan(0)
    }
  })

  it('keeps the repeating mark the small size and the rest a size up', () => {
    // The only hierarchy the rosette has left, now that the word is gone from it.
    expect(milestoneBadgeRadius('week')).toBeLessThan(milestoneBadgeRadius('halfYear'))
    expect(milestoneBadgeRadius('year')).toBe(milestoneBadgeRadius('halfYear'))
  })
})

/**
 * Тело метки существует ради одного: когда фокус поднимает лицо, силуэт обязан остаться одним
 * предметом. Круги это уже проходили (plinthBody.test.ts) — здесь то же требование к звезде.
 */
describe('тело розетки', () => {
  const parse = (d: string) =>
    d
      .replace(/Z$/, '')
      .split(/(?=[ML])/)
      .map((cmd) => cmd.slice(1).split(' ').map(Number))
      .map(([x, y]) => ({ x, y }))

  const area = (pts: { x: number; y: number }[]) => {
    let sum = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      sum += a.x * b.y - b.x * a.y
    }
    return Math.abs(sum) / 2
  }

  const span = (pts: { x: number; y: number }[], k: 'x' | 'y') => {
    const v = pts.map((p) => p[k])
    return { min: Math.min(...v), max: Math.max(...v) }
  }

  /** Что фигура закрывает на вертикали x — отрезком от первого края до последнего. */
  const cut = (pts: { x: number; y: number }[], x: number): [number, number] | null => {
    const ys: number[] = []
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i]
      const b = pts[j]
      if (a.x > x !== b.x > x) ys.push(a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x))
    }
    return ys.length === 0 ? null : [Math.min(...ys), Math.max(...ys)]
  }

  it('без глубины — это сам контур', () => {
    // Глубина 0 — не особый случай в коде, и площадь ловит, что она им не стала: тело схлопывается
    // ровно в лицо, а не в фигуру со сложенным пополам кольцом.
    expect(area(parse(rosetteBodyPath(0, 0, 22, 0)))).toBeCloseTo(area(parse(rosettePathD(22))), 2)
  })

  it('не шире лица и ровно на глубину ниже', () => {
    // Место метке дорога отмерила по радиусу (milestoneBadgeBox): тело, вылезшее вбок, встанет на
    // соседний день. Вниз оно растёт — за этим и звали.
    const face = parse(rosettePathD(22))
    const body = parse(rosetteBodyPath(0, 0, 22, 12))
    expect(span(body, 'x').min).toBeCloseTo(span(face, 'x').min, 6)
    expect(span(body, 'x').max).toBeCloseTo(span(face, 'x').max, 6)
    expect(span(body, 'y').min).toBeCloseTo(span(face, 'y').min, 6)
    expect(span(body, 'y').max).toBeCloseTo(span(face, 'y').max + 12, 6)
  })

  it('шва нет ни на какой высоте: по любой вертикали предмет один', () => {
    // Это и есть вся работа. Лицо поднято на lift, след лежит на своей глубине, перемычка между
    // ними — и если хоть на одной вертикали между тремя кусками остаётся просвет, звезда читается
    // как две звезды. Берётся и высота, до которой фокус (FOCUS_LIFT_PX) не достаёт.
    for (const radius of [22, 26]) {
      for (const lift of [0, 4, 8, 20]) {
        const depth = 4
        const face = parse(rosettePathD(radius)).map((p) => ({ x: p.x, y: p.y - lift }))
        const ground = parse(rosettePathD(radius)).map((p) => ({ x: p.x, y: p.y + depth }))
        const body = parse(rosetteBodyPath(0, -lift, radius, depth + lift))
        const edges = span(face, 'x')
        for (let k = 1; k < 200; k++) {
          const x = edges.min + ((edges.max - edges.min) * k) / 200
          const parts = [cut(face, x), cut(ground, x), cut(body, x)]
            .filter((c) => c !== null)
            .sort((a, b) => a[0] - b[0])
          let reach = parts[0][1]
          for (const [from, to] of parts) {
            expect(from).toBeLessThanOrEqual(reach + 1e-9)
            reach = Math.max(reach, to)
          }
        }
      }
    }
  })
})
