import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../supabase/authState'
import type { FriendsView, SocialClient } from './client'
import type { CirclesView } from './circles'
import type { SocialFeed } from './feed'
import { DEV_SAMPLE_GIF_EVENT, type Gif, type Message } from './messages'
import { gifSearchConfigured, searchGifs } from './gifSearch'
import type { Notice } from './notices'
import { newId } from '../domain/ids'
import { feedSince } from '../domain/feed'
import { getLogicalToday } from '../domain/pathEngine'
import { createSupabaseSocial } from './supabaseClient'
import { SocialContext, type SocialContextValue } from './socialState'

const NOBODY: FriendsView = { friends: [], incoming: [], outgoing: [], blocked: [] }
const NO_CIRCLES: CirclesView = { circles: [], incoming: [], outgoing: [] }
const NO_FEED: SocialFeed = { events: [], hearts: [] }
// Один и тот же пустой список, а не новый на каждый кадр: свежий массив здесь пересобирал бы
// значение контекста у всех, кто его слушает, ровно ни из-за чего.
const NO_NOTICES: Notice[] = []
const NO_MESSAGES: Message[] = []

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
  const [loadedCircles, setCircles] = useState<CirclesView>(NO_CIRCLES)
  const [loadedNotices, setNotices] = useState<Notice[]>([])
  const [loadedFeed, setFeed] = useState<SocialFeed>(NO_FEED)
  const [loadedMessages, setMessages] = useState<Message[]>(NO_MESSAGES)

  const signedIn = status === 'signed-in'

  /**
   * Что видно наружу, выводится, а не хранится вторым экземпляром. Вышедший теряет список в ту же
   * секунду — чужие имена, оставшиеся на экране после выхода, это чужие имена на телефоне, который
   * передали другому человеку, — и стирать их отдельной записью значило бы иметь состояние,
   * которое на один кадр может не совпасть с тем, вошёл человек или нет.
   */
  const view = signedIn ? loaded : NOBODY
  // Кружки и сообщения выводятся из того же признака и по той же причине: пара и новость о её
  // конце — такие же чужие имена на экране, как список друзей, и вышедший обязан потерять их в
  // тот же кадр, а не в следующем запуске.
  const circles = signedIn ? loadedCircles : NO_CIRCLES
  const notices = signedIn ? loadedNotices : NO_NOTICES
  // Лента выводится из того же признака: чужая неделя на экране вышедшего — те же чужие имена.
  const feed = signedIn ? loadedFeed : NO_FEED
  // And GIFs: a friend's face by today's circle on a phone that was handed to somebody else.
  // Dev samples (see below) ride alongside, signed in or not: the preview is for looking at the
  // bubble on a dev server that may have no account behind it at all.
  const [devSamples, setDevSamples] = useState<Message[]>(NO_MESSAGES)
  const signedMessages = signedIn ? loadedMessages : NO_MESSAGES
  const messages = useMemo(
    () => (devSamples.length === 0 ? signedMessages : [...signedMessages, ...devSamples]),
    [signedMessages, devSamples],
  )
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
   * Кружки и сообщения спрашиваются **под тем же `signedIn`, что и друзья**: с части 8 они лежат
   * на сервере, а функции выданы одной роли, и у невошедшего они отвечают отказом в правах.
   *
   * Вышедший теряет их в тот же кадр, как и список друзей, и по той же причине: чужое имя,
   * оставшееся на экране после выхода, — это чужое имя на телефоне, который передали другому.
   */
  const askCircles = useCallback(() => {
    social
      .circles()
      .then(setCircles)
      .catch(() => {
        // Кружок не отвечает — это не повод гасить экран: строки кружка просто не будет, а
        // привычка в дне останется своей обычной строкой. Она и есть главное в этом дне.
      })
  }, [social])

  /**
   * Сообщения спрашиваются **тем же способом, что и кружки**, а не один раз при входе.
   *
   * Разница видна ровно в том случае, ради которого сообщение и заведено: вторая вышла из кружка,
   * пока приложение открыто. Строка пары исчезала в ту же секунду — её приносил `askCircles` по
   * подписке, — а прощальная карточка ждала перезагрузки страницы, то есть человек получал ровно
   * ту молчаливую пропажу, от которой решение 3 и уводило.
   */
  const askNotices = useCallback(() => {
    social
      .notices()
      .then(setNotices)
      .catch(() => {
        // Молчание лучше выдуманной новости: сообщение, которого не показали, придёт в следующий
        // запуск — оно лежит на сервере, пока человек его не закроет.
      })
  }, [social])

  /**
   * Лента спрашивается **окном, а не целиком**: глубина у неё одна и на своих, и на чужих
   * (`FEED_WINDOW_DAYS`), и считается она здесь, а не на сервере, потому что «сегодня» знает тот,
   * у кого часы, — то же правило, что у отметки в кружке.
   */
  const askFeed = useCallback(() => {
    social
      .feed(feedSince(getLogicalToday(new Date())))
      .then(setFeed)
      .catch(() => {
        // Лента не ответила — своя половина экрана всё равно стоит: её выводит дорога, а она
        // лежит на телефоне. Пустая чужая половина честнее, чем погашенный экран.
      })
  }, [social])

  /**
   * GIFs are asked the way notices are — on entry and on every signal from the watch — because the
   * whole point of one is to land while the road is open.
   */
  const askMessages = useCallback(() => {
    social
      .messages()
      .then(setMessages)
      .catch(() => {
        // Nothing by today's circle is the honest answer to "could not ask": the GIF stays on the
        // server for a week and arrives on the next signal.
      })
  }, [social])

  // Dev only: the DevPanel button «Гифка от друга» lays a sample GIF by today's circle, so the bubble
  // and the sheet can be looked at without a server, a friend or a KLIPY key. It lives on this
  // device and nowhere else, and dismissing it never reaches the server.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    // With a KLIPY key the sample is a real GIF — the bubble and the sheet are then looked at with
    // the very formats a friend's GIF arrives in, not a stand-in that is lighter than any of them.
    const onSample = () => {
      const lay = (gif?: Gif) =>
        setDevSamples((current) => {
          const message = sampleMessage(current.length)
          return [...current, gif ? { ...message, gif: { id: gif.id, preview: gif.preview, full: gif.full, width: gif.width, height: gif.height } } : message]
        })
      if (!gifSearchConfigured) return lay()
      searchGifs('привет', null)
        .then((page) => lay(page.gifs[Math.floor(Math.random() * page.gifs.length)]))
        .catch(() => lay())
    }
    window.addEventListener(DEV_SAMPLE_GIF_EVENT, onSample)
    return () => window.removeEventListener(DEV_SAMPLE_GIF_EVENT, onSample)
  }, [])

  useEffect(() => {
    if (!signedIn) return

    askCircles()
    askNotices()
    askFeed()
    askMessages()

    /**
     * И подписка. Это и есть весь кружок: она нажала — у тебя загорелось, не дожидаясь, пока ты
     * откроешь экран заново.
     *
     * Из события не читается ничего: пришло — спрашиваем **оба** вида целиком. Который из них
     * изменился, по событию не определяется, и определять не надо: это то же самое чтение события,
     * от которого мы отказались, а лишний запрос стоит дешевле, чем ветка, способная разойтись.
     */
    return social.watch(() => {
      askCircles()
      askNotices()
      askMessages()
    })
  }, [social, signedIn, askCircles, askNotices, askFeed, askMessages])

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
      excuse: (circleId, date) =>
        runCircle(() => social.circleMark(circleId, date, new Date().toISOString(), 'excused')),
      invite: (input) => runCircle(() => social.circleInvite(input)),
      cancelInvite: (inviteId) => runCircle(() => social.circleCancel(inviteId)),
      acceptInvite: (inviteId, circleId, taskId) => runCircle(() => social.circleAccept(inviteId, circleId, taskId)),
      declineInvite: (inviteId) => runCircle(() => social.circleDecline(inviteId)),
      leaveCircle: (circleId) => runCircle(() => social.circleLeave(circleId)),
      feed,
      /**
       * Сердце. Вид приходит от той стороны целиком — то же правило, что у связей и у кружка:
       * кто ещё сказал сердце этому событию, знает она.
       */
      heart: async (ownerId, eventId, since) => {
        try {
          setFeed(await social.heart(ownerId, eventId, since))
        } catch {
          setError('Не получилось. Попробуй ещё раз.')
        }
      },
      unheart: async (ownerId, eventId, since) => {
        try {
          setFeed(await social.unheart(ownerId, eventId, since))
        } catch {
          setError('Не получилось. Попробуй ещё раз.')
        }
      },
      notices,
      /**
       * Закрыть сообщение. У выхода из кружка это нажатие уносит и саму запись о паре — поэтому
       * следом спрашиваются кружки: закрытый кружок стоял в списке ровно до этой секунды, и
       * оставленный в нём он был бы строкой про человека, с которым всё уже кончилось.
       */
      dismissNotice: async (noticeId) => {
        try {
          setNotices(await social.noticeDismiss(noticeId))
          askCircles()
        } catch {
          setError('Не получилось. Попробуй ещё раз.')
        }
      },
      messages,
      // The key is minted here, once, by whoever composed the send — a retry is the same message.
      sendGif: async (recipientId, gif) => {
        try {
          await social.messageSend({ id: newId(), recipientId, gif })
          return true
        } catch {
          return false
        }
      },
      dismissMessages: async (ids) => {
        // Gone from the screen at once: the person has closed it, and waiting on the server to agree
        // would keep a GIF they already dismissed standing by the road. The server's answer then
        // replaces the list — anything that arrived meanwhile comes with it.
        setMessages((current) => current.filter((m) => !ids.includes(m.id)))
        setDevSamples((current) => (current.length === 0 ? current : current.filter((m) => !ids.includes(m.id))))
        const real = ids.filter((id) => !id.startsWith(DEV_SAMPLE_PREFIX))
        if (real.length === 0) return
        try {
          setMessages(await social.messagesDismiss(real))
        } catch {
          // Not dropped on the server means it comes back on the next ask, which is the right
          // outcome for something the person has not been able to close.
        }
      },
    }),
    [view, loading, error, busy, reload, run, social, circles, runCircle, notices, askCircles, feed, messages],
  )

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

/**
 * A stand-in GIF for the dev preview: an animated SVG, so the bubble plays the way a real one does,
 * and wide like most GIFs are. Not a provider link — which is exactly why it cannot come from the
 * server: the parser would drop it.
 */
const DEV_SAMPLE_PREFIX = 'dev-sample-'

function sampleMessage(n: number): Message {
  const hue = [262, 200, 12][n % 3]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 150"><rect width="220" height="150" fill="hsl(${hue} 60% 30%)"/><circle cx="110" cy="75" r="30" fill="hsl(${hue} 90% 70%)"><animate attributeName="cy" values="75;45;75" dur="0.8s" repeatCount="indefinite"/></circle><text x="110" y="138" font-size="18" text-anchor="middle" fill="white" font-family="sans-serif">привет!</text></svg>`
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`
  const names = ['Лена', 'Олег', 'Саша']
  return {
    id: `${DEV_SAMPLE_PREFIX}${Date.now()}-${n}`,
    kind: 'gif',
    from: { id: `dev-person-${n % 3}`, handle: ['lena', 'oleg', 'sasha'][n % 3], name: names[n % 3] },
    gif: { id: `dev-${n}`, preview: url, full: url, width: 220, height: 150 },
    sentAt: new Date().toISOString(),
  }
}
