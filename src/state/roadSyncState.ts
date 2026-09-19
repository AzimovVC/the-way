import { createContext, useContext } from 'react'
import type { AppState } from '../domain/models'
import type { LoadOutcome } from '../storage/migrate'
import type { RoadStamp } from '../storage/roadPlan'
import type { RoadSnapshot } from '../storage/roadSync'

/**
 * Чем кончился разговор с аккаунтом про дорогу. `loading` — третье состояние, а не «пока нет»:
 * пока штамп не приехал, неизвестно даже, есть ли там что-нибудь, и вопрос «чью дорогу оставить»,
 * мигнувший на секунду, был бы вопросом ни о чём.
 */
export type RoadSyncPhase = 'off' | 'loading' | 'idle' | 'syncing' | 'ask' | 'blocked'

export interface RoadSyncValue {
  phase: RoadSyncPhase
  /** Почему выгрузка остановлена. Заполнено только у `blocked`. */
  blockedReason: string | null
  /** Что лежит в аккаунте, без самой дороги. */
  remote: RoadStamp | null
  error: string | null
  /** Скачать и разобрать конверт из аккаунта — ещё не применяя его. */
  fetchRemote: () => Promise<LoadOutcome>
  /** Применить скачанное: дорога заменяется, и дальше копия уходит сама. */
  acceptRemote: (state: AppState) => void
  /** Оставить дорогу этого устройства и переписать ею копию в аккаунте. */
  keepLocal: () => Promise<boolean>
  /** Дни, за которые аккаунт помнит прежнюю дорогу — самое старое, что у него осталось. */
  listSnapshots: () => Promise<RoadSnapshot[]>
  /** Забрать снимок за день, ещё не применяя его. Применяет всё тот же `acceptRemote`. */
  fetchSnapshot: (takenOn: string) => Promise<LoadOutcome>
}

export const RoadSyncContext = createContext<RoadSyncValue | null>(null)

export function useRoadSync(): RoadSyncValue {
  const ctx = useContext(RoadSyncContext)
  if (!ctx) throw new Error('useRoadSync must be used within RoadSyncProvider')
  return ctx
}
