import { Route, Routes } from 'react-router-dom'
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
  const { needsOnboarding, pendingCelebration, dismissCelebration } = useAppState()

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
      {/* A milestone outranks a day: it is the rarer news, and it is about the same tap. The day's
          summary is not lost by waiting — it is still standing behind this one. */}
      {pendingCelebration ? (
        <MilestoneCelebration celebration={pendingCelebration} onClose={dismissCelebration} />
      ) : (
        <ReviewGate />
      )}
      {import.meta.env.DEV && <DevPanel />}
    </>
  )
}
