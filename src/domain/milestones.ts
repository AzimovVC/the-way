import {
  MILESTONE_COMEBACK_GAIN,
  MILESTONE_MISS_COST_BY_STREAK,
} from './config'
import { dayWord } from './calendar'
import type { Day, TaskTemplate } from './models'
import { rankAfter, rankReachedAt, type Rank } from './ranks'

function sortedByDate(days: Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * What one day was, for one habit. Four answers, and every reading of a habit's history has to
 * give the same one — the day count that hands out ranks and the report printed on the rank screen
 * are two readings of the same days, and a screen saying «пропущено 28» over a run the arithmetic
 * called flawless is the app disagreeing with itself in front of the person.
 *
 * They did disagree. The report classified a day as missed by `!day.frozen` alone, so a rest day
 * and a day the schedule never asked for both landed in the miss column: a perfect «Пн Ср Пт»
 * habit reaching «Практик» was told it had missed twenty-eight days on the way.
 *
 * The order of the tests is the meaning:
 * - a mark is a fact, and it outranks everything;
 * - `offDuty` is a day that *was* built and did not ask for this habit — a rest day, or a weekday
 *   outside its schedule. A day never built at all (the app was closed, and nothing rebuilt it)
 *   has neither tasks nor a rest flag, and stays a miss;
 * - a spent freeze holds the line: it is not a miss, and it does not advance anything either.
 */
type DayVerdict = 'done' | 'offDuty' | 'frozen' | 'missed'

function verdictFor(day: Day, taskId: string): DayVerdict {
  const dayTask = day.tasks.find((t) => t.taskTemplateId === taskId)
  if (dayTask?.isDone) return 'done'
  const dayWasBuilt = day.rest === true || day.tasks.length > 0
  if (dayWasBuilt && dayTask === undefined) return 'offDuty'
  if (day.frozen) return 'frozen'
  return 'missed'
}

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
  /** The longest run of misses in the cycle. Descriptive — it costs days, it does not bar a rank. */
  longestMissStreak: number
  /** Share of the asked days that were done. Descriptive, for the card and the cycle report. */
  avgCompletionRate: number
  /**
   * The day count a slip can no longer take the habit below — the last rung it stood on, or its
   * own finish once that was passed. What the app has already said out loud, in days.
   */
  floorDays: number
  /** The rung these days have already taken, on the one ladder every habit shares. */
  currentRank: Rank | null
  /** The rung being walked to. There is always one — past the ladder the years keep coming. */
  nextRank: Rank
  /** The finish the person set for themselves, and whether the days have passed it. */
  targetDays: number
  targetReached: boolean
  cycleDays: Day[]
}

/**
 * Effective progress since the habit's first day. Each completed day earns +1; a missed day costs
 * MILESTONE_MISS_COST_BY_STREAK by the length of the run it belongs to, floored at 0, and a
 * completed day earns double while that ground is still outstanding. That is the whole judgement:
 * the day count is the one that says how honest the run was, so reaching a number is taking it.
 *
 * There is nothing else between a habit and its next rank. There used to be two more, an
 * average-completion gate and a cap on the miss streak, and both judged a second time what the day
 * count already judges — a person who slipped, came back and walked out their days was answered
 * with «ранг ждёт стабильности» over a bar filled past its end, and no later work could lift the
 * average back.
 *
 * A milestone is a stretch of calendar, not a count of repetitions: a day the task was never
 * asked for earns its +1 like any other. Otherwise «66 дней» would mean 66 Mondays-and-Fridays
 * — five months — for a task the user deliberately scheduled three times a week, and the number
 * on the screen would stop meaning what it says.
 *
 * The average is read only over the days the task actually was asked for, which is the same
 * reason: a Tue/Thu task judged against seven days a week would read as half-abandoned on the
 * card while the person was doing exactly what they signed up for. It is a description of the
 * cycle, not a condition on it.
 *
 * **A rank once stood on is never taken back.** Misses erode the count inside a rung, which is the
 * decay Lally et al. measured and the reason the cost exists at all — but they stop at the last
 * rung the habit reached, and at the habit's own finish once that was passed. Without that floor
 * the only thing this app ever took away from a person was the one thing it had already told them
 * they had: a «Практик» of four months could be demoted by a bad fortnight, and the screen that
 * said «Ты держишь эту привычку 66 дней» would quietly stop being true. Decay is honest; unsaying
 * something is not.
 *
 * The floor is derived here rather than read from the `milestonesReached` stamps on purpose. The
 * stamps record *when the person was told*, and they are written onto whatever day the road is
 * standing on — so a rank earned in March can sit on today's circle, and reading the floor from
 * them would put it in the wrong place in the walk. The rung is a fact about the days, and the
 * days are right here.
 */
