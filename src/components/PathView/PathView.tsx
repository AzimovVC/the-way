import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import Icon, { AWARD_PATH_D, ICON_PATH_D } from '../../components/Icon'
import type { HorizonMarker } from '../../domain/horizon'
import {
  DAY_CIRCLE_RADIUS,
  DAY_SPACING_PX,
  TODAY_CIRCLE_SCALE,
  TODAY_RING_OFFSET_PX,
  TODAY_RING_STROKE_PX,
  FOCUSED_DAYS_COUNT,
  GHOST_FUTURE_DAYS,
  MILESTONE_CHIP_DEPTH,
  MILESTONE_CHIP_FONT_SIZE,
  MILESTONE_CHIP_HEIGHT,
  MILESTONE_CLEARANCE_PX,
  WEEK_BOX_SIZE_RATIO,
} from '../../domain/config'
import { chipFitScale } from '../../domain/chipFit'
import {
  computeWeekBoxGeometry,
  milestoneChipBox,
  milestoneChipWidth,
  milestoneLabel,
} from '../../domain/decorGeometry'
import type { ColorTier, Day } from '../../domain/models'
import {
  computePathPoints,
  type MilestonePathPoint,
  type WeekBoxPoint,
} from '../../domain/pathEngine'
import { dailyQuestsFor } from '../../domain/quests'
import type { PopoverAnchor } from '../NodePopover'
import { describeArc, ringSegmentAngles } from '../ringSegments'

/**
 * Where a tapped circle is brought to before its card opens, as a share of the container's height.
 * High enough that a card of ordinary height — a few tasks, the day's quests, the freeze button —
 * fits below it without being clipped; low enough that the road the user came from is still on
 * screen above it, so the view is nudged rather than jumped.
 */
const TAP_FOCUS_FRACTION = 0.3
/** Slack around that row: a circle already near enough is left alone rather than nudged by 10px. */
const TAP_FOCUS_TOLERANCE_PX = 24
/** How far along the road the search for a camera position may look, and how finely. */
const SEARCH_REACH_DAYS = 8
const SEARCH_STEP_DAYS = 0.25
/** Below this, moving the whole road buys too little to be worth the movement. */
const MIN_WORTHWHILE_LIFT_PX = 48
/**
 * How long the road takes to bring a tapped circle up to the row, as a floor plus a share of the
 * distance. A fixed duration cannot serve both ends of the range: what reads as calm over 80px is a
 * lurch over 500, because the same time over six times the distance is six times the speed. Tying
 * it to distance keeps the *speed* roughly constant instead, which is what the eye actually judges.
 * The ceiling is there because past it the card starts to feel withheld.
 */
const SCROLL_GLIDE_BASE_MS = 200
const SCROLL_GLIDE_MS_PER_PX = 0.5
const SCROLL_GLIDE_MAX_MS = 560

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

const MILESTONE_TIER_COLOR = { bronze: 'var(--rust-500)', gold: 'var(--marigold-500)', platinum: 'var(--cobalt-500)' } as const
const TODAY_RING_GAP_DEG = 16
/* Ring geometry, in the proportions Duolingo's node ring uses — and the proportion that carries
   the look is the *gap*, not the band: the ring reads as a separate object orbiting the circle
   only while there is clear ground between them. Measured off Duo's node, both are quoted
   relative to the circle's radius: band ≈ 0.25r, gap ≈ 0.25r. At today's radius of 24.2 that is a
   6px band standing 6px clear, so the centreline sits 9px out. Outer edge lands at 36px from the
   centre — inside the 42px of clear ground the road's 64px spacing leaves before a neighbour's
   edge, and past the 32px the plinth reaches, so the ring crosses nothing. */

/** The "СЕГОДНЯ" pill, which rides beside today's circle on the path's normal (see its use below). */

/**
 * Where to hang today's label relative to its circle. It sits on the normal — perpendicular to the
 * direction of travel — because that is the only direction the road is guaranteed to leave clear:
 * along the path, one slot up and one slot down are both occupied by circles.
 *
 * Of the two normals it takes whichever points more to the left, so the pill leans back over
 * ground the path has already covered rather than reaching out into the side the weekly boxes
 * occupy.
 */
/**
 * Where the camera should look when it sits at `indexFloat` along `track`.
 *
 * `x` follows the camera point itself — the road's sideways wander inside one window is bounded by
 * its turn radius, and today reads best dead-centre. `centerY` is the mean height of the window,
 * which is the whole point: it is what makes the frame describe the road in view rather than a
 * direction assumed in advance. The clamp then trades some of that centring back for the guarantee
 * that the camera point stays on screen when the window is taller than the viewport.
 */
function cameraFrame(
  track: { x: number; y: number }[],
  indexFloat: number,
  frame: { scale: number; containerHeight: number; focusedDaysCount: number; backFraction: number },
): { x: number; y: number; centerY: number } {
  const at = (i: number) => {
    const clamped = Math.max(0, Math.min(i, track.length - 1))
    const i0 = Math.floor(clamped)
    const i1 = Math.min(i0 + 1, track.length - 1)
    const frac = clamped - i0
    return { x: track[i0].x + (track[i1].x - track[i0].x) * frac, y: track[i0].y + (track[i1].y - track[i0].y) * frac }
  }
  if (track.length === 0) return { x: 0, y: 0, centerY: 0 }
  const here = at(indexFloat)
  const back = frame.focusedDaysCount * frame.backFraction
  const ahead = frame.focusedDaysCount * (1 - frame.backFraction)
  // Sampling past either end of the track clamps onto the endpoint, which piles samples there and
  // pulls the frame back toward the road that exists — the right bias at the start of a history and
  // at the far edge of the horizon, where half the window is road that was never drawn.
  let sum = 0
  for (let k = 0; k < CAMERA_WINDOW_SAMPLES; k++) {
    const t = k / (CAMERA_WINDOW_SAMPLES - 1)
    sum += at(indexFloat - back + t * (back + ahead)).y
  }
  const mean = sum / CAMERA_WINDOW_SAMPLES
  const maxShift = (frame.containerHeight * CAMERA_ANCHOR_MAX_SHIFT_FRACTION) / Math.max(1e-6, frame.scale)
  return { x: here.x, y: here.y, centerY: Math.max(here.y - maxShift, Math.min(here.y + maxShift, mean)) }
}

