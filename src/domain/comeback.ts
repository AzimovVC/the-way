import {
  COMEBACK_MIN_RETURN_DAYS,
  COMEBACK_MIN_SLUMP_DAYS,
  COMEBACK_RANKS,
  COMEBACK_SHAPE_MAX_DAYS,
} from './config'
import type { ColorTier, Day } from './models'

/**
 * One day of the drawn stretch: the colour it was, and which way the road went on it.
 *
 * The direction is carried rather than re-derived from the colour, because they answer different
 * questions — a green day can still bend the road down — and a picture that disagreed with the
 * road on that would be worse than no picture.
 */
export interface ComebackDay {
  date: string
  tier: ColorTier
  direction: -1 | 0 | 1
}

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
  /**
   * The stretch to draw, ending on the confirmation day. It opens one day before the fall so the
   * drawing shows the height it fell from — a dip with no top to it reads as a road that always
   * ran low.
   */
  shape: ComebackDay[]
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

  function shapeBetween(fromIndex: number, toIndex: number): ComebackDay[] {
    const from = Math.max(0, fromIndex - 1)
    const stretch = sorted.slice(from, toIndex + 1).map((day) => ({
      date: day.date,
      tier: day.colorTier,
      direction: Math.sign(day.pathAngleDelta) as -1 | 0 | 1,
    }))
    return stretch.slice(-COMEBACK_SHAPE_MAX_DAYS)
  }

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
      shape: shapeBetween(turning[slump.start].index, turning[back.start + COMEBACK_MIN_RETURN_DAYS - 1].index),
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

/**
 * Возвращения, сложенные в **одно достижение**: сколько их всего и как зовётся взятая ступень.
 *
 * Раньше на профиле стояла своя полка, по карточке на каждое возвращение, — и читалась она как
 * список падений: три плитки «после 4 дней» рядом друг с другом называют не то, что человек
 * сделал, а то, сколько раз ему было плохо. Достижение говорит обратное тем же числом: вернулся
 * раз, вернулся пять, вернулся десять. Сами возвращения при этом никуда не делись — каждое со
 * своим днём и своей длиной живёт в шторке серии, там, где смотрят на оборванную полосу.
 *
 * Ступень — **последняя пройденная**, а не совпавшая: `comebackRank` отвечает про одно
 * возвращение, которое сейчас случилось, и молчит про четвёртое, а медаль стоит на витрине всегда
 * и обязана носить имя между порогами.
 *
 * `null` — возвращений не было. Пустой медали «сюда ты не дошёл» на витрине нет: это та самая
 * пустая ячейка, которой в приложении нет нигде.
 */
export interface ComebackStanding {
  count: number
  label: string
  /** День подтверждения последнего возвращения — место на дороге, куда ведёт медаль. */
  lastDate: string
}

export function comebackStanding(comebacks: Comeback[]): ComebackStanding | null {
  const last = comebacks[comebacks.length - 1]
  if (!last) return null
  // Пороги в конфиге стоят по возрастанию, и берётся самый высокий из пройденных.
  const taken = COMEBACK_RANKS.filter((rank) => rank.at <= comebacks.length).at(-1)
  return { count: comebacks.length, label: taken?.label ?? COMEBACK_RANKS[0].label, lastDate: last.confirmedDate }
}

/** The comeback confirmed on this exact day, if any — what a freshly closed day is asked. */
export function comebackConfirmedOn(days: Day[], date: string): Comeback | null {
  return findComebacks(days).find((c) => c.confirmedDate === date) ?? null
}
