import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { FriendsView, SocialClient } from './client'
import { createMockClient } from './mockClient'
import { SocialContext, type SocialContextValue } from './socialState'

/**
 * Люди вокруг, поднятые в дерево.
 *
 * Отдельный провайдер, а не поле в `AppStateContext`, — по той же причине, по которой у слоя свой
 * ключ в хранилище: пока дорога и люди не встречаются ни в одном значении, ни одно правило дороги
 * не может прочитать чужую жизнь. Здесь это видно и глазами — экран пути этот провайдер не зовёт.
 *
 * Сеть за ним пока заглушка ([mockClient.ts](./mockClient.ts)), и это единственное место, где её
 * имя написано: настоящий клиент придёт сюда одной строкой.
 */
export function SocialProvider({ children, client }: { children: ReactNode; client?: SocialClient }) {
  // Клиент создаётся один раз: новый на каждом рендере завёл бы вторую копию снимка и разошёлся
  // бы с первой на первой же правке.
  const [social] = useState<SocialClient>(() => client ?? createMockClient())

  const [view, setView] = useState<FriendsView>({ friends: [], incoming: [], outgoing: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())

  // Первая загрузка. `loading` уже поднят начальным значением, поэтому до ответа тут нечего
  // ставить. Ответ, пришедший после размонтирования, выбрасывается: в StrictMode эффект зовут
  // дважды, и без этого второй ответ обгонял бы первый.
  useEffect(() => {
    let alive = true
    social
      .load()
      .then((next) => {
        if (alive) setView(next)
      })
      .catch(() => {
        if (alive) setError('Не получилось загрузить. Проверь связь.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [social])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    social
      .load()
      .then(setView)
      .catch(() => setError('Не получилось загрузить. Проверь связь.'))
      .finally(() => setLoading(false))
  }, [social])

  /**
   * Одна правка. Вид приходит **от той стороны** целиком — местная догадка о результате однажды
   * разошлась бы с ним, а разошедшись, показала бы человеку друга, которого у него нет.
   */
  const run = useCallback(async (personId: string, call: () => Promise<FriendsView>) => {
    setBusy((current) => new Set(current).add(personId))
    setError(null)
    try {
      setView(await call())
    } catch {
      setError('Не получилось. Попробуй ещё раз.')
    } finally {
      setBusy((current) => {
        const next = new Set(current)
        next.delete(personId)
        return next
      })
    }
  }, [])

  const value = useMemo<SocialContextValue>(
    () => ({
      view,
      loading,
      error,
      busy,
      reload,
      client: social,
      request: (id) => run(id, () => social.request(id)),
      cancel: (id) => run(id, () => social.cancel(id)),
      accept: (id) => run(id, () => social.accept(id)),
      decline: (id) => run(id, () => social.decline(id)),
      remove: (id) => run(id, () => social.remove(id)),
      block: (id) => run(id, () => social.block(id)),
      unblock: (id) => run(id, () => social.unblock(id)),
    }),
    [view, loading, error, busy, reload, run, social],
  )

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}
