import { DEFAULT_FREEZES_REMAINING } from '../domain/config'
import type { AppState } from '../domain/models'
import { readEnvelope, serializeEnvelope, type LoadOutcome } from './migrate'

const STORAGE_KEY = 'the-way:v1'
/**
 * Where a record we could not read is put aside. There is no backend: a record that fails to
 * load is still the only copy of someone's history, and the app is about to write an empty
 * state over the key it came from. Copying it here first is what makes that reversible.
 */
const QUARANTINE_KEY = 'the-way:quarantine'
/**
 * When a copy was last saved *from this browser*. Deliberately its own key rather than a field on
 * the state: it is a fact about this device, not about the history. Carried inside the envelope it
 * would travel in the backup file itself, and restoring a copy on a new phone would arrive already
 * claiming that phone had a copy — which is exactly the moment the claim would be false.
 */
const LAST_BACKUP_KEY = 'the-way:last-backup'
const SAVE_DEBOUNCE_MS = 400

function createEmptyState(): AppState {
  return {
    user: {
      id: crypto.randomUUID(),
      name: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      notificationsEnabled: true,
      freezesRemaining: DEFAULT_FREEZES_REMAINING,
      freezesRefilledMonth: new Date().toISOString().slice(0, 7),
      goals: [],
    },
    days: [],
  }
}

export interface QuarantinedRecord {
  /** When the record was set aside, ISO. */
  at: string
  reason: string
  /** The original string, exactly as it was stored. */
  raw: string
}

function quarantine(raw: string, reason: string): void {
  // Only the first failure is kept. By the time a second one could happen the app has already
  // written a fresh empty state over the main key, so a later quarantine would be saving that
  // empty state on top of the real history this one is holding.
  if (localStorage.getItem(QUARANTINE_KEY) !== null) return
  const record: QuarantinedRecord = { at: new Date().toISOString(), reason, raw }
  try {
    localStorage.setItem(QUARANTINE_KEY, JSON.stringify(record))
  } catch {
    // Storage full or blocked. Nothing useful is left to do, and failing the load here would
    // turn a recoverable record into a blank screen.
  }
}

export function readQuarantine(): QuarantinedRecord | null {
  const raw = localStorage.getItem(QUARANTINE_KEY)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as QuarantinedRecord
    return typeof parsed?.raw === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function clearQuarantine(): void {
  localStorage.removeItem(QUARANTINE_KEY)
}

export function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY)
  const outcome = readEnvelope(raw)

  if (outcome.kind === 'unreadable') {
    quarantine(raw ?? '', outcome.reason)
    return createEmptyState()
  }
  if (outcome.kind === 'empty') return createEmptyState()

  // Written back straight away so the chain is not replayed on every start — and so the record
  // on disk matches what the running app believes it loaded.
  if (outcome.upgradedFrom !== null) writeNow(outcome.state)
  return outcome.state
}

/** Reads a backup file's contents with the same parser and migration chain as a stored record. */
export function readBackup(text: string): LoadOutcome {
  return readEnvelope(text)
}

export function exportStateJson(state: AppState): string {
  return serializeEnvelope(state, true)
}

/** Records that a copy was just saved. Called by whoever hands the file to the browser. */
export function markBackupSaved(date: string): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, date)
  } catch {
    // A full or blocked storage must not cost the user the copy they just made: the file is
    // already downloaded, and only the note about it is lost.
  }
}

/** The logical date ('YYYY-MM-DD') of the last copy saved here, or null if there has never been one. */
export function readLastBackupDate(): string | null {
  const raw = localStorage.getItem(LAST_BACKUP_KEY)
  return raw !== null && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

let pendingState: AppState | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function writeNow(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, serializeEnvelope(state))
}

function flush(): void {
  if (pendingState === null) return
  writeNow(pendingState)
  pendingState = null
}

export function saveState(state: AppState): void {
  pendingState = state
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    flush()
  }, SAVE_DEBOUNCE_MS)
}

export function clearState(): void {
  pendingState = null
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  localStorage.removeItem(STORAGE_KEY)
}

export function flushPendingSave(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  flush()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingSave)
  window.addEventListener('pagehide', flushPendingSave)
}
