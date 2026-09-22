import { createContext, useContext } from 'react'
import type { FriendsView, SocialClient } from './client'
import type { CirclesView, NewCircleInvite } from './circles'
import type { SocialFeed } from './feed'
import type { Notice } from './notices'

/**
 * Люди вокруг, как их видит дерево. Контекст держится в своём файле, как и `appState.ts` рядом с
 * `AppStateContext.tsx`: файл, который отдаёт наружу и компонент, и значение, теряет горячую
 * перезагрузку целиком.
 */
export interface SocialContextValue {
  view: FriendsView
  /** Первая загрузка. Правки его не поднимают — у них свой признак, по человеку. */
  loading: boolean
  /** Что сказала та сторона, когда не получилось. Экран обязан это показать, а не проглотить. */
  error: string | null
  /**
   * Кого сейчас ждут. По человеку, а не одним флагом: общий гасил бы весь список, пока едет ответ
   * про одну строку, и нажавший «Принять» у Лены не мог бы ответить Олегу.
   */
  busy: ReadonlySet<string>
  reload: () => void
  request: (personId: string) => Promise<void>
  cancel: (personId: string) => Promise<void>
  accept: (personId: string) => Promise<void>
  decline: (personId: string) => Promise<void>
  remove: (personId: string) => Promise<void>
  /**
   * Блокировка идёт здесь, а жалоба — нет, и разделяет их одно: блокировка меняет **твои связи**,
   * поэтому список друзей обязан потерять человека в тот же момент. Жалоба не меняет ничего, её
   * экран отправляет сам через `client` — как поиск и чужой профиль.
   */
  block: (personId: string) => Promise<void>
  unblock: (personId: string) => Promise<void>
  /** Для экранов, которые спрашивают сами: поиск, предложения, чужой профиль. */
  client: SocialClient

  /**
   * Кружки и приглашения в них. Держатся **рядом** с друзьями, а не отдельным провайдером: кружок
   * — это вторая половина того же человека, и экран, узнавший про друга из одного места, а про
   * общую с ним привычку из другого, показал бы их разъехавшимися ровно в тот момент, когда одно
   * из двух не ответило.
   */
  circles: CirclesView
  /**
   * Опубликовать свою отметку. Ничего не ждёт: твоя строка дня к этому моменту уже закрыта — её
   * закрыл `applyAction` на твоей дороге. Здесь только «она увидит».
   */
  mark: (circleId: string, date: string, done: boolean, at: Date) => Promise<void>
  /**
   * Объявить день освобождённым: ты заморозился.
   *
   * Своим словом, а не флагом у `mark`, потому что это **другая новость**. «Не отметился» и «этот
   * день с меня не спросил» — разные вещи для пары: первое рвёт общий счёт, второе нет. Без этой
   * ручки её половина читала бы твою болезнь как пропуск, и правило «каждый либо отметился, либо
   * освобождён» держалось бы только на твоей стороне.
   */
  excuse: (circleId: string, date: string) => Promise<void>
  invite: (input: NewCircleInvite) => Promise<void>
  cancelInvite: (inviteId: string) => Promise<void>
  acceptInvite: (inviteId: string, circleId: string, taskId: string) => Promise<void>
  declineInvite: (inviteId: string) => Promise<void>
  leaveCircle: (circleId: string) => Promise<void>

  /**
   * Сообщения: то, что случилось с тобой, пока тебя тут не было
   * ([notices.ts](./notices.ts)). Пока род один — второй вышел из кружка.
   *
   * Держатся здесь же, рядом с кружками, по той же причине, по которой кружки держатся рядом с
   * друзьями: сообщение **про** кружок, и экран, узнавший про пару из одного места, а про её конец
   * из другого, показал бы живую строку кружка над карточкой о том, что кружка больше нет.
   */
  notices: Notice[]
  dismissNotice: (noticeId: string) => Promise<void>

  /**
   * Лента друзей и сердца ([feed.ts](./feed.ts)).
   *
   * Держится здесь же, потому что иначе и не выйдет: чтобы нарисовать лица под событием, нужен
   * список друзей — сердце приезжает ключом человека, а имя к нему берётся из `view.friends`.
   * Второй провайдер рядом означал бы экран, у которого лента ответила, а имена ещё нет.
   *
   * Своих событий здесь нет: их выводит из дороги сам экран. Сердца — есть, и на свои тоже.
   */
  feed: SocialFeed
  /** Сказать сердце и забрать его назад. Окно ленты передаёт экран — он его и знает. */
  heart: (ownerId: string, eventId: string, since: string) => Promise<void>
  unheart: (ownerId: string, eventId: string, since: string) => Promise<void>
}

export const SocialContext = createContext<SocialContextValue | null>(null)

/**
 * Падает, а не отдаёт пустое: экран друзей без провайдера — это опечатка в дереве, и «друзей нет»
 * было бы самым убедительным способом её спрятать.
 */
export function useSocial(): SocialContextValue {
  const value = useContext(SocialContext)
  if (value === null) throw new Error('useSocial вызван вне SocialProvider')
  return value
}
