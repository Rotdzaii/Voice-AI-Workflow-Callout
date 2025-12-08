import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import WorkflowBuilder from './components/WorkflowBuilder';
import ReportPage from './ReportPage.tsx';
import { getAvatarUrl, logout, type UserProfile } from './services/auth';
import { useTheme } from './state/ThemeContext';

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

type Palette = {
  bg: string;
  panel: string;
  surface: string;
  card: string;
  cardAlt: string;
  text: string;
  textMuted: string;
  border: string;
  borderLight: string;
  shadow: string;
  mainBg: string;
  navBg: string;
  accent: string;
  accentText: string;
  chipBg: string;
  inputBg: string;
  highlight: string;
};

const palettes: Record<'dark' | 'light', Palette> = {
  dark: {
    bg: 'radial-gradient(circle at 16% 18%, rgba(255,255,255,0.06), transparent 30%), radial-gradient(circle at 82% 12%, rgba(255,255,255,0.04), transparent 25%), linear-gradient(135deg, #0a0c11 0%, #0f131b 45%, #090b10 100%)',
    panel: 'rgba(15, 20, 36, 0.96)',
    surface: '#0b111b',
    card: '#0f172a',
    cardAlt: '#111827',
    text: '#e5e7eb',
    textMuted: '#94a3b8',
    border: '#1f2937',
    borderLight: 'rgba(255,255,255,0.12)',
    shadow: '0 24px 60px rgba(0,0,0,0.35)',
    mainBg: 'rgba(9,11,16,0.6)',
    navBg: '#0b111b',
    accent: '#0f172a',
    accentText: '#f8fafc',
    chipBg: '#0b111b',
    inputBg: '#0f131b',
    highlight: '#0f172a',
  },
  light: {
    bg: 'radial-gradient(circle at 18% 20%, rgba(17,24,39,0.05), transparent 32%), radial-gradient(circle at 78% 10%, rgba(17,24,39,0.08), transparent 30%), linear-gradient(135deg, #f5f7ff 0%, #eef2ff 40%, #e3e7ff 100%)',
    panel: 'rgba(255,255,255,0.94)',
    surface: '#f6f7ff',
    card: '#ffffff',
    cardAlt: '#f4f6ff',
    text: '#0f172a',
    textMuted: '#475467',
    border: '#cfd6ed',
    borderLight: 'rgba(15,23,42,0.2)',
    shadow: '0 24px 60px rgba(15,23,42,0.12)',
    mainBg: 'rgba(255,255,255,0.9)',
    navBg: '#f1f4ff',
    accent: '#111c3d',
    accentText: '#ffffff',
    chipBg: '#f6f7ff',
    inputBg: '#ffffff',
    highlight: '#dfe4ff',
  },
};

type HomePageProps = {
  profile?: UserProfile | null;
  onOpenWorkflow?: (wf: WorkflowMeta) => void;
  onOpenReport?: () => void;
};