/** A glyph stamped on a circle's face, centred and sized to that circle. */
function faceGlyph(d: string, stroke: string, cx: number, cy: number, radius: number) {
  const s = FACE_GLYPH_SCALE * (radius / DAY_CIRCLE_RADIUS)
  return (
    <g transform={`translate(${cx - 12 * s}, ${cy - 12 * s}) scale(${s})`}>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={FACE_GLYPH_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

/**
 * The row of small marks that sit above-right of a day circle, saying what changed about the
 * *rules* on that day: a new goal joined the road, a task was added to the daily set, a task
 * left it. They share one row so a single decision — archiving a goal, say — cannot pile six
 * marks onto one circle; the day card spells out which tasks they were.
 *
 * Neither mark is red. Red is the colour of a missed day, and a task you chose to drop is not
 * a miss: the quiet grey says "the bar moved here", which is exactly what it has to say for a
 * stretch of easier days to stay readable years later.
 */
const CHANGE_BADGE_SCALE = 1
const CHANGE_BADGE_STEP = 24
/**
 * Above the circle, not beside it: the right flank belongs to the week box and the left to the
 * milestone trophies, and today's circle wears a ring that eats anything drawn against its edge.
 * The offset clears that ring (TODAY_RING_OFFSET_PX plus half its stroke) with room to spare.
 */
const CHANGE_BADGE_GAP = 22
const CHANGE_BADGE_COLOR = {
  goal: 'var(--cobalt-500)',
  added: 'var(--cobalt-500)',
  removed: 'var(--color-text-secondary)',
} as const

type ChangeMark = 'goal' | 'added' | 'removed'

/**
 * Inner scale per glyph, not one shared number: plus and minus are two bare strokes across a
 * 14-unit span, while the flag is a drawn shape filling nearly the whole 24-unit box. Sized
 * alike, the flag would touch the disc it sits in and turn to mush at this size.
 */
const CHANGE_BADGE_GLYPH: Record<ChangeMark, { d: string; scale: number; width: number }> = {
  goal: { d: ICON_PATH_D.flag, scale: 0.55, width: 3.2 },
  added: { d: ICON_PATH_D.plus, scale: 0.5, width: 4.5 },
  removed: { d: ICON_PATH_D.minus, scale: 0.5, width: 4.5 },
}

/**
 * The glyph sits on an opaque disc so it survives a week box or a neighbouring circle passing
 * underneath — the marks are permanent and must stay readable at any point the road wanders to.
 */
function changeBadge(mark: ChangeMark, key: string, cx: number, cy: number) {
  const color = CHANGE_BADGE_COLOR[mark]
  const s = CHANGE_BADGE_SCALE
  const glyph = CHANGE_BADGE_GLYPH[mark]
  const inset = 12 * (1 - glyph.scale)
  return (
    <g key={key} transform={`translate(${cx - 12 * s}, ${cy - 12 * s}) scale(${s})`}>
      <circle cx={12} cy={12} r={10} fill="var(--color-bg)" stroke={color} strokeWidth={2} />
      <g transform={`translate(${inset}, ${inset}) scale(${glyph.scale})`}>
        <path
          d={glyph.d}
          fill="none"
          stroke={color}
          strokeWidth={glyph.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  )
}

const MIN_SCALE = 0.1
const MAX_SCALE = 3
/** Clear ground left around the fitted route in overview, in screen px — enough for a day circle's own radius at any scale it is drawn at. */
const OVERVIEW_PADDING_PX = 24
// How much road the resting frame tries to hold, as a share of the days that fill the screen
// height (focusedDaysCount). The camera centres on the *mean position of this window*, not on
// today, which is what lets one rule serve a road that may be climbing or falling.
//
// This replaces a fixed screen row for today, and the reason it has to is that such a row is a
// claim the geometry does not support: putting today at 24% from the top says "ahead is up, behind
// is down", which holds only while the road climbs. Once a slump turns it over, history moves
// *above* today and the three quarters reserved for history fill with the road ahead diving away
// and then nothing — measured on a 7-day slump, four of the seven recorded days sat off the top
// edge and 44% of the viewport was empty by construction. There is no correct constant here: the
// right row at 0° is the mirror of the right row at 180°.
//
// Framing by content has no direction to get wrong. On a straight road the two numbers below
// reproduce exactly the split they name (a third behind, two thirds ahead); on a curved or
// doubling-back one they generalise it, and the screen fills either way.
//
// The split itself is the one judgement left, and it is now stated in days rather than in pixels.
// It leans to the past because a ghost day and a recorded day are not worth the same screen: a
// recorded day carries a colour, its tasks and any milestone on it, while every ghost is the same
// grey circle. Three ghosts say "the road continues, aimed at the goal" as completely as fourteen
// do, so past three the road ahead is filler — measured at a 0.7 share it took six of the eight
// circles on screen and left two days of an eighteen-day streak visible.
const CAMERA_WINDOW_BACK_FRACTION = 0.55
// Samples taken across that window. The mean has to be continuous in scroll position or it shows
// as jitter: a plain average over whichever points fall inside moving bounds steps every time one
// enters or leaves (~46px of screen, at this scale). Sampling at fixed fractions of the window and
// interpolating between neighbours makes every sample move continuously instead.
const CAMERA_WINDOW_SAMPLES = 17
// How far the camera point itself may be pushed from the middle of the screen by that centring,
// as a fraction of the container height. A window taller than the viewport would otherwise be
// centred with today off-screen entirely; this is the guarantee that today stays in the frame.
const CAMERA_ANCHOR_MAX_SHIFT_FRACTION = 0.3
/**
 * Physical px of scroll the user must move to advance one day, independent of the path's visual
 * scale — this, not circle size, is what actually controls how fast scrolling through history
 * feels. Higher = slower/more deliberate scrolling for the same wheel/touch motion.
 */
const SCROLL_PX_PER_DAY = 90
/**
 * How close to the container's edge today's circle may come before it counts as out of frame and
 * the return button appears. Today is the largest circle on the road — its own radius plus the ring
 * orbiting it reach ~36px at the focus scale — so anything smaller than this would pop the button
 * up while today is still fully visible, and anything much larger would leave it hidden after today
 * had already been clipped in half.
 */
const TODAY_IN_FRAME_MARGIN_PX = 48
const QUEST_TRACK_OFFSET_X = 90
/** Solid "plinth" offset, in px at scale 1 — the design system's stand-in for a blurred shadow. */
/**
 * Size of a glyph stamped on a day circle's face, as a multiple of the 24-unit icon box. At 1.2 the
 * mark spans a little under half the circle — the proportion a node glyph has to hold to read as
 * part of the object rather than as a speck dropped on it. The stroke is set against the scale so
 * the rendered weight stays ~3px whatever the circle's size.
 */
const FACE_GLYPH_SCALE = 1.2
const FACE_GLYPH_STROKE = 2.6

const PLINTH_DEPTH = 6
const PLINTH_DEPTH_TODAY = 8

const TIER_COLOR: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold)',
  green: 'var(--color-day-green)',
  red: 'var(--color-day-red)',
  gray: 'var(--color-day-gray)',
  rest: 'var(--color-day-rest)',
}

const TIER_PLINTH: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold-plinth)',
  green: 'var(--color-day-green-plinth)',
  red: 'var(--color-day-red-plinth)',
  gray: 'var(--color-day-gray-plinth)',
  rest: 'var(--color-day-rest-plinth)',
}

/**
 * A chip takes one ordinary slot in the snake — exactly DAY_SPACING_PX of road, the same as a day
 * circle — so its width no longer has to be reserved anywhere. What has to fit in that slot is only
 * its extent *along* the path, i.e. its half-height plus its plinth, and the engine leans the road
 * back toward vertical wherever a chip sits so that stays true on a bend (see
 * CHIP_STRAIGHTEN_RESPONSE_PX).
 *
 * Reserving the chip's full *width* instead — which is what the old layout did — is what opened
 * 156px craters in the rhythm either side of every НЕДЕЛЯ marker.
 *
 * `scale` closes the last gap: on a hairpin the road has no budget left to straighten with, so the
 * chip shrinks instead of overlapping (see chipFit.ts). It is 1 virtually everywhere.
 */
function milestoneChipGeometry(label: string, scale = 1) {
  return {
    width: milestoneChipWidth(label) * scale,
    height: MILESTONE_CHIP_HEIGHT * scale,
    depth: MILESTONE_CHIP_DEPTH * scale,
    fontSize: MILESTONE_CHIP_FONT_SIZE * scale,
  }
}

