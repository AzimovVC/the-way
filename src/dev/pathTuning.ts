import { useSyncExternalStore } from 'react'
import {
  AVOIDANCE_STRENGTH_DEG,
  FOCUSED_DAYS_COUNT,
  MAX_TURN_PER_DAY_DEG,
  MAX_WOBBLE_PX,
  MIN_POINT_SEPARATION_PX,
  WEEK_BOX_SIZE_RATIO,
  WOBBLE_SENSITIVITY,
  ZIGZAG_AMPLITUDE_PX,
  ZIGZAG_PERIOD_DAYS,
} from '../domain/config'

/** Default physical scroll px per day in PathView's focus/scroll view — kept here (not in config.ts) since it's a scroll-feel constant, not a path-geometry one. */
export const DEFAULT_SCROLL_PX_PER_DAY = 90

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

  function get(): number {
    return value
  }

  function set(next: number): void {
    value = clamp(next)
    localStorage.setItem(storageKey, String(value))
    for (const listener of listeners) listener()
  }

  function reset(): void {
    set(defaultValue)
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

  return { get, set, reset, useValue }
}

// Capped at 20°: past this the path can curl tighter than its own circle spacing allows, which is
// what the no-self-crossing guarantee in pathEngine.ts depends on (see MAX_TURN_PER_DAY_DEG there).
const maxTurnPerDay = createTunable('dev:maxTurnPerDayDeg', MAX_TURN_PER_DAY_DEG, 20)
export const getMaxTurnPerDay = maxTurnPerDay.get
export const setMaxTurnPerDay = maxTurnPerDay.set
export const resetMaxTurnPerDay = maxTurnPerDay.reset
export const useMaxTurnPerDay = maxTurnPerDay.useValue

const minPointSeparation = createTunable('dev:minPointSeparationPx', MIN_POINT_SEPARATION_PX)
export const getMinPointSeparation = minPointSeparation.get
export const setMinPointSeparation = minPointSeparation.set
export const resetMinPointSeparation = minPointSeparation.reset
export const useMinPointSeparation = minPointSeparation.useValue

const zigzagAmplitude = createTunable('dev:zigzagAmplitudePx', ZIGZAG_AMPLITUDE_PX)
export const getZigzagAmplitude = zigzagAmplitude.get
export const setZigzagAmplitude = zigzagAmplitude.set
export const resetZigzagAmplitude = zigzagAmplitude.reset
export const useZigzagAmplitude = zigzagAmplitude.useValue

const avoidanceStrength = createTunable('dev:avoidanceStrengthDeg', AVOIDANCE_STRENGTH_DEG)
export const getAvoidanceStrength = avoidanceStrength.get
export const setAvoidanceStrength = avoidanceStrength.set
export const resetAvoidanceStrength = avoidanceStrength.reset
export const useAvoidanceStrength = avoidanceStrength.useValue

const zigzagPeriod = createTunable('dev:zigzagPeriodDays', ZIGZAG_PERIOD_DAYS)
export const getZigzagPeriod = zigzagPeriod.get
export const setZigzagPeriod = zigzagPeriod.set
export const resetZigzagPeriod = zigzagPeriod.reset
export const useZigzagPeriod = zigzagPeriod.useValue

const wobbleSensitivity = createTunable('dev:wobbleSensitivity', WOBBLE_SENSITIVITY)
export const getWobbleSensitivity = wobbleSensitivity.get
export const setWobbleSensitivity = wobbleSensitivity.set
export const resetWobbleSensitivity = wobbleSensitivity.reset
export const useWobbleSensitivity = wobbleSensitivity.useValue

// Capped at 30px — well under half of DAY_SPACING_PX (64px) — so this decorative sideways offset
// can never widen a step into an S-curve tighter than MAX_TURN_PER_DAY_DEG was tuned to allow.
const maxWobble = createTunable('dev:maxWobblePx', MAX_WOBBLE_PX, 30)
export const getMaxWobble = maxWobble.get
export const setMaxWobble = maxWobble.set
export const resetMaxWobble = maxWobble.reset
export const useMaxWobble = maxWobble.useValue

const scrollPxPerDay = createTunable('dev:scrollPxPerDay', DEFAULT_SCROLL_PX_PER_DAY)
export const getScrollPxPerDay = scrollPxPerDay.get
export const setScrollPxPerDay = scrollPxPerDay.set
export const resetScrollPxPerDay = scrollPxPerDay.reset
export const useScrollPxPerDay = scrollPxPerDay.useValue

const focusedDaysCount = createTunable('dev:focusedDaysCount', FOCUSED_DAYS_COUNT)
export const getFocusedDaysCount = focusedDaysCount.get
export const setFocusedDaysCount = focusedDaysCount.set
export const resetFocusedDaysCount = focusedDaysCount.reset
export const useFocusedDaysCount = focusedDaysCount.useValue

const weekBoxSizeRatio = createTunable('dev:weekBoxSizeRatio', WEEK_BOX_SIZE_RATIO)
export const getWeekBoxSizeRatio = weekBoxSizeRatio.get
export const setWeekBoxSizeRatio = weekBoxSizeRatio.set
export const resetWeekBoxSizeRatio = weekBoxSizeRatio.reset
export const useWeekBoxSizeRatio = weekBoxSizeRatio.useValue
