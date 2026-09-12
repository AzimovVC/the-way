import { Route, Routes } from 'react-router-dom'
import Onboarding from './screens/Onboarding'
import HomeScreen from './screens/HomeScreen'
import StatsScreen from './screens/StatsScreen'
import ProfileScreen from './screens/ProfileScreen'
import { useAppState } from './state/AppStateContext'

export default function App() {
  const { needsOnboarding } = useAppState()

  if (needsOnboarding) {
    return <Onboarding />
  }

  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/stats" element={<StatsScreen />} />
      <Route path="/profile" element={<ProfileScreen />} />
    </Routes>
  )
}
