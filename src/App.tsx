import { Route, Routes } from 'react-router-dom'
import MilestoneCelebration from './components/MilestoneCelebration'
import DevPanel from './dev/DevPanel'
import Onboarding from './screens/Onboarding'
import PathScreen from './screens/PathScreen'
import StatsScreen from './screens/StatsScreen'
import ProfileScreen from './screens/ProfileScreen'
import { useAppState } from './state/AppStateContext'

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
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
      </Routes>
      {pendingCelebration && <MilestoneCelebration celebration={pendingCelebration} onClose={dismissCelebration} />}
      {import.meta.env.DEV && <DevPanel />}
    </>
  )
}
