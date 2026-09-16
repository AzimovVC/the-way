import type { AppState } from '../domain/models'
import { rankReachedAt } from '../domain/ranks'

/** The version this build writes. Bumping it is only safe with a matching entry in MIGRATIONS. */
export const CURRENT_VERSION = 3

export interface StoredEnvelope {
  version: number
  state: AppState
}

/**
 * Upgrades a state saved at version N into the shape of version N+1, keyed by N. Empty today,
 * and that is the point: the chain is built while there is nothing in it, so the first real
 * migration is one entry added here instead of the loader being rewritten under pressure.
 *
 * Each step is pure and takes `unknown`: by the time it runs, the record has only been proven
 * to be an object saved at that version, not to match any current interface.
 */
export type MigrationChain = Record<number, (state: unknown) => unknown>

/**
 * What the tiers used to be worth: the task's own target times this, so «Бронза» was 21 days for a
 * simple habit and 66 for a medium one. The numbers live here and nowhere else now — this step is
 * the last code that has to know them.
 */
const V1_TIER_MULTIPLIER: Record<string, number> = { bronze: 1, gold: 2, platinum: 3 }

/**
 * v1 → v2: ranks stop being personal and become one ladder shared by every habit.
 *
 * A stamped tier is converted through the only thing about it that was ever objective — how many
 * days it actually stood for — and that number is then read against the new ladder. So a «Бронза»
 * earned at 66 days becomes «Практик», and a «Бронза» earned at 21 becomes «Ученик»: the history
 * keeps its dates and its lengths, and only the word changes. `currentTier` goes altogether; the
 * rank a task stands at now follows from the day count and is never stored.
 */
function v1ToV2(state: unknown): unknown {
  // A record that is not the shape this step knows is handed on untouched: inventing a `days` or a
  // `goals` here would turn a record the loader is about to refuse — and quarantine — into one that
  // looks plausible and starts the person from nothing.
  if (!isObject(state) || !isObject(state.user) || !Array.isArray(state.user.goals) || !Array.isArray(state.days)) {
    return state
  }
  const user = state.user
  const goals: unknown[] = state.user.goals

  const targetByTask = new Map<string, number>()
  const nextGoals = goals.map((goal) => {
    if (!isObject(goal) || !Array.isArray(goal.tasks)) return goal
    const tasks = goal.tasks.map((task) => {
      if (!isObject(task)) return task
      const { currentTier: _dropped, ...rest } = task
      if (typeof task.id === 'string' && typeof task.targetDays === 'number') {
        targetByTask.set(task.id, task.targetDays)
      }
      return rest
    })
    return { ...goal, tasks }
  })

  const nextDays = state.days.map((day) => {
    if (!isObject(day) || !Array.isArray(day.milestonesReached)) return day
    const milestonesReached = day.milestonesReached.flatMap((reached) => {
      if (!isObject(reached) || typeof reached.tier !== 'string') return []
      const multiplier = V1_TIER_MULTIPLIER[reached.tier]
      if (multiplier === undefined) return []
      // A task deleted since leaves no target to read the tier against. 66 is the middle of the
      // three difficulties and the only honest guess left; the alternative is dropping a mark the
      // person actually earned.
      const target = (typeof reached.taskId === 'string' ? targetByTask.get(reached.taskId) : undefined) ?? 66
      const days = target * multiplier
      const rank = rankReachedAt(days)
      if (!rank) return []
      return [{ taskId: reached.taskId, goalId: reached.goalId, rank: rank.id, days }]
    })
    return { ...day, milestonesReached }
  })

  return { ...state, user: { ...user, goals: nextGoals }, days: nextDays }
}

/**
 * v2 → v3: a habit stops having a finish of its own.
 *
 * `targetDays` was set from a difficulty the person picked at creation — «простая» meant 21 days,
 * «средняя» 66 — and on that day the app congratulated them on reaching a number they had never
 * named. The study behind those numbers says the spread runs from 18 to 254 days, so choosing one
 * of three from a word was false precision wearing the clothes of a personal goal. What is left is
 * the ladder, which measures how far the habit has set.
 *
 * So both the field and the stamps it produced go. The stamps are dropped rather than kept as
 * history because the screen that could read them is gone too: a record of an event the app can no
 * longer render, and no longer believes in, is not history, it is litter.
 */
