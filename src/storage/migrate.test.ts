import { describe, expect, it } from 'vitest'
import type { AppState } from '../domain/models'
import { rollForwardToToday } from '../domain/dayLifecycle'
import { CURRENT_VERSION, readEnvelope, serializeEnvelope, type MigrationChain } from './migrate'
import snapshot from './__fixtures__/v1-snapshot.json'

/**
 * A record produced by an actual run of the app and frozen here. It must keep loading whatever
 * happens to the interfaces later — that is the only guarantee that matters, and the reason this
 * file is a checked-in snapshot rather than a state built by the current builders at test time.
 */
const V1_SNAPSHOT = JSON.stringify(snapshot)

describe('reading a stored record', () => {
  it('loads a real v1 snapshot with every day and goal intact', () => {
    const outcome = readEnvelope(V1_SNAPSHOT)
    expect(outcome.kind).toBe('ok')
    if (outcome.kind !== 'ok') return

    expect(outcome.upgradedFrom).toBeNull()
    expect(outcome.state.days).toHaveLength(28)
    expect(outcome.state.days[0].date).toBe('2026-02-11')
    expect(outcome.state.days.at(-1)?.date).toBe('2026-03-10')
    expect(outcome.state.user.goals.map((g) => g.title)).toEqual(['Пробежка', 'Читать'])
    expect(outcome.state.user.goals[0].tasks[0].weekdays).toEqual([0, 2, 4])
  })

  it('treats an absent record as a first run, not as damage', () => {
    expect(readEnvelope(null).kind).toBe('empty')
    expect(readEnvelope('').kind).toBe('empty')
  })

  it('refuses a record it cannot parse instead of reporting an empty history', () => {
    // The difference matters: 'empty' starts someone over, 'unreadable' puts their record aside
    // first. A truncated write must never look like a new user.
    expect(readEnvelope('{"version":1,"state":{"user"').kind).toBe('unreadable')
    expect(readEnvelope('null').kind).toBe('unreadable')
    expect(readEnvelope('[1,2,3]').kind).toBe('unreadable')
    expect(readEnvelope('{"version":1}').kind).toBe('unreadable')
  })

  it('refuses a record with no user or no days, which would crash far from here', () => {
    expect(readEnvelope('{"version":1,"state":{"days":[]}}').kind).toBe('unreadable')
    expect(readEnvelope('{"version":1,"state":{"user":{"goals":[]}}}').kind).toBe('unreadable')
    expect(readEnvelope('{"version":1,"state":{"user":{},"days":[]}}').kind).toBe('unreadable')
  })

  it('leaves a record from a newer build alone rather than downgrading it', () => {
    const outcome = readEnvelope(`{"version":${CURRENT_VERSION + 1},"state":{"user":{"goals":[]},"days":[]}}`)
    expect(outcome.kind).toBe('unreadable')
  })

  it('refuses a version that is not a whole number', () => {
    expect(readEnvelope('{"version":"1","state":{"user":{"goals":[]},"days":[]}}').kind).toBe('unreadable')
    expect(readEnvelope('{"version":0,"state":{"user":{"goals":[]},"days":[]}}').kind).toBe('unreadable')
  })
})

describe('the migration chain', () => {
  const trace: string[] = []
  const migrations: MigrationChain = {
    1: (state) => {
      trace.push('1->2')
      return { ...(state as AppState), migratedAt2: true }
    },
    2: (state) => {
      trace.push('2->3')
      return { ...(state as AppState), migratedAt3: true }
    },
  }

  it('walks every step from the stored version up to the current one, in order', () => {
    trace.length = 0
    const outcome = readEnvelope(V1_SNAPSHOT, { currentVersion: 3, migrations })

    expect(trace).toEqual(['1->2', '2->3'])
    expect(outcome.kind).toBe('ok')
    if (outcome.kind !== 'ok') return
    expect(outcome.upgradedFrom).toBe(1)
    // The steps ran on the real state, not on a stand-in: the history came through them.
    expect(outcome.state.days).toHaveLength(28)
  })

  it('runs no step when the record is already current', () => {
    trace.length = 0
    const outcome = readEnvelope(V1_SNAPSHOT, { currentVersion: 1, migrations })
    expect(trace).toEqual([])
    expect(outcome.kind === 'ok' && outcome.upgradedFrom).toBeNull()
  })

  it('refuses a gap in the chain instead of silently skipping it', () => {
    // Bumping the version without adding the step is the exact mistake that used to wipe
    // everyone's progress. It must fail loudly into quarantine, never succeed halfway.
    const outcome = readEnvelope(V1_SNAPSHOT, { currentVersion: 4, migrations })
    expect(outcome.kind).toBe('unreadable')
  })
})

describe('backup round trip', () => {
  it('reads back a state it exported, with the history unchanged', () => {
    const loaded = readEnvelope(V1_SNAPSHOT)
    expect(loaded.kind).toBe('ok')
    if (loaded.kind !== 'ok') return

    const reread = readEnvelope(serializeEnvelope(loaded.state, true))
    expect(reread.kind).toBe('ok')
    if (reread.kind !== 'ok') return
    expect(reread.state).toEqual(loaded.state)
  })

  it('brings a restored copy up to today, so the road does not stop on the day it was made', () => {
    const loaded = readEnvelope(V1_SNAPSHOT)
    if (loaded.kind !== 'ok') throw new Error('fixture must load')

    const now = new Date('2026-03-15T10:00:00Z')
    const rolled = rollForwardToToday(loaded.state, now)

    expect(rolled.days.at(-1)?.date).toBe('2026-03-15')
    // The days the app was closed through are filled in, not skipped over.
    expect(rolled.days.map((d) => d.date)).toContain('2026-03-12')
    // Nothing that was already recorded is rewritten.
    expect(rolled.days[0]).toEqual(loaded.state.days[0])
  })
})
