import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import ComebackCelebration from './components/ComebackCelebration'
import MilestoneCelebration from './components/MilestoneCelebration'
import PredictionAsk from './components/PredictionAsk'
import PredictionCelebration from './components/PredictionCelebration'
import ReviewGate from './components/ReviewGate'
import DevPanel from './dev/DevPanel'
import Onboarding from './screens/Onboarding'
import PathScreen from './screens/PathScreen'
import { useAppState } from './state/appState'

/**
 * Экраны, кроме дороги, приезжают своими кусками.
 *
 * Причина простая и меряемая: при первом открытии человеку уезжает весь код приложения разом, а
 * нужен ему **путь** — остальные вкладки он в эту минуту не открывает. Статистика, лента, профиль
 * и всё, что под ним, ждут своего тапа.
 *
 * Дорога и онбординг остаются в первом куске нарочно, и это не осторожность:
 *
 * - **дорога — то, ради чего приложение открывают.** Экран, ждущий свой кусок, — это пустой кадр в
 *   тот единственный момент, когда человек уже смотрит;
 * - **онбординг тоже первый экран**, просто для другого человека. Он мельче дороги, и уводить его
 *   в отдельный запрос значило бы поставить задержку ровно там, где у человека меньше всего
 *   терпения: он ещё ничего нам не должен.
 *
 * Supabase отсюда **не выносится**, хотя он и самый тяжёлый кусок из внешних. Дверь стоит перед
 * приложением (решение 7 в docs/circle.md), `AuthGate` спрашивает сессию в первый кадр — и
 * вынесенный он остался бы на том же критическом пути, только двумя запросами вместо одного.
 */
const loadTasks = () => import('./screens/TasksScreen')
const loadFeed = () => import('./screens/FeedScreen')
const loadStats = () => import('./screens/StatsScreen')
const loadProfile = () => import('./screens/ProfileScreen')

const TasksScreen = lazy(loadTasks)
const FeedScreen = lazy(loadFeed)
const StatsScreen = lazy(loadStats)
const ProfileScreen = lazy(loadProfile)
const HabitsScreen = lazy(() => import('./screens/HabitsScreen'))
const FriendsScreen = lazy(() => import('./screens/FriendsScreen'))
const AddFriendsScreen = lazy(() => import('./screens/AddFriendsScreen'))
const PersonScreen = lazy(() => import('./screens/PersonScreen'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'))
const BlockedScreen = lazy(() => import('./screens/BlockedScreen'))
const AccountScreen = lazy(() => import('./screens/AccountScreen'))

/**
 * Четыре вкладки нижней панели греются, как только дорога нарисована.
 *
 * Без этого выигрыш от разбиения пришлось бы оплачивать паузой на каждом первом тапе: экран,
 * которого ещё нет, — это пустой кадр вместо перехода. Греются ровно те четыре, до которых можно
 * дотянуться **одним нажатием** с дороги; всё, что лежит глубже (настройки, друзья, чужой профиль),
 * ждёт своего тапа — до него человек идёт через экран, который эту паузу уже отработал.
 *
 * `requestIdleCallback` — чтобы догрузка не отнимала кадры у самой дороги: она едет и
 * прокручивается, и именно в эти первые секунды человек на неё смотрит. Safari его до сих пор не
 * знает, поэтому запасной путь — таймер.
 */
function warmTabs(): void {
  const warm = () => {
    void loadTasks()
    void loadFeed()
    void loadStats()
    void loadProfile()
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(warm, { timeout: 3000 })
  else setTimeout(warm, 1500)
}

export default function App() {
  const {
    needsOnboarding,
    pendingPredictionAsks,
    answerPredictionAsk,
    pendingPrediction,
    dismissPrediction,
    pendingCelebration,
    dismissCelebration,
    pendingComeback,
    dismissComeback,
  } = useAppState()

  // Дверь стоит **до** онбординга, а не после: вход на пустое устройство отдаёт историю из
  // аккаунта молча, а заведённая привычка делает устройство непустым — и вернувшегося встречал бы
  // вопрос «чью историю оставить» про строку, которую он написал минуту назад.
  // Греть вкладки на онбординге незачем: человек ещё ни одной не видел, и до первой из них у
  // него минуты, а не миллисекунды.
  useEffect(() => {
    if (!needsOnboarding) warmTabs()
  }, [needsOnboarding])

  if (needsOnboarding) {
    return (
      <AuthGate>
        <Onboarding />
        {import.meta.env.DEV && <DevPanel />}
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      {/*
        Ожидание — **пустой экран в цвете приложения**, и обе половины здесь важны.

        Колеса нет: к тапу кусок уже в памяти — вкладки греются сразу после первого кадра
        (`warmTabs`), а на диск они попадают ещё раньше, вместе с предзагрузкой service worker'а.
        Колесо, мигнувшее на кадр, — это движение, которое человек замечает и не успевает
        прочитать.

        Но и `null` здесь нельзя, и это проверено глазами: Suspense снимает **весь** экран вместе
        с нижней панелью, и вместо перехода получается белая вспышка на тёмном приложении. Заливка
        держит цвет и место, поэтому пауза, если она всё-таки случится, читается как переход, а не
        как сбой.
      */}
      <Suspense fallback={<div className="h-dvh w-full bg-surface" />}>
      <Routes>
        <Route path="/" element={<PathScreen />} />
        <Route path="/tasks" element={<TasksScreen />} />
        <Route path="/feed" element={<FeedScreen />} />
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/profile/habits" element={<HabitsScreen />} />
        <Route path="/profile/friends" element={<FriendsScreen />} />
        <Route path="/profile/friends/add" element={<AddFriendsScreen />} />
        {/* Чужой профиль живёт в корне, а не под /profile: на него ведёт ссылка-приглашение,
            которую человек отправляет наружу, и «/profile/...» в чужой ссылке читалось бы как
            «мой профиль». */}
        <Route path="/u/:handle" element={<PersonScreen />} />
        <Route path="/profile/settings" element={<SettingsScreen />} />
        <Route path="/profile/settings/blocked" element={<BlockedScreen />} />
        <Route path="/profile/settings/account" element={<AccountScreen />} />
      </Routes>
      </Suspense>
      {/* The question about a habit just made comes before all the news — it is about the next
          minute, not the last one, and it was raised by the very tap that is still under the
          person's finger.

          Then: a guess met outranks a level outranks a comeback outranks a day — rarest news first, all
          of it about the same tap. Nothing is lost to the order: each screen holds its own slot in
          state, so dismissing one lets the next up rather than dropping it. A day that raised any
          of the first three never raises its own summary at all; see toggleDayTask. */}
      {pendingPredictionAsks[0] ? (
        <PredictionAsk
          title={pendingPredictionAsks[0].title}
          icon={pendingPredictionAsks[0].icon}
          onAnswer={(days) => answerPredictionAsk(days)}
          onSkip={() => answerPredictionAsk(null)}
        />
      ) : pendingPrediction ? (
        <PredictionCelebration award={pendingPrediction} onClose={dismissPrediction} />
      ) : pendingCelebration ? (
        <MilestoneCelebration celebration={pendingCelebration} onClose={dismissCelebration} />
      ) : pendingComeback ? (
        <ComebackCelebration comeback={pendingComeback} onClose={dismissComeback} />
      ) : (
        <ReviewGate />
      )}
      {import.meta.env.DEV && <DevPanel />}
    </AuthGate>
  )
}
