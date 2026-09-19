import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { handleOf, handleProblem } from '../domain/handle'
import { computeProfileOverview } from '../domain/profile'
import { clearSocial } from '../social/socialStore'
import { useAppState } from '../state/appState'
import { AuthContext, type AuthContextValue, type AuthStatus, type ClaimOutcome } from './authState'
import { isSupabaseConfigured, supabase } from './client'
import {
  fetchProfile,
  isDeletedAccount,
  isHandleFree,
  saveProfile,
  saveProjection,
  type Profile,
  type ProfileProjection,
} from './profiles'

/**
 * Числа профиля уезжают наружу не на каждую отметку. Отставшая на полминуты проекция стоит одной
 * галочки на чужом экране; проекция, уходящая на каждый тап, стоит батареи и трафика. Та же
 * причина, по которой у локальной записи 400 мс, а не ноль, — только цена здесь другая.
 */
const PROJECTION_DEBOUNCE_MS = 20_000

/**
 * Сколько ждать, прежде чем занимать набранный ник. Ник правят посимвольно, и запрос на каждую
 * букву занял бы по строке на каждое промежуточное слово — `s`, `se`, `ser` — за живым человеком.
 * Пауза в полсекунды — это «набрал и остановился».
 */
const HANDLE_CLAIM_DEBOUNCE_MS = 600

