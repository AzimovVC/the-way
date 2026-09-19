import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../domain/models'

/**
 * Доказательства про **расписание** выгрузки, а не про сеть. Проверяется ровно то, чего не было:
 * прежний debounce продлевался на каждой правке, и человек, отмечающий задачи по одной, не
 * выгружался ни разу за вечер.
 */

const upserts: unknown[] = []

vi.mock('../supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: (row: unknown) => {
        upserts.push(row)
        return Promise.resolve({ error: null })
      },
    }),
  },
  isSupabaseConfigured: true,
}))

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

const { cancelRoadUpload, queueRoadUpload } = await import('./roadSync')

let serial = 0
/** Каждое состояние отличается от прошлого: одинаковые отсекает отпечаток, а тут проверяется срок. */
function nextState(): AppState {
  serial += 1
  return {
    user: { id: 'u', name: 'Ч', goals: [] },
    days: [],
    chores: [],
    note: `правка ${serial}`,
  } as unknown as AppState
}

beforeEach(() => {
  vi.useFakeTimers()
  upserts.length = 0
  store.clear()
  cancelRoadUpload()
})

afterEach(() => {
  cancelRoadUpload()
  vi.useRealTimers()
})

describe('очередь выгрузки дороги', () => {
  it('первая правка после тишины уезжает сразу', () => {
    queueRoadUpload('u1', nextState())
    expect(upserts).toHaveLength(1)
  })

  it('непрерывная работа выгружается, а не откладывается бесконечно', async () => {
    // Ровно тот случай, ради которого всё переписано: отметка раз в минуту, два часа подряд.
    queueRoadUpload('u1', nextState())
    expect(upserts).toHaveLength(1)

    for (let minute = 0; minute < 120; minute += 1) {
      await vi.advanceTimersByTimeAsync(60_000)
      queueRoadUpload('u1', nextState())
    }
    await vi.advanceTimersByTimeAsync(120_000)

    // Окно — две минуты, значит за два часа не меньше часа выгрузок.
    expect(upserts.length).toBeGreaterThanOrEqual(60)
  })

  it('пачка правок внутри окна уезжает одной выгрузкой', async () => {
    queueRoadUpload('u1', nextState())
    for (let i = 0; i < 20; i += 1) queueRoadUpload('u1', nextState())
    expect(upserts).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(120_000)
    expect(upserts).toHaveLength(2)
  })

  it('после выхода из аккаунта первая правка нового уезжает сразу', async () => {
    queueRoadUpload('u1', nextState())
    expect(upserts).toHaveLength(1)

    cancelRoadUpload()
    queueRoadUpload('u2', nextState())
    expect(upserts).toHaveLength(2)
  })
})
