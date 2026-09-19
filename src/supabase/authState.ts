import { createContext, useContext } from 'react'
import type { Profile } from './profiles'

/**
 * Вошёл человек или нет — и **загрузка здесь третье состояние**, а не «пока нет». Сессия лежит на
 * диске и поднимается асинхронно: экран, у которого состояний два, в первый кадр после запуска
 * показывает вошедшему человеку кнопку «Войти».
 */
export type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

/** Чем кончилась попытка занять ник. `taken` — не ошибка, а ответ, и экран отвечает на него словами. */
export type ClaimOutcome = 'saved' | 'taken' | 'failed'

export interface AuthContextValue {
  /** Есть ли вообще сервер. Без ключей в `.env.local` — нет, и вход не предлагается. */
  configured: boolean
  status: AuthStatus
  email: string | null
  userId: string | null
  /**
   * Профиль на сервере. `null` у вошедшего значит «ника ещё нет»: профиль заводится вместе с
   * ником и без него не существует.
   */
  profile: Profile | null
  /** Последняя беда, словами для экрана. */
  error: string | null
  /** Отправить код на почту. `false` — не ушло, причина лежит в `error`. */
  requestCode: (email: string) => Promise<boolean>
  /** Проверить код из письма. `false` — не подошёл. */
  verifyCode: (email: string, code: string) => Promise<boolean>
  signOut: () => Promise<void>
  /** Занять ник — он же завести профиль, если его ещё нет. */
  claimHandle: (handle: string) => Promise<ClaimOutcome>
  /**
   * Свободен ли ник прямо сейчас. Для поля, пока человек печатает; ответ устаревает в ту же
   * секунду, и держать его за бронь нельзя — бронь это запись.
   */
  checkHandleFree: (candidate: string) => Promise<boolean>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