function v2ToV3(state: unknown): unknown {
  if (!isObject(state) || !isObject(state.user) || !Array.isArray(state.user.goals) || !Array.isArray(state.days)) {
    return state
  }

  const goals = state.user.goals.map((goal) => {
    if (!isObject(goal) || !Array.isArray(goal.tasks)) return goal
    const tasks = goal.tasks.map((task) => {
      if (!isObject(task)) return task
      const { targetDays: _dropped, ...rest } = task
      return rest
    })
    return { ...goal, tasks }
  })

  const days = state.days.map((day) => {
    if (!isObject(day)) return day
    const { targetsReached: _dropped, ...rest } = day
    return rest
  })

  return { ...state, user: { ...state.user, goals }, days }
}

const MIGRATIONS: MigrationChain = { 1: v1ToV2, 2: v2ToV3 }

/**
 * Test seam. The real chain is empty, so the only way to know the machinery around it works —
 * that steps run in order, that a gap in the chain is refused rather than skipped — is to run
 * it against a stand-in chain. Production callers pass nothing.
 */
export interface ReadOptions {
  currentVersion?: number
  migrations?: MigrationChain
}

/**
 * What a stored record turned out to be. `unreadable` is deliberately not the same as `empty`:
 * there is no backend, so a record we refuse to read is the user's only copy of their history
 * and must be preserved, not replaced with a fresh start.
 */
export type LoadOutcome =
  | { kind: 'ok'; state: AppState; upgradedFrom: number | null }
  | { kind: 'empty' }
  | { kind: 'unreadable'; reason: string }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The minimum every consumer of AppState assumes — a user with goals, and a list of days.
 * Deliberately shallow: a stricter check would quarantine records that are perfectly usable,
 * which is the exact failure this whole path exists to prevent. It only has to stop a record
 * that would crash somewhere far from here, in geometry or in a screen.
 */
function isPlausibleState(value: unknown): value is AppState {
  if (!isObject(value)) return false
  const user = value.user
  return isObject(user) && Array.isArray(user.goals) && Array.isArray(value.days)
}

/** Parses and upgrades a stored record. `null` means nothing was ever saved. */
export function readEnvelope(raw: string | null, options: ReadOptions = {}): LoadOutcome {
  const currentVersion = options.currentVersion ?? CURRENT_VERSION
  const migrations = options.migrations ?? MIGRATIONS
  if (raw === null || raw === '') return { kind: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'unreadable', reason: 'запись не разбирается как JSON' }
  }

  if (!isObject(parsed) || !('state' in parsed)) {
    return { kind: 'unreadable', reason: 'запись не похожа на сохранение The Way' }
  }

  const version = parsed.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { kind: 'unreadable', reason: `непонятная версия записи: ${JSON.stringify(version)}` }
  }

  // A record from a newer build. Its shape is unknown to this code and downgrading is not a
  // thing, so the only safe move is to leave it alone — someone opened an old tab, and the
  // newer save must survive that.
  if (version > currentVersion) {
    return { kind: 'unreadable', reason: `запись новее этой сборки: v${version} против v${currentVersion}` }
  }

  let state: unknown = parsed.state
  for (let v = version; v < currentVersion; v++) {
    const step = migrations[v]
    if (!step) return { kind: 'unreadable', reason: `нет шага миграции v${v} → v${v + 1}` }
    state = step(state)
  }

  if (!isPlausibleState(state)) {
    return { kind: 'unreadable', reason: 'в записи нет пользователя или списка дней' }
  }

  return { kind: 'ok', state, upgradedFrom: version === currentVersion ? null : version }
}

export function serializeEnvelope(state: AppState, pretty = false): string {
  const envelope: StoredEnvelope = { version: CURRENT_VERSION, state }
  return pretty ? JSON.stringify(envelope, null, 2) : JSON.stringify(envelope)
}
