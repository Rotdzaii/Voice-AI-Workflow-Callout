import { useEffect, useRef, useState } from 'react';
import WorkflowBuilder from './components/WorkflowBuilder';
import ReportPage from './ReportPage.tsx';
import { fetchCurrentUser, getStoredProfile, logout, getAvatarUrl, getAvatarCandidates, type UserProfile } from './services/auth';

interface WorkflowMeta {
  id: string;
  name: string;
  status: 'Active' | 'Draft' | 'Error';
  updatedAt: string;
}

const mockWorkflows: WorkflowMeta[] = [
  { id: 'wf-1', name: 'Meeting_Bot_v1', status: 'Active', updatedAt: 'dd/mm/yyyy - 00:00' },
  { id: 'wf-2', name: 'Support_AI_v2', status: 'Draft', updatedAt: 'dd/mm/yyyy - 00:00' },
  { id: 'wf-3', name: 'QA_Router', status: 'Error', updatedAt: 'dd/mm/yyyy - 00:00' },
];

export default function HomePage({ onOpenWorkflow, onOpenReport }: { onOpenWorkflow?: (wf: WorkflowMeta) => void; onOpenReport?: () => void }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'error'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<WorkflowMeta | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>(mockWorkflows);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | undefined>(undefined);
  const avatarIdxRef = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Try backend /auth/me first, then fallback to stored/decoded profile
      const profile = await fetchCurrentUser().catch(() => null) || getStoredProfile();
      if (alive) setUser(profile || null);
    })();
    const onDoc = (e: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => { alive = false; document.removeEventListener('mousedown', onDoc); };
  }, []);

  useEffect(() => {
    const cands = getAvatarCandidates(user);
    avatarIdxRef.current = 0;
    setAvatarSrc(cands[0]);
  }, [user]);

  const filtered: WorkflowMeta[] = workflows.filter((w: WorkflowMeta) => {
    if (filter === 'active' && w.status !== 'Active') return false;
    if (filter === 'draft' && w.status !== 'Draft') return false;
    if (filter === 'error' && w.status !== 'Error') return false;
    if (query && !w.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const createNew = () => {
    const id = `wf-${Date.now()}`;
    const meta: WorkflowMeta = { id, name: 'New_Workflow', status: 'Draft', updatedAt: new Date().toLocaleString() };
    setWorkflows(prev => [meta, ...prev]);
    setSelected(meta);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8f9fb' }}>
      {/* Sidebar */}
      <aside style={{ width: sidebarCollapsed ? 64 : 220, transition: 'width .2s', background: '#ffffff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', padding: sidebarCollapsed ? '16px 8px' : '16px 12px', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{sidebarCollapsed ? 'L' : 'Logo'}</div>
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              title="Thu gọn"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            >⇤</button>
          )}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Mở rộng"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            >⇥</button>
          )}
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            style={navBtnStyle}
            onClick={() => {
              setSelected(null);
              setFilter('all');
              setQuery('');
              setShowReport(false);
            }}
          >{sidebarCollapsed ? 'WF' : 'Workflow'}</button>
          <button
            style={navBtnStyle}
            onClick={() => {
              if (onOpenReport) {
                onOpenReport();
              } else {
                setSelected(null);
                setShowReport(true);
              }
            }}
          >{sidebarCollapsed ? 'RP' : 'Report'}</button>
        </nav>
        <div ref={userMenuRef} style={{ marginTop: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: 12, position: 'relative' }}>
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            title={user?.email || user?.name || 'Account'}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {(() => { const a = avatarSrc || getAvatarUrl(user); return a; })() ? (
              <img
                src={avatarSrc || getAvatarUrl(user)}
                alt={user?.name || 'avatar'}
                onError={() => {
                  const list = getAvatarCandidates(user);
                  avatarIdxRef.current += 1;
                  setAvatarSrc(list[avatarIdxRef.current]);
                }}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid #d1d5db' }}
              />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#111827', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                {(user?.name || 'User').slice(0,1).toUpperCase()}
              </div>
            )}
            {!sidebarCollapsed && <div style={{ flex: 1, textAlign: 'left' }}>{user?.name || 'User'}</div>}
            <span aria-hidden>⋮</span>
          </button>

          {userMenuOpen && (
            <div
              style={{
                position: 'absolute',
                left: sidebarCollapsed ? 8 : 0,
                right: 0,
                bottom: 48,
                background: '#121212',
                color: 'white',
                borderRadius: 12,
                boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                padding: 8,
                minWidth: sidebarCollapsed ? 220 : 240,
                zIndex: 9999,
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {(() => { const a = avatarSrc || getAvatarUrl(user); return a; })() ? (
                  <img
                    src={avatarSrc || getAvatarUrl(user)}
                    alt={user?.name || 'avatar'}
                    onError={() => {
                      const list = getAvatarCandidates(user);
                      avatarIdxRef.current += 1;
                      setAvatarSrc(list[avatarIdxRef.current]);
                    }}
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffffff', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                    {(user?.name || 'U').slice(0,1).toUpperCase()}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{user?.name || 'User'}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{user?.email || (user?.provider ? `Signed in via ${user.provider}` : '')}</div>
                </div>
              </div>
              {/* Provider badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px 0 2px', color: 'rgba(255,255,255,0.9)' }}>
                {user?.provider === 'google' && (
                  <div title="Google" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.1 31.9 29 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.3 2.9l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.3 19 13 24 13c2.8 0 5.4 1.1 7.3 2.9l5.7-5.7C33.6 6.1 29 4 24 4 16 4 9.1 8.4 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 44c5 0 9.6-1.9 13-5.1l-6-4.9C29.1 35.1 26.7 36 24 36c-5 0-9.2-3.1-10.8-7.5l-6.7 5.2C9.2 39.6 16 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-3 5.2-5.7 6.8l6 4.9C38.1 36.6 40 30.7 40 24c0-1.2-.1-2.3-.4-3.5z"/>
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Google</span>
                  </div>
                )}
                {user?.provider === 'github' && (
                  <div title="GitHub" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                      <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>GitHub</span>
                  </div>
                )}
                {(!user?.provider || user?.provider === 'local') && (
                  <div title="Local account" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <span style={{ display: 'inline-flex', width: 14, height: 14, borderRadius: 7, background: '#6EE7B7' }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Local</span>
                  </div>
                )}
              </div>
              <div style={{ height: 8 }} />
              <button
                onClick={() => logout('/')}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'white', cursor: 'pointer' }}
              >
                <span style={{ width: 16 }}>⇦</span>
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Content */}
  <main style={{ flex: 1, padding: '24px 32px', overflow: 'auto', width: '100%' }}>
        {showReport ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setShowReport(false)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#ffffff', cursor: 'pointer' }}>← Back</button>
              <div style={{ fontWeight: 700 }}>Workflow Performance Dashboard</div>
            </div>
            <div style={{ flex: 1 }}>
              <ReportPage onGoHome={() => setShowReport(false)} />
            </div>
          </div>
        ) : !selected ? (
          <div style={{ width: '100%' }}>
            {/* Search */}
            <div style={{ marginBottom: 24 }}>
              <input
                placeholder="Search by keyword workflow name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={searchInputStyle}
              />
            </div>
            {/* Filter buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
              <button
                onClick={() => setFilter('active')}
                style={{ ...filterBtnStyle(filter === 'active'), marginLeft: 24 }}
              >
                Active Workflows
              </button>
              <button
                onClick={() => setFilter('draft')}
                style={filterBtnStyle(filter === 'draft')}
              >
                Draft Workflows
              </button>
              <button
                onClick={() => setFilter('error')}
                style={{ ...filterBtnStyle(filter === 'error'), marginRight: 24 }}
              >
                Error Workflows
              </button>
            </div>

            {/* Recent Activities panel */}
            <div style={panelStyle}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Recent Activities:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontSize: 12, fontWeight: 600, padding: '4px 8px', color: '#374151' }}>
                <div>Workflow name</div>
                <div>Status</div>
                <div>Last Modified</div>
              </div>
              <div style={{ maxHeight: 260, overflow: 'auto' }}>
                {(filtered as WorkflowMeta[]).map((w) => {
                  const active = (selected as WorkflowMeta | null)?.id === w.id;
                  return (
                    <div
                      key={w.id}
                      onClick={() => {
                        setSelected(w);
                        onOpenWorkflow?.(w);
                      }}
                      style={{
                        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', alignItems: 'center', padding: '8px 12px', cursor: 'pointer',
                        border: '1px solid #d1d5db', margin: '4px 8px', borderRadius: 12, background: active ? '#ffffff' : '#f3f4f6',
                        boxShadow: active ? '0 0 0 2px #111827 inset' : 'none'
                      }}
                    >
                      <div>{w.name}</div>
                      <div>{w.status}</div>
                      <div style={{ fontSize: 12 }}>{w.updatedAt}</div>
                    </div>
                  );
                })}
                {filtered.length === 0 && <div style={{ padding: 16, color: '#6b7280' }}>No workflows found.</div>}
              </div>
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button onClick={createNew} style={{ padding: '10px 18px', borderRadius: 12, background: '#ffffff', border: '1px solid #111827', cursor: 'pointer', fontWeight: 600 }}>+ New Workflows</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', height: '100%', minHeight: '800px' }}>
            <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={() => setSelected(null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#ffffff', cursor: 'pointer' }}>← Back</button>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{selected!.name}</div>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#f3f4f6', border: '1px solid #e5e7eb' }}>{selected!.status}</span>
            </div>
            <div style={{ position: 'absolute', inset: 0 }}>
              <WorkflowBuilder />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  background: '#ffffff',
  border: '1px solid #111827',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left'
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 18px',
  borderRadius: 14,
  border: '1px solid #111827',
  fontSize: 14,
  outline: 'none',
  boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
};

function filterBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '14px 22px',
    borderRadius: 14,
    border: '1px solid #111827',
    background: active ? '#ffffff' : '#f3f4f6',
    cursor: 'pointer',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: active ? '0 0 0 2px #111827 inset' : 'none'
  };
}

const panelStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #111827',
  padding: '24px 16px',
  borderRadius: 18,
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  minHeight: 360,
};
