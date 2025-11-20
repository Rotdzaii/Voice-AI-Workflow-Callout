import { useState, useEffect, useRef, useCallback } from 'react';
import HomePage from './HomePage';
import LoginPage from './pages/LoginPage';
import CredentialsPage from './pages/CredentialsPage';
import WorkflowBuilder from './components/WorkflowBuilder';
import ReportPage from './ReportPage.tsx';

type ViewState =
  | { kind: 'home' }
  | { kind: 'builder'; workflowId?: string }
  | { kind: 'report' }
  | { kind: 'login' }
  | { kind: 'loginCredentials' };

function App() {
  // Require login before accessing app content
  const initialView: ViewState = (typeof localStorage !== 'undefined' && localStorage.getItem('auth_token')) ? { kind: 'home' } : { kind: 'login' };
  const [view, setView] = useState<ViewState>(initialView);
  const authed = typeof localStorage !== 'undefined' && !!localStorage.getItem('auth_token');
  const v: ViewState = (!authed && view.kind !== 'login' && view.kind !== 'loginCredentials') ? { kind: 'login' } : view;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      {v.kind === 'home' && (
        <HomePage
          onOpenWorkflow={(wf) => setView({ kind: 'builder', workflowId: wf.id })}
          onOpenReport={() => setView({ kind: 'report' })}
          onOpenLogin={() => setView({ kind: 'login' })}
        />
      )}
            {v.kind === 'login' && (
              <LoginPage
                onBack={() => setView(authed ? { kind: 'home' } : { kind: 'login' })}
                onOpenCredentials={() => setView({ kind: 'loginCredentials' })}
              />
            )}

            {v.kind === 'loginCredentials' && (
              <CredentialsPage
                onBack={() => setView({ kind: 'login' })}
                onSuccess={() => setView({ kind: 'home' })}
              />
            )}
      {v.kind === 'report' && (
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

      {v.kind === 'builder' && (
        <BuilderWithHeader onBack={() => setView({ kind: 'home' })} onReview={() => setView({ kind: 'report' })} workflowId={v.workflowId} />
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