/**
 * Вход и профиль, поднятые в дерево.
 *
 * Провайдер стоит **внутри** `AppStateProvider`, потому что читает своё же состояние: имя, ник и
 * три числа, которые видны по нику. Обратной дороги нет — `AppState` про сервер не знает ничего, и
 * приложение без ключей ведёт себя ровно как раньше.
 *
 * Разделение труда между двумя сторонами одно и простое:
 *
 * - **ник приходит с сервера.** Он один на весь мир, занять его может только та сторона, и
 *   местная догадка о том, чей он, разошлась бы с ней в день, когда его заняли раньше;
 * - **всё остальное уезжает отсюда.** Имя, дни в пути, серия, число привычек — это выводы из
 *   истории, а история лежит на телефоне. Сервер их хранит, но не считает.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useAppState()

  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'signed-out')
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  // Профиль лежит вместе с тем, **чей** он. Иначе после выхода его пришлось бы гасить руками, а
  // между выходом и этим «руками» ровно один кадр, в котором чужое имя стоит на пустом аккаунте.
  const [fetched, setFetched] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Сессия лежит на диске и поднимается асинхронно; дальше за ней следит подписка — обновление
  // токена и выход в другой вкладке приходят тем же путём, что и вход.
  useEffect(() => {
    if (!supabase) return
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setUserId(data.session?.user.id ?? null)
      setEmail(data.session?.user.email ?? null)
      setStatus(data.session ? 'signed-in' : 'signed-out')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
      setEmail(session?.user.email ?? null)
      setStatus(session ? 'signed-in' : 'signed-out')
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const profile = fetched !== null && fetched.id === userId ? fetched : null

  const projection = useMemo<ProfileProjection>(() => {
    const overview = computeProfileOverview(state)
    return {
      name: state.user.name,
      daysOnRoad: overview.totalDays,
      currentStreak: overview.currentGoldStreak,
      habitCount: overview.habitCount,
      habitsPublic: state.user.habitsPublic === true,
    }
  }, [state])

  const localHandle = handleOf(state.user)

  // Эти три нужны колбэкам свежими, но не имеют права их пересоздавать: иначе `claimHandle`
  // менялся бы на каждую отметку, а вместе с ним и всё, что на него подписано.
  const projectionRef = useRef(projection)
  const profileRef = useRef<Profile | null>(profile)
  const localHandleRef = useRef(localHandle)
  useEffect(() => {
    projectionRef.current = projection
    profileRef.current = profile
    localHandleRef.current = localHandle
  }, [projection, profile, localHandle])

  /**
   * Профиль вошедшего. Нет строки — ник ещё никем не занят, и берётся тот, что человек и так
   * видит у себя в настройках: выбора здесь нет, есть первая запись того, что уже выбрано. Занят —
   * профиль остаётся пустым, и настройки просят другой ник. Молча приписать хвост из цифр значило
   * бы выдать подсказку за выбор.
   */
  useEffect(() => {
    if (!supabase || userId === null) return
    let alive = true

    fetchProfile(userId)
      .then(async (found) => {
        if (!alive) return
        if (found) {
          setFetched(found)
          return
        }
        const outcome = await saveProfile(userId, localHandleRef.current, projectionRef.current)
        if (alive && outcome.kind === 'saved') setFetched(outcome.profile)
      })
      .catch((failure: unknown) => {
        if (!alive) return
        // Сессия указывает на человека, которого больше нет. Единственный честный ответ — выйти:
        // экран «ты вошёл» над удалённым аккаунтом обещает то, чего нет, и сам не рассосётся,
        // пока не истечёт токен.
        if (isDeletedAccount(failure)) {
          void supabase?.auth.signOut()
          return
        }
        setError('Не получилось прочитать профиль. Проверь связь.')
      })

    return () => {
      alive = false
    }
  }, [userId])

  /**
   * Ник — с сервера, и применяется он **на смену профиля, а не на каждую букву**. Сравнение
   * «сервер против поля» на каждый рендер откатывало бы набранное под пальцем: пока человек
   * печатает новый ник, поле и правда не равно серверному.
   */
  const appliedHandleRef = useRef<string | null>(null)
  useEffect(() => {
    if (profile === null) return
    if (appliedHandleRef.current === profile.handle) return
    appliedHandleRef.current = profile.handle
    // Пишется и тогда, когда ник совпал с подсказкой, которую человек и так видел: до этой
    // минуты она была подсказкой, а теперь за ней стоит запись на сервере. Ник, оставшийся у себя
    // «подобранным по имени», подобрался бы заново после смены имени — и разошёлся бы с тем, по
    // которому человека уже ищут.
    dispatch({ kind: 'updateProfile', patch: { handle: profile.handle } })
  }, [profile, dispatch])

  /** Числа — наружу. Без профиля не уезжают: числа без ника некому показать. */
  useEffect(() => {
    if (!supabase || userId === null || profile === null) return
    const timer = setTimeout(() => {
      saveProjection(userId, projection).catch(() => {
        // Копия, не уехавшая сейчас, уедет со следующей правкой. Экран об этом не сообщает: это
        // не действие человека, и жаловаться ему не на что.
      })
    }, PROJECTION_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [userId, profile, projection])

  const requestCode = useCallback(async (address: string) => {
    if (!supabase) return false
    setError(null)
    const { error: failed } = await supabase.auth.signInWithOtp({
      email: address.trim(),
      options: { shouldCreateUser: true },
    })
    if (failed) {
      setError('Не получилось отправить письмо. Проверь адрес и связь.')
      return false
    }
    return true
  }, [])

  const verifyCode = useCallback(async (address: string, code: string) => {
    if (!supabase) return false
    setError(null)
    const { error: failed } = await supabase.auth.verifyOtp({
      email: address.trim(),
      token: code.trim(),
      type: 'email',
    })
    if (failed) {
      setError('Код не подошёл. Проверь его и набери ещё раз.')
      return false
    }
    return true
  }, [])

  /**
   * Выход. Дорогу он **не трогает**: она лежит на этом телефоне и остаётся источником правды, а
   * вышедший из аккаунта человек не просил стереть себе историю. Уходит только то, что пришло
   * снаружи, — сессия и кэш чужих ответов.
   */
  const signOut = useCallback(async () => {
    if (!supabase) return
    setError(null)
    await supabase.auth.signOut()
    clearSocial()
    setFetched(null)
  }, [])

  const claimHandle = useCallback(
    async (handle: string): Promise<ClaimOutcome> => {
      if (!supabase || userId === null) return 'failed'
      setError(null)
      try {
        const outcome = await saveProfile(userId, handle, projectionRef.current)
        if (outcome.kind === 'taken') {
          // Ник у человека один, и показывать ему в настройках чужой — значит обещать, что по
          // нему его найдут. Поле возвращается к тому, что за ним и правда закреплено.
          setError('Этот ник уже занят. Выбери другой.')
          const mine = profileRef.current?.handle
          if (mine !== undefined && mine !== handle) {
            appliedHandleRef.current = mine
            dispatch({ kind: 'updateProfile', patch: { handle: mine } })
          }
          return 'taken'
        }
        setFetched(outcome.profile)
        return 'saved'
      } catch {
        setError('Не получилось сохранить ник. Проверь связь.')
        return 'failed'
      }
    },
    [userId, dispatch],
  )

  /**
   * Ник — наружу. Занимается он **сам**, как только человек остановился: отдельная кнопка
   * «Сохранить» под одним полем в списке настроек, где всё остальное сохраняется само, читалась бы
   * как «остальное ещё не сохранено».
   *
   * Молчит, пока ник не годится по форме: `se` — это не «занятый ник», это середина слова.
   */
  useEffect(() => {
    if (profile === null || localHandle === profile.handle) return
    if (handleProblem(localHandle) !== null) return
    const timer = setTimeout(() => {
      void claimHandle(localHandle)
    }, HANDLE_CLAIM_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [profile, localHandle, claimHandle])

  /**
   * Свободен ли ник — для поля, пока человек печатает. Ответ подсказка, а не бронь: настоящая
   * проверка это уникальный индекс, и она случается на записи. Невошедшему отвечается «свободен»:
   * занять его всё равно не у кого, а красная строка под полем сообщала бы о беде, которой нет.
   */
  const checkHandleFree = useCallback(
    async (candidate: string) => {
      if (!supabase || userId === null) return true
      try {
        return await isHandleFree(candidate)
      } catch {
        return true
      }
    },
    [userId],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      status,
      email,
      userId,
      profile,
      error,
      requestCode,
      verifyCode,
      signOut,
      claimHandle,
      checkHandleFree,
    }),
    [status, email, userId, profile, error, requestCode, verifyCode, signOut, claimHandle, checkHandleFree],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
