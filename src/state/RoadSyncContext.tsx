import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppState } from '../domain/models'
import { CURRENT_VERSION, type LoadOutcome } from '../storage/migrate'
import { isEmptyRoad, planSync, type RoadStamp } from '../storage/roadPlan'
import {
  cancelRoadUpload,
  downloadRoad,
  downloadRoadSnapshot,
  fetchRoadStamp,
  listRoadSnapshots,
  markRoadAgreement,
  queueRoadUpload,
  readRoadAgreement,
  uploadRoad,
} from '../storage/roadSync'
import { useAuth } from '../supabase/authState'
import { useAppState } from './appState'
import { RoadSyncContext, type RoadSyncValue } from './roadSyncState'

/**
 * Дорога и аккаунт, сведённые в одном месте.
 *
 * Провайдер стоит **внутри** входа и внутри состояния, потому что ему нужны оба, и держит ровно
 * одно решение: что делать, когда история есть с двух сторон. Ответ — спрашивать
 * (`src/storage/roadPlan.ts`), и спрашивает не он, а `BackupSection`, там же, где живёт
 * восстановление из файла.
 */
export function RoadSyncProvider({ children }: { children: ReactNode }) {
  const { state, replaceState } = useAppState()
  const { userId } = useAuth()

  /**
   * Что лежит в аккаунте — вместе с тем, **чей** это аккаунт. Иначе после смены человека штамп
   * пришлось бы гасить руками, а между входом и этим «руками» ровно один кадр, в котором чужая
   * копия стоит против твоей дороги и просит выбрать.
   *
   * `undefined` в `value` — ещё не спрашивали, `null` — спросили, там пусто. Разница несущая:
   * план считается по ответу, а не по его отсутствию.
   */
  const [asked, setAsked] = useState<{ userId: string; value: RoadStamp | null } | null>(null)
  /**
   * Аккаунт ответил, и **в нём пусто**: строка есть, а дороги в ней нет. Так выглядит «Начать
   * заново» — туда уезжает пустая дорога, а не `delete`, ради снимка на две недели. Штамп этого не
   * видит: он несёт версию и время, а не число дней, — поэтому узнаётся это только скачиванием, и
   * весит такое скачивание пустой конверт. Гасить его при смене человека не нужно: здесь лежит
   * **чей** это аккаунт, и чужой ответ не читается — то же, что у штампа выше.
   */
  const [hollow, setHollow] = useState<string | null>(null)
  const [agreedWith, setAgreedWith] = useState<string | null>(() => readRoadAgreement())
  const [failure, setFailure] = useState<{ userId: string | null; message: string } | null>(null)
  /**
   * Молчаливое скачивание уже идёт (или прошло) для **этого** входа. Ref, а не состояние: это
   * защёлка, а не то, что рисуется, — и в StrictMode, где каждый эффект прогоняется дважды, без
   * неё было бы два запроса за одну историю.
   */
  const taking = useRef(false)

  const answered = asked !== null && asked.userId === userId ? asked.value : undefined
  /**
   * Пустая дорога в аккаунте — это **не история, а её отсутствие**, и дальше она считается тем же
   * самым, чем пустая строка: `null`. Иначе пустое устройство против пустого аккаунта вечно стоит
   * в плане `download` — скачивает ничто, остаётся пустым, снова просит скачать, — а на экране
   * онбординга это навсегда зависшее «Смотрю, что лежит в аккаунте…» вместо кнопки «Начать путь».
   */
  const remote = hollow === userId ? null : answered
  const agreed = userId !== null && agreedWith === userId
  const error = failure !== null && failure.userId === userId ? failure.message : null

  useEffect(() => {
    // Новый вход — новый разговор: защёлка, оставленная от прошлого человека, молча отменила бы
    // скачивание на устройстве, где оно как раз и нужно.
    taking.current = false
    if (userId === null) {
      // Вышли — всё, что не уехало, туда уже не поедет: в аккаунте другой человек.
      cancelRoadUpload()
      return
    }

    let alive = true
    fetchRoadStamp(userId)
      .then((found) => {
        if (alive) setAsked({ userId, value: found })
      })
      .catch(() => {
        if (alive) setFailure({ userId, message: 'Не получилось спросить аккаунт про копию. Проверь связь.' })
      })

    return () => {
      alive = false
    }
  }, [userId])

  const plan = useMemo(() => {
    if (userId === null || remote === undefined) return null
    return planSync({ localEmpty: isEmptyRoad(state), remote, agreed })
  }, [userId, remote, state, agreed])

  const fetchRemote = useCallback(async (): Promise<LoadOutcome> => {
    if (userId === null) return { kind: 'empty' }
    return downloadRoad(userId)
  }, [userId])

  const listSnapshots = useCallback(async () => {
    if (userId === null) return []
    return listRoadSnapshots(userId)
  }, [userId])

  const fetchSnapshot = useCallback(
    async (takenOn: string): Promise<LoadOutcome> => {
      if (userId === null) return { kind: 'empty' }
      return downloadRoadSnapshot(userId, takenOn)
    },
    [userId],
  )

  const acceptRemote = useCallback(
    (incoming: AppState) => {
      if (userId === null) return
      // Копия сделана в прошлом, и дорогу надо довести до сегодня прежде, чем рисовать, — это
      // делает `replaceState`, тот же путь, которым приходит файл.
      replaceState(incoming)
      markRoadAgreement(userId)
      setAgreedWith(userId)
    },
    [userId, replaceState],
  )

  const keepLocal = useCallback(async () => {
    if (userId === null) return false
    try {
      // Договорённость пишет сама выгрузка — тот, чья дорога уехала, с аккаунтом и договорился.
      await uploadRoad(userId, state)
      setAgreedWith(userId)
      setAsked({ userId, value: { version: CURRENT_VERSION, updatedAt: new Date().toISOString() } })
      // В аккаунте теперь эта дорога, и пустым он больше не считается.
      setHollow(null)
      return true
    } catch {
      setFailure({ userId, message: 'Не получилось отправить дорогу в аккаунт. Проверь связь.' })
      return false
    }
  }, [userId, state])

  /**
   * Пустое устройство забирает историю молча — это новый телефон, очищенные данные или выселенная
   * PWA, и терять здесь нечего. Ровно ради этого случая всё и затевалось.
   */
  useEffect(() => {
    if (plan?.kind !== 'download' || taking.current) return
    taking.current = true
    fetchRemote()
      .then((outcome) => {
        if (outcome.kind === 'ok') {
          // Забирать нечего: в аккаунте лежит пустая дорога. Защёлка при этом остаётся закрытой —
          // второй раз за этот вход спрашивать не о чем.
          if (isEmptyRoad(outcome.state)) {
            setHollow(userId)
            return
          }
          acceptRemote(outcome.state)
          return
        }
        taking.current = false
        if (outcome.kind === 'unreadable') {
          setFailure({ userId, message: `Копию в аккаунте не удалось прочитать: ${outcome.reason}.` })
        }
      })
      .catch(() => {
        taking.current = false
        setFailure({ userId, message: 'Не получилось забрать дорогу из аккаунта. Проверь связь.' })
      })
  }, [plan, userId, fetchRemote, acceptRemote])

  useEffect(() => {
    if (userId === null) return
    if (plan?.kind !== 'upload') return
    queueRoadUpload(userId, state)
  }, [userId, plan, state])

  const value = useMemo<RoadSyncValue>(
    () => ({
      phase:
        userId === null ? 'off'
        : plan === null ? 'loading'
        : plan.kind === 'ask' ? 'ask'
        : plan.kind === 'blocked' ? 'blocked'
        : plan.kind === 'idle' ? 'idle'
        : 'syncing',
      blockedReason: plan?.kind === 'blocked' ? plan.reason : null,
      remote: remote ?? null,
      error,
      fetchRemote,
      acceptRemote,
      keepLocal,
      listSnapshots,
      fetchSnapshot,
    }),
    [userId, plan, remote, error, fetchRemote, acceptRemote, keepLocal, listSnapshots, fetchSnapshot],
  )

  return <RoadSyncContext.Provider value={value}>{children}</RoadSyncContext.Provider>
}
