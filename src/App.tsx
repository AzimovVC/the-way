import { Route, Routes } from 'react-router-dom'
import ComebackCelebration from './components/ComebackCelebration'
import MilestoneCelebration from './components/MilestoneCelebration'
import PredictionAsk from './components/PredictionAsk'
import PredictionCelebration from './components/PredictionCelebration'
import ReviewGate from './components/ReviewGate'
import DevPanel from './dev/DevPanel'
import FeedScreen from './screens/FeedScreen'
import Onboarding from './screens/Onboarding'
import PathScreen from './screens/PathScreen'
import StatsScreen from './screens/StatsScreen'
import TasksScreen from './screens/TasksScreen'
import ProfileScreen from './screens/ProfileScreen'
import HabitsScreen from './screens/HabitsScreen'
import SettingsScreen from './screens/SettingsScreen'
import { useAppState } from './state/appState'

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

  if (needsOnboarding) {
    return (
      <>
        <Onboarding />
        {import.meta.env.DEV && <DevPanel />}
      </>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<PathScreen />} />
        <Route path="/tasks" element={<TasksScreen />} />
        <Route path="/feed" element={<FeedScreen />} />
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/profile/habits" element={<HabitsScreen />} />
        <Route path="/profile/settings" element={<SettingsScreen />} />
      </Routes>
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
    </>
  )
}
