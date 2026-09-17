import { useSyncExternalStore } from 'react'
import {
  AVOIDANCE_RADIUS_PX,
  AVOIDANCE_STRENGTH_DEG,
  FOCUSED_DAYS_COUNT,
  FOCUS_LIFT_FALLOFF_DAYS,
  FOCUS_LIFT_PX,
  GHOST_FUTURE_DAYS,
  GREEN_THRESHOLD,
  MAX_TURN_PER_DAY_DEG,
  TREND_RESPONSE_PX,
  MAX_WOBBLE_PX,
  WEEK_BOX_SIZE_RATIO,
  WOBBLE_SENSITIVITY,
  ZIGZAG_AMPLITUDE_PX,
  ZIGZAG_PERIOD_DAYS,
  MAX_TURN_PER_DAY_CAP,
  MAX_WOBBLE_CAP,
  ZIGZAG_AMPLITUDE_CAP,
} from '../domain/config'

/** Default physical scroll px per day in PathView's focus/scroll view — kept here (not in config.ts) since it's a scroll-feel constant, not a path-geometry one. */
const DEFAULT_SCROLL_PX_PER_DAY = 90

/**
 * A single dev-tunable numeric setting, persisted to localStorage and readable via a React hook.
 * An optional `max` clamps both a freshly-read stored value and every future `set` — for settings
 * where going past a certain point breaks a geometric guarantee elsewhere (e.g. the path's
 * no-self-crossing invariant), so a value saved before the cap was tightened doesn't linger
 * unclamped in someone's browser.
 */
function createTunable(storageKey: string, defaultValue: number, max?: number) {
  const clamp = (v: number): number => (max === undefined ? v : Math.min(v, max))

  function readInitial(): number {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw === null ? NaN : Number(raw)
    return clamp(Number.isFinite(parsed) ? parsed : defaultValue)
  }

  let value = readInitial()
  const listeners = new Set<() => void>()

  function set(next: number): void {
    value = clamp(next)
    localStorage.setItem(storageKey, String(value))
    for (const listener of listeners) listener()
  }

  function useValue(): number {
    return useSyncExternalStore(
      (onChange) => {
        listeners.add(onChange)
        return () => listeners.delete(onChange)
      },
      () => value,
    )
  }

  return { set, useValue }
}

/**
 * A dev-tunable boolean, same shape as createTunable. Used for switches that exist only to inspect
 * the geometry during development and have no place in the product UI.
 */
function createFlag(storageKey: string, defaultValue: boolean) {
  let value = localStorage.getItem(storageKey) === null ? defaultValue : localStorage.getItem(storageKey) === '1'
  const listeners = new Set<() => void>()

  function set(next: boolean): void {
    value = next
    localStorage.setItem(storageKey, next ? '1' : '0')
    for (const listener of listeners) listener()
  }

  function useValue(): boolean {
    return useSyncExternalStore(
      (onChange) => {
        listeners.add(onChange)
        return () => listeners.delete(onChange)
      },
      () => value,
    )
  }

  return { set, useValue }
}

// The three geometry sliders are capped so a tuning session can't break the path's no-overlap
// guarantee; the ceilings are derived from the geometry constants themselves (see config.ts).
const maxTurnPerDay = createTunable('dev:maxTurnPerDayDeg', MAX_TURN_PER_DAY_DEG, MAX_TURN_PER_DAY_CAP)
export const setMaxTurnPerDay = maxTurnPerDay.set
export const useMaxTurnPerDay = maxTurnPerDay.useValue

// Renamed from 'dev:minPointSeparationPx', which is also why the storage key changed: that slider
// claimed to set how far apart two day circles stay, but nothing has enforced a separation since
// the post-hoc collision pass was replaced by the curve's turn radius. All it ever reached was the
// avoidance radius, so that is what it is now called and what it now sets directly — and a value
// saved under the old key, which meant something else, is not carried over.
const avoidanceRadius = createTunable('dev:avoidanceRadiusPx', AVOIDANCE_RADIUS_PX)
export const setAvoidanceRadius = avoidanceRadius.set
export const useAvoidanceRadius = avoidanceRadius.useValue

const zigzagAmplitude = createTunable('dev:zigzagAmplitudePx', ZIGZAG_AMPLITUDE_PX, ZIGZAG_AMPLITUDE_CAP)
export const setZigzagAmplitude = zigzagAmplitude.set
export const useZigzagAmplitude = zigzagAmplitude.useValue

