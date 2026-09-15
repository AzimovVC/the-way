/**
 * Pixel footprints of the two things that ride beside or inside the snake — milestone chips and
 * the weekly side boxes.
 *
 * This lives in the domain rather than in PathView because it is what the layout engine reserves
 * space against *and* what the geometry tests prove the no-overlap guarantee with. Written out a
 * second time in either of those places, the proof and the drawing drift apart silently: the tests
 * keep passing on the old numbers while the app renders the new ones.
 */

import type { ChipFitBox } from './chipFit'
import {
  DAY_CIRCLE_MAX_RADIUS,
  DAY_CIRCLE_RADIUS,
  MILESTONE_CHAR_WIDTH,
  MILESTONE_CHIP_DEPTH,
  MILESTONE_CHIP_HEIGHT,
  MILESTONE_CHIP_PADDING_X,
} from './config'
import type { MilestoneKind } from './pathEngine'

/** Base word for each milestone kind — 'week' repeats (every 7th day), so its chip also gets the occurrence number appended (see milestoneLabel). */
export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  start: 'СТАРТ',
  week: 'НЕДЕЛЯ',
  month: 'МЕСЯЦ',
  halfYear: 'ПОЛГОДА',
  year: 'ГОД',
}

export function milestoneLabel(kind: MilestoneKind, n?: number): string {
  return kind === 'week' ? `${MILESTONE_LABEL.week} ${n}` : MILESTONE_LABEL[kind]
}

/** Width of a chip's pill at scale 1 — the one place the padding enters the geometry. */
export function milestoneChipWidth(label: string): number {
  return label.length * MILESTONE_CHAR_WIDTH + MILESTONE_CHIP_PADDING_X * 2
}

/** A chip's footprint at scale 1, as chipFit wants it: the plinth hangs below, so it is not symmetric. */
export function milestoneChipBox(label: string): ChipFitBox {
  return {
    halfWidth: milestoneChipWidth(label) / 2,
    halfUp: MILESTONE_CHIP_HEIGHT / 2,
    halfDown: MILESTONE_CHIP_HEIGHT / 2 + MILESTONE_CHIP_DEPTH,
  }
}

/**
 * The widest chip the app can ever draw — "НЕДЕЛЯ 99", nine characters. The engine places weekly
 * boxes without knowing which chip is which, so it reserves against this one: proving it for the
 * widest chip that can exist proves it for every chip that actually renders.
 */
const WIDEST_CHIP_LABEL = [...Object.values(MILESTONE_LABEL), milestoneLabel('week', 99)].reduce((a, b) =>
  b.length > a.length ? b : a,
)

export function widestMilestoneChipBox(): ChipFitBox {
  return milestoneChipBox(WIDEST_CHIP_LABEL)
}

/**
 * Weekly side-placeholder box — a reserved slot for a future mascot/quest, sitting just off the
 * path next to that week's day circle rather than sitting inline in the snake like the milestone
 * chips. Plain square for now; only its footprint (for collision purposes) matters yet. Like
 * Duolingo's side illustrations (the owl, the chest), it nestles right up against the day circle
 * with no connecting line — sized close to that circle rather than dwarfing it (see
 * WEEK_BOX_SIZE_RATIO, a dev-tunable multiple of DAY_CIRCLE_RADIUS) — but capped by
 * computeWeekBoxGeometry below so it can never grow wide enough to be clipped by the screen edge.
 */
/** Preferred floor when shrinking the box for a narrow container — still clearly bigger than a day circle. */
const WEEK_BOX_MIN_SIZE = DAY_CIRCLE_RADIUS * 2.5
/**
 * Absolute floor the binary search in computeWeekBoxGeometry may shrink down to as a last resort,
 * on top of WEEK_BOX_MIN_SIZE — reached only when the container is so narrow (or the path so
 * zoomed in) that even the preferred minimum wouldn't fit on screen. Guarantees the box is always
 * fully visible rather than merely usually fitting, at the cost of looking undersized in that
 * rare case instead of clipping off the container's edge.
 */
