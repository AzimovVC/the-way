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

/**
 * Чем кончилась регистрация. Три исхода вместо «да/нет», и каждый ведёт человека в своё место:
 *
 * - `signed-in` — подтверждение адреса в проекте выключено, человек уже внутри;
 * - `code-sent` — включено, и письмо ушло: дальше шесть цифр;
 * - `exists` — такая почта уже заведена. Это **не** беда и не ошибка ввода: человек ошибся дверью,
 *   и сказать ему надо «войди», а не «что-то пошло не так».
 */
export type SignUpOutcome = 'signed-in' | 'code-sent' | 'exists' | 'failed'

/**
 * Чем кончился вход паролем. `unconfirmed` — пароль верный, но адрес так и не подтвердили:
 * человек завёл аккаунт и закрыл письмо. Без отдельного исхода он навсегда упирается в «почта или
 * пароль не подошли» про пароль, который подошёл.
 */
export type SignInOutcome = 'signed-in' | 'unconfirmed' | 'failed'

/**
 * Нижняя граница пароля **у нас**, и она обязана быть не ниже серверной (у Supabase по умолчанию
 * 6): правило, которое клиент обещает мягче сервера, превращается в отказ сервера — по-английски и
 * после нажатия, вместо подписи под полем до него.
 *
 * Восемь, а не шесть, потому что шесть — это длина кода из письма, который лежит на том же экране.
 * Два разных секрета одной длины человек однажды наберёт не в то поле.
 */
export const PASSWORD_MIN_LENGTH = 8

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
  /**
   * Забыть последнюю беду. Нужна тому, кто уводит человека с экрана, на котором она случилась:
   * жалоба на пароль, пережившая уход из этой двери, — это красная строка над кнопками, к которым
   * она не относится.
   */
  clearError: () => void
  /** Завести аккаунт почтой и паролем. */
  signUp: (email: string, password: string) => Promise<SignUpOutcome>
  /** Войти почтой и паролем. */
  signIn: (email: string, password: string) => Promise<SignInOutcome>
  /** Подтвердить адрес кодом из письма о регистрации. */
  verifySignUp: (email: string, code: string) => Promise<boolean>
  /**
   * Отправить код на почту — вторая дверь. Ею входят двое: забывший пароль и тот, кто завёл
   * аккаунт до того, как пароли появились. `false` — не ушло, причина лежит в `error`.
   */
  requestCode: (email: string) => Promise<boolean>
  /** Проверить код из письма. `false` — не подошёл. */
  verifyCode: (email: string, code: string) => Promise<boolean>
  /** Поставить пароль — он же сменить. Старый не спрашивается: спрашивать его не у кого. */
  setPassword: (password: string) => Promise<boolean>
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
