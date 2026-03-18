import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { useAuthStore } from './store/auth.store';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import BusinessTeamsPage from './pages/BusinessTeamsPage';
import FlowTeamsPage from './pages/FlowTeamsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import IssueDetailPage from './pages/IssueDetailPage';
import BoardPage from './pages/BoardPage';
import SprintsPage from './pages/SprintsPage';
import GlobalSprintsPage from './pages/GlobalSprintsPage';
import ReleasesPage from './pages/ReleasesPage';
import TimePage from './pages/TimePage';
import TeamsPage from './pages/TeamsPage';
import AdminPage from './pages/AdminPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import UatTestsPage from './pages/UatTestsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <LoadingSpinner />;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const darkTheme = {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      // Передаём конкретные hex-значения, а не CSS-переменные —
      // Ant Design разрешает токены в JS, CSS vars там не работают
      colorPrimary: '#7b86ff',
      colorPrimaryHover: '#9aa4ff',
      colorBgBase: '#111117',
      colorBgContainer: '#181821',
      colorBgElevated: '#1e1e2a',      // фон выпадающих списков, модалок, поповеров
      colorBgSpotlight: '#252535',     // тултипы
      colorBorder: 'rgba(255,255,255,0.10)',
      colorBorderSecondary: 'rgba(255,255,255,0.07)',
      colorTextBase: '#e2e2e8',
      colorText: '#e2e2e8',
      colorTextSecondary: '#8c8c9e',
      colorTextTertiary: '#555566',
      colorTextQuaternary: '#3a3a4a',
      colorTextPlaceholder: '#3a3a4a',
      colorFillSecondary: 'rgba(255,255,255,0.06)',
      colorFill: 'rgba(255,255,255,0.04)',
      colorFillTertiary: 'rgba(255,255,255,0.03)',
      colorSplit: 'rgba(255,255,255,0.07)',
      borderRadius: 6,
      borderRadiusSM: 4,
      borderRadiusLG: 10,
      fontFamily: "Inter, -apple-system, system-ui, sans-serif",
      fontSize: 13,
      fontSizeSM: 12,
      controlHeight: 32,
      controlHeightSM: 26,
      controlHeightLG: 38,
      lineWidth: 1,
      motionDurationMid: '0.12s',
      motionDurationSlow: '0.18s',
    },
  };

  return (
    <ConfigProvider theme={darkTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="business-teams" element={<BusinessTeamsPage />} />
            <Route path="flow-teams" element={<FlowTeamsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="projects/:id/board" element={<BoardPage />} />
            <Route path="projects/:id/sprints" element={<SprintsPage />} />
            <Route path="projects/:id/releases" element={<ReleasesPage />} />
            <Route path="sprints" element={<GlobalSprintsPage />} />
            <Route path="issues/:id" element={<IssueDetailPage />} />
            <Route path="time" element={<TimePage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="uat" element={<UatTestsPage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