export function computeMilestoneProgress(task: TaskTemplate, days: Day[]): MilestoneProgress {
  const cycleDays = sortedByDate(days).filter((d) => d.date >= task.cycleStartDate)

  let progressDays = 0
  let debt = 0
  let missStreak = 0
  let longestMissStreak = 0
  let doneCount = 0
  let askedCount = 0
  let floorDays = 0

  for (const day of cycleDays) {
    const verdict = verdictFor(day, task.id)

    if (verdict === 'done') {
      // The extra day of a comeback is taken out of the debt, so repaying ground is exactly twice
      // as fast as losing it was — and the moment the debt is clear the day is worth +1 again.
      const gain = debt > 0 ? MILESTONE_COMEBACK_GAIN : 1
      progressDays += gain
      debt = Math.max(0, debt - (gain - 1))
      doneCount += 1
      askedCount += 1
      missStreak = 0
    } else if (verdict === 'offDuty') {
      // The day earns its +1 and leaves the run of misses alone. Resetting here would mean a
      // Mon/Wed/Fri task could never build a run at all — the off day in between would break it —
      // and three skipped runs in a row would each be charged as a first miss, which costs
      // nothing. A week without the behaviour is a week without the behaviour; the gap the habit
      // feels is measured in times asked, not in squares of the calendar.
      progressDays += 1
    } else if (verdict === 'frozen') {
      // A spent freeze holds the line without advancing it: it protects the streak, it does not
      // buy a milestone.
      missStreak = 0
    } else {
      missStreak += 1
      const cost =
        MILESTONE_MISS_COST_BY_STREAK[Math.min(missStreak, MILESTONE_MISS_COST_BY_STREAK.length) - 1]
      // Debt only counts ground that was actually there: a task charged below zero has nothing to
      // win back, and a comeback bonus for days never earned would be a gift, not a repayment.
      // The floor is the same argument one rung up — days the habit can no longer be charged for
      // are not ground it can win back either, so they never enter the debt.
      const charged = Math.max(0, Math.min(progressDays - floorDays, cost))
      progressDays -= charged
      debt += charged
      askedCount += 1
      longestMissStreak = Math.max(longestMissStreak, missStreak)
    }

    // Read after the day, so the rung the day itself just took protects it from the next miss.
    floorDays = Math.max(floorDays, rankReachedAt(progressDays)?.days ?? 0)
    if (progressDays >= task.targetDays) floorDays = Math.max(floorDays, task.targetDays)
  }

  const avgCompletionRate = askedCount === 0 ? 0 : doneCount / askedCount

  return {
    progressDays,
    daysElapsed: cycleDays.length,
    daysLostToMisses: debt,
    isComingBack: debt > 0,
    avgCompletionRate,
    longestMissStreak,
    floorDays,
    currentRank: rankReachedAt(progressDays),
    nextRank: rankAfter(progressDays),
    targetDays: task.targetDays,
    targetReached: progressDays >= task.targetDays,
    cycleDays,
  }
}

/**
 * What a run of days just crossed: a rung of the shared ladder, or the finish the person set for
 * themselves. They are different events on purpose — the rank is «вот сколько ты уже держишь», the
 * target is the one moment the app asks whether to go on or stop — and the target screen swallows
 * the rank when both land on the same day.
 */
export type MilestoneEvent =
  | { kind: 'rank'; rank: Rank }
  | { kind: 'target'; rank: Rank | null }