export default function HomePage({ profile, onOpenWorkflow, onOpenReport }: HomePageProps) {
  const { theme } = useTheme();
  const palette = useMemo(() => (theme === 'light' ? palettes.light : palettes.dark), [theme]);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'error'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>(mockWorkflows);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [runAction, setRunAction] = useState<(() => void) | null>(null);
  const [reviewAction, setReviewAction] = useState<(() => void) | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const selectedWorkflow = useMemo(
    () => workflows.find((wf) => wf.id === selectedId) ?? null,
    [selectedId, workflows],
  );

  const filtered = useMemo(() => {
    return workflows.filter((w) => {
      if (filter === 'active' && w.status !== 'Active') return false;
      if (filter === 'draft' && w.status !== 'Draft') return false;
      if (filter === 'error' && w.status !== 'Error') return false;
      if (query && !w.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [filter, query, workflows]);

  const displayName = useMemo(() => {
    if (!profile) return 'User';
    return profile.name?.trim() || profile.username || profile.email || 'User';
  }, [profile]);

  const avatarUrl = useMemo(() => getAvatarUrl(profile) || null, [profile]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  const initials = useMemo(() => {
    const source = displayName.trim();
    if (!source) return 'U';
    const letters = source.match(/\b\w/g);
    const pair = letters ? letters.slice(0, 2).join('') : source.slice(0, 2);
    return pair.toUpperCase();
  }, [displayName]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(e.target as Node)) setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!selectedWorkflow) {
      setRunAction(null);
      setReviewAction(null);
    }
  }, [selectedWorkflow]);

  const showSidebar = !selectedWorkflow;
  const mainStyle: CSSProperties = selectedWorkflow
    ? { flex: 1, width: '100%', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }
    : { flex: 1, padding: '24px 32px', overflow: 'auto', width: '100%' };

  const handleAvatarError = () => setAvatarFailed(true);

  const resetToWorkflowList = () => {
    setSelectedId(null);
    setFilter('all');
    setQuery('');
    setShowReport(false);
  };

  const openReport = () => {
    if (onOpenReport) {
      onOpenReport();
      return;
    }
    setSelectedId(null);
    setShowReport(true);
  };

  const createNew = () => {
    const id = `wf-${Date.now()}`;
    const meta: WorkflowMeta = { id, name: 'New_Workflow', status: 'Draft', updatedAt: new Date().toLocaleString() };
    setWorkflows((prev) => [meta, ...prev]);
    setSelectedId(id);
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
        background: palette.bg,
        color: palette.text,
      }}
    >
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'space-between',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700 }}>{sidebarCollapsed ? 'V' : 'VoiceAI'}</div>
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
            <button style={navBtnStyle(palette)} onClick={resetToWorkflowList}>
              {sidebarCollapsed ? 'WF' : 'Workflow'}
            </button>
            <button style={navBtnStyle(palette)} onClick={openReport}>
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
              background: palette.surface,
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
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayName}
                </div>
                {profile?.email && (
                  <div
                    style={{
                      fontSize: 12,
                      color: palette.textMuted,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {profile.email}
                  </div>
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

      <main
        style={{
          ...mainStyle,
          background: palette.mainBg,
          borderRadius: 18,
          margin: showSidebar ? 12 : 0,
          boxShadow: palette.shadow,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {showReport ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${palette.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: palette.panel,
                color: palette.text,
                borderRadius: 12,
              }}
            >
              <button onClick={() => setShowReport(false)} style={ghostBtn(palette)}>
                ‹ Back
              </button>
              <div style={{ fontWeight: 700 }}>Workflow Performance Dashboard</div>
            </div>
            <div style={{ flex: 1 }}>
              <ReportPage onGoHome={() => setShowReport(false)} />
            </div>
          </div>
        ) : !selectedWorkflow ? (
          <div style={{ width: '100%', color: palette.text }}>
            <div style={{ marginBottom: 24 }}>
              <input
                placeholder="Search by keyword workflow name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={searchInputStyle(palette)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
              <button onClick={() => setFilter('active')} style={filterBtnStyle(palette, filter === 'active')}>
                Active Workflows
              </button>
              <button onClick={() => setFilter('draft')} style={filterBtnStyle(palette, filter === 'draft')}>
                Draft Workflows
              </button>
              <button onClick={() => setFilter('error')} style={filterBtnStyle(palette, filter === 'error')}>
                Error Workflows
              </button>
            </div>

            <div style={{ ...panelStyle(palette), color: palette.text }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Recent Activities:</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 8px',
                  color: palette.textMuted,
                }}
              >
                <div>Workflow name</div>
                <div>Status</div>
                <div>Last Modified</div>
              </div>
              <div style={{ maxHeight: 260, overflow: 'auto' }}>
                {filtered.map((w) => {
                  const active = selectedId === w.id;
                  return (
                    <div
                      key={w.id}
                      onClick={() => {
                        setSelectedId(w.id);
                        setShowReport(false);
                        onOpenWorkflow?.(w);
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr',
                        alignItems: 'center',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        border: `1px solid ${palette.border}`,
                        margin: '4px 8px',
                        borderRadius: 12,
                        background: active ? palette.accent : palette.cardAlt,
                        boxShadow: active ? `0 0 0 2px ${palette.borderLight} inset` : 'none',
                        color: active ? palette.accentText : palette.text,
                      }}
                    >
                      <div>{w.name}</div>
                      <div>{w.status}</div>
                      <div style={{ fontSize: 12 }}>{w.updatedAt}</div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ padding: 16, color: palette.textMuted }}>No workflows found.</div>
                )}
              </div>
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button
                  onClick={createNew}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    background: palette.accent,
                    border: `1px solid ${palette.border}`,
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: palette.accentText,
                    boxShadow: palette.shadow,
                  }}
                >
                  + New Workflows
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: palette.surface, minHeight: 0, borderRadius: 12, padding: 4 }}>
            <div
              style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${palette.border}`,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
                background: palette.card,
                color: palette.text,
                borderRadius: 12,
                boxShadow: palette.shadow,
              }}
            >
              <button onClick={resetToWorkflowList} style={{ ...ghostBtn(palette), background: palette.surface, color: palette.text }}>
                ‹ Back
              </button>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{selectedWorkflow?.name}</div>
              <span
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: palette.surface,
                  border: `1px solid ${palette.border}`,
                }}
              >
                {selectedWorkflow?.status}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                <button
                  style={{ ...workflowActionBtn(palette), opacity: runAction ? 1 : 0.4, cursor: runAction ? 'pointer' : 'not-allowed' }}
                  onClick={() => runAction?.()}
                  disabled={!runAction}
                >
                  Run
                </button>
                <button
                  style={{
                    ...workflowActionBtn(palette),
                    borderColor: '#f97316',
                    color: '#f97316',
                    opacity: reviewAction ? 1 : 0.4,
                    cursor: reviewAction ? 'pointer' : 'not-allowed',
                  }}
                  onClick={() => reviewAction?.()}
                  disabled={!reviewAction}
                >
                  Review
                </button>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <WorkflowBuilder
                workflowId={selectedWorkflow?.id}
                onRegisterRun={(fn) => setRunAction(() => fn)}
                onRegisterReview={(fn) => setReviewAction(() => fn)}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const ghostBtn = (palette: Palette): CSSProperties => ({
  padding: '10px 14px',
  borderRadius: 12,
  border: `1px solid ${palette.border}`,
  background: palette.surface,
  cursor: 'pointer',
  fontWeight: 700,
  color: palette.text,
});

const navBtnStyle = (palette: Palette): CSSProperties => ({
  padding: '12px 16px',
  borderRadius: 12,
  background: palette.navBg,
  border: `1px solid ${palette.border}`,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
  color: palette.text,
});

const searchInputStyle = (palette: Palette): CSSProperties => ({
  width: '100%',
  padding: '14px 18px',
  borderRadius: 14,
  border: `1px solid ${palette.border}`,
  fontSize: 14,
  outline: 'none',
  boxShadow: '0 2px 6px rgba(15,23,42,0.08)',
  background: palette.surface,
  color: palette.text,
});

function filterBtnStyle(palette: Palette, active: boolean): CSSProperties {
  return {
    padding: '14px 22px',
    borderRadius: 14,
    border: `1px solid ${palette.border}`,
    background: active ? palette.accent : palette.navBg,
    cursor: 'pointer',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: active ? palette.accentText : palette.text,
    boxShadow: active ? `0 0 0 2px ${palette.borderLight} inset` : 'none',
  };
}

const panelStyle = (palette: Palette): CSSProperties => ({
  background: palette.panel,
  border: `1px solid ${palette.border}`,
  padding: '24px 16px',
  borderRadius: 18,
  boxShadow: palette.shadow,
  minHeight: 360,
});

const workflowActionBtn = (palette: Palette): CSSProperties => ({
  padding: '8px 18px',
  borderRadius: 999,
  border: `1px solid ${palette.borderLight}`,
  background: 'transparent',
  color: palette.text,
  fontWeight: 600,
  transition: 'opacity .15s ease',
});
