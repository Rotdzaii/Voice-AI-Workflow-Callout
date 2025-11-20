import { useState } from 'react';
import WorkflowBuilder from './components/WorkflowBuilder';
import ReportPage from './ReportPage.tsx';

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
        <div style={{ marginTop: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#111827', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>U</div>
          {!sidebarCollapsed && <div style={{ flex: 1 }}>Username</div>}
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>⋮</button>
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
