import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import Icon, { AWARD_PATH_D, ICON_PATH_D } from '../../components/Icon'
import HorizonPanel from '../../components/HorizonPanel'
import { RANK_COLOR } from '../rankColor'
import type { HorizonMarker } from '../../domain/horizon'
import {
  DAY_CIRCLE_MAX_RADIUS,
  DAY_CIRCLE_RADIUS,
  DAY_SPACING_PX,
  TODAY_CIRCLE_SCALE,
  TODAY_RING_OFFSET_PX,
  TODAY_RING_STROKE_PX,
  FOCUSED_DAYS_COUNT,
  FOCUS_LIFT_FALLOFF_DAYS,
  FOCUS_LIFT_PX,
  GHOST_FUTURE_DAYS,
  MILESTONE_BADGE_DEPTH,
  MILESTONE_BADGE_FONT_SIZE,
  MILESTONE_CLEARANCE_PX,
  WEEK_BOX_SIZE_RATIO,
} from '../../domain/config'
import { chipFitScale } from '../../domain/chipFit'
import { formatDayNumber, formatShortMonth } from '../../domain/calendar'
import { rollAnchor, rollDayShown, rollMonthRows, rollPlacement, type RollObstacle } from '../../domain/dateRoll'
import { focusLift, focusLiftWake } from '../../domain/focusLift'
import { plinthBodyPath } from '../../domain/plinthBody'
import {
  computeWeekBoxGeometry,
  milestoneBadgeBox,
  milestoneBadgeFace,
  horizonBandSlotsNeeded,
  milestoneBadgeRadius,
  rosettePathD,
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
  rescheduled: 'var(--color-text-secondary)',
} as const

type ChangeMark = 'goal' | 'added' | 'removed' | 'rescheduled'

/**
 * Inner scale per glyph, not one shared number: plus and minus are two bare strokes across a
 * 14-unit span, while the flag is a drawn shape filling nearly the whole 24-unit box. Sized
 * alike, the flag would touch the disc it sits in and turn to mush at this size.
 */
