import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './HomePage';
import WorkflowBuilder from './components/WorkflowBuilder';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import { AuthProvider, useAuth, type AuthUser } from './state/AuthContext';
import { ThemeProvider, useTheme } from './state/ThemeContext';
import { getStoredProfile, type UserProfile } from './services/auth';

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
                      <WorkflowRoute />
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
  const navigate = useNavigate();
  const profile = useDashboardProfile();

  return (
    <HomePage
      profile={profile}
      onOpenWorkflow={(wf) => navigate('/workflow', { state: { workflowId: wf?.id } })}
    />
  );
}

function WorkflowRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const workflowId = (location.state as { workflowId?: string } | null)?.workflowId;

  return (
    <div className="workspace-frame">
      <BuilderWithHeader
        workflowId={workflowId}
        onBack={() => navigate('/home')}
        onReview={() => navigate('/home')}
      />
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

function BuilderWithHeader({ onBack, onReview, workflowId }: { onBack: () => void; onReview: () => void; workflowId?: string }) {
  const [runTest, setRunTest] = useState<(() => void) | null>(null);
  const registerRun = useCallback((fn: () => void) => setRunTest(() => fn), []);
  const [showMenu, setShowMenu] = useState(false);
  const [hoverSplit, setHoverSplit] = useState<{ play: boolean; more: boolean }>({ play: false, more: false });
  const [activeSplit, setActiveSplit] = useState<{ play: boolean; more: boolean }>({ play: false, more: false });
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);
  const playBg = activeSplit.play ? '#e5e7eb' : hoverSplit.play ? '#f3f4f6' : 'white';
  const moreBg = activeSplit.more ? '#e5e7eb' : hoverSplit.more ? '#f3f4f6' : 'white';

  return (
    <div className="workspace-surface">
      <header className="workspace-header">
        <button onClick={onBack} className="workspace-header__back">← Back</button>
        <h1>Workflow Builder</h1>
        <div ref={menuRef} className="workspace-header__actions">
          <div className="workspace-header__split">
            <button
              title="Run test"
              onClick={() => runTest?.()}
              onMouseEnter={() => setHoverSplit((s) => ({ ...s, play: true }))}
              onMouseLeave={() => { setHoverSplit((s) => ({ ...s, play: false })); setActiveSplit((s) => ({ ...s, play: false })); }}
              onMouseDown={() => setActiveSplit((s) => ({ ...s, play: true }))}
              onMouseUp={() => setActiveSplit((s) => ({ ...s, play: false }))}
              style={{ background: playBg }}
            >
              ▶
            </button>
            <div className="workspace-header__split-divider" />
            <button
              title="More"
              onClick={() => setShowMenu((v) => !v)}
              onMouseEnter={() => setHoverSplit((s) => ({ ...s, more: true }))}
              onMouseLeave={() => { setHoverSplit((s) => ({ ...s, more: false })); setActiveSplit((s) => ({ ...s, more: false })); }}
              onMouseDown={() => setActiveSplit((s) => ({ ...s, more: true }))}
              onMouseUp={() => setActiveSplit((s) => ({ ...s, more: false }))}
              style={{ background: moreBg }}
            >
              ⋯
            </button>
          </div>
          {showMenu && (
            <div className="workspace-header__menu">
              <button onClick={() => { runTest?.(); setShowMenu(false); }}>
                <span>▶</span>
                <span>Run test</span>
              </button>
              <button onClick={() => { onReview(); setShowMenu(false); }}>
                <span>👁</span>
                <span>Review</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="workspace-main">
        <WorkflowBuilder workflowId={workflowId} onRegisterRun={registerRun} />
      </main>
    </div>
  );
}