export interface PathViewProps {
  days: Day[]
  containerWidth: number
  containerHeight: number
  todayDayId?: string
  showQuestTrack?: boolean
  showGhostFuture?: boolean
  showMascot?: boolean
  /**
  * Show the whole route fitted to the container instead of the scrolling focus view. Controlled by
  * the caller: the stats map asks for it outright, and on the path screen only the dev panel does.
  */
  zoomedOut?: boolean
  /** How far past today the road is drawn, in days. Defaults to the horizon in config. */
  ghostDays?: number
  /** What the road is heading toward. Only those inside the horizon are drawn on it; the rest are the caller's to list. */
  markersAhead?: HorizonMarker[]
  /** Dev-only overrides for the path's geometry tuning — each defaults to its domain constant. */
  maxTurnPerDayDeg?: number
  avoidanceRadiusPx?: number
  zigzagAmplitudePx?: number
  avoidanceStrengthDeg?: number
  zigzagPeriodDays?: number
  wobbleSensitivity?: number
  maxWobblePx?: number
  greenThreshold?: number
  trendResponsePx?: number
  /** Dev-only override: share of the resting frame's window given to the road behind today — defaults to CAMERA_WINDOW_BACK_FRACTION. */
  cameraBackFraction?: number
  /** Dev-only override: physical scroll px per day in the focus/scroll view — defaults to SCROLL_PX_PER_DAY. */
  scrollPxPerDay?: number
  /** Dev-only override: how many days fill the container height in the focus/scroll view — defaults to FOCUSED_DAYS_COUNT. Smaller = more zoomed in. */
  focusedDaysCount?: number
  /** Dev-only override: the weekly placeholder box's ideal size as a multiple of DAY_CIRCLE_RADIUS — defaults to WEEK_BOX_SIZE_RATIO. */
  weekBoxSizeRatio?: number
  /**
   * Label for the bubble hung on tomorrow's circle, or null for none. Deliberately a fixed short
   * string and not the task names: names are written by the user, and any user-supplied length on
   * the road eventually runs off a 390px screen or lands on a neighbouring circle. The names live
   * in the sheet this opens, where there is as much room as they need.
   */
  tomorrowLabel?: string | null
  /**
   * Whether the bubble is currently up. Kept apart from the label so the bubble is never unmounted
   * to hide it: an undone task would blink it out of existence, and the road is the one place in
   * this app where nothing happens abruptly. Mounted and faded, it can leave the way it arrived.
   */
  tomorrowShown?: boolean
  /**
   * A day was tapped, reported with where its circle stands on screen — the card that opens is
   * anchored to it, so the position is part of the event, not something the screen can recover
   * afterwards: the road scrolls and only this component knows the camera it drew under.
   */
  onDaySelect?: (day: Day, anchor: PopoverAnchor) => void
  onFutureTap?: () => void
  onTomorrowTap?: (anchor: PopoverAnchor) => void
}

