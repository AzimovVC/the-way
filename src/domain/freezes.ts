import { FREEZE_MONTHLY_ALLOWANCE } from './config'
import type { AppState, Day } from './models'

/** Tops freezesRemaining back up to the monthly allowance, at most once per calendar month. */
export function replenishFreezesIfNeeded(state: AppState, now: Date = new Date()): AppState {
  const currentMonth = now.toISOString().slice(0, 7)
  if (state.user.freezesRefilledMonth === currentMonth) return state
  return {
    ...state,
    user: {
      ...state.user,
      freezesRemaining: Math.max(state.user.freezesRemaining, FREEZE_MONTHLY_ALLOWANCE),
      freezesRefilledMonth: currentMonth,
    },
  }
}

/** Spends one freeze credit on a specific day, ahead of time or to rescue a day already missed. */
export function spendFreezeOnDay(state: AppState, dayId: string): AppState {
  if (state.user.freezesRemaining <= 0) return state
  const day = state.days.find((d) => d.id === dayId)
  if (!day || day.frozen) return state

  return {
    ...state,
    user: { ...state.user, freezesRemaining: state.user.freezesRemaining - 1 },
    days: state.days.map((d) => (d.id === dayId ? { ...d, frozen: true } : d)),
  }
}

/**
 * Auto-applies freezes to newly reconciled gap days (oldest first) while
 * credits last, so an honest miss quietly becomes a frozen day instead of a
 * rollback whenever the user has a freeze to spare.
 */
export function autoApplyFreezesToGaps(state: AppState, gapDayIds: Set<string>): AppState {
  let remaining = state.user.freezesRemaining
  if (remaining <= 0 || gapDayIds.size === 0) return state

  const days: Day[] = state.days.map((day) => {
    if (remaining <= 0 || !gapDayIds.has(day.id) || day.frozen) return day
    remaining -= 1
    return { ...day, frozen: true }
  })

  return { ...state, user: { ...state.user, freezesRemaining: remaining }, days }
}
