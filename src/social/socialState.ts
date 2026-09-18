import { createContext, useContext } from 'react'
import type { FriendsView, SocialClient } from './client'

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