const CHANGE_BADGE_GLYPH: Record<ChangeMark, { d: string; scale: number; width: number }> = {
  goal: { d: ICON_PATH_D.flag, scale: 0.55, width: 3.2 },
  added: { d: ICON_PATH_D.plus, scale: 0.5, width: 4.5 },
  removed: { d: ICON_PATH_D.minus, scale: 0.5, width: 4.5 },
  rescheduled: { d: ICON_PATH_D.calendar, scale: 0.55, width: 2.6 },
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
 * Daylight, in screen px, the last ghost must keep below the horizon band's lower edge before the
 * band is shown at all.
 *
 * 16px is double the gap a weekly box keeps from a day circle (WEEK_BOX_GAP_PX), because this edge
 * is a straight rule running the full width rather than a small box tucked beside the road, and a
 * rule reads as touching the circle long before a box would.
 */
const HORIZON_BAND_GAP_PX = 16

/**
 * Clearance beyond the bare minimum that the reserved slots aim for, so the band does not appear only
 * in the last pixel of the scroll. Small on purpose: every px of it is scroll the user has to make,
 * and the reserve rounds up to whole slots anyway, which usually grants far more than this.
 */
const HORIZON_BAND_SLACK_PX = 12

/**
 * Whether the road has come out from under the band — the top *edge* of its far end, which is the
 * topmost thing drawn, standing clear of the band's lower edge by HORIZON_BAND_GAP_PX.
 *
 * This is what the band's visibility hangs on, and it is the whole reason it hangs on anything. The
 * band is pinned under the goal card, where a heading belongs; the road, meanwhile, comes down from
 * above as the horizon is approached, so for part of that approach it is behind the band. Showing
 * the band then would put a straight edge across a ghost circle — which reads as a rendering fault,
 * not as a boundary. So the band waits for the road to clear it, and once clear it stays clear: the
 * end only ever descends further as the scroll goes on.
 */
function horizonBandClear(roadEndEdgeScreenY: number, bandHeightPx: number): boolean {
  return bandHeightPx > 0 && roadEndEdgeScreenY >= bandHeightPx + HORIZON_BAND_GAP_PX
}

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

/**
 * Высота строки в окне с датой, и сколько строк видно за раз.
 *
 * Одна. Окно показывает **дату**, а не список дат: соседи по бокам читались бы как выбор из
 * трёх, хотя выбирать нечего, и занимали бы втрое больше места у дороги. Одна строка позволяет
 * чипу быть маленьким и стоять рядом с кругом, а не в стороне от него.
 *
 * Смена даты едет 90 мс — это перекид, а не прокрутка. Длительность здесь безопасна ровно потому,
 * что цель всегда одна: переход перенацеливается с того места, где его застали, и очередь
 * лепестков, из-за которой перекидные часы отстали бы на быстром листании, просто не возникает.
 */
const DATE_ROLL_ROW_PX = 22
const DATE_ROLL_ROWS = 1
const DATE_ROLL_FLIP_MS = 90
/** Число и месяц стоят в колонках своей ширины: иначе «6 → 26» дёргает чип, а за ним и стрелку. */
const DATE_ROLL_DAY_W = 16
const DATE_ROLL_MONTH_W = 24
/**
 * Зазор от края круга до чипа, px экрана.
 *
 * Подпись у дороги работает, только пока её не нужно искать: чип стоит вплотную к кругу, который
 * называет, и едет за ним. 8 — примерно толщина обводки круга: меньше читается как часть круга,
 * заметно больше — как отдельная панель у края экрана, чем чип и был. Отмеряется от DAY_CIRCLE_RADIUS,
 * а не от DAY_CIRCLE_MAX_RADIUS: кольцо носит только сегодня, а над сегодня чип и не показывается.
 */
const DATE_ROLL_GAP_PX = 8
/** Сколько чип оставляет себе от края экрана, когда круг подходит к краю вплотную. */
const DATE_ROLL_EDGE_PX = 12
/**
 * Перелёт чипа на другой кружок или на другую сторону дороги.
 *
 * 160 мс с лёгким перелётом — это «оно перепрыгнуло», а не «оно моргнуло»: глаз успевает увидеть
 * само движение и понять, что предмет тот же самый. Длиннее — и на быстром листании чип тянется за
 * дорогой шлейфом; короче — снова телепорт.
 */
const DATE_ROLL_HOP_MS = 160
/** Дальше этого чип не летит, а просто оказывается на месте — см. ниже, у самого перелёта. */
const DATE_ROLL_HOP_MAX_PX = 200
const DATE_ROLL_HOP_EASE = 'cubic-bezier(0.34, 1.4, 0.64, 1)'

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
 * A badge takes one ordinary slot in the snake — exactly DAY_SPACING_PX of road, the same as a day
 * circle. What has to fit in that slot is its radius plus its plinth (see the derivation on
 * MILESTONE_BADGE_RADIUS); the rosette being round, that is the same demand in every direction,
 * which is why it makes almost no difference how the road is leaning where it lands.
 *
 * Reserving a badge's full width as a *gap* in the road instead — which is what the very first
 * layout did, back when this was a wide pill — is what opened 156px craters in the rhythm either
 * side of every weekly marker.
 *
 * `scale` closes the last gap: beside today's circle the ring takes room a plain circle does not
 * (DAY_CIRCLE_MAX_RADIUS), and on a hairpin the road has no budget left to straighten with, so the
 * badge shrinks instead of overlapping (see chipFit.ts). It is 1 virtually everywhere.
 *
 * The outline is cached per radius: every weekly badge on a year of road is the same 120-segment
 * path, and only the translate differs.
 */
const rosetteCache = new Map<number, string>()
function rosetteFor(radius: number): string {
  let d = rosetteCache.get(radius)
  if (d === undefined) {
    d = rosettePathD(radius)
    rosetteCache.set(radius, d)
  }
  return d
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
  /** Dev-only override: how high the focused day stands off its plinth — defaults to FOCUS_LIFT_PX. */
  focusLiftPx?: number
  /** Dev-only override: how many days out the lift reaches — defaults to FOCUS_LIFT_FALLOFF_DAYS. */
  focusLiftFalloffDays?: number
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
  /**
   * A date to open the road on instead of today, once — what a trophy on the profile points at.
   * Applied only when it changes, so browsing away from it afterwards is never undone.
   */
  focusDate?: string | null
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
  focusDate = null,
  scrollPxPerDay = SCROLL_PX_PER_DAY,
  focusLiftPx = FOCUS_LIFT_PX,
  focusLiftFalloffDays = FOCUS_LIFT_FALLOFF_DAYS,
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

  // One layout pass produces everything: day circles, milestone badges, weekly boxes and the
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

  // Today's circle wears a ring, so it reaches DAY_CIRCLE_MAX_RADIUS rather than DAY_CIRCLE_RADIUS.
  // The badge beside it has to clear what is drawn, not what a plain day would have been — this is
  // the same thing that once left the weekly box lying on the ring.
  const obstacles = useMemo(
    () =>
      points.map((p, i) =>
        days[i]?.id === todayDayId ? { x: p.x, y: p.y, radius: DAY_CIRCLE_MAX_RADIUS } : { x: p.x, y: p.y },
      ),
    [points, days, todayDayId],
  )

  // Each badge's face and the scale it has to shrink to to clear its neighbours — an O(points) scan
  // per badge, so it rides in the same memo rather than being redone for every badge on every render.
  const badges = useMemo(
    () =>
      pathMilestones.map((m) => {
        const face = milestoneBadgeFace(m.kind, m.n)
        // Every day circle is a candidate obstacle, not just the two the badge sits between: on a
        // switchback the lane coming back down passes within a badge's reach too. chipFitScale
        // filters by proximity itself, and returns 1 unless something is actually in the way.
        const fit = chipFitScale(
          m.x,
          m.y,
          milestoneBadgeBox(m.kind),
          obstacles,
          DAY_CIRCLE_RADIUS,
          MILESTONE_CLEARANCE_PX,
        )
        return { ...m, face, fit }
      }),
    [pathMilestones, obstacles],
  )

  /**
   * How far the far end of the road reaches from its own centre. A ghost is a plain circle; with no
   * horizon drawn at all the end is today, which wears a ring and reaches half again as far
   * (DAY_CIRCLE_MAX_RADIUS). Every clearance below is taken from this edge rather than from the
   * centre — a gap measured to a centre is a gap that closes by a radius without anyone noticing.
   */
  const roadEndRadius = ghosts.length > 0 ? DAY_CIRCLE_RADIUS : DAY_CIRCLE_MAX_RADIUS

  /** The far end of everything drawn: the last ghost, or today when there is no horizon to draw. */
  const roadEnd = ghosts[ghosts.length - 1] ??
    (points.length > 0 ? { x: points[points.length - 1].x, y: points[points.length - 1].y } : { x: 0, y: 0 })

  /**
   * The horizon band's own element. Its position is written straight to the DOM by the camera, for
   * the same reason the road's inner group is: this moves at native scroll frequency, and putting it
   * through state would re-render the whole road on every frame of a scroll.
   */
  const horizonBandRef = useRef<HTMLDivElement>(null)
  /**
   * The band's rendered height. Measured rather than derived: it is a strip of DOM whose height
   * depends on how many markers are in it and how their names wrap, and a constant guessed here is a
   * constant that goes stale the first time a marker is renamed.
   */
  const [horizonBandHeight, setHorizonBandHeight] = useState(0)
  /** Whether the road currently stands clear of the band — see horizonBandClear. */
  const [horizonBandShown, setHorizonBandShown] = useState(false)

  useLayoutEffect(() => {
    const el = horizonBandRef.current
    if (!el) return
    const update = () => setHorizonBandHeight(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
    // The observer catches every content change; this only has to re-run when the element itself
    // comes or goes, which is the zoom toggle.
  }, [zoomedOut])

  // What the camera can travel along: the recorded road, then the horizon past it. Ghosts carry no
  // day data, so only their positions join the track — scrolling forward is the only thing it is
  // for. Without them the scroll range stops dead at today and the road ahead can never be reached.
  const roadTrack = useMemo(
    () => [...points.map((p) => ({ x: p.x, y: p.y })), ...ghosts],
    [points, ghosts],
  )

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
   * move the road. A mark ahead borrows a ghost slot the same way, for the same reason.
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

  /**
   * Marks ahead, each standing in the ghost slot it will one day occupy.
   *
   * It borrows that slot the way the tomorrow bubble does — the ghost's circle is not drawn and
   * nothing moves — so the road ahead is literally the road you will get: when the day comes the
   * badge goes gold where the grey one already stood. Hung off to the side instead, it was in the
   * wrong place twice over, since a milestone on the recorded road stands *in* the chain, between
   * two days; the side is where the weekly boxes live, and that is a different kind of thing.
   *
   * The slot is exactly the one the real chip will take, which is why the marker carries
   * `slotsAhead` rather than being placed by its days: a chip is laid in the slot *before* the day
   * that crosses its threshold (see computeMilestones), and every chip laid between now and then
   * takes a slot too. So nothing shifts on the handover — the grey badge goes gold in place, and
   * the day that brought it arrives just past it.
   *
   * A slot the bubble holds is conceded rather than worked around: the bubble names tomorrow and
   * is gone by tomorrow, while a mark nudged aside to make room would be lying about when it lands.
   */
  const aheadSlots = useMemo(() => {
    const bubbleSlot = tomorrowBubble && tomorrowShown ? 1 : -1
    const byLabel = new Map<string, number>()
    const taken = new Set<number>()
    for (const m of markersAhead) {
      if (!m.milestone || m.slotsAhead === undefined) continue
      const slot = m.slotsAhead - 1
      if (slot < 0 || slot >= ghosts.length || slot === bubbleSlot || taken.has(slot)) continue
      taken.add(slot)
      byLabel.set(m.label, slot)
    }
    return { byLabel, taken }
  }, [markersAhead, ghosts.length, tomorrowBubble, tomorrowShown])

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
  // Off roadTrack rather than the full camera track: this frames today, which sits on the recorded
  // road, and the slots reserved for the band at the far end cannot reach that far back.
  const initialFrame = cameraFrame(roadTrack, lastIndex, {
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
  const appliedFocusDateRef = useRef<string | null>(null)
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

  /**
   * Empty slots past the last ghost, kept for the horizon band to stand in. Nothing is ever drawn in
   * them; they exist so the road can be walked far enough past its own end that the band standing
   * there fits on screen.
   *
   * Reserved by need rather than by a fixed count, because the need is real and varies: where the
   * last ghost comes to rest at the end of the scroll is decided by the camera's window (see
   * cameraFrame), which reads the shape of the road, so the same band has plenty of room above a
   * road that ends level and none at all above one ending in a climb. On a short screen it could
   * have none either way. Left to a guessed constant, the band's own top is what gets cut — which is
   * worse than the clipped ghost this whole arrangement was built to avoid, since a band is the
   * thing that is supposed to be read.
   *
   * Zero when the resting frame already leaves room, which is the common case.
   */
  const reservedSlots = useMemo(() => {
    if (roadTrack.length < 2) return 0
    const restCenterY = cameraFrame(roadTrack, roadTrack.length - 1, {
      scale,
      containerHeight,
      focusedDaysCount,
      backFraction: cameraBackFraction,
    }).centerY
    return horizonBandSlotsNeeded(
      horizonBandHeight,
      HORIZON_BAND_GAP_PX,
      HORIZON_BAND_SLACK_PX,
      containerHeight / 2 + (roadEnd.y - restCenterY) * scale - roadEndRadius * scale,
      DAY_SPACING_PX * scale,
    )
  }, [roadTrack, roadEnd.y, roadEndRadius, horizonBandHeight, scale, containerHeight, focusedDaysCount, cameraBackFraction])

  // Kept in sync every render so the scroll listener's effect (which doesn't re-subscribe on every
  // data change — see its dependency array) always reads the current points, never a stale closure.
  const cameraTrack = useMemo(() => {
    if (reservedSlots === 0) return roadTrack
    const track = [...roadTrack]
    const end = track[track.length - 1]
    const before = track[track.length - 2]
    if (!end || !before) return track
    // Straight on along the road's final heading: these slots are scroll room, not road, and bending
    // them would be inventing a shape for a stretch nobody has walked.
    const dx = end.x - before.x
    const dy = end.y - before.y
    const len = Math.hypot(dx, dy) || 1
    for (let i = 1; i <= reservedSlots; i++) {
      track.push({ x: end.x + (dx / len) * DAY_SPACING_PX * i, y: end.y + (dy / len) * DAY_SPACING_PX * i })
    }
    return track
  }, [roadTrack, reservedSlots])
  const roadEndRef = useRef(roadEnd)
  // oxlint-disable-next-line react/refs
  roadEndRef.current = roadEnd
  const roadEndRadiusRef = useRef(roadEndRadius)
  // oxlint-disable-next-line react/refs
  roadEndRadiusRef.current = roadEndRadius
  const trackRef = useRef(cameraTrack)
  // Written during render on purpose — this is the latest-value pattern, not state: the listener
  // has to see the current points on the very frame they change, and an effect would hand them
  // over one frame late.
  // oxlint-disable-next-line react/refs
  trackRef.current = cameraTrack

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
  // Read during render on purpose: this is where the camera *is*, and the transform below has to
  // be written with it in the same frame. Held in state instead, every scroll frame would re-render
  // the whole road; taken from a layout effect instead, the road would paint once at the old
  // position first.
  // oxlint-disable-next-line react/refs
  const centeredX = zoomedOut ? boxCenterX : focalXRef.current
  // oxlint-disable-next-line react/refs
  const centeredY = zoomedOut ? boxCenterY : focalYRef.current

  // Where the far end of the drawn road stands on screen under the camera as it is this frame — the
  // same composition the two groups apply. Only the band's first paint reads it; after that the
  // camera writes the band's position straight to the DOM.
  // oxlint-disable-next-line react/refs
  const roadEndEdgeScreenY = containerHeight / 2 + (roadEnd.y - centeredY) * scale - roadEndRadius * scale

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


  // --- Focus lift -----------------------------------------------------------
  // The circle the scroll is standing on rises off its plinth, its neighbours less so (see
  // focusLift). Everything here is DOM, not state, for the same reason the camera is: it updates on
  // every scroll frame, and a re-render of the whole circle list at that rate is the one thing this
  // component is built to avoid.
  //
  // Nodes register themselves by day index rather than being looked up, so the lift never has to
  // know how the road is drawn — today's ring lives in a different block entirely and still rides
  // along by registering under the same index.
  const liftNodesRef = useRef<Map<number, Set<SVGGElement>>>(new Map())
  // Last value written per index, so a frame that changes nothing writes nothing: outside the
  // falloff every index is already at 0 and stays there, which is most of the road.
  const liftValuesRef = useRef<Map<number, number>>(new Map())
  // Where the lift is aimed right now, kept so a re-render (which hands back fresh DOM nodes with
  // no transform on them) can restore it without waiting for the next scroll frame.
  const liftIndexRef = useRef(lastIndex)

  // The bodies the circles stand on. Kept apart from the lifted nodes because they do not move —
  // they *stretch*: the face rises, the ground stays, and the body between them is redrawn. Their
  // geometry is handed in at registration rather than looked up, so a frame only has to add the
  // lift to a depth it already knows.
  const bodyNodesRef = useRef<Map<number, { el: SVGPathElement; cx: number; cy: number; r: number; depth: number }>>(
    new Map(),
  )

  const registerBody = useCallback(
    (index: number, cx: number, cy: number, r: number, depth: number) => (el: SVGPathElement | null) => {
      if (!el) return
      bodyNodesRef.current.set(index, { el, cx, cy, r, depth })
      return () => {
        if (bodyNodesRef.current.get(index)?.el === el) bodyNodesRef.current.delete(index)
      }
    },
    [],
  )

  // The date roll: the strip of days that rides beside the road while you look back. Written to the
  // DOM from the camera's own frame like everything else here — through state it would re-render a
  // year of rows at scroll frequency.
  const dateRollRef = useRef<HTMLButtonElement>(null)
  const dateStripRef = useRef<HTMLSpanElement>(null)
  const dateMonthStripRef = useRef<HTMLSpanElement>(null)
  // Измеряется один раз: чип встаёт правым краем у круга, а значит его ширина нужна каждый кадр, и
  // читать offsetWidth после записи left — значит просить перерасчёт вёрстки на каждом кадре скролла.
  // Ширина здесь постоянная: колонки фиксированы, стрелка стоит всегда, пока чип виден.
  const dateRollWidthRef = useRef(0)
  const dateRollHeightRef = useRef(0)
  const dateRollSideRef = useRef<-1 | 1>(-1)
  const dateRollDayRef = useRef(-1)
  const dateRollAnchorRef = useRef<{ x: number; y: number } | null>(null)
  const monthRows = useMemo(() => rollMonthRows(points.map((p) => p.date)), [points])

  const registerLift = useCallback(
    (index: number) => (el: SVGGElement | null) => {
      if (!el) return
      const byIndex = liftNodesRef.current
      let set = byIndex.get(index)
      if (!set) byIndex.set(index, (set = new Set()))
      set.add(el)
      return () => {
        set.delete(el)
        if (set.size === 0) byIndex.delete(index)
      }
    },
    [],
  )

  const applyFocusLift = useCallback((indexFloat: number | null) => {
    liftIndexRef.current = indexFloat ?? liftIndexRef.current
    // How far back the scroll is looking. The lift is a cursor through history, so it is asleep at
    // rest (where the road parks on today) and wakes as you scroll away from it — see focusLiftWake.
    const wake = indexFloat === null ? 0 : focusLiftWake(lastIndex - indexFloat)
    for (const [index, nodes] of liftNodesRef.current) {
      // null = overview, where there is no "day you are standing on" to raise.
      const lift = indexFloat === null ? 0 : wake * focusLift(index - indexFloat, focusLiftPx, focusLiftFalloffDays)
      // Sub-tenth-px changes are below what a 22px circle can show and still cost a layout write.
      if (Math.abs((liftValuesRef.current.get(index) ?? 0) - lift) < 0.05) continue
      liftValuesRef.current.set(index, lift)
      for (const el of nodes) {
        if (lift === 0) el.removeAttribute('transform')
        else el.setAttribute('transform', `translate(0 ${-lift})`)
      }
      // The body follows the face up while its foot stays on the road, so what grows is the
      // extrusion — which is the whole reason the lift reads as "standing taller" rather than as a
      // circle floating above its own shadow.
      const body = bodyNodesRef.current.get(index)
      if (body) body.el.setAttribute('d', plinthBodyPath(body.cx, body.cy - lift, body.r, body.depth + lift))
    }
    // The roll shares the lift's wake, not a rule of its own: at rest the road stands on today, and
    // a date printed over today says the one thing it cannot fail to say. It appears when you look
    // back, for the same reason the lift does.
    if (dateRollRef.current) {
      dateRollRef.current.style.opacity = String(wake)
      // Появляется не в воздухе, а как бы выдвигаясь из-под кружка: последняя десятая роста идёт
      // вместе с той же волной, что поднимает сам день, так что подпись и лифт — одно движение.
      dateRollRef.current.style.setProperty('--roll-scale', String(0.9 + 0.1 * wake))
      // Faded out it must not be tappable: a target you cannot see is a target you press by accident.
      dateRollRef.current.style.pointerEvents = wake > 0 ? 'auto' : 'none'
    }
    if (indexFloat !== null) {
      const shown = rollDayShown(indexFloat)
      const box = DATE_ROLL_ROW_PX * DATE_ROLL_ROWS
      if (dateStripRef.current) {
        dateStripRef.current.style.transform = `translateY(${rollPlacement(shown, DATE_ROLL_ROW_PX, box).offsetPx}px)`
      }
      // Месяц едет своей лентой по своим строкам — на смене месяца, а не каждый день вместе с числом.
      const rows = monthRows.rowOfIndex
      const monthRow = rows[Math.max(0, Math.min(shown, rows.length - 1))] ?? 0
      if (dateMonthStripRef.current) {
        dateMonthStripRef.current.style.transform = `translateY(${rollPlacement(monthRow, DATE_ROLL_ROW_PX, box).offsetPx}px)`
      }
    }
  }, [focusLiftPx, focusLiftFalloffDays, lastIndex, monthRows])

  // Restore the lift after any render: React hands back nodes with no transform attribute (it never
  // set one), so without this a task toggle would drop the road flat until the next scroll frame.
  useLayoutEffect(() => {
    applyFocusLift(zoomedOut ? null : liftIndexRef.current)
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
      applyFocusLift(indexFloat)
      if (innerGroupRef.current) innerGroupRef.current.style.transform = `translate(${-x}px, ${-centerY}px)`
      // Where today landed on screen under this very frame — `screen = translate + scale * (local −
      // centred)`, the same composition the two groups apply. Reading the arrow's direction off the
      // drawn position rather than off the scroll number is what makes it honest: it points where
      // today actually is.
      const screenY = containerHeight / 2 + (lastY - centerY) * scale
      // Куда идти домой — но не «стоит ли показывать»: стрелка живёт ровно столько, сколько сам чип,
      // а он появляется, только когда смотришь назад. Прятать её по рамке значило бы убрать подсказку
      // на последних днях пути к сегодня — там, где до цели остаётся один экран и она нужнее всего.
      setTodayOffScreen(screenY < containerHeight / 2 ? 'up' : 'down')
      // The band is measured against the last ghost — the topmost thing drawn — not against the
      // empty slots reserved beyond it.
      const endEdgeScreenY =
        containerHeight / 2 + (roadEndRef.current.y - centerY) * scale - roadEndRadiusRef.current * scale
      setHorizonBandShown(horizonBandClear(endEdgeScreenY, horizonBandHeight))
      // The roll stands beside the circle it names — the *rounded* day, not the fractional position
      // between two. The window prints one day, and a label parked between two days argues with it.
      // Moving from circle to circle is a jump, not a glide, and it happens in the same instant as
      // the date flips: one click, one day, chip and number together.
      const shown = Math.max(0, Math.min(rollDayShown(indexFloat), pts.length - 1))
      const focus = pts[shown]
      const roll = dateRollRef.current
      if (roll) {
        // Measured once: the chip's own size is needed every frame, and reading offsetWidth after
        // writing left would ask for a layout on each scroll frame. Both are constant here —
        // the columns are fixed and the arrow is there whenever the chip is.
        if (dateRollWidthRef.current === 0) {
          dateRollWidthRef.current = roll.offsetWidth
          dateRollHeightRef.current = roll.offsetHeight
        }
        const cx = containerWidth / 2 + (focus.x - x) * scale
        const cy = containerHeight / 2 + (focus.y - centerY) * scale
        const r = DAY_CIRCLE_RADIUS * scale
        // What else can land on the chip's own row: the nearest days along the road (on a turn the
        // road brings its own neighbours alongside) and the weekly boxes in the gutter. Both are
        // taken from the drawn frame, so the choice is made against what is actually on screen.
        const obstacles: RollObstacle[] = []
        // Пять дней в каждую сторону, а не два-три: на развороте дорога подводит к дню соседа из
        // другого витка, и он оказывается ближе, чем следующий по счёту.
        for (let i = shown - 5; i <= shown + 5; i++) {
          if (i === shown || i < 0 || i >= pts.length) continue
          // Каждый предмет на дороге стоит на плинте и потому занимает больше места, чем его лицо:
          // тело уходит вниз на depth и заканчивается своей же нижней дугой. Считать по лицу —
          // значит разрешить подписи лечь ровно на ту тень, которой предмет держится за дорогу.
          const isTodayCircle = i === lastIndex
          const faceR = (isTodayCircle ? DAY_CIRCLE_MAX_RADIUS : DAY_CIRCLE_RADIUS) * scale
          const depth = (isTodayCircle ? PLINTH_DEPTH_TODAY : PLINTH_DEPTH) * scale
          // И лифт: дни у фокуса поднимаются, и на 8 px это ровно тот зазор, который мы оставляем.
          const lift = (liftValuesRef.current.get(i) ?? 0) * scale
          obstacles.push({
            x: containerWidth / 2 + (pts[i].x - x) * scale,
            y: containerHeight / 2 + (pts[i].y - centerY) * scale - lift + depth / 2,
            halfW: faceR,
            halfH: faceR + depth / 2,
          })
        }
        const boxHalf = (weekBoxGeometry.size * scale) / 2
        const boxDepth = weekBoxGeometry.depth * scale
        for (const box of weekBoxes) {
          // Only the ones near the chip's row matter, and the road is laid down in order, so this
          // stays a couple of comparisons rather than a scan of the year.
          if (Math.abs(box.y - focus.y) > DAY_SPACING_PX * 3) continue
          obstacles.push({
            x: containerWidth / 2 + (box.x - x) * scale,
            y: containerHeight / 2 + (box.y - centerY) * scale + boxDepth / 2,
            halfW: boxHalf,
            halfH: boxHalf + boxDepth / 2,
          })
        }
        // Вехи стоят у дороги своим ромбом и мешают ровно так же, как недельный бокс.
        for (const badge of badges) {
          if (Math.abs(badge.y - focus.y) > DAY_SPACING_PX * 3) continue
          const badgeR = milestoneBadgeRadius(badge.kind) * badge.fit * scale
          obstacles.push({
            x: containerWidth / 2 + (badge.x - x) * scale,
            y: containerHeight / 2 + (badge.y - centerY) * scale,
            halfW: badgeR,
            halfH: badgeR,
          })
        }
        const anchor = rollAnchor(
          { x: cx, y: cy },
          // Куда идёт дорога в этом дне — по соседям, а не по одному отрезку: на повороте один
          // отрезок круче самой дороги, и подпись отъезжала бы рывком относительно того, что видно.
          {
            x: (pts[Math.min(shown + 1, pts.length - 1)].x - pts[Math.max(shown - 1, 0)].x) * scale,
            y: (pts[Math.min(shown + 1, pts.length - 1)].y - pts[Math.max(shown - 1, 0)].y) * scale,
          },
          {
            width: dateRollWidthRef.current,
            height: dateRollHeightRef.current,
            gap: DATE_ROLL_GAP_PX,
            radius: r,
          },
          obstacles,
          { width: containerWidth, height: containerHeight, edge: DATE_ROLL_EDGE_PX },
          dateRollSideRef.current,
        )
        // Магнит. Два движения живут здесь одновременно, и путать их нельзя: за дорогой чип следует
        // мгновенно (подпись, отстающая от дороги, отклеивается от того, что называет), а **перелёт
        // на другой кружок** — когда сменился день под фокусом или сторона — едет.
        //
        // Поэтому позиция ставится сразу в новую точку, а анимируется разница: чип стартует оттуда,
        // где он только что стоял, и приезжает в ноль. Пока он летит, дорога под ним продолжает
        // двигаться, и это движение он не теряет — оно уже в left/top.
        const prev = dateRollAnchorRef.current
        const hopped = shown !== dateRollDayRef.current || anchor.side !== dateRollSideRef.current
        dateRollAnchorRef.current = anchor
        dateRollDayRef.current = shown
        dateRollSideRef.current = anchor.side
        roll.style.left = `${anchor.x}px`
        roll.style.top = `${anchor.y}px`
        if (prev && hopped) {
          const dx = prev.x - anchor.x
          const dy = prev.y - anchor.y
          const distance = Math.hypot(dx, dy)
          // Летит только то, что действительно перелёт: соседний кружок, соседняя сторона. Прыжок
          // через полэкрана — это не хоп, а возвращение к сегодня или смена масштаба, и тянуть за
          // собой подпись через всю дорогу там незачем.
          if (distance > 1 && distance < DATE_ROLL_HOP_MAX_PX) {
            roll.animate(
              [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
              {
                duration: DATE_ROLL_HOP_MS,
                easing: DATE_ROLL_HOP_EASE,
                // Складывается с собственным transform чипа (центрирование и рост из-под кружка) и
                // с предыдущим перелётом, если тот ещё в воздухе: на быстром листании прыжки идут
                // чередой, и замена дала бы рывок в начале каждого следующего.
                composite: 'add',
              },
            )
          }
        }
      }
    },
    [
      scale,
      containerWidth,
      containerHeight,
      focusedDaysCount,
      cameraBackFraction,
      lastIndex,
      lastY,
      horizonBandHeight,
      badges,
      weekBoxes,
      weekBoxGeometry,
      applyFocusLift,
    ],
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
  }, [zoomedOut, todayDayId, days.length, lastIndex, lastX, lastY, scrollPxPerDay, focusOn])

  // Arriving from a trophy: open the road on the day it was reached rather than on today. Declared
  // after the recenter effect so it wins on the render they share, and guarded by the date it last
  // applied so a new day, a resize or a task toggle never drags the view back to an old milestone.
  useEffect(() => {
    if (zoomedOut) return
    if (focusDate === null) {
      appliedFocusDateRef.current = null
      return
    }
    if (appliedFocusDateRef.current === focusDate) return
    const el = scrollContainerRef.current
    if (!el) return
    const index = points.findIndex((p) => p.date === focusDate)
    if (index < 0) return
    appliedFocusDateRef.current = focusDate
    focusOn(index)
    el.scrollTop = index * scrollPxPerDay
  }, [zoomedOut, focusDate, points, scrollPxPerDay, focusOn])

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

  /**
   * One badge. `muted` draws the very same shape in grey, which is how a mark the road has not
   * reached yet is shown: not a different notation for the future, the same badge unearned.
   */
  function renderMilestoneBadge(badge: (typeof badges)[number], muted = false) {
    const { kind, n, x: cx, y: cy, face, fit } = badge
    const r = milestoneBadgeRadius(kind) * fit
    const depth = MILESTONE_BADGE_DEPTH * fit
    const d = rosetteFor(r)
    const plinthFill = muted ? 'var(--color-day-gray-plinth)' : 'var(--color-brand-plinth)'
    const faceFill = muted ? 'var(--color-day-gray)' : 'var(--color-brand)'
    const inkFill = muted ? 'var(--color-text-muted)' : 'var(--color-text-on-brand)'
    // Three characters ("Н52") in a badge sized for two need the type to give way, since the badge
    // itself cannot: its radius is what the road reserved. 0.82 is the ratio of the two widths.
    const fontScale = face.kind === 'text' && face.text.length > 2 ? 0.82 : 1
    const fontSize = MILESTONE_BADGE_FONT_SIZE * fit * fontScale
    return (
      <g key={n !== undefined ? `${kind}-${n}` : kind} transform={`translate(${cx}, ${cy})`}>
        {/* plinth: a solid offset copy underneath, same idiom as the day circles' shadow */}
        <path d={d} transform={`translate(0, ${depth})`} fill={plinthFill} />
        <path d={d} fill={faceFill} />
        {face.kind === 'text' ? (
          <text
            y={fontSize / 3}
            textAnchor="middle"
            fontSize={fontSize}
            fontFamily="var(--font-display)"
            fontWeight={700}
            fill={inkFill}
          >
            {face.text}
          </text>
        ) : (
          // The glyph is drawn at Lucide's 24px box, so it is scaled to the badge and centred by
          // hand rather than mounting a nested <svg> with its own viewBox inside this one.
          <path
            d={ICON_PATH_D.flag}
            transform={`translate(${-r * 0.55}, ${-r * 0.55}) scale(${(r * 1.1) / 24})`}
            fill="none"
            stroke={inkFill}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
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
                  // Anchored to where the circle is *drawn*, lift included: the card points at the
                  // face, and the face is the thing that moved.
                  day &&
                  onDaySelect &&
                  openOnRoad(p.x, cy - (liftValuesRef.current.get(i) ?? 0), radius, (anchor) =>
                    onDaySelect(day, anchor),
                  )
                }
                style={{ cursor: onDaySelect ? 'pointer' : 'default' }}
                opacity={dimmed ? 0.6 : 1}
              >
                {/* The body the day stands on — one shape from the face down to the road, not a
                    second circle offset underneath. Two circles were what this was, and at rest it
                    passed; under the focus lift it stopped passing, because the lower circle is as
                    wide as the face and the silhouette bulges out at the ground, so the eye reads a
                    disc and a copy of it instead of one object (see plinthBody.ts).
                    Left out of the lifted group below on purpose: the face rises, the plinth stays,
                    and the band between them — both full circles of the same radius, so no gap can
                    open — simply grows. That is the whole effect. Lifting the pair instead would
                    slide the day's shadow up the road with it and the circle would read as floating
                    rather than as standing taller. */}
                <path
                  ref={registerBody(i, p.x, cy, radius, depth)}
                  d={plinthBodyPath(p.x, cy, radius, depth)}
                  fill={TIER_PLINTH[p.colorTier]}
                />
                <g ref={registerLift(i)}>
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
                  if (day?.taskChanges?.some((c) => c.kind === 'rescheduled')) marks.push('rescheduled')
                  const left = p.x - ((marks.length - 1) * CHANGE_BADGE_STEP) / 2
                  return marks.map((mark, mi) =>
                    changeBadge(mark, mark, left + mi * CHANGE_BADGE_STEP, cy - radius - CHANGE_BADGE_GAP),
                  )
                })()}
                {day?.milestonesReached?.map((m, mi) => (
                  <g key={m.taskId} transform={`translate(${p.x - radius - 10 - mi * 16}, ${cy - 8}) scale(0.65)`}>
                    <circle cx={12} cy={8} r={7} fill="none" stroke={RANK_COLOR[m.rank]} strokeWidth={2.5} />
                    <path
                      d={AWARD_PATH_D}
                      fill="none"
                      stroke={RANK_COLOR[m.rank]}
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
              </g>
            )
          })}

          {/* The road ahead: same circle, same rhythm, same grey a day with nothing recorded gets —
              because that is exactly what a future day is. What separates it from an empty *past*
              day is depth, not colour: recorded days sit on a plinth, these are drawn flat. Raised
              means it happened. No lock glyph and no dashes — at a fourteen-day horizon that is
              fourteen badges of noise, and the flatness already says "not yet". */}
          {ghosts.map((g, n) => {
            // A slot lent to the bubble or to a mark ahead — see tomorrowBubble and aheadSlots.
            // The circle gives way there and nothing moves to make room. The two cross-fade rather
            // than swapping in one frame, so the slot always holds something.
            const yielded = (Boolean(tomorrowBubble) && n === 1 && tomorrowShown) || aheadSlots.taken.has(n)
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

          {/* Today's ring — the day's tasks as segments, filling as they are done. It is shown only
              while something is still open: a ring filled all the way round is a value that cannot
              be anything else on a day whose face is already gold and already carries a check, and
              the road does not print those (the same rule that keeps "Задачи N из N" off the day
              review). So the last tap of the day takes the ring off — and today is still the only
              circle drawn at full brightness, and still the last raised one before the flat road
              ahead, so nothing is lost in saying which day it is.

              Drawn after every circle on the road — recorded days and the
              ghosts ahead alike. Both reach past today's own circle, so drawn inside today's group
              they were laid down first and then partly buried: the plinth alone, an offset copy of
              the circle sitting `depth` lower, ate the bottom of the ring. A halo can only be drawn
              with the thing it haloes when nothing overlaps it; here the road's own circles do. */}
          {(() => {
            const i = points.findIndex((_, n) => days[n]?.id === todayDayId)
            const p = points[i]
            const day = days[i]
            if (!p || !day) return null
            if (!day.tasks.some((t) => !t.isDone)) return null
            const radius = DAY_CIRCLE_RADIUS * TODAY_CIRCLE_SCALE
            const ringR = radius + TODAY_RING_OFFSET_PX
            return (
              // Registered under today's own index so the ring rises with the face it orbits: it is
              // drawn out here, after every circle on the road, and left behind it would sit on the
              // road while today stood above it.
              <g ref={registerLift(i)} style={{ pointerEvents: 'none' }}>
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

          {/* Marks the road is heading toward. A calendar mark stands in the ghost slot it will
              one day take (see aheadSlots), drawn as the very badge that will stand there, only
              grey — so what you are walking toward and what you get are one notation, unearned and
              earned, rather than two. It used to spell the word out beside the road ("НЕДЕЛЯ 6"),
              which looked like nothing the road ever puts down and stood where the road never puts
              it. Anything with no slot of its own still hangs off the side. */}
          {markersAhead
            // A mark is on the road only while the slot it wants is one the road has drawn — for a
            // badge that is its chip's slot, for a tier the ghost of the day it falls on.
            .filter((m) => m.daysAhead >= 1 && (m.slotsAhead ?? m.daysAhead) <= ghosts.length)
            .map((marker) => {
              const slot = marker.milestone ? aheadSlots.byLabel.get(marker.label) : undefined
              if (marker.milestone && slot !== undefined) {
                const g = ghosts[slot]
                return renderMilestoneBadge(
                  {
                    kind: marker.milestone,
                    n: marker.milestoneN,
                    x: g.x,
                    y: g.y,
                    headingDeg: 0,
                    face: milestoneBadgeFace(marker.milestone, marker.milestoneN),
                    // The slot is empty and its neighbours are a full DAY_SPACING_PX off, which is
                    // more than the largest badge and a day circle need between them.
                    fit: 1,
                  },
                  true,
                )
              }

              // No slot: either a tier — not a place the road passes but a thing a task earns, so
              // it has no badge to grey out, and its label names a task, which no two-character
              // token can — or a calendar mark whose slot the tomorrow bubble already holds.
              const g = ghosts[marker.daysAhead - 1]
              const prev = marker.daysAhead === 1 ? { x: lastX, y: lastY } : ghosts[marker.daysAhead - 2]
              // Hang it off the road's normal, on whichever side points left — the same choice
              // today's own pill makes, and for the same reason: the weekly boxes take the other.
              const dx = g.x - prev.x
              const dy = g.y - prev.y
              const len = Math.hypot(dx, dy) || 1
              const side = -dy / len > 0 ? -1 : 1
              const nx = (-dy / len) * side
              const ny = (dx / len) * side
              // What it has to get around: the bubble where the bubble stands, the circle elsewhere.
              const clear =
                tomorrowBubble && tomorrowShown && marker.daysAhead === 2
                  ? tomorrowBubble.halfWidth
                  : DAY_CIRCLE_RADIUS
              if (marker.milestone) {
                const r = milestoneBadgeRadius(marker.milestone)
                // Centred, so the reach carries the badge's own radius as well as its clearance —
                // measuring to the centre is what once left a weekly badge lying on today's ring.
                const reach = clear + MILESTONE_CLEARANCE_PX + r
                return renderMilestoneBadge(
                  {
                    kind: marker.milestone,
                    n: marker.milestoneN,
                    x: g.x + nx * reach,
                    y: g.y + ny * reach,
                    headingDeg: 0,
                    face: milestoneBadgeFace(marker.milestone, marker.milestoneN),
                    fit: 1,
                  },
                  true,
                )
              }
              const reach = clear + 10
              return (
                <g key={`ahead-${marker.label}`} transform={`translate(${g.x + nx * reach}, ${g.y + ny * reach})`}>
                  <text
                    x={nx < 0 ? -4 : 4}
                    y={4}
                    textAnchor={nx < 0 ? 'end' : 'start'}
                    fontSize={11}
                    fontWeight={700}
                    letterSpacing={0.9}
                    fill="var(--color-day-gold)"
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
          {badges
            // Overview stays to the big, one-time picture (month/half-year/year) — 'start' would
            // otherwise spam a long history with a badge right at its very beginning, and repeating
            // weekly markers would otherwise spam it with dozens of badges.
            .filter((m) => (zoomedOut ? m.kind !== 'start' && m.kind !== 'week' : true))
            .map((badge) => renderMilestoneBadge(badge))}

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
      {/* The horizon band. Only in the scroll view: overview already holds the whole road at once, and
          a band across it would cover the very thing it is there to show. */}
      {!zoomedOut && (
        <div
          ref={horizonBandRef}
          aria-hidden={!horizonBandShown}
          className="pointer-events-none absolute inset-x-0 top-0 transition-opacity duration-300"
          // Kept mounted and faded rather than unmounted: the height measured off it is what decides
          // how much room the camera has to reserve, and an unmounted band has no height to measure.
          style={{ opacity: horizonBandShown || horizonBandClear(roadEndEdgeScreenY, horizonBandHeight) ? 1 : 0 }}
        >
          <HorizonPanel markers={beyondHorizon} />
        </div>
      )}

      {/* What day you are looking at, printed still while the road moves under it. A label beside
          the circle would ride with it, and the gutter beside the road is already spoken for (week
          boxes, milestone chips); a label that stays put can be read at speed. Its rows exist for
          every day at once, so a scroll frame only ever writes one transform.

          It is also the way home. That job used to belong to a button in the corner, which meant
          two controls for one action and the one you needed was the furthest from where you were
          looking. Here the arrow appears on the thing your eye is already on, and only while today
          is actually off screen — on a chip that is otherwise just a readout, an arrow that is
          always there would be a button that usually does nothing. Being tappable is also what
          earns the plinth: depth in this app means "press me", and it may not be spent on decoration
          (see .sk-card in index.css). */}
      {!zoomedOut && points.length > 0 && (
        <button
          type="button"
          ref={dateRollRef}
          onClick={scrollToToday}
          aria-label="Вернуться к сегодня"
          className="sk-plinth sk-focus pointer-events-none absolute z-10 flex flex-col items-center gap-0.5 rounded-[14px] border border-border bg-surface-raised px-2 py-1"
          style={
            {
              opacity: 0,
              left: 0,
              top: 0,
              // Проставляется здесь, а не классом: -50% по обеим осям — это «чип держится своим
              // центром», то самое, что позволяет ставить его по нормали, а не только сбоку.
              transform: 'translate(-50%, -50%) scale(var(--roll-scale, 1))',
              '--plinth-color': 'var(--ink-800)',
            } as CSSProperties
          }
        >
          <span
            className="flex items-center font-semibold text-text-secondary"
            style={{ height: DATE_ROLL_ROW_PX * DATE_ROLL_ROWS, fontSize: 12 }}
          >
            {/* Число и месяц — две ленты: одна перекидывается каждый день, другая раз в месяц. */}
            <span
              className="block overflow-hidden text-right"
              style={{ width: DATE_ROLL_DAY_W, height: DATE_ROLL_ROW_PX * DATE_ROLL_ROWS }}
            >
              <span
                ref={dateStripRef}
                className="block"
                style={{ transition: `transform ${DATE_ROLL_FLIP_MS}ms var(--ease-out)` }}
              >
                {points.map((p) => (
                  <span
                    key={p.date}
                    className="block"
                    style={{ height: DATE_ROLL_ROW_PX, lineHeight: `${DATE_ROLL_ROW_PX}px` }}
                  >
                    {formatDayNumber(p.date)}
                  </span>
                ))}
              </span>
            </span>
            <span
              className="block overflow-hidden pl-1 text-left"
              style={{ width: DATE_ROLL_MONTH_W, height: DATE_ROLL_ROW_PX * DATE_ROLL_ROWS }}
            >
              <span
                ref={dateMonthStripRef}
                className="block"
                style={{ transition: `transform ${DATE_ROLL_FLIP_MS}ms var(--ease-out)` }}
              >
                {monthRows.rows.map((month) => (
                  <span
                    key={month}
                    className="block"
                    style={{ height: DATE_ROLL_ROW_PX, lineHeight: `${DATE_ROLL_ROW_PX}px` }}
                  >
                    {formatShortMonth(`${month}-01`)}
                  </span>
                ))}
              </span>
            </span>
          </span>
          {/* Черта между чтением и кнопкой: сверху чип говорит, где ты, снизу — увозит домой. Цвет
              тот же, которым чип отбрасывает свою тень, чтобы линия читалась как грань предмета, а
              не как ещё одна надпись. */}
          <span className="block h-px self-stretch" style={{ background: 'var(--ink-800)' }} />
          <Icon name={todayOffScreen === 'down' ? 'arrow-down' : 'arrow-up'} size={16} color="var(--color-brand)" />
        </button>
      )}

    </div>
  )
}