const WEEK_BOX_HARD_MIN_SIZE = 8
export const WEEK_BOX_DEPTH = 6
/**
 * Gap, in px, kept between the outermost edge a day can reach (DAY_CIRCLE_MAX_RADIUS — today's
 * circle plus its ring) and the box's nearest edge. No connecting line any more (see the Duolingo
 * reference), just this breathing room.
 */
const WEEK_BOX_GAP_PX = 8
/** Clear space, in px, kept between the box's edge and any day circle it comes near. */
export const WEEK_BOX_CLEARANCE_PX = 8
/** Kept clear of the container's edge so the box's plinth/shadow never touches it either. */
const WEEK_BOX_SCREEN_EDGE_MARGIN_PX = 12

export function weekBoxFootprint(size: number) {
  const halfDiagonal = Math.hypot(size / 2, size / 2 + WEEK_BOX_DEPTH)
  const offsetPx = DAY_CIRCLE_MAX_RADIUS + WEEK_BOX_GAP_PX + halfDiagonal
  // The box is drawn screen-axis-aligned regardless of the path's local heading, and the side it's
  // offset to (left/right of the path) can point anywhere depending on that heading — so the
  // *actual* horizontal reach from its attach circle is offsetPx * |cos(heading)|, somewhere
  // between 0 and offsetPx. Assuming the worst case (heading fully horizontal, so the whole offset
  // lands sideways) rather than tracking the real heading here keeps this a guarantee, not a guess.
  const maxHorizontalReachPx = offsetPx + size / 2
  return { halfDiagonal, offsetPx, maxHorizontalReachPx }
}

export interface WeekBoxGeometry {
  size: number
  depth: number
  offsetPx: number
  /** Centre-to-centre distance the box keeps from a day circle — circles are round, so a radius is exact here. */
  separationPx: number
  /** The box's own footprint, for the rectangle-vs-rectangle tests against other boxes. */
  footprint: ChipFitBox
  /** The widest milestone chip's footprint, for that same rectangle test. */
  chipFootprint: ChipFitBox
  /** Daylight kept between those rectangles. */
  clearancePx: number
}

/**
 * Shrinks the week box (down to WEEK_BOX_MIN_SIZE) just enough that, even in the worst-case
 * heading, it can never be clipped by the container's left/right edge — the box always ends up
 * fully on screen instead of merely usually fitting. Recomputed whenever the container width, the
 * path's scale, or the dev-tunable size ratio changes; cheap enough (a bounded binary search) to
 * redo every render.
 */
export function computeWeekBoxGeometry(containerWidth: number, scale: number, idealSize: number): WeekBoxGeometry {
  const halfWidthBudgetPx = containerWidth / 2 - WEEK_BOX_SCREEN_EDGE_MARGIN_PX
  let size = idealSize
  if (weekBoxFootprint(size).maxHorizontalReachPx * scale > halfWidthBudgetPx) {
    // Prefer not to shrink past WEEK_BOX_MIN_SIZE, but if even that wouldn't fit (a very narrow
    // container combined with a zoomed-in scale), keep shrinking down to WEEK_BOX_HARD_MIN_SIZE
    // instead of leaving the box clipped by the screen edge.
    const floor = weekBoxFootprint(WEEK_BOX_MIN_SIZE).maxHorizontalReachPx * scale <= halfWidthBudgetPx
      ? WEEK_BOX_MIN_SIZE
      : WEEK_BOX_HARD_MIN_SIZE
    let lo = floor
    let hi = idealSize
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (weekBoxFootprint(mid).maxHorizontalReachPx * scale <= halfWidthBudgetPx) lo = mid
      else hi = mid
    }
    size = lo
  }
  const { halfDiagonal, offsetPx } = weekBoxFootprint(size)
  return {
    size,
    depth: WEEK_BOX_DEPTH,
    offsetPx,
    separationPx: halfDiagonal + DAY_CIRCLE_MAX_RADIUS + WEEK_BOX_CLEARANCE_PX,
    footprint: { halfWidth: size / 2, halfUp: size / 2, halfDown: size / 2 + WEEK_BOX_DEPTH },
    chipFootprint: widestMilestoneChipBox(),
    clearancePx: WEEK_BOX_CLEARANCE_PX,
  }
}
