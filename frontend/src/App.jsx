import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import BottomNav from './components/BottomNav'
import ProtectedRoute from './components/ProtectedRoute'
import PageTransition from './components/PageTransition'

// Public pages
import Login from './pages/Login'
import Register from './pages/Register'
import AuthCallback from './pages/AuthCallback'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import JoinGroup from './pages/JoinGroup'

// User pages
import Home from './pages/Home'
import Groups from './pages/Groups'
import GroupDashboard from './pages/GroupDashboard'
import MatchPredictions from './pages/MatchPredictions'
import PredictionForm from './pages/PredictionForm'
import TournamentPredictions from './pages/TournamentPredictions'
import Leaderboard from './pages/Leaderboard'
import Matches from './pages/Matches'
import Profile from './pages/Profile'
import UserProfile from './pages/UserProfile'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminMatches from './pages/admin/AdminMatches'
import AdminTeams from './pages/admin/AdminTeams'
import AdminRosters from './pages/admin/AdminRosters'
import AdminResults from './pages/admin/AdminResults'
import AdminScoring from './pages/admin/AdminScoring'
import AdminSettings from './pages/admin/AdminSettings'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen bg-brand-bg">
          <PageTransition>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/join/:inviteCode" element={<JoinGroup />} />

            {/* Protected user routes */}
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
            <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDashboard /></ProtectedRoute>} />
            <Route path="/groups/:groupId/matches" element={<ProtectedRoute><MatchPredictions /></ProtectedRoute>} />
            <Route path="/groups/:groupId/matches/:matchId" element={<ProtectedRoute><PredictionForm /></ProtectedRoute>} />
            <Route path="/groups/:groupId/tournament" element={<ProtectedRoute><TournamentPredictions /></ProtectedRoute>} />
            <Route path="/groups/:groupId/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
            <Route path="/matches/:matchId" element={<ProtectedRoute><PredictionForm /></ProtectedRoute>} />
            <Route path="/tournament" element={<ProtectedRoute><TournamentPredictions /></ProtectedRoute>} />

            {/* Global leaderboard */}
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/users/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/matches" element={<ProtectedRoute adminOnly><AdminMatches /></ProtectedRoute>} />
            <Route path="/admin/teams" element={<ProtectedRoute adminOnly><AdminTeams /></ProtectedRoute>} />
            <Route path="/admin/rosters" element={<ProtectedRoute adminOnly><AdminRosters /></ProtectedRoute>} />
            <Route path="/admin/results" element={<ProtectedRoute adminOnly><AdminResults /></ProtectedRoute>} />
            <Route path="/admin/scoring" element={<ProtectedRoute adminOnly><AdminScoring /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </PageTransition>

          {/* Bottom nav shown on all protected pages */}
          <BottomNav />
        </div>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  )
}
