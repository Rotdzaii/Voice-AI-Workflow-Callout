import { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import HomePage from './pages/HomePage';
import WorkflowBuilder from './features/workflow/components/WorkflowBuilder';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoadingScreen from './components/ui/LoadingScreen';
import { AuthProvider, useAuth, type AuthUser } from './state/AuthContext';
import { ThemeProvider, useTheme } from './state/ThemeContext';
import { getStoredProfile, type UserProfile } from './services/auth';
import ReportPage from './pages/ReportPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <div className="app-shell" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <BrowserRouter>
            <div className="app-shell__router" style={{ flex: 1, width: '100%', display: 'flex', overflow: 'hidden' }}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/login" element={<LoginRoute />} />
                <Route
                  path="/home"
                  element={(
                    <ProtectedRoute>
                      <HomeRoute />
                    </ProtectedRoute>
                  )}
                />
                <Route
                  path="/workflow"
                  element={(
                    <ProtectedRoute>
                      <WorkflowBuilderRoute />
                    </ProtectedRoute>
                  )}
                />
                <Route
                  path="/builder"
                  element={(
                    <ProtectedRoute>
                      <WorkflowBuilderRoute />
                    </ProtectedRoute>
                  )}
                />
                <Route
                  path="/builder/:workflowId"
                  element={(
                    <ProtectedRoute>
                      <WorkflowBuilderRoute />
                    </ProtectedRoute>
                  )}
                />
                <Route
                  path="/reports"
                  element={( 
                    <ProtectedRoute>
                      <ReportsRoute />
                    </ProtectedRoute>
                  )}
                />
                <Route
                  path="/settings"
                  element={( 
                    <ProtectedRoute>
                      <SettingsRoute />
                    </ProtectedRoute>
                  )}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </BrowserRouter>
          <ThemeToggle />
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const nextModeLabel = `Switch to ${isDark ? 'light' : 'dark'} mode`;
  return (
    <label
      className={`theme-toggle theme-toggle--${theme}`}
      aria-label={nextModeLabel}
      title={nextModeLabel}
    >
      <input
        type="checkbox"
        className="theme-toggle__checkbox"
        checked={isDark}
        onChange={toggleTheme}
        aria-checked={isDark}
      />
      <span className="theme-toggle__track">
        <span className="theme-toggle__thumb" aria-hidden>
          {isDark ? '🌙' : '☀️'}
        </span>
      </span>
    </label>
  );
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <RouteLoader label="Đang xác thực..." />;
  }
  return <Navigate to={isAuthenticated ? '/home' : '/login'} replace />;
}

function LoginRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return <RouteLoader label="Đang chuẩn bị đăng nhập..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return (
    <LoginPage
      onBack={() => navigate(-1)}
    />
  );
}

function HomeRoute() {
  const profile = useDashboardProfile();
  return <HomePage profile={profile} />;
}

function WorkflowBuilderRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ workflowId?: string }>();
  const workflowId = params.workflowId ?? (location.state as { workflowId?: string } | null)?.workflowId;

  return (
    <WorkflowBuilder
      workflowId={workflowId}
      onBack={() => navigate('/home')}
    />
  );
}

function ReportsRoute() {
  const navigate = useNavigate();
  return (
    <div className="reports-frame">
      <ReportPage onGoHome={() => navigate('/home')} />
    </div>
  );
}

function SettingsRoute() {
  return (
    <div className="settings-frame">
      <SettingsPage />
    </div>
  );
}

function RouteLoader({ label }: { label: string }) {
  return <LoadingScreen label={label} />;
}

function useDashboardProfile(): UserProfile | null {
  const { user } = useAuth();
  return useMemo(() => {
    if (user) {
      return mapAuthUserToProfile(user);
    }
    return getStoredProfile();
  }, [user]);
}

function mapAuthUserToProfile(user: AuthUser | null): UserProfile | null {
  if (!user) return null;
  return {
    id: user.id,
    name: typeof user.name === 'string' ? user.name : undefined,
    email: typeof user.email === 'string' ? user.email : undefined,
    avatarUrl: typeof user.picture === 'string' ? user.picture : undefined,
    provider: typeof user.provider === 'string' ? user.provider : undefined,
    username: typeof user.username === 'string' ? user.username : undefined,
  } satisfies UserProfile;
}
