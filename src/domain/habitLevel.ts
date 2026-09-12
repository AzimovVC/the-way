import { EXP_PER_COMPLETION } from './config'

/** Habit level from accumulated EXP — purely cosmetic, never feeds into path angle/color. */
export function levelFromExp(exp: number): number {
  return Math.floor(Math.sqrt(exp / EXP_PER_COMPLETION))
}
