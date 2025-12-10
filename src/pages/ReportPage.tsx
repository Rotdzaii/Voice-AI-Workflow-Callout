import { useMemo, useState } from 'react';

// Simple mock datasets for the dashboard
export type LogItem = {
  id: string;
  workflowId: string;
  workflowName: string;
  time: string; // ISO string
  node: string;
  status: 'Active' | 'Error' | 'Draft';
  intent: 'Agree' | 'Reject' | 'Other';
  output: string | null;
  durationSec: number;
};

const mockLogs: LogItem[] = (() => {
  const wfs = [
    { id: 'wf-1', name: 'Meeting_Bot_v1' },
    { id: 'wf-2', name: 'Support_AI_v2' },
    { id: 'wf-3', name: 'QA_Router' },
  ];
  const intents: Array<LogItem['intent']> = ['Agree', 'Reject', 'Other'];
  const nodes = ['STT', 'Router', 'RAG', 'TTS'];
  const now = Date.now();
  const arr: LogItem[] = [];
  for (let i = 0; i < 120; i++) {
    const wf = wfs[i % wfs.length];
    const t = new Date(now - Math.floor(Math.random() * 7) * 24 * 3600 * 1000 - Math.floor(Math.random() * 3600) * 1000);
    arr.push({
      id: `WF${230000 + i}`,
      workflowId: wf.id,
      workflowName: wf.name,
      time: t.toISOString(),
      node: nodes[i % nodes.length],
      status: (['Active', 'Error', 'Draft'] as const)[i % 3],
      intent: intents[Math.floor(Math.random() * intents.length)],
      output: Math.random() < 0.3 ? null : ['ok', 'fail', 'skip'][i % 3],
      durationSec: Math.floor(Math.random() * 18) + 1,
    });
  }
  return arr;
})();