const avoidanceStrength = createTunable('dev:avoidanceStrengthDeg', AVOIDANCE_STRENGTH_DEG)
export const setAvoidanceStrength = avoidanceStrength.set
export const useAvoidanceStrength = avoidanceStrength.useValue

const zigzagPeriod = createTunable('dev:zigzagPeriodDays', ZIGZAG_PERIOD_DAYS)
export const setZigzagPeriod = zigzagPeriod.set
export const useZigzagPeriod = zigzagPeriod.useValue

const wobbleSensitivity = createTunable('dev:wobbleSensitivity', WOBBLE_SENSITIVITY)
export const setWobbleSensitivity = wobbleSensitivity.set
export const useWobbleSensitivity = wobbleSensitivity.useValue

const maxWobble = createTunable('dev:maxWobblePx', MAX_WOBBLE_PX, MAX_WOBBLE_CAP)
export const setMaxWobble = maxWobble.set
export const useMaxWobble = maxWobble.useValue

const scrollPxPerDay = createTunable('dev:scrollPxPerDay', DEFAULT_SCROLL_PX_PER_DAY)
export const setScrollPxPerDay = scrollPxPerDay.set
export const useScrollPxPerDay = scrollPxPerDay.useValue

const focusedDaysCount = createTunable('dev:focusedDaysCount', FOCUSED_DAYS_COUNT)
export const setFocusedDaysCount = focusedDaysCount.set
export const useFocusedDaysCount = focusedDaysCount.useValue

// The focus lift (see focusLift.ts): how high the day under the scroll stands off its plinth, and
// how many days out that reaches. Tuned by looking rather than by arithmetic — the derivations in
// config.ts fix the *shape* (a neighbour at exactly half height, the day past it flat), not how
// tall a raised circle has to be before a thumb notices it mid-scroll.
const focusLiftPx = createTunable('dev:focusLiftPx', FOCUS_LIFT_PX)
export const setFocusLiftPx = focusLiftPx.set
export const useFocusLiftPx = focusLiftPx.useValue

const focusLiftFalloffDays = createTunable('dev:focusLiftFalloffDays', FOCUS_LIFT_FALLOFF_DAYS)
export const setFocusLiftFalloffDays = focusLiftFalloffDays.set
export const useFocusLiftFalloffDays = focusLiftFalloffDays.useValue

const weekBoxSizeRatio = createTunable('dev:weekBoxSizeRatio', WEEK_BOX_SIZE_RATIO)
export const setWeekBoxSizeRatio = weekBoxSizeRatio.set
export const useWeekBoxSizeRatio = weekBoxSizeRatio.useValue

// How hard a slump has to be before the road says so, and how fast it says it. These two are the
// pair to move together when the question is "why did nothing happen when I missed two days": the
// first decides whether there is anything to draw, the second decides how long it takes to appear.
// Both are perceptual — the derivations in config.ts fix their *shape*, not where a human notices
// them — so they are tuned by looking rather than by arithmetic.
const greenThreshold = createTunable('dev:greenThreshold', GREEN_THRESHOLD, 1)
export const setGreenThreshold = greenThreshold.set
export const useGreenThreshold = greenThreshold.useValue

const trendResponsePx = createTunable('dev:trendResponsePx', TREND_RESPONSE_PX)
export const setTrendResponsePx = trendResponsePx.set
export const useTrendResponsePx = trendResponsePx.useValue

// What share of the resting frame looks back rather than forward. The camera centres on the mean
// of that window (see cameraFrame in PathView), so this one number decides where today lands on a
// road going either way — which is the thing a fixed screen row could never do.
const cameraBackFraction = createTunable('dev:cameraBackFraction', 0.55, 0.9)
export const setCameraBackFraction = cameraBackFraction.set
export const useCameraBackFraction = cameraBackFraction.useValue

const ghostHorizonDays = createTunable('dev:ghostHorizonDays', GHOST_FUTURE_DAYS)
export const setGhostHorizonDays = ghostHorizonDays.set
export const useGhostHorizonDays = ghostHorizonDays.useValue

/**
 * Whether the path is shown zoomed out to fit the whole route.
 *
 * This used to be a button in the corner of PathView, but its only real job was to let us look at
 * the geometry while building it — so it lives here now and never ships. The product's own
 * whole-route view is the map on the stats screen, which asks for the overview directly.
 */
const pathZoomedOut = createFlag('dev:pathZoomedOut', false)
export const setPathZoomedOut = pathZoomedOut.set
export const usePathZoomedOut = pathZoomedOut.useValue
