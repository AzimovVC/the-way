import { useSyncExternalStore } from 'react'
import {
  AVOIDANCE_STRENGTH_DEG,
  MAX_TURN_PER_DAY_DEG,
  MAX_WOBBLE_PX,
  MIN_POINT_SEPARATION_PX,
  WOBBLE_SENSITIVITY,
  ZIGZAG_AMPLITUDE_PX,
  ZIGZAG_PERIOD_DAYS,
} from '../domain/config'

/** A single dev-tunable numeric setting, persisted to localStorage and readable via a React hook. */
function createTunable(storageKey: string, defaultValue: number) {
  function readInitial(): number {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw === null ? NaN : Number(raw)
    return Number.isFinite(parsed) ? parsed : defaultValue
  }

  let value = readInitial()
  const listeners = new Set<() => void>()

  function get(): number {
    return value
  }

  function set(next: number): void {
    value = next
    localStorage.setItem(storageKey, String(next))
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

const maxTurnPerDay = createTunable('dev:maxTurnPerDayDeg', MAX_TURN_PER_DAY_DEG)
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

const maxWobble = createTunable('dev:maxWobblePx', MAX_WOBBLE_PX)
export const getMaxWobble = maxWobble.get
export const setMaxWobble = maxWobble.set
export const resetMaxWobble = maxWobble.reset
export const useMaxWobble = maxWobble.useValue
