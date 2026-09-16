import { Route, Routes } from 'react-router-dom'
import ComebackCelebration from './components/ComebackCelebration'
import MilestoneCelebration from './components/MilestoneCelebration'
import ReviewGate from './components/ReviewGate'
import DevPanel from './dev/DevPanel'
import Onboarding from './screens/Onboarding'
import PathScreen from './screens/PathScreen'
import StatsScreen from './screens/StatsScreen'
import TasksScreen from './screens/TasksScreen'
import ProfileScreen from './screens/ProfileScreen'
import SettingsScreen from './screens/SettingsScreen'
import { useAppState } from './state/appState'

export default function App() {
  const { needsOnboarding, pendingCelebration, dismissCelebration, pendingComeback, dismissComeback } = useAppState()

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
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/profile/settings" element={<SettingsScreen />} />
      </Routes>
      {/* A milestone outranks a comeback outranks a day — rarest news first, all three about the
          same tap. A day that raised either of the first two never raises its own summary at all;
          see toggleDayTask. */}
      {pendingCelebration ? (
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
