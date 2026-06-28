import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import PlayerSearch from './pages/PlayerSearch'
import PlayerProfile from './pages/PlayerProfile'
import Compare from './pages/Compare'
import SimilarPlayers from './pages/SimilarPlayers'
import TeamStyle from './pages/TeamStyle'
import EmergingTalent from './pages/EmergingTalent'
import ScatterPlot from './pages/ScatterPlot'
import ScoutingLists from './pages/ScoutingLists'
import LeagueCoverage from './pages/LeagueCoverage'
import TeamProfile from './pages/TeamProfile'
import SquadGap from './pages/SquadGap'
import Rankings from './pages/Rankings'
import MetricWeighting from './pages/MetricWeighting'
import LeagueProfile from './pages/LeagueProfile'
import RecruitmentBoard from './pages/RecruitmentBoard'
import TacticalFit from './pages/TacticalFit'
import ProfileShortlist from './pages/ProfileShortlist'
import SquadPlanner from './pages/SquadPlanner'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={
            <ErrorBoundary>
              <Dashboard />
            </ErrorBoundary>
          } />
          <Route path="players" element={
            <ErrorBoundary>
              <PlayerSearch />
            </ErrorBoundary>
          } />
          <Route path="compare" element={
            <ErrorBoundary>
              <Compare />
            </ErrorBoundary>
          } />
          <Route path="players/:id" element={
            <ErrorBoundary>
              <PlayerProfile />
            </ErrorBoundary>
          } />
          <Route path="similar" element={
            <ErrorBoundary>
              <SimilarPlayers />
            </ErrorBoundary>
          } />
          <Route path="team-style" element={
            <ErrorBoundary>
              <TeamStyle />
            </ErrorBoundary>
          } />
          <Route path="talent" element={
            <ErrorBoundary>
              <EmergingTalent />
            </ErrorBoundary>
          } />
          <Route path="scatter" element={
            <ErrorBoundary>
              <ScatterPlot />
            </ErrorBoundary>
          } />
          <Route path="lists" element={
            <ErrorBoundary>
              <ScoutingLists />
            </ErrorBoundary>
          } />
          <Route path="coverage" element={
            <ErrorBoundary>
              <LeagueCoverage />
            </ErrorBoundary>
          } />
          <Route path="rankings" element={
            <ErrorBoundary>
              <Rankings />
            </ErrorBoundary>
          } />
          <Route path="weighting" element={
            <ErrorBoundary>
              <MetricWeighting />
            </ErrorBoundary>
          } />
          <Route path="teams/:teamId" element={
            <ErrorBoundary>
              <TeamProfile />
            </ErrorBoundary>
          } />
          <Route path="leagues/:leagueId" element={
            <ErrorBoundary>
              <LeagueProfile />
            </ErrorBoundary>
          } />
          <Route path="recruitment" element={
            <ErrorBoundary>
              <RecruitmentBoard />
            </ErrorBoundary>
          } />
          <Route path="tactical" element={
            <ErrorBoundary>
              <TacticalFit />
            </ErrorBoundary>
          } />
          <Route path="squad-gap" element={
            <ErrorBoundary>
              <SquadGap />
            </ErrorBoundary>
          } />
          <Route path="profiles/shortlist" element={
            <ErrorBoundary>
              <ProfileShortlist />
            </ErrorBoundary>
          } />
          <Route path="planner" element={
            <ErrorBoundary>
              <SquadPlanner />
            </ErrorBoundary>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