function toCSV(rows: LogItem[]): string {
  const head = ['Execution ID', 'Workflow', 'Time', 'Node', 'Status', 'Intent', 'Output', 'Duration'];
  const body = rows.map(r => [r.id, r.workflowName, new Date(r.time).toLocaleString(), r.node, r.status, r.intent, r.output ?? '', `${r.durationSec}s`]);
  return [head.join(','), ...body.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
}

export default function ReportPage({ onGoHome }: { onGoHome?: () => void }) {
  const [workflowId, setWorkflowId] = useState<string>('all');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [from, setFrom] = useState<string>(() => new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const workflows = useMemo(() => [
    { id: 'wf-1', name: 'Meeting_Bot_v1' },
    { id: 'wf-2', name: 'Support_AI_v2' },
    { id: 'wf-3', name: 'QA_Router' },
  ], []);

  const filtered = useMemo(() => {
    const fromDt = new Date(from + 'T00:00:00');
    const toDt = new Date(to + 'T23:59:59');
    return mockLogs.filter(l => {
      if (workflowId !== 'all' && l.workflowId !== workflowId) return false;
      const t = new Date(l.time);
      return t >= fromDt && t <= toDt;
    });
  }, [workflowId, from, to]);

  const totalExecutions = filtered.length;
  const nodeSuccessRate = totalExecutions === 0 ? 0 : Math.round((filtered.filter(f => f.status === 'Active').length / totalExecutions) * 100);
  const successOutcome = totalExecutions === 0 ? 0 : Math.round((filtered.filter(f => (f.output ?? '').toLowerCase() === 'ok').length / totalExecutions) * 100);

  const dailyCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      map.set(k, 0);
    }
    for (const l of filtered) {
      const k = l.time.slice(0, 10);
      if (map.has(k)) map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const intentBreakdown = useMemo(() => {
    const cnt: Record<string, number> = { Agree: 0, Reject: 0, Other: 0 };
    for (const l of filtered) cnt[l.intent]++;
    return cnt;
  }, [filtered]);

  function download() {
    const rows = filtered;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'report.json'; a.click(); URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([toCSV(rows)], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'report.csv'; a.click(); URL.revokeObjectURL(url);
    }
  }

  return (
  <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      {/* Left nav mimic to match mock */}
      <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #e5e7eb', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button style={navBtn} onClick={() => onGoHome?.()}>Workflow</button>
        <button style={{ ...navBtn, boxShadow: '0 0 0 2px #111827 inset' }}>Report</button>
      </aside>

  <main style={{ flex: 1, background: '#f8f9fb', padding: 20, overflow: 'auto', width: '100%' }}>
        {/* Top controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div style={selectorBox}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>List Workflow</div>
            <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #111827', borderRadius: 10 }}>
              <option value="all">All</option>
              {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div style={selectorBox}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Select output file format</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={radioLabel}><input type="radio" name="fmt" checked={format === 'csv'} onChange={() => setFormat('csv')} /> .csv</label>
              <label style={radioLabel}><input type="radio" name="fmt" checked={format === 'json'} onChange={() => setFormat('json')} /> .json</label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Workflow Performance Dashboard</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #111827', borderRadius: 12, padding: '6px 10px' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Select Workflow</span>
              <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} style={{ padding: '4px 6px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <option value="all">All</option>
                {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #111827', borderRadius: 12, padding: '6px 10px' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Date Range</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateInput} />
              <span>→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateInput} />
            </div>
            <button onClick={download} style={{ padding: '8px 12px', border: '1px solid #111827', background: '#fff', borderRadius: 12, fontWeight: 700 }}>Export</button>
          </div>
        </div>

        {/* KPI cards */}
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
          <KpiCard title="Total Executions" value={totalExecutions.toLocaleString()} />
          <KpiCard title="Node Success Rate" value={`${nodeSuccessRate}%`} />
          <KpiCard title="Success Outcome" value={`${successOutcome}%`} />
        </div>

  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
          <Panel title="Workflow Activity (Last 7 days)">
            <LineChart data={dailyCounts} />
          </Panel>
          <Panel title="Intent Types">
            <Donut data={intentBreakdown} />
          </Panel>
        </div>

        <Panel title="Workflow Logs">
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1fr 1fr 1fr 1fr', fontSize: 12, fontWeight: 600, padding: '6px 8px' }}>
            <div>Execution ID</div>
            <div>Time</div>
            <div>Node</div>
            <div>Status</div>
            <div>Intent</div>
            <div>Output</div>
            <div>Duration</div>
          </div>
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            {filtered.slice(0, 60).map(l => (
              <div key={l.id + l.time} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr 1fr 1fr 1fr 1fr', alignItems: 'center', padding: '8px 10px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                <div>#{l.id}</div>
                <div>{new Date(l.time).toLocaleTimeString()}</div>
                <div>{l.node}</div>
                <div>{l.status}</div>
                <div>{l.intent}</div>
                <div>{l.output ?? 'null'}</div>
                <div>{l.durationSec}s</div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: 16, color: '#6b7280' }}>No data in the selected range.</div>}
          </div>
        </Panel>
      </main>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #111827', borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #111827', borderRadius: 14, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function LineChart({ data }: { data: Array<[string, number]> }) {
  const max = Math.max(1, ...data.map(([, v]) => v));
  const w = 480, h = 160, pad = 20;
  const pts = data.map(([, v], i) => [pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1), h - pad - (v / max) * (h - pad * 2)] as const);
  const path = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={w} height={h} fill="#f9fafb" stroke="#e5e7eb" />
      <path d={path} stroke="#111827" strokeWidth={2} fill="none" />
      {pts.map(([x, y], i) => (<circle key={i} cx={x} cy={y} r={3} fill="#111827" />))}
      {data.map(([k], i) => (
        <text key={k} x={pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1)} y={h - 4} fontSize={10} textAnchor="middle">{k.slice(5)}</text>
      ))}
    </svg>
  );
}

function Donut({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const colors = ['#10b981', '#ef4444', '#111827'];
  let acc = 0;
  const r = 60, cx = 80, cy = 80, stroke = 18;
  const segs = Object.entries(data).map(([k, v], i) => {
    const frac = v / total;
    const start = acc; acc += frac;
    const a1 = 2 * Math.PI * start, a2 = 2 * Math.PI * (start + frac);
    const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r };
    const p2 = { x: cx + Math.cos(a2) * r, y: cy + Math.sin(a2) * r };
    const large = frac > 0.5 ? 1 : 0;
    const d = `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
    return { d, color: colors[i], label: `${k} (${v})` };
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
      <svg viewBox="0 0 180 160" width="100%" height={160} preserveAspectRatio="xMidYMid meet">
        <circle cx={cx} cy={cy} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        {segs.map((s, i) => (
          <path key={i} d={s.d} stroke={s.color} strokeWidth={stroke} fill="none" />
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 12, height: 12, background: s.color, borderRadius: 3, display: 'inline-block' }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  background: '#ffffff',
  border: '1px solid #111827',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
};

const selectorBox: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #111827',
  borderRadius: 14,
  padding: 12,
  minWidth: 220,
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
};

const radioLabel: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  background: '#fff'
};

const dateInput: React.CSSProperties = {
  padding: '4px 6px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
};
