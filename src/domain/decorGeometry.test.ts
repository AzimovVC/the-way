import { describe, expect, it } from 'vitest'
import { MILESTONE_LABEL, milestoneBadgeFace, milestoneBadgeRadius } from './decorGeometry'
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
