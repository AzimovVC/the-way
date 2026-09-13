import { useSyncExternalStore } from 'react'
import { MAX_TURN_PER_DAY_DEG } from '../domain/config'

const STORAGE_KEY = 'dev:maxTurnPerDayDeg'

function readInitial(): number {
  const raw = localStorage.getItem(STORAGE_KEY)
  const parsed = raw === null ? NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : MAX_TURN_PER_DAY_DEG
}

let value = readInitial()
const listeners = new Set<() => void>()

export function getMaxTurnPerDay(): number {
  return value
}

export function setMaxTurnPerDay(next: number): void {
  value = next
  localStorage.setItem(STORAGE_KEY, String(next))
  for (const listener of listeners) listener()
}

export function resetMaxTurnPerDay(): void {
  setMaxTurnPerDay(MAX_TURN_PER_DAY_DEG)
}

export function useMaxTurnPerDay(): number {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => value,
  )
}
