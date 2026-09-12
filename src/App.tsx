import { Route, Routes } from 'react-router-dom'
import MilestoneCelebration from './components/MilestoneCelebration'
import Onboarding from './screens/Onboarding'
import PathScreen from './screens/PathScreen'
import StatsScreen from './screens/StatsScreen'
import ProfileScreen from './screens/ProfileScreen'
import { useAppState } from './state/AppStateContext'

export default function App() {
  const { needsOnboarding, pendingCelebration, dismissCelebration } = useAppState()

  if (needsOnboarding) {
    return <Onboarding />
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<PathScreen />} />
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
      </Routes>
      {pendingCelebration && <MilestoneCelebration celebration={pendingCelebration} onClose={dismissCelebration} />}
    </>
  )
}
