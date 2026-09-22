import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type Ref } from 'react'
import { createPortal } from 'react-dom'
import Icon, { AWARD_PATH_D, ICON_PATH_D, TROPHY_PATH_D } from '../../components/Icon'
import HorizonPanel from '../../components/HorizonPanel'
import { RANK_COLOR } from '../rankColor'
import { markerKey, type HorizonMarker } from '../../domain/horizon'
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
  MILESTONE_TAP_RADIUS_PX,
  WEEK_BOX_SIZE_RATIO,
} from '../../domain/config'
import { chipFitScale } from '../../domain/chipFit'
import { formatDayNumber, formatShortMonth } from '../../domain/calendar'
import { rollDayShown, rollMonthRows, rollPlacement } from '../../domain/dateRoll'
import { focusLift, focusLiftWake } from '../../domain/focusLift'
import { plinthBodyPath } from '../../domain/plinthBody'
import {
  computeWeekBoxGeometry,
  milestoneBadgeBox,
  type MilestoneBadgeFace,
  milestoneBadgeFace,
  horizonBandSlotsNeeded,
  milestoneBadgeRadius,
  rosetteBodyPath,
  rosettePathD,
} from '../../domain/decorGeometry'
import type { ColorTier, Day } from '../../domain/models'
import {
  addDaysISO,
  computePathPoints,
  type MilestonePathPoint,
  type WeekBoxPoint,
} from '../../domain/pathEngine'
import { dailyQuestsFor } from '../../domain/quests'
import type { PopoverAnchor } from '../NodePopover'
import { describeArc, ringSegmentAngles } from '../ringSegments'

/** Slack around the row a card asks for: a circle already near enough is left alone rather than nudged by 10px. */
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

/**
 * Выше этой строки круг не поднимают, даже если карточке нужно больше. Карточка растёт **из** круга
 * и хвостом показывает на него: круг, уехавший под верхнюю кромку, оставил бы её расти из ничего.
 * Это же и предел честности движения — дальше дорога просто уезжает с экрана.
 *
 * Отсюда и число: это сам круг (самый крупный — сегодняшний) плюс полтора десятка пикселей воздуха
 * над ним. Стояло 84 — с запасом, взятым на глаз, — и этот запас был чистым убытком: в день на
 * десять строк карточка упиралась в собственную прокрутку на полсотни пикселей раньше, чем была
 * обязана. Предел теперь там, где он физически есть: круг ещё виден целиком, и это всё, что нужно
 * хвосту. Уперевшись сюда, карточка прокручивается внутри себя — последняя страховка на месте.
 */
const MIN_CIRCLE_ROW_PX = Math.round(DAY_CIRCLE_RADIUS * TODAY_CIRCLE_SCALE) + 16
/**
 * Дальше этого вид не отъезжает. Сдвиг добирает недостачу там, где прокрутка кончилась, — это
 * подвинуться, а не уехать: за пару сотен пикселей дорога уходит с экрана целиком, и карточка
 * висит над пустотой, показывая хвостом в никуда. Место ей нужно рядом с дорогой, а не вместо неё.
 */
const MAX_VIEW_SHIFT_PX = 180

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
 * The highest rung taken on a day, or null. `days` is the rung itself (see models.ts), so the
 * tallest number is the tallest rank — no need to look the ladder up to sort them.
 */
function topRank(day: Day | undefined) {
  const reached = day?.milestonesReached
  if (!reached?.length) return null
  return reached.reduce((best, m) => (m.days > best.days ? m : best))
}

/**
 * A rank medal stamped on a day's face, in that rank's own colour.
 *
 * On the face rather than beside the circle, which is where it used to sit at scale 0.65: out there
 * it was a footnote nobody read, it ate the road's margin, and a second award on the same day
 * marched further out until a third would have left the screen. The face has room for exactly one
 * thing, and on the five days in a habit's life when a level lands, the level is that thing.
 *
 * New ink on purpose, unlike the check and the minus, which are drawn in the day's own plinth tone
 * so they read as depth. This is not depth — it is an event, and the rank's colour is what says
 * which level. A freeze already does the same with its violet moon.
 *
 * The cost is honest and worth naming: on such a day the check/minus channel is gone, and that pair
 * is what carries completion for someone who cannot separate the red from the green. It is a handful
 * of days out of a history, the tier still has its colour, and the day card still spells it out.
 */
