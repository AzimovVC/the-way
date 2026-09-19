import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../supabase/authState'
import type { FriendsView, SocialClient } from './client'
import type { CirclesView } from './circles'
import { createSupabaseSocial } from './supabaseClient'
import { SocialContext, type SocialContextValue } from './socialState'

const NOBODY: FriendsView = { friends: [], incoming: [], outgoing: [], blocked: [] }
const NO_CIRCLES: CirclesView = { circles: [], incoming: [], outgoing: [] }

/**
 * Люди вокруг, поднятые в дерево.
 *
 * Отдельный провайдер, а не поле в `AppStateContext`, — по той же причине, по которой у слоя свой
 * ключ в хранилище: пока дорога и люди не встречаются ни в одном значении, ни одно правило дороги
 * не может прочитать чужую жизнь.
 *
 * С кружком экран пути этот провайдер **зовёт** — строка кружка стоит в карточке дня, — и обещание
 * держится тем же самым: наружу отсюда уезжает её отметка, а внутрь не приезжает ничего. Её
 * галочка нарисована рядом с твоей и не входит ни в `completionRate`, ни в цвет, ни в угол, ни в
 * серию, ни в веху; твоя дорога считается ровно так же, как если бы кружка не было вовсе.
 *
 * Сеть за ним — [supabaseClient.ts](./supabaseClient.ts), и это единственное место, где её имя
 * написано: заглушка стояла здесь же и ушла одной строкой, не тронув ни одного экрана. Ради этого
 * интерфейс и заводился до сервера.
 */
export function SocialProvider({ children, client }: { children: ReactNode; client?: SocialClient }) {
  // Клиент создаётся один раз: новый на каждом рендере завёл бы вторую копию снимка и разошёлся
  // бы с первой на первой же правке.
  const [social] = useState<SocialClient>(() => client ?? createSupabaseSocial())

  // Люди приходят вместе с аккаунтом: функции выданы одной роли, и у невошедшего они отвечают
  // отказом в правах. Спросить и не понять ответа — значит сказать ему «проверь связь» про связь,
  // с которой всё в порядке. За дверью приложения невошедшего не бывает, но выход случается изнутри
  // — и список должен исчезнуть в тот же кадр, а не в следующем запуске.
  const { configured, status } = useAuth()

  const [loaded, setLoaded] = useState<FriendsView>(NOBODY)
  const [asking, setAsking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [circles, setCircles] = useState<CirclesView>(NO_CIRCLES)

  const signedIn = status === 'signed-in'

  /**
   * Что видно наружу, выводится, а не хранится вторым экземпляром. Вышедший теряет список в ту же
   * секунду — чужие имена, оставшиеся на экране после выхода, это чужие имена на телефоне, который
   * передали другому человеку, — и стирать их отдельной записью значило бы иметь состояние,
   * которое на один кадр может не совпасть с тем, вошёл человек или нет.
   */
  const view = signedIn ? loaded : NOBODY
  // «Ещё не знаю» — это тоже загрузка: сессия поднимается с диска асинхронно. Без сервера она не
  // поднимается никогда, и вечное «Загружаю…» было бы обещанием ответа, которого не будет.
  const loading = (configured && status === 'loading') || (signedIn && asking)

  // Первая загрузка. Ответ, пришедший после размонтирования, выбрасывается: в StrictMode эффект
  // зовут дважды, и без этого второй ответ обгонял бы первый.
  useEffect(() => {
    if (!signedIn) return

    let alive = true
    social
      .load()
      .then((next) => {
        if (alive) setLoaded(next)
      })
      .catch(() => {
        if (alive) setError('Не получилось загрузить. Проверь связь.')
      })
      .finally(() => {
        if (alive) setAsking(false)
      })
    return () => {
      alive = false
    }
  }, [social, signedIn])

  /**
   * Кружки спрашиваются **без оглядки на аккаунт**, в отличие от друзей, и ровно до части 8:
   * сейчас они лежат на этом же устройстве ([mockCircles.ts](./mockCircles.ts)), и разрешения
   * спрашивать не у кого. Когда они уедут на сервер, этот эффект встанет под тот же `signedIn`,
   * что и друзья, — и по той же причине: функции выданы одной роли.
   */
  useEffect(() => {
    let alive = true
    social
      .circles()
      .then((next) => {
        if (alive) setCircles(next)
      })
      .catch(() => {
        // Кружок не отвечает — это не повод гасить экран друзей: строки кружка просто не будет,
        // а привычка в дне останется своей обычной строкой. Она и есть главное в этом дне.
      })
    return () => {
      alive = false
    }
  }, [social])

  const reload = useCallback(() => {
    setAsking(true)
    setError(null)
    social
      .load()
      .then(setLoaded)
      .catch(() => setError('Не получилось загрузить. Проверь связь.'))
      .finally(() => setAsking(false))
  }, [social])

  /**
   * Одна правка. Вид приходит **от той стороны** целиком — местная догадка о результате однажды
   * разошлась бы с ним, а разошедшись, показала бы человеку друга, которого у него нет.
   */
  const run = useCallback(async (personId: string, call: () => Promise<FriendsView>) => {
    setBusy((current) => new Set(current).add(personId))
    setError(null)
    try {
      setLoaded(await call())
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

  /**
   * Правка кружка. Вид приходит от той стороны целиком — то же правило, что у связей, и по той же
   * причине: согласие второго и его отметки знает она, а не мы.
   */
  const runCircle = useCallback(
    async (call: () => Promise<CirclesView>) => {
      try {
        setCircles(await call())
      } catch {
        setError('Не получилось. Попробуй ещё раз.')
      }
    },
    [],
  )

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
      circles,
      // Снятая галочка отзывает отметку: это исправление, а не второе событие, и оставленная
      // отметка сказала бы той стороне неправду про день, который ты уже переписал.
      mark: (circleId, date, done, at) =>
        runCircle(() =>
          done ? social.circleMark(circleId, date, at.toISOString()) : social.circleUnmark(circleId, date),
        ),
      invite: (input) => runCircle(() => social.circleInvite(input)),
      cancelInvite: (inviteId) => runCircle(() => social.circleCancel(inviteId)),
      acceptInvite: (inviteId, taskId) => runCircle(() => social.circleAccept(inviteId, taskId)),
      declineInvite: (inviteId) => runCircle(() => social.circleDecline(inviteId)),
      leaveCircle: (circleId) => runCircle(() => social.circleLeave(circleId)),
    }),
    [view, loading, error, busy, reload, run, social, circles, runCircle],
  )

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}
