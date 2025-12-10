import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Save,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '../state/ThemeContext';
import api from '../services/api';
import type { WorkflowRecord, WorkflowStatus, WorkflowUpsertPayload } from '../types/workflow';

const statusTokens: Record<WorkflowStatus, { label: string; bg: string; dot: string; text: string }> = {
  active: {
    label: 'Active',
    bg: 'border-emerald-400/30 bg-emerald-500/10',
    dot: 'bg-emerald-300',
    text: 'text-emerald-200',
  },
  draft: {
    label: 'Draft',
    bg: 'border-sky-400/30 bg-slate-500/10',
    dot: 'bg-sky-300',
    text: 'text-slate-100',
  },
  error: {
    label: 'Error',
    bg: 'border-rose-400/30 bg-rose-500/10',
    dot: 'bg-rose-300',
    text: 'text-rose-100',
  },
};

const paletteNodes = [
  { key: 'trigger', title: 'Trigger', copy: 'Entry point for inbound calls or schedules' },
  { key: 'ai-logic', title: 'AI Logic', copy: 'LLM or rule nodes to reason with context' },
  { key: 'nlu', title: 'NLU Router', copy: 'Intent router that branches dialogue paths' },
  { key: 'audio', title: 'Audio IO', copy: 'Play prompts, capture user speech, stream TTS' },
  { key: 'integration', title: 'Integration', copy: 'Call APIs, Supabase, CRM, or webhooks' },
  { key: 'decision', title: 'Decision', copy: 'Evaluate conditions, scores, or memory' },
  { key: 'handoff', title: 'Handoff', copy: 'Transfer to live agent or voicemail' },
];

type PaletteNode = typeof paletteNodes[number];

interface WorkflowBuilderProps {
  workflowId?: string;
  onBack?: () => void;
}

