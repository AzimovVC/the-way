import { daysBetween } from './calendar'
import {
  MILESTONE_COMEBACK_GAIN,
  MILESTONE_MAX_MISS_STREAK,
  MILESTONE_MIN_COMPLETION_RATE,
  MILESTONE_MISS_COST_BY_STREAK,
  MILESTONE_MISS_STREAK_FORGIVE_DAYS,
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

/**
 * Which of the three conditions is the one still standing between the task and its next tier.
 *
 * The screen needs this named, not inferred: the day count can be long past the target while the
 * tier is withheld for honesty, and a bar drawn on days alone then fills to the end next to a
 * milestone that never arrives. One blocker, one gauge — the number in front of the person is
 * always the number that is actually holding the line.
 *
 * 'missStreak' comes first because it is the only one that cannot be worked off: the cycle keeps
 * its longest streak until a tier resets it, so no amount of later days clears it.
 */
export type MilestoneBlocker = 'missStreak' | 'days' | 'rate'

export interface MilestoneProgress {
  progressDays: number
  daysElapsed: number
  /**
   * Ground taken by misses and not yet won back. Falls as the comeback days repay it, so the line
   * that explains a shrunken bar shrinks with it.
   */
  daysLostToMisses: number
  /** True while comeback days are worth MILESTONE_COMEBACK_GAIN — there is ground outstanding. */
  isComingBack: boolean
  /** Every run of misses in the cycle, longest first is not assumed — order is chronological. */
  longestMissStreak: number
  /** The longest run of misses still young enough to count against the tier. */
  blockingMissStreak: number
  avgCompletionRate: number
  nextTier: 'bronze' | 'gold' | 'platinum' | null
  nextTierTarget: number | null
  blocker: MilestoneBlocker | null
  reachedTier: 'bronze' | 'gold' | 'platinum' | null
  cycleDays: Day[]
}

/**
 * Effective progress toward the task's next milestone tier since its current
 * cycle started. Each completed day earns +1; each missed day costs
 * MILESTONE_ROLLBACK_MULTIPLIER, floored at 0 — a slump unwinds several times
 * faster than the streak was built. Reaching the tier also requires the
 * "honest" gate (avg completion ≥ 80%, no miss streak longer than 3 days).
 *
 * A milestone is a stretch of calendar, not a count of repetitions: a day the task was never
 * asked for earns its +1 like any other. Otherwise «66 дней» would mean 66 Mondays-and-Fridays
 * — five months — for a task the user deliberately scheduled three times a week, and the number
 * on the screen would stop meaning what it says.
 *
 * The average is read only over the days the task actually was asked for, which is the same
 * reason: judging a Tue/Thu task against seven days a week would put the honesty gate out of
 * reach of anyone who did not sign up for daily.
 */
export function computeMilestoneProgress(task: TaskTemplate, days: Day[]): MilestoneProgress {
  const cycleDays = sortedByDate(days).filter((d) => d.date >= task.cycleStartDate)

  let progressDays = 0
  let debt = 0
  let missStreak = 0
  let longestMissStreak = 0
  let doneCount = 0
  let askedCount = 0
  // Each run of misses with the date it ended, so the ones that have aged out can be dropped.
  const missRuns: { length: number; endDate: string }[] = []

  for (const day of cycleDays) {
    const dayTask = day.tasks.find((t) => t.taskTemplateId === task.id)
    // A day the app never built — the app was not opened — has no tasks and no rest flag, and
    // stays a miss. Only a day that was built and did not ask for this task is off duty.
    const dayWasBuilt = day.rest === true || day.tasks.length > 0
    const offDuty = dayWasBuilt && dayTask === undefined

    if (dayTask?.isDone) {
      // The extra day of a comeback is taken out of the debt, so repaying ground is exactly twice
      // as fast as losing it was — and the moment the debt is clear the day is worth +1 again.
      const gain = debt > 0 ? MILESTONE_COMEBACK_GAIN : 1
      progressDays += gain
      debt = Math.max(0, debt - (gain - 1))
      doneCount += 1
      askedCount += 1
      missStreak = 0
    } else if (offDuty) {
      // The day earns its +1 and leaves the run of misses alone. Resetting here would mean a
      // Mon/Wed/Fri task could never build a run at all — the off day in between would break it —
      // and three skipped runs in a row would each be charged as a first miss, which costs
      // nothing. A week without the behaviour is a week without the behaviour; the gap the habit
      // feels is measured in times asked, not in squares of the calendar.
      progressDays += 1
    } else if (day.frozen) {
      // A spent freeze holds the line without advancing it: it protects the streak, it does not
      // buy a milestone.
      missStreak = 0
    } else {
      missStreak += 1
      const cost =
        MILESTONE_MISS_COST_BY_STREAK[Math.min(missStreak, MILESTONE_MISS_COST_BY_STREAK.length) - 1]
      // Debt only counts ground that was actually there: a task charged below zero has nothing to
      // win back, and a comeback bonus for days never earned would be a gift, not a repayment.
      const charged = Math.min(progressDays, cost)
      progressDays -= charged
      debt += charged
      askedCount += 1
      longestMissStreak = Math.max(longestMissStreak, missStreak)
      const previous = missRuns[missRuns.length - 1]
      if (missStreak === 1 || previous === undefined) missRuns.push({ length: 1, endDate: day.date })
      else {
        previous.length = missStreak
        previous.endDate = day.date
      }
    }
  }

  const lastDate = cycleDays[cycleDays.length - 1]?.date ?? task.cycleStartDate
  const blockingMissStreak = missRuns.reduce(
    (worst, run) =>
      daysBetween(run.endDate, lastDate) <= MILESTONE_MISS_STREAK_FORGIVE_DAYS ? Math.max(worst, run.length) : worst,
    0,
  )

  const avgCompletionRate = askedCount === 0 ? 0 : doneCount / askedCount
  const upcoming = nextTier(task.currentTier)
  const nextTierTarget = upcoming ? task.targetDays * MILESTONE_TIER_MULTIPLIER[upcoming] : null

  const qualifies =
    avgCompletionRate >= MILESTONE_MIN_COMPLETION_RATE && blockingMissStreak <= MILESTONE_MAX_MISS_STREAK
  const reachedTier =
    upcoming && qualifies && nextTierTarget !== null && progressDays >= nextTierTarget ? upcoming : null

  let blocker: MilestoneBlocker | null = null
  if (upcoming && !reachedTier) {
    if (blockingMissStreak > MILESTONE_MAX_MISS_STREAK) blocker = 'missStreak'
    else if (nextTierTarget !== null && progressDays < nextTierTarget) blocker = 'days'
    else blocker = 'rate'
  }

  return {
    progressDays,
    daysElapsed: cycleDays.length,
    daysLostToMisses: debt,
    isComingBack: debt > 0,
    avgCompletionRate,
    longestMissStreak,
    blockingMissStreak,
    nextTier: upcoming,
    nextTierTarget,
    blocker,
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
