import { useSyncExternalStore } from 'react'
import { AVOIDANCE_STRENGTH_DEG, MAX_TURN_PER_DAY_DEG, MIN_POINT_SEPARATION_PX, ZIGZAG_AMPLITUDE_PX } from '../domain/config'

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