export default function WorkflowBuilder({ workflowId, onBack }: WorkflowBuilderProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [workflow, setWorkflow] = useState<WorkflowRecord | null>(null);
  const [name, setName] = useState('Untitled Workflow');
  const [status, setStatus] = useState<WorkflowStatus>('draft');
  const [loading, setLoading] = useState(Boolean(workflowId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<PaletteNode | null>(null);
  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeDescription, setNodeDescription] = useState('');
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const glassSurface = isDark
    ? 'bg-slate-950/60 border-white/10 backdrop-blur-2xl text-white'
    : 'bg-white/85 border-slate-200/80 backdrop-blur-xl text-slate-900';

  const dotPattern = useMemo(() => ({
    backgroundImage: isDark
      ? 'radial-gradient(rgba(148,163,184,0.2) 1px, transparent 1px)'
      : 'radial-gradient(rgba(15,23,42,0.12) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  }), [isDark]);

  const statusBadge = statusTokens[status];

  const backHome = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    navigate('/home');
  }, [navigate, onBack]);

  const normalizeWorkflow = useCallback((data: any): WorkflowRecord | null => {
    if (!data || typeof data !== 'object') return null;
    const normalized: WorkflowRecord = {
      id: String(data.id ?? data.workflow_id ?? ''),
      name: data.name || 'Untitled Workflow',
      nodes: data.nodes ?? null,
      edges: data.edges ?? null,
      status: (data.status ?? 'draft') as WorkflowStatus,
      updated_at: data.updated_at || new Date().toISOString(),
      created_at: data.created_at,
      description: data.description ?? null,
    };
    return normalized.id ? normalized : null;
  }, []);

  const fetchWorkflow = useCallback(async () => {
    if (!workflowId) {
      setLoading(false);
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setError('Missing session, please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await api.workflows.get(token, workflowId);
      const normalized = normalizeWorkflow(raw);
      if (normalized) {
        setWorkflow(normalized);
        setName(normalized.name);
        setStatus(normalized.status);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load workflow');
    } finally {
      setLoading(false);
    }
  }, [workflowId, normalizeWorkflow]);

  useEffect(() => {
    void fetchWorkflow();
  }, [fetchWorkflow]);

  useEffect(() => {
    if (!workflowId) {
      setWorkflow(null);
      setSuccess(null);
    }
  }, [workflowId]);

  useEffect(() => {
    if (!selectedNode) return;
    setNodeLabel(selectedNode.title);
    setNodeDescription(selectedNode.copy);
  }, [selectedNode]);

  const handleSave = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setError('Missing auth token. Please sign in again.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: WorkflowUpsertPayload = {
        name: name.trim() || 'Untitled Workflow',
        status,
        nodes: workflow?.nodes ?? [],
        edges: workflow?.edges ?? [],
      };
      const raw = workflowId
        ? await api.workflows.update(token, workflowId, payload)
        : await api.workflows.create(token, payload);
      const normalized = normalizeWorkflow(raw);
      if (normalized) {
        setWorkflow(normalized);
        setName(normalized.name);
        setStatus(normalized.status);
        if (!workflowId && normalized.id) {
          navigate(`/builder/${normalized.id}`, { replace: true });
        }
        setSuccess('Saved to workspace');
        setTimeout(() => setSuccess(null), 2800);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to save workflow');
    } finally {
      setSaving(false);
    }
  }, [workflowId, workflow, name, status, navigate, normalizeWorkflow]);

  const handlePaletteClick = useCallback((item: PaletteNode) => {
    setSelectedNode(item);
  }, []);

  const isBusy = loading || saving;

  return (
    <div
      className={`min-h-screen w-full ${
        isDark
          ? 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white'
          : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900'
      }`}
    >
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute left-1/3 top-0 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className={`flex flex-wrap items-center gap-4 border-b px-6 py-5 ${glassSurface}`}>
          <button
            type="button"
            onClick={backHome}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name your workflow"
              className={`flex-1 rounded-2xl border px-4 py-2 text-lg font-semibold outline-none transition ${
                isDark
                  ? 'border-white/10 bg-white/5 text-white placeholder-white/50 focus:border-blue-400'
                  : 'border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-500'
              }`}
            />
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1 text-sm font-semibold ${statusBadge.bg} ${statusBadge.text}`}
            >
              <span className={`h-2 w-2 rounded-full ${statusBadge.dot}`} />
              {statusBadge.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isBusy}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${
              'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-500/90 hover:to-indigo-600/90'
            }`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </header>

        {(error || success) && (
          <div className="px-6 pt-4">
            {error && (
              <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                isDark ? 'border-rose-500/40 bg-rose-500/15 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            {success && (
              <div className={`mt-3 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                isDark ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
              >
                <CheckCircle2 size={16} />
                {success}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 px-4 py-4 lg:flex-row">
          <aside className={`w-full max-w-xs rounded-3xl border p-4 shadow-xl ${glassSurface}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">Nodes</p>
                <h2 className="text-lg font-bold">Palette</h2>
              </div>
              <Sparkles className="text-blue-400" size={18} />
            </div>
            <div className="mt-4 space-y-3">
              {paletteNodes.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handlePaletteClick(item)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-blue-400/70 ${
                    selectedNode?.key === item.key
                      ? 'border-blue-400 bg-blue-500/10 text-blue-100'
                      : isDark
                        ? 'border-white/5 bg-white/5 text-slate-100'
                        : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2 text-white ${isDark ? '' : 'shadow-inner'}`}>
                      <GripVertical size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs opacity-70">{item.copy}</p>
                    </div>
                    <MoreHorizontal className="ml-auto opacity-50" size={16} />
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1">
            <div
              ref={canvasRef}
              className={`relative flex h-[680px] w-full flex-col overflow-hidden rounded-[32px] border shadow-2xl ${glassSurface}`}
              style={dotPattern}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-900/0 via-white/5 to-slate-900/0" />
              <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm opacity-70">Loading workflow graph...</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                      React Flow Mount Point
                    </div>
                    <h1 className="mt-4 text-3xl font-bold">Double-click to drop nodes</h1>
                    <p className="mt-2 max-w-xl text-sm opacity-80">
                      This surface is wired for React Flow. We keep it lightweight so you can plug in drag/drop logic, custom handles, and arrow routing the moment you hook the library.
                    </p>
                  </>
                )}
              </div>
            </div>
          </main>

          <aside className={`w-full max-w-sm rounded-3xl border p-5 shadow-xl ${glassSurface}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">Properties</p>
                <h2 className="text-lg font-bold">Node Settings</h2>
              </div>
              <span className="text-xs opacity-70">{workflow?.updated_at ? new Date(workflow.updated_at).toLocaleString() : 'Unsaved'}</span>
            </div>
            {selectedNode ? (
              <form className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide opacity-70">Label</label>
                  <input
                    value={nodeLabel}
                    onChange={(e) => setNodeLabel(e.target.value)}
                    className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm outline-none ${
                      isDark ? 'border-white/10 bg-white/5 text-white focus:border-blue-400' : 'border-slate-200 bg-white focus:border-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide opacity-70">Description</label>
                  <textarea
                    value={nodeDescription}
                    onChange={(e) => setNodeDescription(e.target.value)}
                    className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm outline-none ${
                      isDark ? 'border-white/10 bg-white/5 text-white focus:border-blue-400' : 'border-slate-200 bg-white focus:border-blue-500'
                    }`}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide opacity-70">Model</label>
                  <select
                    className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm outline-none ${
                      isDark ? 'border-white/10 bg-white/5 text-white focus:border-blue-400' : 'border-slate-200 bg-white focus:border-blue-500'
                    }`}
                  >
                    <option>gpt-4o-mini</option>
                    <option>gemini-1.5-pro</option>
                    <option>claude-3.5-sonnet</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-blue-400/40 bg-blue-500/10 py-2 text-sm font-semibold text-blue-100"
                >
                  Attach to canvas
                </button>
              </form>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed px-4 py-6 text-center text-sm opacity-80">
                Select a node from the palette to edit its properties and connect it to your voice journey.
              </div>
            )}

            <div className="mt-8 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide opacity-70">Workflow Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WorkflowStatus)}
                  className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm outline-none ${
                    isDark ? 'border-white/10 bg-white/5 text-white focus:border-blue-400' : 'border-slate-200 bg-white focus:border-blue-500'
                  }`}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="error">Paused</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide opacity-70">Notes</label>
                <textarea
                  placeholder="Document prompts, variables, or Supabase tables to sync."
                  className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm outline-none ${
                    isDark ? 'border-white/10 bg-white/5 text-white focus:border-blue-400' : 'border-slate-200 bg-white focus:border-blue-500'
                  }`}
                  rows={4}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('auth_token');
}