export interface CycleReport {
  kind: MilestoneEvent['kind']
  /** The rank standing after this event; null only for a target reached before the first rung. */
  rank: Rank | null
  cycleStartDate: string
  cycleEndDate: string
  /** Days the event asked for, and days actually walked — the latter can be past the former. */
  thresholdDays: number
  daysWalked: number
  /** Days the next rung of the ladder asks for, counted from the same start. */
  nextRankDays: number
  missedDays: number
  missStreakCount: number
  avgRecoveryDays: number
  avgCompletionRate: number
  /** Freezes that actually shielded *this* habit — a frozen day it was not asked on is just a day off. */
  freezesUsed: number
  message: string
}

/** Mini end-of-cycle report, built right when a tier is reached. */
export function buildCycleReport(
  task: TaskTemplate,
  progress: MilestoneProgress,
  event: MilestoneEvent,
): CycleReport {
  const { cycleDays } = progress
  let missedDays = 0
  let missStreakCount = 0
  let currentMissStreak = 0
  const recoveryLengths: number[] = []
  let currentRecovery = 0
  let inMissStreak = false
  let freezesUsed = 0

  for (const day of cycleDays) {
    const verdict = verdictFor(day, task.id)

    // A day off passes through untouched: it is not a miss, it does not end a run of misses, and
    // it is not a day of recovery either. The road walks straight over it, and so does the report.
    if (verdict === 'offDuty') continue

    if (verdict === 'done') {
      if (inMissStreak) currentRecovery += 1
      currentMissStreak = 0
      continue
    }

    if (verdict === 'frozen') {
      // The freeze bought a fresh start, exactly as it does in the day count: the next miss is a
      // first miss again, so the run of misses ends here.
      freezesUsed += 1
      currentMissStreak = 0
      continue
    }

    missedDays += 1
    if (currentMissStreak === 0) missStreakCount += 1
    currentMissStreak += 1
    inMissStreak = true
    if (currentRecovery > 0) {
      recoveryLengths.push(currentRecovery)
      currentRecovery = 0
    }
  }
  if (currentRecovery > 0) recoveryLengths.push(currentRecovery)

  const avgRecoveryDays =
    recoveryLengths.length === 0 ? 0 : recoveryLengths.reduce((s, v) => s + v, 0) / recoveryLengths.length

  const thresholdDays = event.kind === 'rank' ? event.rank.days : task.targetDays
  const perfect = missStreakCount === 0
  // Two sentences, said the way a person would say them out loud. The one about slips used to
  // carry a moral — «это ничуть не хуже идеального пути: тут важна настойчивость, а не только
  // дисциплина» — which is a lecture delivered at the happiest moment the app has. The days
  // already charged the misses; the tiles already count them. What is left to say is that the
  // person came back, and that is one clause, not three.
  const tail = perfect ? ' И ни разу не сорвался.' : ' И каждый раз возвращался.'

  // The rank sentence counts the days actually walked, not the rung: the rung is already in the
  // heading, and a screen that says «21 день» over a card reading «40 дней пройдено» argues with
  // itself. A rung can be crossed with days to spare — on a rest day, or on the first open after a
  // week away — so the two numbers are not always the same.
  const walked = `${progress.progressDays} ${dayWord(progress.progressDays)}`
  // The habit's name is in the heading right above, so the sentence does not repeat it — printing
  // the goal here and the task there put two different names on one screen about one habit.
  const message =
    event.kind === 'target'
      ? `Ты сам поставил себе ${thresholdDays} ${dayWord(thresholdDays)} — и дошёл.${tail}`
      : `Ты держишь эту привычку ${walked}.${tail}`

  return {
    kind: event.kind,
    rank: event.kind === 'rank' ? event.rank : progress.currentRank,
    cycleStartDate: task.cycleStartDate,
    cycleEndDate: cycleDays[cycleDays.length - 1]?.date ?? task.cycleStartDate,
    thresholdDays,
    daysWalked: progress.progressDays,
    nextRankDays: progress.nextRank.days,
    missedDays,
    missStreakCount,
    avgRecoveryDays,
    avgCompletionRate: progress.avgCompletionRate,
    freezesUsed,
    message,
  }
}
