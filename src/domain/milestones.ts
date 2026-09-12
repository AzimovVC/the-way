import {
  MILESTONE_MAX_MISS_STREAK,
  MILESTONE_MIN_COMPLETION_RATE,
  MILESTONE_ROLLBACK_MULTIPLIER,
  MILESTONE_TIER_MULTIPLIER,
} from './config'
import type { Day, Tier, TaskTemplate } from './models'

const TIER_ORDER: Tier[] = ['none', 'bronze', 'gold', 'platinum']

export const TIER_LABEL: Record<Tier, string> = {
  none: '',
  bronze: 'Закреплено',
  gold: 'Золото',
  platinum: 'Платина',
}

export function nextTier(current: Tier): 'bronze' | 'gold' | 'platinum' | null {
  const idx = TIER_ORDER.indexOf(current)
  const next = TIER_ORDER[idx + 1]
  return next && next !== 'none' ? (next as 'bronze' | 'gold' | 'platinum') : null
}

function sortedByDate(days: Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export interface MilestoneProgress {
  progressDays: number
  daysElapsed: number
  avgCompletionRate: number
  longestMissStreak: number
  nextTier: 'bronze' | 'gold' | 'platinum' | null
  nextTierTarget: number | null
  reachedTier: 'bronze' | 'gold' | 'platinum' | null
  cycleDays: Day[]
}

/**
 * Effective progress toward the task's next milestone tier since its current
 * cycle started. Each completed day earns +1; each missed day costs
 * MILESTONE_ROLLBACK_MULTIPLIER, floored at 0 — a slump unwinds several times
 * faster than the streak was built. Reaching the tier also requires the
 * "honest" gate (avg completion ≥ 80%, no miss streak longer than 3 days).
 */
export function computeMilestoneProgress(task: TaskTemplate, days: Day[]): MilestoneProgress {
  const cycleDays = sortedByDate(days).filter((d) => d.date >= task.cycleStartDate)

  let progressDays = 0
  let missStreak = 0
  let longestMissStreak = 0
  let doneCount = 0

  for (const day of cycleDays) {
    const dayTask = day.tasks.find((t) => t.taskTemplateId === task.id)
    const done = !!dayTask?.isDone
    if (done || day.frozen) {
      if (done) {
        progressDays += 1
        doneCount += 1
      }
      missStreak = 0
    } else {
      progressDays = Math.max(0, progressDays - MILESTONE_ROLLBACK_MULTIPLIER)
      missStreak += 1
      longestMissStreak = Math.max(longestMissStreak, missStreak)
    }
  }

  const avgCompletionRate = cycleDays.length === 0 ? 0 : doneCount / cycleDays.length
  const upcoming = nextTier(task.currentTier)
  const nextTierTarget = upcoming ? task.targetDays * MILESTONE_TIER_MULTIPLIER[upcoming] : null

  const qualifies =
    avgCompletionRate >= MILESTONE_MIN_COMPLETION_RATE && longestMissStreak <= MILESTONE_MAX_MISS_STREAK
  const reachedTier =
    upcoming && qualifies && nextTierTarget !== null && progressDays >= nextTierTarget ? upcoming : null

  return {
    progressDays,
    daysElapsed: cycleDays.length,
    avgCompletionRate,
    longestMissStreak,
    nextTier: upcoming,
    nextTierTarget,
    reachedTier,
    cycleDays,
  }
}

export interface CycleReport {
  tier: 'bronze' | 'gold' | 'platinum'
  cycleStartDate: string
  cycleEndDate: string
  missedDays: number
  missStreakCount: number
  avgRecoveryDays: number
  avgCompletionRate: number
  freezesUsed: number
  message: string
}

/** Mini end-of-cycle report, built right when a tier is reached. */
export function buildCycleReport(
  task: TaskTemplate,
  goalTitle: string,
  progress: MilestoneProgress,
  reachedTier: 'bronze' | 'gold' | 'platinum',
): CycleReport {
  const { cycleDays } = progress
  let missedDays = 0
  let missStreakCount = 0
  let currentMissStreak = 0
  const recoveryLengths: number[] = []
  let currentRecovery = 0
  let inMissStreak = false

  for (const day of cycleDays) {
    const dayTask = day.tasks.find((t) => t.taskTemplateId === task.id)
    const done = !!dayTask?.isDone
    if (done) {
      if (inMissStreak) {
        currentRecovery += 1
      }
    } else if (!day.frozen) {
      missedDays += 1
      if (currentMissStreak === 0) missStreakCount += 1
      currentMissStreak += 1
      inMissStreak = true
      if (currentRecovery > 0) {
        recoveryLengths.push(currentRecovery)
        currentRecovery = 0
      }
    }
    if (done) currentMissStreak = 0
  }
  if (currentRecovery > 0) recoveryLengths.push(currentRecovery)

  const avgRecoveryDays =
    recoveryLengths.length === 0 ? 0 : recoveryLengths.reduce((s, v) => s + v, 0) / recoveryLengths.length
  const freezesUsed = cycleDays.filter((d) => d.frozen).length

  const targetDays = task.targetDays * MILESTONE_TIER_MULTIPLIER[reachedTier]
  const perfect = missStreakCount === 0

  const message = perfect
    ? `Ты сделал это! ${targetDays} дней к цели: ${goalTitle} — ${TIER_LABEL[reachedTier]}, без единого срыва.`
    : `Ты сделал это! ${targetDays} дней к цели: ${goalTitle} — ${TIER_LABEL[reachedTier]}. Было ${missStreakCount} срыв(ов) и столько же возвращений — и это ничуть не хуже идеального цикла: тут важна настойчивость, а не только дисциплина.`

  return {
    tier: reachedTier,
    cycleStartDate: task.cycleStartDate,
    cycleEndDate: cycleDays[cycleDays.length - 1]?.date ?? task.cycleStartDate,
    missedDays,
    missStreakCount,
    avgRecoveryDays,
    avgCompletionRate: progress.avgCompletionRate,
    freezesUsed,
    message,
  }
}
