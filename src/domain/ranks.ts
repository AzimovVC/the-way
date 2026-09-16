/**
 * The ladder of levels — one scale, the same for every habit.
 *
 * It used to be personal: the tiers were the task's own target times 1, 2, 3, so «Бронза» meant
 * 21 days for a simple habit and 66 for a medium one. The word said the same thing about two
 * different amounts of life, and a shelf of those words in the profile invited a comparison it
 * could not honestly support. Now a rank is an absolute number of milestone days, and the target
 * the person picked is a separate thing: their own finish line, where the app asks whether to go
 * on (see `MILESTONE_TARGET_DAYS` consumers and the celebration screen).
 *
 * The rungs are durations that mean something on their own: a week, the lower and the mean end of
 * Lally et al. 2010 (21 and 66 days), half a year, a year.
 */
export type RankId = 'novice' | 'apprentice' | 'practitioner' | 'master' | 'legend'

export const RANK_LADDER: { id: RankId; days: number }[] = [
  { id: 'novice', days: 7 },
  { id: 'apprentice', days: 21 },
  { id: 'practitioner', days: 66 },
  { id: 'master', days: 180 },
  { id: 'legend', days: 365 },
]

export const RANK_NAME: Record<RankId, string> = {
  novice: 'Новичок',
  apprentice: 'Ученик',
  practitioner: 'Практик',
  master: 'Мастер',
  legend: 'Легенда',
}

/** Days in a year of the habit, and the step every rank past the ladder is counted in. */
export const RANK_YEAR_DAYS = 365

export interface Rank {
  id: RankId
  /** Milestone days it asks for, counted from the first day of the habit. */
  days: number
  /**
   * Which year of «Легенда» this is — 1 for every named rung. Past a year the ladder stops
   * inventing titles: three years of a habit is not a new word, it is three years, and a name
   * nobody can reach is decoration. So the last rank keeps its name and counts years.
   */
  year: number
}

function legendAt(year: number): Rank {
  return { id: 'legend', days: RANK_YEAR_DAYS * year, year }
}

function yearWord(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 14) return 'лет'
  switch (n % 10) {
    case 1:
      return 'год'
    case 2:
    case 3:
    case 4:
      return 'года'
    default:
      return 'лет'
  }
}

/** «Практик», «Легенда», «Легенда · 3 года» — one name per rank, the year only past the first. */
export function rankLabel(rank: Rank): string {
  const name = RANK_NAME[rank.id]
  return rank.year > 1 ? `${name} · ${rank.year} ${yearWord(rank.year)}` : name
}

/** The highest rank these days have earned, or null while the first rung is still ahead. */
export function rankReachedAt(days: number): Rank | null {
  if (days >= RANK_YEAR_DAYS) return legendAt(Math.floor(days / RANK_YEAR_DAYS))
  let reached: Rank | null = null
  for (const rung of RANK_LADDER) {
    if (days >= rung.days) reached = { id: rung.id, days: rung.days, year: 1 }
  }
  return reached
}

/** The next rung. There is always one: past the ladder the years keep coming. */
export function rankAfter(days: number): Rank {
  for (const rung of RANK_LADDER) {
    if (days < rung.days) return { id: rung.id, days: rung.days, year: 1 }
  }
  return legendAt(Math.floor(days / RANK_YEAR_DAYS) + 1)
}

/**
 * What a rung means, in one light line — the words on the card, not the explanation.
 *
 * Only 21 and 66 get to say anything about how habits form, because only they come from a study
 * (Lally et al. 2010). A week, half a year and a year are amounts of time and nothing more, and a
 * confident sentence under them would be invented science dressed as a reward. The reading behind
 * the «?» carries the rest, including the spread of 18 to 254 days — the one number that tells a
 * person their own pace is normal.
 */
export function rankMeaning(rank: Rank): string {
  switch (rank.id) {
    case 'novice':
      return 'Неделя. Пока всё держится на решении.'
    case 'apprentice':
      return 'Три недели. Кто-то закрепляется уже здесь.'
    case 'practitioner':
      return 'Два месяца. Столько в среднем и уходит.'
    case 'master':
      return 'Полгода с этой привычкой.'
    default:
      return rank.year > 1
        ? `${rank.year} ${yearWord(rank.year)} с этой привычкой.`
        : 'Год с этой привычкой.'
  }
}
