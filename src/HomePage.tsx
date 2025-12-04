import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import WorkflowBuilder from './components/WorkflowBuilder';
import ReportPage from './ReportPage.tsx';
import {
  fetchCurrentUser,
  getStoredProfile,
  logout,
  getAvatarUrl,
  getAvatarCandidates,
  type UserProfile,
} from './services/auth';

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

const palette = {
  bg: 'radial-gradient(circle at 16% 18%, rgba(255,255,255,0.06), transparent 30%), radial-gradient(circle at 82% 12%, rgba(255,255,255,0.04), transparent 25%), linear-gradient(135deg, #0a0c11 0%, #0f131b 45%, #090b10 100%)',
  panel: '#0f131b',
  card: '#0f172a',
  text: '#e5e7eb',
  textMuted: '#94a3b8',
  border: '#1f2937',
  shadow: '0 24px 60px rgba(0,0,0,0.35)',
};

type HomePageProps = {
  profile?: UserProfile | null;
  onOpenWorkflow?: (wf: WorkflowMeta) => void;
  onOpenReport?: () => void;
};

export default function HomePage({ profile, onOpenWorkflow, onOpenReport }: HomePageProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'error'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<WorkflowMeta | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>(mockWorkflows);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(profile ?? null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    if (profile) {
      setUser(profile);
      return;
    }

    let alive = true;
    (async () => {
      const remoteProfile = (await fetchCurrentUser().catch(() => null)) || getStoredProfile();
      if (alive) setUser(remoteProfile || null);
    })();

    return () => {
      alive = false;
    };
  }, [profile]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(event.target as Node)) setAccountMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const avatarCandidates = useMemo(() => getAvatarCandidates(user), [user]);

  useEffect(() => {
    setAvatarIndex(0);
    setAvatarFailed(false);
  }, [avatarCandidates]);

  const avatarUrl = avatarCandidates[avatarIndex] ?? getAvatarUrl(user);
  const displayName = useMemo(() => user?.name || user?.email || 'User', [user]);
  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    const letters = parts.map((part) => part[0]).join('').slice(0, 2);
    return letters ? letters.toUpperCase() : 'U';
  }, [displayName]);
  const selectedId = selected?.id ?? null;
  const showSidebar = useMemo(() => !selected, [selected]);

  const filtered = useMemo<WorkflowMeta[]>(() => {
    return workflows.filter((w) => {
      if (filter === 'active' && w.status !== 'Active') return false;
      if (filter === 'draft' && w.status !== 'Draft') return false;
      if (filter === 'error' && w.status !== 'Error') return false;
      if (query && !w.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [filter, query, workflows]);

  const handleAvatarError = () => {
    if (avatarIndex < avatarCandidates.length - 1) {
      setAvatarIndex((idx) => idx + 1);
      return;
    }
    setAvatarFailed(true);
  };

  const handleOpenReport = () => {
    if (onOpenReport) {
      onOpenReport();
      return;
    }
    setSelected(null);
    setShowReport(true);
  };

  const handleOpenWorkflows = () => {
    setSelected(null);
    setShowReport(false);
    setFilter('all');
    setQuery('');
  };

  const handleSelectWorkflow = (wf: WorkflowMeta) => {
    setSelected(wf);
    setShowReport(false);
    onOpenWorkflow?.(wf);
  };

  const createNew = () => {
    const id = `wf-${Date.now()}`;
    const meta: WorkflowMeta = {
      id,
      name: 'New_Workflow',
      status: 'Draft',
      updatedAt: new Date().toLocaleString(),
    };
    setWorkflows((prev) => [meta, ...prev]);
    handleSelectWorkflow(meta);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', background: palette.bg, color: palette.text }}>
      {showSidebar && (
        <aside
          style={{
            width: sidebarCollapsed ? 64 : 220,
            transition: 'width .2s',
            background: palette.panel,
            borderRight: `1px solid ${palette.border}`,
            display: 'flex',
            flexDirection: 'column',
            padding: sidebarCollapsed ? '16px 8px' : '16px 12px',
            gap: 24,
            boxShadow: palette.shadow,
            borderRadius: 12,
            margin: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{sidebarCollapsed ? 'L' : 'Logo'}</div>
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                title="Thu gọn"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: palette.text }}
              >
                ‹
              </button>
            )}
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                title="Mở rộng"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: palette.text }}
              >
                ›
              </button>
            )}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button style={navBtnStyle} onClick={handleOpenWorkflows}>
              {sidebarCollapsed ? 'WF' : 'Workflow'}
            </button>
            <button style={navBtnStyle} onClick={handleOpenReport}>
              {sidebarCollapsed ? 'RP' : 'Report'}
            </button>
          </nav>
          <div
            ref={accountMenuRef}
            style={{
              marginTop: 'auto',
              borderTop: `1px solid ${palette.border}`,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#0b111b',
              borderRadius: 14,
              position: 'relative',
              color: palette.text,
            }}
          >
            {avatarUrl && !avatarFailed ? (
              <img
                src={avatarUrl}
                alt={displayName}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${palette.border}` }}
                onError={handleAvatarError}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#111827',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {initials}
              </div>
            )}
            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                {user?.email && (
                  <div style={{ fontSize: 12, color: palette.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                )}
              </div>
            )}
            <button
              title="Account menu"
              onClick={() => setAccountMenuOpen((v) => !v)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: palette.text }}
            >
              ⋮
            </button>
            {accountMenuOpen && !sidebarCollapsed && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 56,
                  background: palette.panel,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
                  padding: 8,
                  minWidth: 160,
                }}
              >
                <button
                  onClick={() => logout('/')}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid transparent',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: palette.text,
                  }}
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      <main style={{ ...mainStyle, background: 'rgba(9,11,16,0.6)', borderRadius: 18, margin: 12, boxShadow: '0 18px 42px rgba(0,0,0,0.35)' }}>
        {showReport ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${palette.border}`, display: 'flex', alignItems: 'center', gap: 12, background: palette.panel, color: palette.text, borderRadius: 12 }}>
              <button onClick={() => setShowReport(false)} style={ghostBtn}>
                ‹ Back
              </button>
              <div style={{ fontWeight: 700 }}>Workflow Performance Dashboard</div>
            </div>
            <div style={{ flex: 1 }}>
              <ReportPage onGoHome={() => setShowReport(false)} />
            </div>
          </div>
        ) : !selected ? (
          <div style={{ width: '100%', color: palette.text }}>
            <div style={{ marginBottom: 24 }}>
              <input
                placeholder="Search by keyword workflow name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ ...searchInputStyle, background: palette.panel, color: palette.text, border: `1px solid ${palette.border}` }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
              <button
                onClick={() => setFilter('active')}
                style={{ ...filterBtnStyle(filter === 'active'), background: filter === 'active' ? '#0f172a' : palette.panel, color: palette.text, border: `1px solid ${palette.border}` }}
              >
                Active Workflows
              </button>
              <button
                onClick={() => setFilter('draft')}
                style={{ ...filterBtnStyle(filter === 'draft'), background: filter === 'draft' ? '#0f172a' : palette.panel, color: palette.text, border: `1px solid ${palette.border}` }}
              >
                Draft Workflows
              </button>
              <button
                onClick={() => setFilter('error')}
                style={{ ...filterBtnStyle(filter === 'error'), background: filter === 'error' ? '#0f172a' : palette.panel, color: palette.text, border: `1px solid ${palette.border}` }}
              >
                Error Workflows
              </button>
            </div>

            <div style={{ ...panelStyle, background: palette.panel, color: palette.text, border: `1px solid ${palette.border}`, boxShadow: '0 12px 30px rgba(0,0,0,0.25)' }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Recent Activities:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontSize: 12, fontWeight: 600, padding: '4px 8px', color: palette.textMuted }}>
                <div>Workflow name</div>
                <div>Status</div>
                <div>Last Modified</div>
              </div>
              <div style={{ maxHeight: 260, overflow: 'auto' }}>
                {filtered.map((w: WorkflowMeta) => {
                  const active = selectedId === w.id;
                  return (
                    <div
                      key={w.id}
                      onClick={() => handleSelectWorkflow(w)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr',
                        alignItems: 'center',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        border: `1px solid ${palette.border}`,
                        margin: '4px 8px',
                        borderRadius: 12,
                        background: active ? '#0f172a' : '#111827',
                        boxShadow: active ? '0 0 0 2px #1f2937 inset' : 'none',
                      }}
                    >
                      <div>{w.name}</div>
                      <div>{w.status}</div>
                      <div style={{ fontSize: 12 }}>{w.updatedAt}</div>
                    </div>
                  );
                })}
                {filtered.length === 0 && <div style={{ padding: 16, color: palette.textMuted }}>No workflows found.</div>}
              </div>
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button
                  onClick={createNew}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    background: '#0f172a',
                    border: `1px solid ${palette.border}`,
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: '#f8fafc',
                    boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
                  }}
                >
                  + New Workflows
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: '#0b111b',
              minHeight: 0,
              borderRadius: 16,
              padding: 12,
              position: 'relative',
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${palette.border}`,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                background: '#0f172a',
                color: palette.text,
                borderRadius: 12,
                boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
              }}
            >
              <button onClick={() => setSelected(null)} style={{ ...ghostBtn, background: '#0b111b', color: palette.text }}>
                ‹ Back
              </button>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{selected?.name}</div>
              {selected && (
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#0b111b', border: `1px solid ${palette.border}` }}>
                  {selected.status}
                </span>
              )}
            </div>
            <div style={{ position: 'absolute', inset: 12, top: 72 }}>
              <WorkflowBuilder />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const ghostBtn: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: `1px solid ${palette.border}`,
  background: 'rgba(255,255,255,0.04)',
  cursor: 'pointer',
  fontWeight: 600,
  color: palette.text,
};

const navBtnStyle: CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  background: 'rgba(11,17,27,0.9)',
  border: `1px solid ${palette.border}`,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
  color: palette.text,
};

const searchInputStyle: CSSProperties = {
  width: '100%',
  padding: '14px 18px',
  borderRadius: 16,
  border: `1px solid ${palette.border}`,
  fontSize: 14,
  outline: 'none',
  background: 'transparent',
  color: palette.text,
  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
};

function filterBtnStyle(active: boolean): CSSProperties {
  return {
    padding: '14px 22px',
    borderRadius: 14,
    border: `1px solid ${palette.border}`,
    background: active ? '#0f172a' : '#0b111b',
    cursor: 'pointer',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#e5e7eb',
    boxShadow: active ? '0 0 0 2px #1f2937 inset' : 'none',
  };
}

const panelStyle: CSSProperties = {
  background: palette.card,
  border: `1px solid ${palette.border}`,
  padding: '24px 16px',
  borderRadius: 18,
  boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
  minHeight: 360,
};

const mainStyle: CSSProperties = {
  flex: 1,
  padding: '24px 32px',
  overflow: 'hidden',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
};

