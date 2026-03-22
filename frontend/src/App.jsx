import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import PlayerSearch from './pages/PlayerSearch'
import PlayerProfile from './pages/PlayerProfile'
import SimilarPlayers from './pages/SimilarPlayers'
import TeamStyle from './pages/TeamStyle'
import EmergingTalent from './pages/EmergingTalent'
import ScatterPlot from './pages/ScatterPlot'
import ScoutingLists from './pages/ScoutingLists'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index        element={<Dashboard />} />
          <Route path="players"     element={<PlayerSearch />} />
          <Route path="players/:id" element={<PlayerProfile />} />
          <Route path="similar"     element={<SimilarPlayers />} />
          <Route path="team-style"  element={<TeamStyle />} />
          <Route path="talent"      element={<EmergingTalent />} />
          <Route path="scatter"     element={<ScatterPlot />} />
          <Route path="lists"       element={<ScoutingLists />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
