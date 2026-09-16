import { COMEBACK_MIN_RETURN_DAYS, COMEBACK_MIN_SLUMP_DAYS, COMEBACK_RANKS } from './config'
import type { Day } from './models'

/**
 * The road falling and climbing back — the one thing in the app that can only happen to somebody
 * who slipped, and so the only count here that a perfect history cannot have.
 *
 * Read from `pathAngleDelta`, the same signal the road is drawn from, so the screen and the
 * picture can never disagree about whether there was a slump.
 */
export interface Comeback {
  slumpStart: string
  slumpEnd: string
  slumpLength: number
  returnStart: string
  /** The day the return stopped being in doubt — the moment, and the day the mark belongs on. */
  confirmedDate: string
  /** How many days the road has climbed by the end of this run, confirmation day included. */
  returnLength: number
  /** Which comeback this is over the whole road, counting from one. */
  ordinal: number
}

function sortedByDate(days: Day[]): Day[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * Days the road actually turned on, paired with their place in the history. Flat days are left
 * out rather than ending a run: a rest day and a spent freeze leave the road going straight, and
 * treating that as the end of a slump would break one fall into two — each half then too short to
 * count, so coming back from a week off would register as no slump at all. Same rule as
 * everywhere else: a day nothing was owed on is not a result in either direction.
 */
function turningDays(days: Day[]): { sign: 1 | -1; index: number }[] {
  const turning: { sign: 1 | -1; index: number }[] = []
  days.forEach((day, index) => {
    const sign = Math.sign(day.pathAngleDelta)
    if (sign !== 0) turning.push({ sign: sign as 1 | -1, index })
  })
  return turning
}

/** Stretches of turning days that all went the same way, as indices into `turning`. */
function runs(turning: { sign: 1 | -1; index: number }[]): { sign: 1 | -1; start: number; end: number }[] {
  const out: { sign: 1 | -1; start: number; end: number }[] = []
  for (let i = 0; i < turning.length; ) {
    let j = i
    while (j < turning.length && turning[j].sign === turning[i].sign) j++
    out.push({ sign: turning[i].sign, start: i, end: j - 1 })
    i = j
  }
  return out
}

export function findComebacks(days: Day[]): Comeback[] {
  const sorted = sortedByDate(days)
  const turning = turningDays(sorted)
  const comebacks: Comeback[] = []
  const dateAt = (position: number) => sorted[turning[position].index].date

  const stretches = runs(turning)
  for (const [k, slump] of stretches.entries()) {
    if (slump.sign !== -1) continue
    if (slump.end - slump.start + 1 < COMEBACK_MIN_SLUMP_DAYS) continue

    const back = stretches[k + 1]
    if (!back || back.sign !== 1) continue
    const backLength = back.end - back.start + 1
    if (backLength < COMEBACK_MIN_RETURN_DAYS) continue

    comebacks.push({
      slumpStart: dateAt(slump.start),
      slumpEnd: dateAt(slump.end),
      slumpLength: slump.end - slump.start + 1,
      returnStart: dateAt(back.start),
      confirmedDate: dateAt(back.start + COMEBACK_MIN_RETURN_DAYS - 1),
      returnLength: backLength,
      ordinal: comebacks.length + 1,
    })
  }

  return comebacks
}

/**
 * The rank this comeback carries, or null. Ranks sit on the ordinal rather than on a separate
 * count so the shelf and the screen can never disagree about which return was the third.
 */
export function comebackRank(ordinal: number): string | null {
  return COMEBACK_RANKS.find((r) => r.at === ordinal)?.label ?? null
}

/** The comeback confirmed on this exact day, if any — what a freshly closed day is asked. */
export function comebackConfirmedOn(days: Day[], date: string): Comeback | null {
  return findComebacks(days).find((c) => c.confirmedDate === date) ?? null
}
