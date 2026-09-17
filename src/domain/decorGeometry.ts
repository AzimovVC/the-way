/**
 * Pixel footprints of the two things that ride beside or inside the snake — milestone badges and
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
  MILESTONE_BADGE_DEPTH,
  MILESTONE_BADGE_LOBES,
  MILESTONE_BADGE_LOBE_PX,
  MILESTONE_BADGE_MAJOR_RADIUS,
  MILESTONE_BADGE_RADIUS,
} from './config'
import type { MilestoneKind } from './pathEngine'

/**
 * Base word for each milestone kind. No longer what the badge on the road says — a rosette holds a
 * token, not a word (see milestoneBadgeFace) — but still what the horizon list at the end of the
 * road calls the same mark, where there is room to say it in full.
 */
export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  start: 'СТАРТ',
  week: 'НЕДЕЛЯ',
  month: 'МЕСЯЦ',
  halfYear: 'ПОЛГОДА',
  year: 'ГОД',
}

/**
 * What goes inside a badge. Only a short token fits — that is the whole trade the rosette makes
 * (see MILESTONE_BADGE_RADIUS) — so the word itself survives only where there is room for prose:
 * MILESTONE_LABEL still spells it out in the horizon list at the end of the road.
 *
 * The marks split into two families, and the face is what says which.
 *
 * **Signposts** answer «where am I»: the week, and the month. They repeat, they carry a token, and
 * a person reads them the way road signs are read — without stopping.
 *
 * **Achievements** answer «what has this road reached»: half a year, a year. They happen once, and
 * they carry a cup. «6М» was the whole trouble — a number in a slot, indistinguishable at a glance
 * from the «Н6» three days behind it, saying nothing about being the rarer thing.
 *
 * The cup is deliberately not the medal a habit's rank wears (see HorizonPanel): a rank is what one
 * task earned and lives beside the day that earned it, while these belong to the road everybody's
 * habits are drawn on. Same family of feeling, different subject, different glyph.
 *
 * 'start' is neither. It is a place, not a claim, and its own position already explains it: day
 * zero, where the road begins.
 */
export type MilestoneBadgeFace = { kind: 'text'; text: string } | { kind: 'icon'; icon: 'flag' | 'trophy' }

/** The one signpost that still fits a token. The week's is built from its number. */
const MONTH_BADGE_TOKEN = '1М'

export function milestoneBadgeFace(kind: MilestoneKind, n?: number): MilestoneBadgeFace {
  if (kind === 'start') return { kind: 'icon', icon: 'flag' }
  if (kind === 'week') return { kind: 'text', text: `Н${n}` }
  if (kind === 'month') return { kind: 'text', text: MONTH_BADGE_TOKEN }
  return { kind: 'icon', icon: 'trophy' }
}

/** Weekly marks repeat all history long, so they are the small size; the one-time marks are the large one. */
export function milestoneBadgeRadius(kind: MilestoneKind): number {
  return kind === 'week' ? MILESTONE_BADGE_RADIUS : MILESTONE_BADGE_MAJOR_RADIUS
}

/**
 * A badge's footprint at scale 1, as chipFit wants it: the square that circumscribes the rosette,
 * with the plinth hanging below. Circumscribing rather than inscribing keeps the error on the side
 * of extra clearance — the scallops' gaps are reserved even though nothing is drawn in them.
 */
export function milestoneBadgeBox(kind: MilestoneKind): ChipFitBox {
  const r = milestoneBadgeRadius(kind)
  return { halfWidth: r, halfUp: r, halfDown: r + MILESTONE_BADGE_DEPTH }
}

/**
 * The rosette outline, centred on the origin, as an SVG path — here beside the footprint rather
 * than in PathView so the shape and the box that reserves room for it cannot disagree about a
 * radius.
 *
 * r(θ) = base + bite·cos(lobes·θ) sampled densely and joined with straight segments, rather than a
 * hand-built run of arcs: at 12 samples per lobe the chords are under a third of a pixel off the
 * true curve at these radii, which is finer than the renderer can show, and it stays correct for
 * any lobe count instead of only the one it was drawn for.
 */
export function rosettePathD(radius: number, lobes = MILESTONE_BADGE_LOBES, bitePx = MILESTONE_BADGE_LOBE_PX): string {
  const base = radius - bitePx
  const steps = lobes * 12
  let d = ''
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const r = base + bitePx * Math.cos(lobes * a)
    d += `${i === 0 ? 'M' : 'L'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`
  }
  return `${d}Z`
}

/**
 * The largest badge the app can ever draw. The engine places weekly boxes without knowing which
 * badge is which, so it reserves against this one: proving it for the largest badge that can exist
 * proves it for every badge that actually renders.
 */
export function widestMilestoneChipBox(): ChipFitBox {
  return milestoneBadgeBox('month')
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

/**
 * How many empty slots the road has to be walkable past its last ghost before it stands clear of the
 * horizon band.
 *
 * The band is pinned under the goal card, at the top of the path, and the road comes down from above
 * as the horizon is approached — so until the road's far end has descended past the band's lower
 * edge, the band is over the road and cannot be shown without cutting a ghost circle in half. How
 * far down that end comes to rest at the end of the scroll is not a constant: the camera's frame
 * follows the shape of the road (see cameraFrame), so a road ending level comes to rest low and a
 * road ending in a climb barely comes down at all, and on a short screen neither does.
 *
 * Whatever is missing is reserved as scroll room past the last ghost, rounded up to whole slots
 * because the camera moves in slots. Without it the band is simply unreachable on those roads: it
 * would wait for a clearance the scroll can never deliver. Zero when the resting frame already
 * clears it, which is the ordinary case — this is a floor under the worst geometry, not a tax on
 * every history.
 */
export function horizonBandSlotsNeeded(
  bandHeightPx: number,
  gapPx: number,
  minSkyPx: number,
  restEndScreenY: number,
  slotScreenPx: number,
): number {
  if (bandHeightPx <= 0 || slotScreenPx <= 0) return 0
  return Math.max(0, Math.ceil((bandHeightPx + gapPx + minSkyPx - restEndScreenY) / slotScreenPx))
}
