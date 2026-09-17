import { computeWeekdayStats, summarizePeriod } from './analytics'
import { MONTH_REVIEW_WEEKDAY_MIN_SAMPLES, MONTH_REVIEW_WEEKDAY_MIN_GAP } from './config'
import type { Day } from './models'
import { WEEKDAY_FULL, WEEKDAY_GENITIVE_PLURAL, isDayExcused } from './schedule'

/**
 * A month of the road, opened on purpose by tapping its badge.
 *
 * It exists only because it can say things a week cannot. A week has one of each weekday, so
 * «крепче всего понедельник» over it is one number against one number; a month has four or five,
 * and the sentence starts to mean something. Everything a week already answers — gold days, the
 * rate, the streak — is here too, but it is not the reason the screen exists: a month screen that
 * was the week screen with bigger numbers would teach people to skip both.
 *
 * The clock deliberately stays out. The time of day a habit lands, its drift week over week, what
 * happens when the anchor is missed — all of it needs more than a month (see timeOfDay.ts, and the
 * blocks on the statistics screen that read the whole history and say so in their own subtitles).
 * A month-scoped version of those would be a weaker answer to a question already answered better.
 */

export interface WeekdayFinding {
  /** Monday-first index, the same one the schedule picker uses. */
  weekday: number
  /** The weekday spelled out, for prose — «Вторник», never «вт». */
  name: string
  /** The same weekday in the form it takes when counted: «Четвергов было 3». */
  countedName: string
  rate: number
  /** How many of that weekday the month held. Printed in the sentence: four Saturdays is not yet a rule. */
  sampleCount: number
}

export interface MonthReview {
  /** 'YYYY-MM'. */
  key: string
  /** First and last day of the month that the history actually covers. */
  start: string
  end: string
  goldDays: number
  /** Days that counted — excused ones are held apart, never folded in. */
  judgedDays: number
  restDays: number
  completionRate: number
  /**
   * The two halves of the month, and whether there were two halves to compare. Printed rather than
   * summed into a verdict: «идёт ровно» over 82% and 91% reads as a blind app until the numbers
   * are beside it.
   */
  earlyRate: number
  lateRate: number
  hasHalves: boolean
  trend: 'improving' | 'declining' | 'stable'
  /**
   * The weekday that held up best and the one that held up worst — the whole reason a month gets a
   * screen of its own. Either may be null on its own: too few of that weekday, the two ends too
   * close to be anything but noise, or — most often — several weekdays tied at that end, where
   * naming one of them would invent a difference the month does not have.
   */
  strongest: WeekdayFinding | null
  weakest: WeekdayFinding | null
}

/** Every recorded day of the given 'YYYY-MM'. */
function monthSlice(days: Day[], key: string): Day[] {
  return days.filter((d) => d.date.startsWith(`${key}-`)).sort((a, b) => (a.date < b.date ? -1 : 1))
}

/**
 * The strongest and weakest weekday of the month, either of which may be null on its own.
 *
 * Three conditions, and each one exists because dropping it produces a sentence that is false in
 * an ordinary month.
 *
 * Backed: a weekday the month barely held cannot speak for itself. One missed Tuesday out of two
 * is a coin, not a pattern.
 *
 * Far enough apart: something is always last. Without the gap the screen names a weakest weekday
 * every month without exception, and a month where every day went alike reads as one with a problem.
 *
 * **Alone at its end**: this is the one that is easy to miss. In a good month four weekdays sit at
 * 100% together, and picking whichever the reduce happened to land on invents a distinction — «your
 * strongest day is Tuesday» is simply not true when Monday, Wednesday and Friday did the same. A
 * tied end is reported as nothing, which is why the weak half usually survives alone: it is the one
 * that tends to be genuinely alone, and the one a person can act on.
 */
function weekdayEnds(days: Day[]): { strongest: WeekdayFinding | null; weakest: WeekdayFinding | null } {
  const backed = computeWeekdayStats(days).filter((s) => s.sampleCount >= MONTH_REVIEW_WEEKDAY_MIN_SAMPLES)
  if (backed.length < 2) return { strongest: null, weakest: null }

  const rates = backed.map((s) => s.avgCompletionRate)
  const top = Math.max(...rates)
  const bottom = Math.min(...rates)
  if (top - bottom < MONTH_REVIEW_WEEKDAY_MIN_GAP) return { strongest: null, weakest: null }

  const finding = (s: (typeof backed)[number]): WeekdayFinding => ({
    weekday: s.weekday,
    name: WEEKDAY_FULL[s.weekday],
    countedName: WEEKDAY_GENITIVE_PLURAL[s.weekday],
    rate: s.avgCompletionRate,
    sampleCount: s.sampleCount,
  })
  // Compared with a tolerance, not exactly: these rates are sums over different day counts, and two
  // weekdays that plainly went the same can land an ulp apart. An invented distinction is exactly
  // what the tie rule is here to prevent, so a float artifact must not be able to sneak one back in.
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-9
  const at = (rate: number) => backed.filter((s) => same(s.avgCompletionRate, rate))

  return {
    strongest: at(top).length === 1 ? finding(at(top)[0]) : null,
    weakest: at(bottom).length === 1 ? finding(at(bottom)[0]) : null,
  }
}

/**
 * The month's summary, or null when the history holds no day of it at all.
 *
 * Unlike the week, there is no floor on how much it must hold: this screen is never shown
 * unbidden. Somebody tapped a badge they could see, and the thin month — the one the app was
 * installed halfway through — still owes them an answer. The screen drops what it cannot support
 * (the weekday ends go null on their own) rather than the road refusing the question.
 *
 * `history` is the whole road, because the streak is a fact about today and reading it from the
 * slice would cap it at the month's length.
 */
export function reviewMonth(days: Day[], key: string, history: Day[] = days): MonthReview | null {
  const month = monthSlice(days, key)
  if (month.length === 0) return null

  const judged = month.filter((d) => !isDayExcused(d))
  const summary = summarizePeriod(month, history)

  return {
    key,
    start: month[0].date,
    end: month[month.length - 1].date,
    goldDays: judged.filter((d) => d.colorTier === 'gold').length,
    judgedDays: judged.length,
    restDays: month.length - judged.length,
    completionRate: summary?.completionRate ?? 0,
    earlyRate: summary?.earlyRate ?? 0,
    lateRate: summary?.lateRate ?? 0,
    hasHalves: summary?.hasHalves ?? false,
    trend: summary?.trend ?? 'stable',
    ...weekdayEnds(month),
  }
}
