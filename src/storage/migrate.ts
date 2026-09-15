import type { AppState } from '../domain/models'

/** The version this build writes. Bumping it is only safe with a matching entry in MIGRATIONS. */
export const CURRENT_VERSION = 1

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

const MIGRATIONS: MigrationChain = {}

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
