import type { AppState } from '../domain/models'

const STORAGE_KEY = 'the-way:v1'
const SAVE_DEBOUNCE_MS = 400

interface StoredEnvelope {
  version: 1
  state: AppState
}

function createEmptyState(): AppState {
  return {
    user: { id: crypto.randomUUID(), goals: [] },
    days: [],
  }
}

export function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return createEmptyState()

  try {
    const parsed = JSON.parse(raw) as StoredEnvelope
    if (parsed.version !== 1 || !parsed.state) return createEmptyState()
    return parsed.state
  } catch {
    return createEmptyState()
  }
}

let pendingState: AppState | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function flush(): void {
  if (pendingState === null) return
  const envelope: StoredEnvelope = { version: 1, state: pendingState }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
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
