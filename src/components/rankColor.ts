import type { RankId } from '../domain/ranks'

/**
 * One colour per rank, rising with the ladder — and fixed, like the day colours: a rank that
 * changed hue between the road, the shelf and the screen that awarded it would read as a different
 * rank. Nothing new is invented here; these are the app's own five accents in order.
 */
export const RANK_COLOR: Record<RankId, string> = {
  novice: 'var(--ink-200)',
  apprentice: 'var(--teal-500)',
  practitioner: 'var(--cobalt-500)',
  master: 'var(--violet-500)',
  legend: 'var(--marigold-500)',
}

/** The shadow under a rank medal, one step darker than its face. */
export const RANK_PLINTH: Record<RankId, string> = {
  novice: 'var(--ink-400)',
  apprentice: 'var(--teal-700)',
  practitioner: 'var(--cobalt-700)',
  master: 'var(--violet-700)',
  legend: 'var(--marigold-700)',
}