export default function PathView({
  days,
  containerWidth,
  containerHeight,
  todayDayId,
  showQuestTrack = false,
  showGhostFuture = true,
  showMascot = false,
  zoomedOut = false,
  ghostDays = GHOST_FUTURE_DAYS,
  markersAhead = [],
  maxTurnPerDayDeg,
  avoidanceRadiusPx,
  zigzagAmplitudePx,
  avoidanceStrengthDeg,
  zigzagPeriodDays,
  wobbleSensitivity,
  maxWobblePx,
  greenThreshold,
  trendResponsePx,
  scrollPxPerDay = SCROLL_PX_PER_DAY,
  focusedDaysCount = FOCUSED_DAYS_COUNT,
  weekBoxSizeRatio = WEEK_BOX_SIZE_RATIO,
  cameraBackFraction = CAMERA_WINDOW_BACK_FRACTION,
  tomorrowLabel = null,
  tomorrowShown = false,
  onDaySelect,
  onFutureTap,
  onTomorrowTap,
}: PathViewProps) {
  // The scroll view's scale only depends on container height + the focus density, never on the
  // points themselves (see its full derivation below) — computed here, ahead of computePathPoints,
  // so the week-box geometry (which must be sized in screen px to guarantee it fits on screen) can
  // feed into that same layout pass instead of being bolted on after the fact.
  const scrollScale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, containerHeight / (focusedDaysCount * DAY_SPACING_PX)),
  )
  const weekBoxGeometry = useMemo(
    () => computeWeekBoxGeometry(containerWidth, scrollScale, DAY_CIRCLE_RADIUS * weekBoxSizeRatio),
    [containerWidth, scrollScale, weekBoxSizeRatio],
  )

  // One layout pass produces everything: day circles, milestone chips, weekly boxes and the
  // ghost circles past today are all read off the same curve at their own arc lengths, so they
  // cannot disagree about where the road is.
  //
  // Memoized because that pass is the expensive part of this component by a wide margin (a curve
  // integrated every few px over the whole history, plus a search for each weekly box's spot), and
  // most renders don't change any of its inputs: a pinch-zoom fires setZoomFactor on every
  // pointermove, opening the day card re-renders, and so does every container resize. The geometry
  // object above is memoized too, so it can be a dependency here rather than defeating this one
  // with a fresh identity each render.
  const { points, milestones: pathMilestones, weekBoxes, ghosts } = useMemo(
    () =>
      days.length > 0
        ? computePathPoints(days, {
            maxTurnPerDayDeg,
            avoidanceRadiusPx,
            zigzagAmplitudePx,
            avoidanceStrengthDeg,
            zigzagPeriodDays,
            wobbleSensitivity,
            maxWobblePx,
            greenThreshold,
            trendResponsePx,
            weekBoxGeometry,
            ghostDays: showGhostFuture ? ghostDays : 0,
          })
        : {
            points: [],
            milestones: [] as MilestonePathPoint[],
            weekBoxes: [] as WeekBoxPoint[],
            ghosts: [] as { x: number; y: number }[],
          },
    [
      days,
      maxTurnPerDayDeg,
      avoidanceRadiusPx,
      zigzagAmplitudePx,
      avoidanceStrengthDeg,
      zigzagPeriodDays,
      wobbleSensitivity,
      maxWobblePx,
      greenThreshold,
      trendResponsePx,
      weekBoxGeometry,
      showGhostFuture,
      ghostDays,
    ],
  )

  // Each chip's label and the scale it has to shrink to to clear its neighbours — an O(points) scan
  // per chip, so it rides in the same memo rather than being redone for every chip on every render.
  const chips = useMemo(
    () =>
      pathMilestones.map((m) => {
        const text = milestoneLabel(m.kind, m.n)
        // Every day circle is a candidate obstacle, not just the two the chip sits between: on a
        // switchback the lane coming back down passes within a chip's reach too. chipFitScale
        // filters by proximity itself, and returns 1 unless something is actually in the way.
        const fit = chipFitScale(m.x, m.y, milestoneChipBox(text), points, DAY_CIRCLE_RADIUS, MILESTONE_CLEARANCE_PX)
        return { ...m, text, fit }
      }),
    [pathMilestones, points],
  )

  // Kept in sync every render so the scroll listener's effect (which doesn't re-subscribe on every
  // data change — see its dependency array) always reads the current points, never a stale closure.
  // What the camera can travel along: the recorded road, then the horizon past it. Ghosts carry no
  // day data, so only their positions join the track — scrolling forward is the only thing it is
  // for. Without them the scroll range stops dead at today and the road ahead can never be reached.
  const cameraTrack = useMemo(
    () => [...points.map((p) => ({ x: p.x, y: p.y })), ...ghosts],
    [points, ghosts],
  )
  const trackRef = useRef(cameraTrack)
  trackRef.current = cameraTrack
  const lastIndex = points.length - 1
  const lastX = points[lastIndex]?.x ?? 0
  const lastY = points[lastIndex]?.y ?? 0

  // Markers too far off to land on the drawn road. Three is the cap because this is a signpost,
  // not an agenda: past the third line it stops reading as "and beyond this" and starts reading as
  // a list to work through.
  const beyondHorizon = useMemo(
    () => markersAhead.filter((m) => m.daysAhead > ghosts.length).slice(0, 3),
    [markersAhead, ghosts.length],
  )

  /**
   * The bubble naming tomorrow, and the slot it stands in.
   *
   * It stands in the second ghost's slot and that ghost's circle is not drawn, so the bubble
   * takes a place in the chain rather than pushing the chain around: every point keeps its
   * coordinates and the step stays DAY_SPACING_PX everywhere. That distinction is the whole reason
   * it is allowed on the road at all — the bubble is chrome, not a day, and chrome does not get to
   * move the road. It is the same rule that keeps horizon markers as labels instead of slots.
   *
   * Sitting in the column is not optional either: the step is 64px and a day circle is 44px
   * across, so the daylight between two circles is 20px and this pill is 26px tall. There is no
   * placing it between them. Either it stands where a circle stands, or it hangs off to the side.
   *
   * What it costs is one ghost out of the horizon, and only while today is closed — which costs
   * nothing at all: the horizon is a drawing limit, not a claim that the road stops there.
   */
  const tomorrowBubble = useMemo(() => {
    if (!tomorrowLabel || ghosts.length < 2) return null
    const from = ghosts[0]
    const to = ghosts[1]
    // 6.9px per uppercase character at 12px/800 with 0.9 letter-spacing in the app's sans, measured
    // off the rendered label; the pill is that plus symmetric padding.
    const halfWidth = (tomorrowLabel.length * 6.9) / 2 + 13
    const halfHeight = 14
    // Seven tenths of the way into the borrowed slot rather than its centre: the slot is empty
    // either way, and sitting low in it puts the pill close enough to tomorrow's circle for the
    // tail to read as a tail instead of a stray arrow. Expressed as a fraction, not px, so it
    // holds at every zoom level the road is drawn at.
    const x = from.x + (to.x - from.x) * 0.7
    const y = from.y + (to.y - from.y) * 0.7
    const dx = from.x - x
    const dy = from.y - y
    const len = Math.hypot(dx, dy) || 1
    return { x, y, halfWidth, halfHeight, nx: dx / len, ny: dy / len }
  }, [tomorrowLabel, ghosts])

  // Ghosts are part of what overview has to fit — they sit past today, so on a path whose last
  // stretch is climbing they are the topmost thing on screen. The 0 seed keeps this defined for an
  // empty history (and costs nothing otherwise: the path always starts at the origin).
  const { minX, maxX, minY, maxY } = useMemo(() => {
    let minX = 0
    let maxX = 0
    let minY = 0
    let maxY = 0
    for (const p of [...points, ...ghosts]) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    return { minX, maxX, minY, maxY }
  }, [points, ghosts])
  const boxCenterX = (minX + maxX) / 2
  const boxCenterY = (minY + maxY) / 2

  // scrollScale itself (a fixed "about this many days fill the screen vertically" density, so it
  // stays constant as you scroll with no rescaling jump) is computed above, ahead of
  // computePathPoints. Width doesn't factor into it: the camera continuously re-centers
  // horizontally on whatever's on screen (see focalXRef below), so only the path's *local* sideways
  // wobble (ZIGZAG_AMPLITUDE_PX + MAX_WOBBLE_PX, well under containerWidth at this scale) needs to
  // fit — never its cumulative drift over the whole history. The week box is the one exception,
  // which is exactly why its own geometry is pre-sized against containerWidth instead.
  //
  // No lower bound here, and that is the point. Overview's whole contract is "the entire route,
  // fitted"; flooring it at MIN_SCALE quietly broke that contract on exactly the history it matters
  // for. A year of days is ~15000px of road, which wants a scale of 0.027 — floored to 0.1 the road
  // was drawn nearly four times too large, and two thirds of it sat outside the container with
  // nothing on screen to admit it. A long history simply draws small: a thread of coloured specks
  // *is* what a map of three hundred days looks like, and it still carries the shape, which is the
  // one thing this view exists to show.
  //
  // The padding is in screen px rather than the old 200 local units, so it stays a visible margin
  // at every scale instead of vanishing to 5px on a long road (and swallowing a quarter of the
  // container on a short one).
  const overviewScale = Math.min(
    1,
    (containerHeight - 2 * OVERVIEW_PADDING_PX) / Math.max(1, maxY - minY),
    (containerWidth - 2 * OVERVIEW_PADDING_PX) / Math.max(1, maxX - minX),
  )

  // The base scale that fits the current data (scroll or overview) is recomputed from
  // days/container on every render; zoomFactor is only the user's manual pinch on top of
  // overview's fit, so newly added/removed days keep the path correctly framed without a stale
  // scale left over from before the data changed.
  const [zoomFactor, setZoomFactor] = useState(1)
  // A pinch only applies on top of overview's fit, so leaving or re-entering overview drops it —
  // otherwise a zoom level pinched into one visit would silently persist into the next. Adjusted
  // during render rather than in an effect, so no frame is ever painted with the stale factor.
  const [pinchedWhileZoomedOut, setPinchedWhileZoomedOut] = useState(zoomedOut)
  if (pinchedWhileZoomedOut !== zoomedOut) {
    setPinchedWhileZoomedOut(zoomedOut)
    setZoomFactor(1)
  }
  const pinchState = useRef<{ startDistance: number; startScale: number } | null>(null)
  const activeTouches = useRef<Map<number, { x: number; y: number }>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const innerGroupRef = useRef<SVGGElement>(null)
  // Local path-space x currently centered horizontally — the "camera" the scroll view follows.
  // A ref, not state: it updates every scroll frame, and going through React state/re-render for
  // that would re-render the whole circle list at scroll frequency.
  // Seeded from the frame, not from today: the recenter effect below settles on the same value a
  // tick later, and seeding with today's own position instead would paint one frame at the old
  // "today is the centre" placement and then jump.
  const initialFrame = cameraFrame(cameraTrack, lastIndex, {
    scale: scrollScale,
    containerHeight,
    focusedDaysCount,
    backFraction: cameraBackFraction,
  })
  const focalXRef = useRef(initialFrame.x)
  // Same as focalXRef, but for what the frame centres on vertically — the window mean, not the
  // camera point (see cameraFrame). They differ by exactly the offset that puts today where it
  // honestly falls relative to the road around it.
  const focalYRef = useRef(initialFrame.centerY)
  // Tracks the last (todayDayId, days.length, today's x/y) combo the "bring today into view" effect
  // acted on, so a container resize alone (which reruns that effect but changes none of these) never
  // forces a recenter. See that effect below for the full rationale.
  const recenterKeyRef = useRef<string | null>(null)
  const prevZoomedOutRef = useRef(zoomedOut)
  /**
   * Which way today lies when it is off the frame, or null while it is in view — the state of the
   * button that flies back to it (Duolingo's "jump to your current lesson", which appears only once
   * you have browsed away from it).
   *
   * The direction is read off the geometry, never off "you are in the past, so today is ahead".
   * Scroll position cannot answer it here: the road climbs while things go well and turns over in a
   * slump, so from the same scroll position today sits above the frame in one history and below it
   * in another. This is the same reason the camera frames by content rather than by an assumed
   * heading (see CAMERA_WINDOW_BACK_FRACTION).
   */
  const [todayOffScreen, setTodayOffScreen] = useState<'up' | 'down' | null>(null)

  // The pinch clamps against the fit, not against an absolute floor: below the fit there is nothing
  // further to reveal, so zooming out past it would only shrink the road inside a container it
  // already fits in.
  const scale = zoomedOut
    ? Math.min(MAX_SCALE, Math.max(overviewScale, zoomFactor * overviewScale))
    : scrollScale

  // Where the point the inner group centres on (centeredX/centeredY below) lands on screen. The
  // two groups compose as `screen = translate + scale * (local − centered)`, so this is the whole
  // vertical placement: in overview the box centre goes to the middle of the container, and in the
  // scroll view the camera's current point is pinned at a fixed screen row (FOCUS_VIEWPORT_FRACTION
  // down) forever — it no longer depends on scroll position at all. All movement through history
  // happens on the inner group, driven by the scroll-progress -> (x,y) camera position (see focusOn).
  //
  // Note this is *not* `containerHeight / 2 − boxCenterY * scale` in overview: the inner group
  // already subtracts boxCenterY inside the same scale, so doing it here as well double-counts it
  // and pushes the whole path off-centre by its own height.
  //
  // The same row serves the scroll view: what the inner group centres on there is the window mean
  // (see cameraFrame), so where *today* lands is the frame's output rather than its input. Keeping
  // the row fixed also keeps this group's 200ms transition — which exists for the zoom toggle —
  // clear of the per-frame camera updates, which are written straight to the inner group.
  const translateY = containerHeight / 2
  // Height of the invisible spacer that gives the scroll container its physical scroll room — the
  // SVG itself stays pinned (position: sticky) at containerHeight, so this is the entire scrollable
  // range: scrollTop runs from 0 (first day) through `lastIndex * scrollPxPerDay` (today, where the
  // recenter below parks it) and on to this value (the far end of the horizon).
  const spacerHeight = zoomedOut ? 0 : Math.max(0, cameraTrack.length - 1) * scrollPxPerDay
  // The point currently centered: the whole box in overview (static), or wherever the camera has
  // scrolled to in the scroll view (focalXRef/focalYRef, updated by the scroll handler below).
  const centeredX = zoomedOut ? boxCenterX : focalXRef.current
  const centeredY = zoomedOut ? boxCenterY : focalYRef.current

  /**
   * Local path units -> screen px inside this container, the same composition the two nested
   * groups apply: `screen = translate + scale * (local - centred)`. The camera refs are read at
   * call time, not at render time, because the scroll handler writes the camera straight to the
   * DOM between renders — reading the render-time copy would anchor a card to where the tapped
   * circle stood one frame ago.
   */
  const toScreen = (x: number, y: number, radius: number): PopoverAnchor => ({
    x: containerWidth / 2 + (x - (zoomedOut ? boxCenterX : focalXRef.current)) * scale,
    y: containerHeight / 2 + (y - (zoomedOut ? boxCenterY : focalYRef.current)) * scale,
    radius: radius * scale,
  })


  // Move the camera to a *continuous* index into `points` (e.g. 2.4 = 40% of the way from day 2 to
  // day 3), linearly interpolating (x,y) between the two bracketing points. Days are laid down by
  // pathEngine as fixed-length steps (~DAY_SPACING_PX apart, see computePathPoints), so they're
  // already near-equidistant — interpolating between chronological neighbors like this is both
  // continuous (no jumps, unlike snapping to whichever point is nearest by y) and correct (never
  // locks onto a point from an unrelated loop just because the path doubled back near it).
  // Memoized on exactly the frame inputs it reads, so the scroll listener below can depend on it
  // without re-subscribing every render.
  const focusOn = useCallback(
    (indexFloat: number) => {
      const pts = trackRef.current
      if (pts.length === 0) return
      const { x, centerY } = cameraFrame(pts, indexFloat, {
        scale,
        containerHeight,
        focusedDaysCount,
        backFraction: cameraBackFraction,
      })
      focalXRef.current = x
      focalYRef.current = centerY
      if (innerGroupRef.current) innerGroupRef.current.style.transform = `translate(${-x}px, ${-centerY}px)`
      // Where today landed on screen under this very frame — `screen = translate + scale * (local −
      // centred)`, the same composition the two groups apply. Reading the button's state off the
      // drawn position rather than off the scroll number is what makes it honest: it appears exactly
      // when today leaves the picture, and points where today actually is.
      const screenX = containerWidth / 2 + (lastX - x) * scale
      const screenY = containerHeight / 2 + (lastY - centerY) * scale
      const inFrame =
        screenX > TODAY_IN_FRAME_MARGIN_PX &&
        screenX < containerWidth - TODAY_IN_FRAME_MARGIN_PX &&
        screenY > TODAY_IN_FRAME_MARGIN_PX &&
        screenY < containerHeight - TODAY_IN_FRAME_MARGIN_PX
      setTodayOffScreen(inFrame ? null : screenY < containerHeight / 2 ? 'up' : 'down')
    },
    [scale, containerWidth, containerHeight, focusedDaysCount, cameraBackFraction, lastX, lastY],
  )

  // Bring "today" into view whenever the scroll view becomes active (mount, or switching back
  // from overview), a new day starts, or today's own point moves (e.g. toggling a task shifts
  // today's heading/position without changing todayDayId or days.length) — otherwise a manual
  // scroll to browse old history is left alone, the same way the old center-on-today behavior
  // never fought a user who'd zoomed out. `recenterKeyRef` tracks the logical reasons to recenter,
  // so a bare container resize (which doesn't even appear in this effect's deps any more, now that
  // scroll position is index-based rather than pixel-based) never yanks a manually-scrolled view
  // back to today.
  useEffect(() => {
    if (zoomedOut) {
      prevZoomedOutRef.current = true
      return
    }
    const el = scrollContainerRef.current
    if (!el) return
    const enteringFocus = prevZoomedOutRef.current
    prevZoomedOutRef.current = false
    const key = `${todayDayId}:${days.length}:${lastX.toFixed(1)}:${lastY.toFixed(1)}`
    if (!enteringFocus && recenterKeyRef.current === key) return
    recenterKeyRef.current = key
    focusOn(lastIndex)
    el.scrollTop = lastIndex * scrollPxPerDay
    // focusOn is a dependency because it carries the frame; the recenterKeyRef guard above is what
    // keeps a bare resize (which changes it) from yanking a manually-scrolled view back to today.
  }, [zoomedOut, todayDayId, days.length, lastX, lastY, scrollPxPerDay, focusOn])

  // Camera-follow: as the container scrolls, move the camera through `points` in lockstep, so the
  // user only ever scrolls vertically and the path's wander (both its curve and its own vertical
  // ups and downs) is always centered under them — a native listener (not React's onScroll) kept
  // off the render path and rAF-throttled, since this can fire at native scroll frequency.
  useEffect(() => {
    if (zoomedOut) return
    const el = scrollContainerRef.current
    if (!el) return
    let rafId: number | null = null
    function handleScroll() {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const el = scrollContainerRef.current
        if (!el) return
        focusOn(el.scrollTop / scrollPxPerDay)
      })
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
    // focusOn changes only when the frame does — a resize or the zoom toggle, never at scroll
    // frequency — so re-installing the listener then costs nothing, and it is cheaper than the
    // alternative of mirroring those inputs into a ref written during render.
  }, [zoomedOut, scrollPxPerDay, focusOn])

  /**
   * The scroll position that brings a point on the road up to `targetY`, or null if none does.
   *
   * It is searched, not solved. The camera does not track a circle — it centres on the mean height
   * of the window around it (see cameraFrame), so how far a given circle moves for a given scroll
   * depends on which way the road is running there: on a climbing stretch scrolling forward pushes
   * a point *down* the screen, on a falling one it lifts it, and across a flat stretch it barely
   * moves it at all. There is no formula to invert; there is a camera to try positions on, and
   * cameraFrame is pure, so trying them costs nothing.
   *
   * Candidates are walked outwards from where the view stands now, so the first one that clears the
   * row is also the smallest movement that does — the road is nudged, never swung. If nothing
   * clears it (a road running sideways cannot lift anything), the best position is taken only if it
   * is a real improvement; otherwise the view stays put and the card fits itself instead.
   */
  function scrollTopThatRaises(localY: number, targetY: number, el: HTMLDivElement): number | null {
    const track = trackRef.current
    if (track.length === 0) return null
    const frameOptions = {
      scale,
      containerHeight,
      focusedDaysCount,
      backFraction: cameraBackFraction,
    }
    const rowAt = (index: number) =>
      containerHeight / 2 + (localY - cameraFrame(track, index, frameOptions).centerY) * scale

    const maxIndex = Math.max(0, (el.scrollHeight - el.clientHeight) / scrollPxPerDay)
    const from = el.scrollTop / scrollPxPerDay
    const startRow = rowAt(from)
    let best: { index: number; row: number } | null = null

    for (let away = 0; away <= SEARCH_REACH_DAYS; away += SEARCH_STEP_DAYS) {
      for (const index of away === 0 ? [from] : [from - away, from + away]) {
        if (index < 0 || index > maxIndex) continue
        const row = rowAt(index)
        if (row <= targetY + TAP_FOCUS_TOLERANCE_PX) return index * scrollPxPerDay
        if (!best || row < best.row) best = { index, row }
      }
    }
    return best && startRow - best.row >= MIN_WORTHWHILE_LIFT_PX ? best.index * scrollPxPerDay : null
  }

  /**
   * Open something that stands on the road: bring it up to the tap row first, then report where it
   * actually landed.
   *
   * A card opens *downwards* out of the thing that was tapped — always, so the gesture has one
   * answer instead of two. That is only possible if there is room below it, and on a road the user
   * scrolls there often is not: today rests a little past halfway down the frame, and a circle
   * tapped near the bottom edge has nothing under it at all. So the road moves first, by the
   * shortfall and no more, and the card follows the circle to its new place.
   *
   * Only upwards, and only when the thing sits below the row: a circle already high in the frame
   * has all the room it needs, and pushing the road down to centre it would move the user's view
   * for nothing. The road is the subject here, not a backdrop — it is moved when a card cannot open
   * otherwise, never as decoration.
   *
   * Where it lands is measured, not predicted. The camera centres on the window's mean height (see
   * cameraFrame), not on any one circle, so a scroll of N px does not move a given circle by a
   * knowable amount — the step below is one Newton step on that relation, good to a few px, and the
   * anchor is then read off the settled view rather than off the guess.
   */
  function openOnRoad(localX: number, localY: number, localRadius: number, report: (anchor: PopoverAnchor) => void) {
    const el = scrollContainerRef.current
    const here = toScreen(localX, localY, localRadius)
    const targetY = containerHeight * TAP_FOCUS_FRACTION
    if (zoomedOut || !el || here.y <= targetY + TAP_FOCUS_TOLERANCE_PX) {
      report(here)
      return
    }
    const top = scrollTopThatRaises(localY, targetY, el)
    if (top === null || Math.abs(top - el.scrollTop) < 1) {
      report(here)
      return
    }
    // The camera-follow listener is rAF-throttled, so it can still be a frame behind the last
    // scroll position written — and a frame behind is a card anchored a few px off the circle.
    // Pulling the camera to the final position here makes the anchor exact.
    const arrive = () => {
      focusOn(top / scrollPxPerDay)
      report(toScreen(localX, localY, localRadius))
    }

    if (prefersReducedMotion()) {
      el.scrollTop = top
      arrive()
      return
    }

    // The road is glided by hand rather than by `scrollTo({ behavior: 'smooth' })` because the card
    // has to open at the end of the movement, and a native smooth scroll never says when it is
    // done — there is no callback, `scrollend` is not everywhere, and watching scrollTop go still
    // mistakes a slow first frame for an arrival. Here the last frame is the arrival.
    const from = el.scrollTop
    const distance = top - from
    const duration = Math.min(
      SCROLL_GLIDE_MAX_MS,
      SCROLL_GLIDE_BASE_MS + Math.abs(distance) * SCROLL_GLIDE_MS_PER_PX,
    )
    // The clock is the one rAF hands in, so the glide is timed by the frames it is drawn on.
    let startedAt = 0
    let wrote = from
    const step = (frameTime: number) => {
      if (startedAt === 0) startedAt = frameTime
      const now = scrollContainerRef.current
      if (!now) return
      // A thumb on the screen outranks us: if the view is not where we last put it, the user is
      // scrolling, and the card opens on the circle where it stands rather than fighting for it.
      if (Math.abs(now.scrollTop - wrote) > 1) {
        report(toScreen(localX, localY, localRadius))
        return
      }
      const t = Math.min(1, (frameTime - startedAt) / duration)
      // Ease-in-out: the road pulls away as gently as it arrives. Ease-out alone starts at full
      // speed, and starting at full speed from under the user's finger is the jolt itself — the
      // movement has to look like it was begun, not like the view was yanked.
      wrote = from + distance * (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
      now.scrollTop = wrote
      if (t < 1) requestAnimationFrame(step)
      else arrive()
    }
    requestAnimationFrame(step)
  }

  // The camera-follow listener above turns this one assignment into the whole flight back, so the
  // road is scrolled through rather than cut to — the same motion the user's own thumb produces.
  function scrollToToday() {
    scrollContainerRef.current?.scrollTo({ top: lastIndex * scrollPxPerDay, behavior: 'smooth' })
  }

  function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function handlePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'touch') return
    activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activeTouches.current.size === 2) {
      const [a, b] = [...activeTouches.current.values()]
      pinchState.current = { startDistance: distanceBetween(a, b), startScale: zoomFactor }
    }
  }

  function handlePointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'touch' || !activeTouches.current.has(e.pointerId)) return
    activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activeTouches.current.size === 2 && pinchState.current) {
      const [a, b] = [...activeTouches.current.values()]
      const ratio = distanceBetween(a, b) / pinchState.current.startDistance
      setZoomFactor(pinchState.current.startScale * ratio)
    }
  }

  function handlePointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    activeTouches.current.delete(e.pointerId)
    if (activeTouches.current.size < 2) pinchState.current = null
  }

  function renderMilestoneChip(chip: (typeof chips)[number]) {
    const { kind, n, x: cx, y: cy, text, fit } = chip
    const { width: chipWidth, height, depth, fontSize } = milestoneChipGeometry(text, fit)
    return (
      <g key={n !== undefined ? `${kind}-${n}` : kind}>
        {/* plinth: a solid offset copy underneath, same idiom as the day circles' shadow */}
        <rect
          x={cx - chipWidth / 2}
          y={cy - height / 2 + depth}
          width={chipWidth}
          height={height}
          rx={height / 2}
          fill="var(--color-brand-plinth)"
        />
        <rect
          x={cx - chipWidth / 2}
          y={cy - height / 2}
          width={chipWidth}
          height={height}
          rx={height / 2}
          fill="var(--color-brand)"
        />
        <text
          x={cx}
          y={cy + fontSize / 3}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily="var(--font-sans)"
          fontWeight={700}
          letterSpacing={0.5 * fit}
          fill="var(--color-text-on-brand)"
        >
          {text}
        </text>
      </g>
    )
  }

  function renderWeekBox(box: WeekBoxPoint) {
    const { size, depth } = weekBoxGeometry
    return (
      <g key={`week-box-${box.n}-${box.slot}`}>
        {/* No connecting line to the day circle — like Duolingo's side illustrations, the box just
            nestles up against it (see WEEK_BOX_GAP_PX) rather than being tethered to it. */}
        {/* plinth: a solid offset copy underneath, same idiom as the day circles' shadow */}
        <rect
          x={box.x - size / 2}
          y={box.y - size / 2 + depth}
          width={size}
          height={size}
          rx={16}
          fill="var(--cobalt-700)"
        />
        <rect
          x={box.x - size / 2}
          y={box.y - size / 2}
          width={size}
          height={size}
          rx={16}
          fill="var(--cobalt-500)"
        />
      </g>
    )
  }

  return (
    <div className="relative overflow-hidden" style={{ height: containerHeight, width: containerWidth }}>
      <div
        ref={scrollContainerRef}
        className="hide-scrollbar"
        style={{ height: containerHeight, width: containerWidth, overflowY: zoomedOut ? 'hidden' : 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}
      >
      <svg
        width="100%"
        height={containerHeight}
        style={zoomedOut ? undefined : { position: 'sticky', top: 0, display: 'block' }}
        onPointerDown={zoomedOut ? handlePointerDown : undefined}
        onPointerMove={zoomedOut ? handlePointerMove : undefined}
        onPointerUp={zoomedOut ? handlePointerUp : undefined}
        onPointerCancel={zoomedOut ? handlePointerUp : undefined}
        className={zoomedOut ? 'touch-none' : undefined}
      >
        <g
          style={{
            transform: `translate(${containerWidth / 2}px, ${translateY}px) scale(${scale})`,
            transition: 'transform 200ms ease-out',
          }}
        >
          {/*
            The camera position lives on this inner group, split out from the outer one above, so it
            can be updated instantly on every scroll frame (see the camera-follow effect) without
            fighting the outer group's transition — which is reserved for scale changes on zoom
            toggle, far rarer. `-centeredX/-centeredY` are in pre-scale local units; the outer
            group's scale() above applies to it like everything else in its subtree, so they don't
            need to be pre-multiplied by scale here.
          */}
          <g ref={innerGroupRef} style={{ transform: `translate(${-centeredX}px, ${-centeredY}px)` }}>
          {showQuestTrack && (
            <>
              <text
                x={(points[0]?.x ?? 0) + QUEST_TRACK_OFFSET_X - 20}
                y={minY - 16}
                fontSize={10}
                fontFamily="var(--font-sans)"
                fill="var(--color-quest-dot)"
              >
                квесты
              </text>
              {points.map((p, i) => {
                const quests = days[i] ? dailyQuestsFor(days[i], days) : []
                const allComplete = quests.length > 0 && quests.every((q) => q.isComplete)
                return (
                  <circle
                    key={`quest-${p.date}`}
                    cx={p.x + QUEST_TRACK_OFFSET_X}
                    cy={p.y}
                    r={DAY_CIRCLE_RADIUS * 0.35}
                    fill={allComplete ? 'var(--color-day-gold)' : 'var(--color-quest-dot)'}
                    opacity={allComplete ? 0.9 : 0.6}
                  />
                )
              })}
            </>
          )}

          {points.map((p, i) => {
            const cy = p.y
            const isToday = days[i]?.id === todayDayId
            const day = days[i]
            const radius = isToday ? DAY_CIRCLE_RADIUS * TODAY_CIRCLE_SCALE : DAY_CIRCLE_RADIUS
            const depth = isToday ? PLINTH_DEPTH_TODAY : PLINTH_DEPTH
            const dimmed = !isToday
            return (
              <g
                key={p.date}
                onClick={() =>
                  day && onDaySelect && openOnRoad(p.x, cy, radius, (anchor) => onDaySelect(day, anchor))
                }
                style={{ cursor: onDaySelect ? 'pointer' : 'default' }}
                opacity={dimmed ? 0.6 : 1}
              >
                {/* plinth: a solid offset copy underneath, standing in for a blurred shadow */}
                <circle cx={p.x} cy={cy + depth} r={radius} fill={TIER_PLINTH[p.colorTier]} />
                <circle cx={p.x} cy={cy} r={radius} fill={TIER_COLOR[p.colorTier]} />
                {p.frozen && faceGlyph(ICON_PATH_D.moon, 'var(--violet-500)', p.x, cy, radius)}
                {/* How the day went, read off the same completionRate the colour is read off, so
                    the two can never disagree — this is one number on two channels, not two facts.

                    It needs two channels because colour alone cannot carry it: three of the four
                    tiers are gold, green and red, and red against green is precisely the pair that
                    merges under the common forms of colour blindness. A glyph here is the readable
                    channel, not decoration.

                    Only the ends are marked. The middle earns its meaning by being bare — a day
                    that is neither closed nor empty reads as partial exactly because nothing is
                    stamped on it, and marking it too would put a badge on every circle in the
                    history and turn the row into texture. A wall of checks is worth having, since
                    repetition there *is* the streak; a wall of three different marks is wallpaper.

                    Drawn in the day's own plinth tone, the way the whole system draws depth: no new
                    ink enters the palette, and the mark reads as stamped into the circle rather
                    than stuck on top of it. */}
                {!p.frozen &&
                  (day?.tasks.length ?? 0) > 0 &&
                  p.completionRate >= 1 &&
                  faceGlyph(ICON_PATH_D.check, TIER_PLINTH[p.colorTier], p.x, cy, radius)}
                {!p.frozen &&
                  (day?.tasks.length ?? 0) > 0 &&
                  p.completionRate <= 0 &&
                  faceGlyph(ICON_PATH_D.minus, TIER_PLINTH[p.colorTier], p.x, cy, radius)}
                {(() => {
                  // One row, centred above the circle, left to right in the order the changes mean
                  // something: the goal arrived, then what the day gained, then what it gave up.
                  // One badge per kind, not per task — archiving a goal is one decision, and six
                  // marks for it would read as six events.
                  const marks: ChangeMark[] = []
                  if ((day?.newGoalIds?.length ?? 0) > 0) marks.push('goal')
                  if (day?.taskChanges?.some((c) => c.kind === 'added')) marks.push('added')
                  if (day?.taskChanges?.some((c) => c.kind === 'removed')) marks.push('removed')
                  const left = p.x - ((marks.length - 1) * CHANGE_BADGE_STEP) / 2
                  return marks.map((mark, mi) =>
                    changeBadge(mark, mark, left + mi * CHANGE_BADGE_STEP, cy - radius - CHANGE_BADGE_GAP),
                  )
                })()}
                {day?.milestonesReached?.map((m, mi) => (
                  <g key={m.taskId} transform={`translate(${p.x - radius - 10 - mi * 16}, ${cy - 8}) scale(0.65)`}>
                    <circle cx={12} cy={8} r={7} fill="none" stroke={MILESTONE_TIER_COLOR[m.tier as 'bronze' | 'gold' | 'platinum']} strokeWidth={2.5} />
                    <path
                      d={AWARD_PATH_D}
                      fill="none"
                      stroke={MILESTONE_TIER_COLOR[m.tier as 'bronze' | 'gold' | 'platinum']}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                ))}
                {isToday && showMascot && (
                  <polygon
                    points={`${p.x},${cy - radius - 60} ${p.x - 7},${cy - radius - 48} ${p.x + 7},${cy - radius - 48}`}
                    fill="var(--color-text-secondary)"
                    transform={`rotate(${(p.completionRate - 0.5) * 60} ${p.x} ${cy - radius - 54})`}
                  />
                )}
              </g>
            )
          })}

          {/* The road ahead: same circle, same rhythm, same grey a day with nothing recorded gets —
              because that is exactly what a future day is. What separates it from an empty *past*
              day is depth, not colour: recorded days sit on a plinth, these are drawn flat. Raised
              means it happened. No lock glyph and no dashes — at a fourteen-day horizon that is
              fourteen badges of noise, and the flatness already says "not yet". */}
          {ghosts.map((g, n) => {
            // The slot the bubble stands in — see tomorrowBubble. Its circle gives way there, and
            // nothing moves to make room. The two cross-fade rather than swapping in one frame,
            // so the slot always holds something.
            const yielded = Boolean(tomorrowBubble) && n === 1 && tomorrowShown
            return (
              <g
                key={`ghost-${n}`}
                onClick={() => onFutureTap?.()}
                style={{
                  cursor: onFutureTap ? 'pointer' : 'default',
                  opacity: yielded ? 0 : 0.5,
                  pointerEvents: yielded ? 'none' : undefined,
                  transition: 'opacity var(--dur-base) var(--ease-out)',
                }}
              >
                <circle cx={g.x} cy={g.y} r={DAY_CIRCLE_RADIUS} fill="var(--color-day-gray)" />
              </g>
            )
          })}

          {/* Today's ring, drawn after every circle on the road — recorded days and the
              ghosts ahead alike. Both reach past today's own circle, so drawn inside today's group
              they were laid down first and then partly buried: the plinth alone, an offset copy of
              the circle sitting `depth` lower, ate the bottom of the ring. A halo can only be drawn
              with the thing it haloes when nothing overlaps it; here the road's own circles do. */}
          {(() => {
            const i = points.findIndex((_, n) => days[n]?.id === todayDayId)
            const p = points[i]
            const day = days[i]
            if (!p || !day) return null
            const radius = DAY_CIRCLE_RADIUS * TODAY_CIRCLE_SCALE
            const ringR = radius + TODAY_RING_OFFSET_PX
            return (
              <g style={{ pointerEvents: 'none' }}>
                {ringSegmentAngles(day.tasks.length, TODAY_RING_GAP_DEG).map((seg, si) => (
                  <path
                    key={si}
                    d={describeArc(p.x, p.y, ringR, seg.start, seg.end)}
                    fill="none"
                    stroke={day.tasks[si].isDone ? TIER_COLOR[p.colorTier] : 'var(--color-surface-track)'}
                    strokeWidth={TODAY_RING_STROKE_PX}
                    strokeLinecap="round"
                  />
                ))}
              </g>
            )
          })()}

          {/* Markers the road is heading toward, hung off the ghost they fall on. They are drawn as
              labels rather than taking a slot of their own the way past milestones do: a slot shifts
              every circle after it, and nothing ahead is settled enough to earn that. */}
          {markersAhead
            .filter((m) => m.daysAhead >= 1 && m.daysAhead <= ghosts.length)
            .map((marker) => {
              const g = ghosts[marker.daysAhead - 1]
              const prev = marker.daysAhead === 1 ? { x: lastX, y: lastY } : ghosts[marker.daysAhead - 2]
              // Hang it off the road's normal, the side the label leans being whichever points
              // left — the same choice today's own pill makes, and for the same reason: the weekly
              // boxes take the other side.
              const dx = g.x - prev.x
              const dy = g.y - prev.y
              const len = Math.hypot(dx, dy) || 1
              const side = -dy / len > 0 ? -1 : 1
              const nx = (-dy / len) * side
              const ny = (dx / len) * side
              // A marker landing on the slot the bubble stands in clears the pill instead of the
              // circle that is no longer drawn there — the label still marks the right point of
              // the road, it just has a wider thing to get around.
              const reach =
                tomorrowBubble && tomorrowShown && marker.daysAhead === 2
                  ? tomorrowBubble.halfWidth + 10
                  : DAY_CIRCLE_RADIUS + 10
              return (
                <g key={`ahead-${marker.label}`} transform={`translate(${g.x + nx * reach}, ${g.y + ny * reach})`}>
                  <text
                    x={nx < 0 ? -4 : 4}
                    y={4}
                    textAnchor={nx < 0 ? 'end' : 'start'}
                    fontSize={11}
                    fontWeight={700}
                    letterSpacing={0.9}
                    fill={marker.kind === 'tier' ? 'var(--color-day-gold)' : 'var(--color-text-muted)'}
                    style={{ fontFamily: 'var(--font-sans)', textTransform: 'uppercase' }}
                  >
                    {marker.label}
                  </text>
                </g>
              )
            })}

          {/* Tomorrow, named in the road's own column — see tomorrowBubble for why it stands in a
              slot instead of beside one, and why standing there moves nothing. The tail points
              back down the road at tomorrow's circle, so the bubble reads as belonging to that
              circle and not to the chain in general. */}
          {tomorrowBubble && (() => {
            const b = tomorrowBubble
            const tipX = b.x + b.nx * (b.halfHeight + 9)
            const tipY = b.y + b.ny * (b.halfHeight + 9)
            const baseX = b.x + b.nx * b.halfHeight
            const baseY = b.y + b.ny * b.halfHeight
            return (
              <g
                role="button"
                aria-label="Что завтра"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onTomorrowTap) openOnRoad(b.x, b.y, b.halfHeight, onTomorrowTap)
                }}
                // It grows out of, and shrinks back into, the point it stands on — the circle it
                // is standing in front of. Scaling from anywhere else would read as the bubble
                // flying in from off the road.
                style={{
                  cursor: onTomorrowTap ? 'pointer' : 'default',
                  transformBox: 'view-box',
                  transformOrigin: `${b.x}px ${b.y}px`,
                  transform: tomorrowShown ? 'scale(1)' : 'scale(0.55)',
                  opacity: tomorrowShown ? 1 : 0,
                  pointerEvents: tomorrowShown ? undefined : 'none',
                  transition: 'transform var(--dur-base) var(--ease-bounce), opacity var(--dur-base) var(--ease-out)',
                }}
              >
                <rect
                  x={b.x - b.halfWidth}
                  y={b.y - b.halfHeight}
                  width={b.halfWidth * 2}
                  height={b.halfHeight * 2}
                  rx={14}
                  fill="var(--color-surface-raised)"
                  stroke="var(--color-border)"
                />
                <path
                  d={`M ${baseX - b.ny * 7} ${baseY + b.nx * 7} L ${tipX} ${tipY} L ${baseX + b.ny * 7} ${baseY - b.nx * 7} Z`}
                  fill="var(--color-surface-raised)"
                />
                <text
                  x={b.x}
                  y={b.y + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={800}
                  letterSpacing={0.9}
                  fill="var(--color-text-primary)"
                  style={{ fontFamily: 'var(--font-sans)', textTransform: 'uppercase' }}
                >
                  {tomorrowLabel}
                </text>
              </g>
            )
          })()}

          {/* What lies past the drawn road, written where the drawn road ends.
              These are the markers further off than the horizon — another goal's tier at 66 more
              kept days, the half-year mark at 143. They used to hang in a stack pinned to the top
              of the screen, which made them the only thing here that was not part of the road, and
              they covered the day circles underneath because nothing had reserved them room.

              A signpost at the end of the road is what a road actually has, and it says the true
              thing: the horizon is where drawing stops, not where the road stops. It costs nothing
              at rest — fourteen days away, it is the reward for scrolling to the edge — which is
              right for things that are one to two months out. */}
          {beyondHorizon.length > 0 && ghosts.length > 0 && (() => {
            const end = ghosts[ghosts.length - 1]
            const before = ghosts.length > 1 ? ghosts[ghosts.length - 2] : { x: lastX, y: lastY }
            const dx = end.x - before.x
            const dy = end.y - before.y
            const len = Math.hypot(dx, dy) || 1
            // One day's travel further on, and then the whole block laid out on the far side of
            // that point: a climbing road puts it above, a falling one below. Placing the block
            // rather than each line is what keeps it reading top to bottom either way — stacking
            // the lines along the travel direction would reverse them on a climb. Offsetting only
            // the anchor and always growing downward is what let the last line land back on the
            // final ghost.
            const ax = end.x + (dx / len) * DAY_SPACING_PX
            const blockHeight = 20 + beyondHorizon.length * 17
            const ay = end.y + (dy / len) * DAY_SPACING_PX - (dy < 0 ? blockHeight : 0)
            return (
              <g opacity={0.75}>
                <text
                  x={ax}
                  y={ay}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  letterSpacing={1.2}
                  fill="var(--color-text-muted)"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  ДАЛЬШЕ
                </text>
                {beyondHorizon.map((m, i) => (
                  <text
                    key={m.label}
                    x={ax}
                    y={ay + 20 + i * 17}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={m.kind === 'tier' ? 'var(--color-day-gold)' : 'var(--color-text-secondary)'}
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {m.label}
                    <tspan dx={6} fill="var(--color-text-muted)" style={{ fontFamily: 'var(--font-display)' }}>
                      {m.daysAhead} дн.
                    </tspan>
                  </text>
                ))}
              </g>
            )
          })()}

          {chips
            // Overview stays to the big, one-time picture (month/half-year/year) — 'start' would
            // otherwise spam a long history with a chip right at its very beginning, and repeating
            // weekly markers would otherwise spam it with dozens of chips.
            .filter((m) => (zoomedOut ? m.kind !== 'start' && m.kind !== 'week' : true))
            .map((chip) => renderMilestoneChip(chip))}

          {/* Weekly boxes: overview would otherwise spam a long history with dozens of them. */}
          {!zoomedOut && weekBoxes.map((box) => renderWeekBox(box))}
          </g>
        </g>
      </svg>
      {!zoomedOut && <div aria-hidden style={{ height: spacerHeight }} />}
      </div>

      {/* Sits outside the scroll container, over it — pinned to the corner of the viewport rather
          than to a place on the road, so it is where the thumb left it however far the user has
          travelled. It exists only in the scroll view: overview already holds the whole road, so
          today is never lost there. */}
      {!zoomedOut && todayOffScreen && (
        <button
          type="button"
          onClick={scrollToToday}
          aria-label="Вернуться к сегодня"
          className="sk-plinth sk-focus absolute bottom-4 right-4 grid size-12 place-items-center rounded-[16px] bg-surface-raised"
          style={{ '--plinth-color': 'var(--ink-950)' } as CSSProperties}
        >
          <Icon name={todayOffScreen === 'up' ? 'arrow-up' : 'arrow-down'} size={24} color="var(--color-brand)" />
        </button>
      )}
    </div>
  )
}