function faceMedal(color: string, cx: number, cy: number, radius: number) {
  const s = FACE_MEDAL_SCALE * (radius / DAY_CIRCLE_RADIUS)
  return (
    <g transform={`translate(${cx - 12 * s}, ${cy - 13 * s}) scale(${s})`}>
      <circle cx={12} cy={8} r={7} fill="none" stroke={color} strokeWidth={2.5} />
      <path
        d={AWARD_PATH_D}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
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

/** The glyphs a badge's face can carry, by the name milestoneBadgeFace hands over. */
const BADGE_GLYPH_D: Record<'flag' | 'trophy', string> = {
  flag: ICON_PATH_D.flag,
  trophy: TROPHY_PATH_D,
}

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
/**
 * The medal is a drawn object filling its whole 24-unit box, not two strokes across the middle like
 * the check, so it is sized below the glyph scale: matched, it would run its ribbon off the circle.
 */
const FACE_MEDAL_SCALE = 1.05
const FACE_GLYPH_STROKE = 2.6

/**
 * Высота строки в окне с датой, и сколько строк видно за раз.
 *
 * Одна. Окно показывает **дату**, а не список дат: соседи по бокам читались бы как выбор из
 * трёх, хотя выбирать нечего, и занимали бы втрое больше места в плашке.
 *
 * Смена даты едет 90 мс — это перекид, а не прокрутка. Длительность здесь безопасна ровно потому,
 * что цель всегда одна: переход перенацеливается с того места, где его застали, и очередь
 * лепестков, из-за которой перекидные часы отстали бы на быстром листании, просто не возникает.
 */
const DATE_ROLL_ROW_PX = 24
const DATE_ROLL_ROWS = 1
const DATE_ROLL_FLIP_MS = 90
/**
 * Число и месяц стоят каждый в своей колонке постоянной ширины: иначе «6 → 26» дёргает саму
 * ячейку. Ширины отмеряны по самым широким значениям — «30» и «сент» в 15 px жирного.
 */
const DATE_ROLL_DAY_W = 22
const DATE_ROLL_MONTH_W = 36
/** Кегль в ячейке: тот же вес, каким набрана сама плашка, — она читается как её часть, а не как сноска. */
const DATE_CELL_FONT_PX = 15
/**
 * Ширина ячейки даты в плашке.
 *
 * Постоянная: ячейка, которая дышит вслед за содержимым, толкала бы заголовок плашки каждый раз,
 * когда ты трогаешь дорогу. Дата («11 авг») стоит в ней по центру, а ширину держат колонки числа
 * и месяца — они и так постоянные.
 */
const DATE_CELL_WIDTH_PX = 86
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

/**
 * Дорога под открытой карточкой: она умеет подвинуться и умеет встать обратно.
 *
 * Карточка не знает, сколько места на экране, а дорога не знает, сколько места нужно карточке, —
 * поэтому наружу уходит не «прокрути на N», а две просьбы. Высоту при этом меряет тот, у кого она
 * есть: карточка говорит, до какой строки ей надо поднять свой круг, а дорога решает, достижима ли
 * эта строка и каким движением.
 */
export interface RoadFocus {
  /**
   * Поднять круг к строке `rowY` (в координатах дороги) и сказать, где он в итоге встал. Только
   * вверх и только по недостаче: кругу, который и так стоит выше, дорога ничего не должна.
   * `report` зовётся ровно один раз — даже когда двигаться не пришлось, иначе ждущей карточке
   * нечего было бы дождаться.
   */
  raiseTo: (rowY: number, report: (anchor: PopoverAnchor) => void) => void
  /**
   * Карточка закрылась. Прокрутка остаётся там, куда доехала, — вид возвращает только то, что
   * было подпоркой под саму карточку (см. roadFocusAt).
   */
  release: () => void
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
   * A date to open the road on instead of today, once — what a trophy on the profile points at.
   * Applied only when it changes, so browsing away from it afterwards is never undone.
   */
  focusDate?: string | null
  /**
   * A day was tapped, reported with where its circle stands on screen — the card that opens is
   * anchored to it, so the position is part of the event, not something the screen can recover
   * afterwards: the road scrolls and only this component knows the camera it drew under.
   */
  onDaySelect?: (day: Day, anchor: PopoverAnchor, road: RoadFocus) => void
  /**
   * A weekly badge was tapped; the argument is the day it stands on — a Monday, the day the week
   * behind it closed. No anchor, unlike a day: what opens is a whole screen, not a card pinned to
   * a spot on a road that is about to scroll away underneath it.
   */
  onWeekSelect?: (markDate: string) => void
  /**
   * A monthly badge was tapped; the argument is the day it stands on — the 1st of the month it is
   * named for. Separate from onWeekSelect rather than one «badge tapped» callback, because what
   * opens is a different screen answering a different question, and one handler that switched on
   * the kind would put that decision in the screen instead of here.
   */
  onMonthSelect?: (markDate: string) => void
  /**
   * A day ahead was tapped, reported the way a recorded one is: its date and where its circle
   * stands. The same event as onDaySelect in everything but the subject — there is no `Day` behind
   * it, because nobody has lived it yet, and the schedule is what answers for it instead.
   */
  onFutureTap?: (date: string, anchor: PopoverAnchor, road: RoadFocus) => void
  /**
   * Место в плашке, куда дорога печатает, какой день ты смотришь.
   *
   * Элемент, а не пропсы обратно наверх: подпись меняется на каждом кадре скролла, и поднимать это
   * в состояние экрана значило бы перерисовывать плашку вместе с дорогой. Хозяин подписи остаётся
   * здесь — только дорога знает, где стоит скролл, — а плашка одалживает ей место.
   */
  dateSlot?: HTMLElement | null
  /**
   * День, чья карточка открыта прямо сейчас, — пока она открыта, ячейка даты пишет его.
   *
   * Высокая карточка просит места, дорога уезжает под неё, и ячейка честно называет день, на
   * котором встала камера, — а открыт при этом другой. Два дня на экране разом, и оба правы.
   * Открытая карточка тут главнее: она и есть то, на что человек смотрит.
   */
  openDayId?: string | null
  /** То же самое для открытой карточки дня, которого ещё не было: у него нет `Day`, поэтому дата. */
  openFutureDate?: string | null
  /**
   * Ручка дороги: открыть день так, как если бы нажали его круг.
   *
   * Плашка «сегодня» стоит над дорогой и своего дня на экране не имеет — но день у неё тот же
   * самый, и открываться он обязан оттуда же, откуда открывается всегда: из своего круга. Иначе у
   * одного дня два разных появления, и человек всякий раз заново решает, на что он смотрит.
   * Поэтому наружу отдаётся не «открой карточку», а «нажми этот круг»: дорога сама доезжает до
   * него и сама сообщает, где он встал.
   */
  roadRef?: Ref<RoadHandle>
}

/** Что экран умеет попросить у дороги (см. roadRef). */
export interface RoadHandle {
  openDay: (dayId: string) => void
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
  onDaySelect,
  onWeekSelect,
  onMonthSelect,
  onFutureTap,
  dateSlot = null,
  openDayId = null,
  openFutureDate = null,
  roadRef,
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

  /**
   * A badge as the renderer wants it. `date` is absent for the grey marks drawn ahead of the road:
   * those days have not happened, so there is nothing behind them to open.
   */
  // atDayIndex приходит с настоящей метки и отсутствует у серых впереди: те лежат плоско, как и
  // призрачные круги вокруг них, — поднятое здесь значит прожитое.
  type BadgeToDraw = Omit<MilestonePathPoint, 'date' | 'atDayIndex'> & {
    face: MilestoneBadgeFace
    fit: number
    date?: string
    atDayIndex?: number
  }

  // Each badge's face and the scale it has to shrink to to clear its neighbours — an O(points) scan
  // per badge, so it rides in the same memo rather than being redone for every badge on every render.
  const badges = useMemo(
    () =>
      pathMilestones.map((m) => {
        const face = milestoneBadgeFace(m.kind, m.n, m.date)
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
   * The date on each ghost, so a day ahead can say which day it is when it is tapped.
   *
   * Counted off today rather than handed down with the ghosts: the ghosts are geometry — points on
   * a curve — and the road ahead is simply the calendar continuing, one circle per date, with
   * nothing to decide. Deriving it anywhere else would be a second answer to "which day is that".
   */
  const ghostDates = useMemo(() => {
    const last = days[days.length - 1]?.date
    if (last === undefined) return [] as string[]
    return ghosts.map((_, n) => addDaysISO(last, n + 1))
  }, [days, ghosts])

  /**
   * Marks ahead, each standing in the ghost slot it will one day occupy.
   *
   * It borrows that slot — the ghost's circle is not drawn and nothing moves, so every point keeps
   * its coordinates and the step stays DAY_SPACING_PX everywhere — and so the road ahead is
   * literally the road you will get: when the day comes the
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
   */
  const aheadSlots = useMemo(() => {
    const byLabel = new Map<string, number>()
    const taken = new Set<number>()
    for (const m of markersAhead) {
      if (!m.milestone || m.slotsAhead === undefined) continue
      const slot = m.slotsAhead - 1
      if (slot < 0 || slot >= ghosts.length || taken.has(slot)) continue
      taken.add(slot)
      byLabel.set(m.label, slot)
    }
    return { byLabel, taken }
  }, [markersAhead, ghosts.length])

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
  /** Кадр текущего движения дороги, чтобы второе движение отменяло первое, а не боролось с ним. */
  const glideRef = useRef(0)
  /**
   * На сколько дорога отъехала вверх сверх прокрутки, чтобы под кругом хватило места карточке.
   *
   * Прокрутка кончается: в начале истории дней слишком мало, чтобы было куда прокручивать, и
   * круг стоит там, где стоит. Тогда двигается сам вид — не рывком, а тем же движением, каким
   * едет дорога: это и есть «подойти к карточке», а не «перепрыгнуть к ней». Длительность живёт
   * рядом с величиной, потому что переход должен идти ровно то время, что посчитано под путь.
   */
  const [viewShift, setViewShift] = useState({ px: 0, ms: 0 })
  // Копия в ref: величину читает settleRoom между рендерами, сразу после собственной записи.
  const shiftRef = useRef(0)
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

  /** То же место, но с учётом того, что дорога могла отъехать вверх (см. viewShift). */
  const anchorOnScreen = (x: number, y: number, radius: number): PopoverAnchor => {
    const a = toScreen(x, y, radius)
    return { ...a, y: a.y - shiftRef.current }
  }


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
  //
  // Фигуру тело рисует само: круг дня и розетка метки стоят на разных, и кадру скролла незачем
  // знать, что из них перед ним, — он отдаёт высоту, обратно получает путь.
  const bodyNodesRef = useRef<Map<number, { el: SVGPathElement; draw: (lift: number) => string }>>(new Map())

  const registerBody = useCallback(
    (index: number, draw: (lift: number) => string) => (el: SVGPathElement | null) => {
      if (!el) return
      bodyNodesRef.current.set(index, { el, draw })
      return () => {
        if (bodyNodesRef.current.get(index)?.el === el) bodyNodesRef.current.delete(index)
      }
    },
    [],
  )

  // Ячейка даты в плашке: ленты дней и месяцев и два её состояния. Пишется в DOM из того же кадра
  // камеры, что и всё здесь, — через состояние это перерисовывало бы год строк на каждом кадре
  // скролла.
  const dateCellRef = useRef<HTMLButtonElement>(null)
  const dateStripRef = useRef<HTMLSpanElement>(null)
  const dateMonthStripRef = useRef<HTMLSpanElement>(null)
  /** День, написанный в ячейке прямо сейчас: по нему открывается карточка. */
  const dateShownRef = useRef(0)
  /** Он же, но пока открыта карточка: тогда ячейка пишет её день, а не день камеры (см. openDayId). */
  const pinnedIndexRef = useRef<number | null>(null)
  const homeButtonRef = useRef<HTMLButtonElement>(null)
  /**
   * Даты, которые умеет показать ячейка: вся дорога, включая ту её часть, что ещё впереди.
   *
   * Лента кончалась на сегодня, и, листая дальше, человек видел дорогу, которая едет, и число,
   * которое стоит, — то есть ячейка молча начинала говорить не про тот день, что под камерой.
   * Слот в ленте один на слот на дороге, поэтому её номер и есть номер круга: по нему же ячейка
   * этот день и открывает (см. openSlotAt).
   */
  const dateRows = useMemo(
    () => [...points.map((p) => p.date), ...ghostDates],
    [points, ghostDates],
  )
  const monthRows = useMemo(() => rollMonthRows(dateRows), [dateRows])

  const registerLift = useCallback(
    (index: number) => (el: SVGGElement | null) => {
      if (!el) return
      const byIndex = liftNodesRef.current
      let set = byIndex.get(index)
      if (!set) byIndex.set(index, (set = new Set()))
      set.add(el)
      return () => {
        set.delete(el)
        if (set.size === 0) {
          byIndex.delete(index)
          // Записанная высота уходит вместе с узлом: в обзоре недельные метки и старт
          // размонтируются, а вернувшись, монтируются без transform — то есть лежат. Оставшееся
          // старое число совпало бы с новым, и охранник «ничего не изменилось» пропустил бы
          // единственный кадр, который мог их поднять.
          liftValuesRef.current.delete(index)
        }
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
      if (body) body.el.setAttribute('d', body.draw(lift))
    }
    // Дорога домой появляется по волне подъёма: она нужна ровно тогда, когда ты ушёл с сегодня,
    // и молчит, пока стоишь дома. Дата по этой волне больше не ходит — она в ячейке всегда.
    if (homeButtonRef.current) {
      homeButtonRef.current.style.opacity = String(wake)
      // Невидимая кнопка не должна нажиматься: мишень, которой не видно, — это мишень, задетая
      // случайно.
      homeButtonRef.current.style.pointerEvents = wake > 0 ? 'auto' : 'none'
    }
    if (indexFloat !== null) {
      // Зажимается **один раз, до лент**, а не только для тапа: за последним слотом дороги стоит
      // пустая земля под горизонтальную полосу (reservedSlots), и лента, уехавшая в эти строки,
      // показывает пустое окно — число исчезало ровно там, где человек листал дальше всего.
      const shown = Math.max(
        0,
        Math.min(pinnedIndexRef.current ?? rollDayShown(indexFloat), dateRows.length - 1),
      )
      dateShownRef.current = shown
      const box = DATE_ROLL_ROW_PX * DATE_ROLL_ROWS
      if (dateStripRef.current) {
        dateStripRef.current.style.transform = `translateY(${rollPlacement(shown, DATE_ROLL_ROW_PX, box).offsetPx}px)`
      }
      // Месяц едет своей лентой по своим строкам — на смене месяца, а не каждый день вместе с числом.
      const rows = monthRows.rowOfIndex
      const monthRow = rows[shown] ?? 0
      if (dateMonthStripRef.current) {
        dateMonthStripRef.current.style.transform = `translateY(${rollPlacement(monthRow, DATE_ROLL_ROW_PX, box).offsetPx}px)`
      }
    }
  }, [focusLiftPx, focusLiftFalloffDays, lastIndex, monthRows, dateRows.length])

  // Открытая карточка забирает ячейку себе. Стоит до эффекта ниже — тот и перерисовывает ячейку,
  // и на каждый рендер, так что отдельного кадра на это не нужно.
  useLayoutEffect(() => {
    const index =
      openDayId !== null
        ? days.findIndex((d) => d.id === openDayId)
        : openFutureDate !== null
          ? (() => {
              const n = ghostDates.indexOf(openFutureDate)
              return n >= 0 ? points.length + n : -1
            })()
          : -1
    pinnedIndexRef.current = index >= 0 ? index : null
  })

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
    },
    [
      scale,
      containerHeight,
      focusedDaysCount,
      cameraBackFraction,
      lastY,
      horizonBandHeight,
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
  function scrollTopThatRaises(
    localY: number,
    targetY: number,
    el: HTMLDivElement,
    tolerance: number,
  ): number | null {
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
        if (row <= targetY + tolerance) return index * scrollPxPerDay
        if (!best || row < best.row) best = { index, row }
      }
    }
    return best && startRow - best.row >= MIN_WORTHWHILE_LIFT_PX ? best.index * scrollPxPerDay : null
  }

  /**
   * Поднять то, что стоит на дороге, до строки, которую попросили, и доложить, куда оно встало.
   *
   * Карточка раскрывается **вниз** из того, что нажали, — всегда, чтобы у жеста был один ответ, а
   * не два. Это возможно, только если под ним есть место, а на прокрученной дороге его часто нет:
   * сегодня стоит чуть ниже середины кадра, а у круга, нажатого у нижней кромки, под ним нет
   * ничего. Поэтому сначала едет дорога — ровно на недостачу и не больше, — и карточка идёт за
   * кругом на его новое место.
   *
   * Только вверх и только когда круг ниже строки: кругу, стоящему высоко, места и так хватает, и
   * опускать ради него дорогу значило бы двигать вид зря. Дорога здесь подлежащее, а не фон, —
   * её двигают, когда иначе карточке не раскрыться, и никогда для красоты.
   *
   * Куда встало — меряется, а не предсказывается. Камера центрируется на средней высоте окна
   * (см. cameraFrame), а не на одном круге, так что прокрутка на N px двигает данный круг на
   * неизвестную величину: ниже делается один ньютоновский шаг по этой зависимости, с точностью в
   * несколько пикселей, а якорь читается уже с устоявшегося вида, а не с догадки.
   *
   * Строку задаёт тот, кто знает высоту карточки.
   */
  function raiseToRow(
    localX: number,
    localY: number,
    localRadius: number,
    askedRow: number,
    report: (anchor: PopoverAnchor) => void,
  ) {
    // Просьба может быть невыполнимой: карточка в десять строк не помещается на телефоне ни при
    // каком положении дороги. Выше верхней строки круг не поднимают — остаток такой карточки
    // уходит в её собственную прокрутку, последнюю страховку (см. NodePopover).
    const targetY = Math.max(MIN_CIRCLE_ROW_PX, askedRow)
    // У карточки, которой всё равно не хватит, допуска нет. Обычно дорога не ездит ради десяти
    // пикселей — оно того не стоит и выглядит как дёрганье. Но здесь эти пиксели и есть последние
    // строки дня: не отдать их значит оставить их за краем карточки, в её собственной прокрутке.
    const tolerance = askedRow < targetY ? 0 : TAP_FOCUS_TOLERANCE_PX
    const el = scrollContainerRef.current
    if (zoomedOut || !el) {
      report(anchorOnScreen(localX, localY, localRadius))
      return
    }
    const settle = () => settleRoom(localX, localY, localRadius, targetY, tolerance, report)
    if (toScreen(localX, localY, localRadius).y <= targetY + tolerance) {
      settle()
      return
    }
    const top = scrollTopThatRaises(localY, targetY, el, tolerance)
    if (top === null || Math.abs(top - el.scrollTop) < 1) {
      settle()
      return
    }
    glideScrollTop(el, top, (arrived) => {
      // The camera-follow listener is rAF-throttled, so it can still be a frame behind the last
      // scroll position written — and a frame behind is a card anchored a few px off the circle.
      // Pulling the camera to the final position here makes the anchor exact.
      if (arrived) focusOn(top / scrollPxPerDay)
      settle()
    })
  }

  /**
   * Добрать недостачу тем, что осталось, когда прокрутка кончилась: отодвинуть сам вид.
   *
   * Прокрутка поднимает круг, пока под дорогой есть дни. В начале истории их нет — и раньше
   * карточка на это отвечала тем, что переворачивалась наверх или пряталась в собственную
   * прокрутку. Ни то, ни другое не про день: первое — второй ответ на тот же жест, второе —
   * часть дня, спрятанная внутри дня. Вид отъезжает вверх ровно на недостачу, и внизу
   * освобождается то самое место.
   *
   * Движение идёт тем же временем, что и прокрутка (одна скорость на оба способа: человек не
   * должен различать, чем ему дали место), и карточка ждёт его конца — она ждёт `report`.
   */
  function settleRoom(
    localX: number,
    localY: number,
    localRadius: number,
    targetY: number,
    tolerance: number,
    report: (anchor: PopoverAnchor) => void,
  ) {
    const row = toScreen(localX, localY, localRadius).y
    const short = row - targetY
    // Ниже допуска не двигаются вовсе: дорога не ездит ради десяти пикселей — тот же порог, по
    // которому её не дёргают прокруткой (у карточки, которой не хватило места, он нулевой — см.
    // raiseToRow). И круг, оставшийся за нижней кромкой, не догоняют: туда его завела не теснота,
    // а чужое движение, и рывок вида этого не исправит.
    const want =
      short > tolerance && row <= containerHeight
        ? Math.max(0, Math.min(short, row - MIN_CIRCLE_ROW_PX, MAX_VIEW_SHIFT_PX))
        : 0
    shiftTo(want, () => report(anchorOnScreen(localX, localY, localRadius)))
  }

  /** Отодвинуть вид на `px` вверх и сказать, когда переход кончился. */
  function shiftTo(px: number, onEnd: () => void) {
    if (Math.abs(px - shiftRef.current) < 1) {
      onEnd()
      return
    }
    const ms = prefersReducedMotion()
      ? 0
      : Math.min(
          SCROLL_GLIDE_MAX_MS,
          SCROLL_GLIDE_BASE_MS + Math.abs(px - shiftRef.current) * SCROLL_GLIDE_MS_PER_PX,
        )
    shiftRef.current = px
    setViewShift({ px, ms })
    // По таймеру, а не по transitionend: событие не придёт, если переход схлопнулся в ноль кадров
    // (reduced motion, вкладка в фоне), — а не пришедший конец движения это невидимая карточка.
    window.setTimeout(onEnd, ms)
  }

  /**
   * Дорога под карточкой, открытой на круге в (localX, localY).
   *
   * Прокрутка, которой дорога дала место, **остаётся**. Карточка открылась там, куда камера
   * доехала, — и человек смотрел на это движение: вернуть вид назад значило бы отменить на его
   * глазах то, что он только что проследил, и сделать второе движение там, где по делу было одно.
   * Его палец остался там, где он его оставил.
   */
  function roadFocusAt(localX: number, localY: number, localRadius: number): RoadFocus {
    return {
      raiseTo: (rowY, report) => raiseToRow(localX, localY, localRadius, rowY, report),
      // Отпускается только сдвиг вида: это не место на дороге, а подпорка под одну карточку.
      // Оставленный, он держал бы дорогу поднятой над собственной рамкой — с мёртвой полосой внизу
      // и обрезанным верхом, и всякая следующая прокрутка шла бы мимо своего места.
      release: () => shiftTo(0, () => {}),
    }
  }

  /**
   * Открыть день, не нажимая его круг: доехать до круга и нажать его за человека.
   *
   * Так открывают день плашка сверху и ячейка с датой рядом с ней. Ни у той, ни у другой нет своего
   * места на дороге, и раньше карточка выезжала прямо из них — то есть один и тот же день имел два
   * разных появления, и ни одно из них не показывало, где этот день стоит. Теперь у входа один
   * ответ: камера едет к кругу, и карточка растёт оттуда же, откуда всегда. Дорога доезжает до дня
   * и встаёт на нём — дальше всё как после тапа, включая просьбу о месте.
   */
  function openDayAt(index: number) {
    const day = days[index]
    const p = points[index]
    if (!day || !p || !onDaySelect) return
    const radius = day.id === todayDayId ? DAY_CIRCLE_RADIUS * TODAY_CIRCLE_SCALE : DAY_CIRCLE_RADIUS
    // Место круга читается в момент доклада, а не сейчас: подъём (focus lift) успеет перемениться
    // за поездку, а карточка показывает хвостом на лицо круга, то есть на то, что двигалось.
    const tap = () => {
      const y = p.y - (liftValuesRef.current.get(index) ?? 0)
      onDaySelect(day, anchorOnScreen(p.x, y, radius), roadFocusAt(p.x, y, radius))
    }

    glideToSlot(index, tap)
  }

  /** Довезти камеру до слота на дороге и сказать, когда приехали (или что ехать некуда). */
  function glideToSlot(index: number, then: () => void) {
    const el = scrollContainerRef.current
    if (zoomedOut || !el) {
      then()
      return
    }
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight)
    const top = Math.max(0, Math.min(index * scrollPxPerDay, maxTop))
    glideScrollTop(el, top, (arrived) => {
      if (arrived) focusOn(top / scrollPxPerDay)
      then()
    })
  }

  /**
   * Открыть слот дороги по его номеру: прожитый день — карточкой дня, будущий — карточкой плана.
   *
   * Так открывает ячейка с датой, и знать, что у неё написано — прошлое или будущее, — ей не надо:
   * в ячейке стоит дорога, а дорога после сегодня не кончается. Камера доезжает до круга в обоих
   * случаях, потому что у ячейки своего места на дороге нет (см. openDayAt).
   */
  function openSlotAt(index: number) {
    if (index < points.length) {
      openDayAt(index)
      return
    }
    glideToSlot(index, () => openFutureAt(index - points.length))
  }

  /**
   * Открыть день, до которого ещё идти, — тем же движением, что и прожитый.
   *
   * Слот ведёт себя как день во всём, кроме того, что за ним нет `Day`: карточка растёт из круга,
   * дорога отдаёт ей место той же просьбой, и закрывается она так же. Отвечает за такой день
   * расписание — оно знает про вторник через неделю ровно то же, что про завтрашний.
   */
  function openFutureAt(n: number) {
    const g = ghosts[n]
    const date = ghostDates[n]
    if (!g || date === undefined || !onFutureTap) return
    const index = points.length + n
    const y = g.y - (liftValuesRef.current.get(index) ?? 0)
    onFutureTap(
      date,
      anchorOnScreen(g.x, y, DAY_CIRCLE_RADIUS),
      roadFocusAt(g.x, y, DAY_CIRCLE_RADIUS),
    )
  }

  /**
   * Довести scrollTop до `top` и сказать, доехали ли.
   *
   * The road is glided by hand rather than by `scrollTo({ behavior: 'smooth' })` because the card
   * has to open at the end of the movement, and a native smooth scroll never says when it is
   * done — there is no callback, `scrollend` is not everywhere, and watching scrollTop go still
   * mistakes a slow first frame for an arrival. Here the last frame is the arrival.
   */
  function glideScrollTop(el: HTMLDivElement, top: number, onEnd: (arrived: boolean) => void) {
    // Одно движение за раз: вторая просьба отменяет первую, иначе два rAF-цикла пишут в один
    // scrollTop и каждый видит чужую запись как палец на экране.
    if (glideRef.current !== 0) cancelAnimationFrame(glideRef.current)
    glideRef.current = 0

    if (prefersReducedMotion() || Math.abs(top - el.scrollTop) < 1) {
      el.scrollTop = top
      onEnd(true)
      return
    }

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
        glideRef.current = 0
        onEnd(false)
        return
      }
      const t = Math.min(1, (frameTime - startedAt) / duration)
      // Ease-in-out: the road pulls away as gently as it arrives. Ease-out alone starts at full
      // speed, and starting at full speed from under the user's finger is the jolt itself — the
      // movement has to look like it was begun, not like the view was yanked.
      wrote = from + distance * (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
      now.scrollTop = wrote
      if (t < 1) glideRef.current = requestAnimationFrame(step)
      else {
        glideRef.current = 0
        onEnd(true)
      }
    }
    glideRef.current = requestAnimationFrame(step)
  }

  // Без списка зависимостей: ручка держит день и камеру, которые меняются на каждый рендер, а
  // стоит она ровно столько, сколько стоит замыкание.
  useImperativeHandle(roadRef, () => ({
    openDay: (dayId: string) => {
      const index = days.findIndex((d) => d.id === dayId)
      if (index >= 0) openDayAt(index)
    },
  }))

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
  function renderMilestoneBadge(badge: BadgeToDraw, muted = false) {
    const { kind, n, x: cx, y: cy, face, fit, atDayIndex } = badge
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
    // The whole badge answers, not just the invisible disc over it: an event on the rosette or on
    // its own number bubbles to this group, while a sibling circle would never see either. That was
    // the bug — the drawing looked tappable everywhere and answered only in the gaps around itself.
    const open =
      muted || !badge.date
        ? null
        : kind === 'week' && onWeekSelect
          ? { label: `Неделя ${n}`, run: () => onWeekSelect(badge.date!) }
          : kind === 'month' && onMonthSelect
            ? { label: `Месяц ${face.kind === 'text' ? face.text : ''}`.trim(), run: () => onMonthSelect(badge.date!) }
            : null
    const tappable = open !== null
    return (
      <g
        key={n !== undefined ? `${kind}-${n}` : kind}
        transform={`translate(${cx}, ${cy})`}
        {...(open
          ? {
              role: 'button',
              'aria-label': open.label,
              className: 'cursor-pointer',
              onClick: open.run,
            }
          : {})}
      >
        {/* След на земле — та же розетка со сдвигом, как тень у кругов дня: он остаётся лежать,
            когда лицо встаёт. Между ними перемычка, и она тянется (rosetteBodyPath): без неё
            поднятая звезда распадается на две звезды со щелью между лучами. Метка занимает слот
            дороги наравне со днём, поэтому и поднимается вместе с соседями: лежащая одна, она
            гасила бы курсор фокуса ровно там, где он заметнее всего. */}
        <path d={d} transform={`translate(0, ${depth})`} fill={plinthFill} />
        <path
          ref={
            atDayIndex === undefined
              ? undefined
              : registerBody(atDayIndex, (lift) => rosetteBodyPath(0, -lift, r, depth + lift))
          }
          d={rosetteBodyPath(0, 0, r, depth)}
          fill={plinthFill}
        />
        <g ref={atDayIndex === undefined ? undefined : registerLift(atDayIndex)}>
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
              d={BADGE_GLYPH_D[face.icon]}
              transform={`translate(${-r * 0.55}, ${-r * 0.55}) scale(${(r * 1.1) / 24})`}
              fill="none"
              stroke={inkFill}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
        {tappable && (
          // The rosette is small — MILESTONE_BADGE_RADIUS is derived from how much room the road can
          // spare, not from a fingertip — so this widens the group's reach to a finger's worth.
          // Invisible, because a badge that grew a button ring would stop reading as the same mark
          // the horizon band draws in grey.
          <circle r={Math.max(r + depth, MILESTONE_TAP_RADIUS_PX)} fill="transparent" />
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
        style={{
          height: containerHeight,
          width: containerWidth,
          overflowY: zoomedOut ? 'hidden' : 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          // Сдвиг живёт на самом окне прокрутки, а не на дороге внутри: сдвинуть содержимое значит
          // поспорить с камерой, которая пишет в него на каждом кадре прокрутки.
          transform: viewShift.px === 0 ? undefined : `translateY(${-viewShift.px}px)`,
          transition: viewShift.ms === 0 ? undefined : `transform ${viewShift.ms}ms var(--ease-out)`,
        }}
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
                  onDaySelect(
                    day,
                    anchorOnScreen(p.x, cy - (liftValuesRef.current.get(i) ?? 0), radius),
                    roadFocusAt(p.x, cy - (liftValuesRef.current.get(i) ?? 0), radius),
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
                  ref={registerBody(i, (lift) => plinthBodyPath(p.x, cy - lift, radius, depth + lift))}
                  d={plinthBodyPath(p.x, cy, radius, depth)}
                  fill={TIER_PLINTH[p.colorTier]}
                />
                <g ref={registerLift(i)}>
                <circle cx={p.x} cy={cy} r={radius} fill={TIER_COLOR[p.colorTier]} />
                {p.frozen && faceGlyph(ICON_PATH_D.moon, 'var(--violet-500)', p.x, cy, radius)}
                {/* One medal, whatever landed here — a day on which three habits each took a level
                    is one day, and three medals would read as three events. It wears the highest
                    rung's colour, and the day card names which habits they were. The same rule the
                    change marks follow: one badge per kind, never per task. */}
                {!p.frozen &&
                  topRank(day) &&
                  faceMedal(RANK_COLOR[topRank(day)!.rank], p.x, cy, radius)}
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
                  !topRank(day) &&
                  (day?.tasks.length ?? 0) > 0 &&
                  p.completionRate >= 1 &&
                  faceGlyph(ICON_PATH_D.check, TIER_PLINTH[p.colorTier], p.x, cy, radius)}
                {!p.frozen &&
                  !topRank(day) &&
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

          {/* The road ahead: the same circle a recorded day gets, down to the plinth it stands on
              and the lift it takes when the scroll comes to rest on it. It used to be drawn flat,
              to say "not lived yet" with depth — but a day ahead is a day one can open and read,
              and a circle that answers a tap while looking like a placeholder invites nobody to
              try it. What says "not yet" is what it is made of: the grey of a day with nothing
              recorded, and the dimming every circle but today wears. No lock glyph and no dashes —
              at a fourteen-day horizon that is fourteen badges of noise.

              Its index continues the road's own numbering (points.length + n), which is what puts
              it on the same lift as the days behind it: the lift is a cursor along the road, and
              the road does not end at today. */}
          {ghosts.map((g, n) => {
            // A slot lent to a mark ahead — see aheadSlots. The circle gives way there and nothing
            // moves to make room. The two cross-fade rather than swapping in one frame, so the slot
            // always holds something.
            const yielded = aheadSlots.taken.has(n)
            const index = points.length + n
            return (
              <g
                key={`ghost-${n}`}
                onClick={() => openFutureAt(n)}
                style={{
                  cursor: onFutureTap ? 'pointer' : 'default',
                  opacity: yielded ? 0 : 0.5,
                  pointerEvents: yielded ? 'none' : undefined,
                  transition: 'opacity var(--dur-base) var(--ease-out)',
                }}
              >
                <path
                  ref={registerBody(index, (lift) =>
                    plinthBodyPath(g.x, g.y - lift, DAY_CIRCLE_RADIUS, PLINTH_DEPTH + lift),
                  )}
                  d={plinthBodyPath(g.x, g.y, DAY_CIRCLE_RADIUS, PLINTH_DEPTH)}
                  fill="var(--color-day-gray-plinth)"
                />
                <g ref={registerLift(index)}>
                  <circle cx={g.x} cy={g.y} r={DAY_CIRCLE_RADIUS} fill="var(--color-day-gray)" />
                </g>
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
                    face: milestoneBadgeFace(marker.milestone, marker.milestoneN, marker.milestoneDate),
                    // The slot is empty and its neighbours are a full DAY_SPACING_PX off, which is
                    // more than the largest badge and a day circle need between them.
                    fit: 1,
                  },
                  true,
                )
              }

              // No slot: either a tier — not a place the road passes but a thing a task earns, so
              // it has no badge to grey out, and its label names a task, which no two-character
              // token can — or a calendar mark whose slot another mark already holds.
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
              // What it has to get around: the circle standing in that slot.
              const clear = DAY_CIRCLE_RADIUS
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
                    face: milestoneBadgeFace(marker.milestone, marker.milestoneN, marker.milestoneDate),
                    fit: 1,
                  },
                  true,
                )
              }
              const reach = clear + 10
              return (
                <g key={`ahead-${markerKey(marker)}`} transform={`translate(${g.x + nx * reach}, ${g.y + ny * reach})`}>
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

      {/* Дорога домой.

          Она жила в самой подписи — читаешь дату и ею же возвращаешься, одно движение. Но подпись
          уехала в плашку, а плашка стоит у верхней кромки: навигации там не место, до неё не
          дотянуться большим пальцем. Кнопка внизу справа — там, где рука и так держит телефон, и
          над таб-баром, чтобы не спорить с мебелью самого телефона (слева внизу в dev-сборке сидит
          значок панели).

          Появляется по той же волне, что и дата: пока стоишь на сегодня, возвращаться некуда, и
          кнопка, которая обычно ничего не делает, — это кнопка, которую перестают замечать.
          Глубина у неё настоящая: в этом приложении плинт значит «нажми меня» и не тратится на
          украшение (см. .sk-card в index.css). */}
      {!zoomedOut && points.length > 0 && (
        <button
          type="button"
          ref={homeButtonRef}
          onClick={scrollToToday}
          aria-label="Вернуться к сегодня"
          className="sk-plinth sk-press sk-focus absolute right-4 bottom-4 z-10 flex items-center justify-center rounded-[16px] border border-border bg-surface-raised"
          style={
            {
              // 52 — размер пальца, тот же, которым меряются все одиночные кнопки приложения.
              width: 52,
              height: 52,
              opacity: 0,
              pointerEvents: 'none',
              '--plinth-color': 'var(--ink-800)',
            } as CSSProperties
          }
        >
          <Icon name={todayOffScreen === 'down' ? 'arrow-down' : 'arrow-up'} size={24} color="var(--color-brand)" />
        </button>
      )}

      {/* Какой день ты смотришь — в ячейке плашки, за разделителем.

          Подпись стояла у самого кружка и ездила за ним: рядом с тем, что называет, — но у дороги
          нет для неё постоянного места. Обочина занята недельными боксами и вехами, на диагонали
          дорога оставляет вдвое меньше зазора, и подпись, которая каждый раз находит себе новое
          место, ищется глазами. В плашке место одно и всегда одно, поэтому читается на ходу.

          Ячейка при этом не вторая новость в плашке, а другое подлежащее: слева — что осталось
          сегодня, справа, за чертой, — какой день показывает дорога. Отсюда и «Сегодня» словом,
          пока дорога стоит дома: одна ячейка, одна работа, и слово превращается в число ровно
          тогда, когда ты уехал.

          Рисует её дорога, а не экран: только она знает, на каком дне стоит скролл и как вернуться
          домой, — плашка лишь одалживает место (dateSlot). Нажимается вся ячейка, а не стрелка:
          верх экрана и так самая неудобная зона для пальца.

          В ячейке всегда **дата**, даже когда дорога стоит дома. Стояло слово «Сегодня» — и оно
          было третьим «сегодня» в одной строке экрана: плашка слева говорит про сегодня, карточка
          под ней здоровается тем же словом. Дата же говорит то, чего не говорит никто, — какое
          сегодня число.

          Тап открывает день, который в ней написан, и открывает его **из его круга**: дорога
          доезжает до него, и карточка растёт оттуда (openDayAt). Открывать её из самой ячейки
          значило бы дать одному дню два разных появления. */}
      {dateSlot !== null &&
        points.length > 0 &&
        createPortal(
          <button
            type="button"
            ref={dateCellRef}
            onClick={() => openSlotAt(dateShownRef.current)}
            aria-label="Открыть этот день"
            className="sk-press sk-focus relative flex h-full shrink-0 items-center justify-center rounded-r-[20px]"
            style={{ width: DATE_CELL_WIDTH_PX, color: 'var(--ink-950)' }}
          >
            <span className="absolute inset-x-0 flex flex-col items-center">
              <span
                className="flex items-center"
                style={{ height: DATE_ROLL_ROW_PX * DATE_ROLL_ROWS, fontSize: DATE_CELL_FONT_PX, fontWeight: 800 }}
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
                    {dateRows.map((date) => (
                      <span
                        key={date}
                        className="block"
                        style={{ height: DATE_ROLL_ROW_PX, lineHeight: `${DATE_ROLL_ROW_PX}px` }}
                      >
                        {formatDayNumber(date)}
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
            </span>
          </button>,
          dateSlot,
        )}

    </div>
  )
}
