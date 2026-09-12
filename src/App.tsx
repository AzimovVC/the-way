import { Route, Routes } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import StatsScreen from './screens/StatsScreen'
import ProfileScreen from './screens/ProfileScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/stats" element={<StatsScreen />} />
      <Route path="/profile" element={<ProfileScreen />} />
    </Routes>
  )
}
