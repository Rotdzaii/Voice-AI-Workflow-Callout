import { useState, useEffect, useRef, useCallback } from 'react';
import HomePage from './HomePage';
import WorkflowBuilder from './components/WorkflowBuilder';
import ReportPage from './ReportPage.tsx';
import LoginPage from './pages/LoginPage';
import CredentialsPage from './pages/CredentialsPage';
import { fetchCurrentUser, getStoredProfile, type UserProfile } from './services/auth';

type ViewState = { kind: 'home' } | { kind: 'builder'; workflowId?: string } | { kind: 'report' };

function App() {
  const [view, setView] = useState<ViewState>({ kind: 'home' });
  const [authScreen, setAuthScreen] = useState<'login' | 'credentials'>('login');
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let canceled = false;
    async function bootstrapProfile() {
      const local = getStoredProfile();
      if (local) {
        if (!canceled) {
          setProfile(local);
          setAuthReady(true);
        }
        return;
      }
      const fetched = await fetchCurrentUser().catch(() => null);
      if (!canceled) {
        setProfile(fetched);
        setAuthReady(true);
      }
    }
    bootstrapProfile();
    return () => {
      canceled = true;
    };
  }, []);

  const resolveProfile = async () => {
    const local = getStoredProfile();
    if (local) return local;
    return fetchCurrentUser().catch(() => null);
  };

  const handleAuthSuccess = async () => {
    const next = await resolveProfile();
    setProfile(next);
    setAuthScreen('login');
    setView({ kind: 'home' });
  };

  if (!authReady) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        Đang tải...
      </div>
    );
  }

  if (!profile) {
    return authScreen === 'credentials' ? (
      <CredentialsPage
        onBack={() => setAuthScreen('login')}
        onSuccess={handleAuthSuccess}
      />
    ) : (
      <LoginPage
        onBack={() => setAuthScreen('login')}
        onOpenCredentials={() => setAuthScreen('credentials')}
      />
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      {view.kind === 'home' && (
        <HomePage
          profile={profile}
          onOpenWorkflow={(wf) => setView({ kind: 'builder', workflowId: wf.id })}
          onOpenReport={() => setView({ kind: 'report' })}
        />
      )}
      {view.kind === 'report' && (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setView({ kind: 'home' })} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#ffffff', cursor: 'pointer' }}>← Back</button>
            <div style={{ fontWeight: 700 }}>Workflow Performance Dashboard</div>
          </div>
          <div style={{ flex: 1 }}>
            <ReportPage onGoHome={() => setView({ kind: 'home' })} />
          </div>
        </div>
      )}

      {view.kind === 'builder' && (
        <BuilderWithHeader onBack={() => setView({ kind: 'home' })} onReview={() => setView({ kind: 'report' })} workflowId={view.workflowId} />
      )}
    </div>
  );
}

export default App;

function BuilderWithHeader({ onBack, onReview, workflowId }: { onBack: () => void; onReview: () => void; workflowId?: string }) {
  const [runTest, setRunTest] = useState<(() => void) | null>(null);
  // Stabilize the registration callback to avoid re-register loops
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
  <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        <button onClick={onBack} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#ffffff', cursor: 'pointer' }}>← Back</button>
        <div style={{ fontWeight: 700 }}>Workflow Builder</div>
        <div style={{ marginLeft: 'auto' }} />
        <div ref={menuRef} style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', background: '#ffffff', border: '2px solid #111827', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <button
              title="Run test"
              onClick={() => runTest?.()}
              onMouseEnter={() => setHoverSplit(s => ({ ...s, play: true }))}
              onMouseLeave={() => { setHoverSplit(s => ({ ...s, play: false })); setActiveSplit(s => ({ ...s, play: false })); }}
              onMouseDown={() => setActiveSplit(s => ({ ...s, play: true }))}
              onMouseUp={() => setActiveSplit(s => ({ ...s, play: false }))}
              style={{ padding: '6px 12px', background: playBg, border: 'none', cursor: 'pointer', fontWeight: 700 }}
            >
              ▶
            </button>
            <div style={{ width: 1, background: '#e5e7eb' }} />
            <button
              title="More"
              onClick={() => setShowMenu(v => !v)}
              onMouseEnter={() => setHoverSplit(s => ({ ...s, more: true }))}
              onMouseLeave={() => { setHoverSplit(s => ({ ...s, more: false })); setActiveSplit(s => ({ ...s, more: false })); }}
              onMouseDown={() => setActiveSplit(s => ({ ...s, more: true }))}
              onMouseUp={() => setActiveSplit(s => ({ ...s, more: false }))}
              style={{ padding: '6px 10px', background: moreBg, border: 'none', cursor: 'pointer', fontWeight: 700 }}
            >
              ▾
            </button>
          </div>
          {showMenu && (
            <div style={{ position: 'absolute', right: 0, top: 40, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 8, minWidth: 160, zIndex: 9999 }}>
              <button onClick={() => { runTest?.(); setShowMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 10, border: '1px solid transparent', background: 'white', cursor: 'pointer' }}>
                <span style={{ width: 16 }}>▶</span>
                <span>Run test</span>
              </button>
              <button onClick={() => { onReview(); setShowMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 10, border: '1px solid transparent', background: 'white', cursor: 'pointer' }}>
                <span style={{ width: 16 }}>👁</span>
                <span>Review</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, width: '100%' }}>
        <WorkflowBuilder workflowId={workflowId} onRegisterRun={registerRun} />
      </div>
    </div>
  );
}