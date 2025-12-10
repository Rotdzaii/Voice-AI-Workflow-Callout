import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Grid3x3,
  Loader2,
  Play,
  Save,
  Settings,
} from 'lucide-react';
import { useTheme } from '../../../state/ThemeContext';
import api from '../../../services/api';
import type { WorkflowRecord, WorkflowStatus, WorkflowUpsertPayload } from '../../../types/workflow';

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

interface BuilderNodeData {
  label: string;
  description: string;
  icon: string;
  category: string;
}

const paletteNodes = [
  {
    key: 'frontend',
    title: 'Frontend Input',
    copy: 'Nhập số điện thoại, gửi yêu cầu lên API Gateway.',
    type: 'frontend_node',
    gradient: 'from-blue-400 to-blue-600',
    icon: '📱',
  },
  {
    key: 'api-gateway',
    title: 'API Gateway',
    copy: 'Nhận request từ Frontend, chuyển tiếp đến Backend.',
    type: 'api_gateway_node',
    gradient: 'from-purple-400 to-purple-600',
    icon: '🔌',
  },
  {
    key: 'backend',
    title: 'Backend Logic',
    copy: 'Xử lý logic chính (Audio, STT, RAG, LLM) và điều phối.',
    type: 'backend_node',
    gradient: 'from-orange-400 to-orange-600',
    icon: '⚙️',
  },
  {
    key: 'tts',
    title: 'Google TTS',
    copy: 'Nhận văn bản từ Backend, trả về file âm thanh (Audio).',
    type: 'tts_node',
    gradient: 'from-green-400 to-green-600',
    icon: '🔊',
  },
];

type PaletteNode = typeof paletteNodes[number];

const defaultNodeTypes: NodeTypes = {};

const ensureNodeData = (data: unknown): BuilderNodeData => {
  const base = (data ?? {}) as Partial<BuilderNodeData>;
  return {
    label: base.label ?? 'Untitled node',
    description: base.description ?? '',
    icon: base.icon ?? '🧩',
    category: base.category ?? 'custom',
  };
};

const toNodeArray = (graph: WorkflowRecord['nodes']): Node<BuilderNodeData>[] => {
  if (!Array.isArray(graph)) return [];
  return (graph as Node<BuilderNodeData>[]).map((node) => ({
    ...node,
    data: ensureNodeData(node.data),
  }));
};

const toEdgeArray = (graph: WorkflowRecord['edges']): Edge[] => {
  if (!Array.isArray(graph)) return [];
  return graph as Edge[];
};

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<BuilderNodeData>([]);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const statusBadge = statusTokens[status];
  const defaultEdgeOptions = useMemo(
    () => ({ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }),
    [],
  );

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
      setHasUnsavedChanges(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (!workflow) {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      return;
    }
    setNodes(toNodeArray(workflow.nodes));
    setEdges(toEdgeArray(workflow.edges));
    setSelectedNodeId(null);
    setHasUnsavedChanges(false);
  }, [workflow, setNodes, setEdges]);

  useEffect(() => {
    if (selectedNodeId && !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

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
        nodes,
        edges,
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
        setHasUnsavedChanges(false);
        setTimeout(() => setSuccess(null), 2800);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to save workflow');
    } finally {
      setSaving(false);
    }
  }, [workflowId, workflow, name, status, navigate, normalizeWorkflow]);

  const handleNameInput = useCallback((value: string) => {
    setName(value);
    setHasUnsavedChanges(true);
  }, []);

  const handleRunWorkflow = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setError('❌ Unauthorized. Please login again.');
      if (typeof window !== 'undefined') {
        window.alert('Please log in to run this workflow.');
      }
      return;
    }

    const payload = {
      workflow_id: workflow?.id || 'draft-1',
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        data: ensureNodeData(node.data),
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
      })),
    };

    console.log('🚀 Workflow Payload:', payload);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/v1/workflows/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        // ignore malformed response bodies
      }
      console.log('🎯 Workflow Run Response:', data);

      if (response.ok) {
        setSuccess('✅ Workflow sent to Backend!');
        setTimeout(() => setSuccess(null), 2800);
        return;
      }

      if (response.status === 401) {
        setError('❌ Unauthorized. Please login again.');
        return;
      }

      setError('❌ Failed to send workflow.');
    } catch (err) {
      console.error('Workflow run failed', err);
      setError('❌ Failed to send workflow.');
    }
  }, [workflow, nodes, edges]);

  const handleStatusChange = useCallback((value: WorkflowStatus) => {
    setStatus(value);
    setHasUnsavedChanges(true);
  }, []);

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeInternal>[0]) => {
      setHasUnsavedChanges(true);
      onNodesChangeInternal(changes);
    },
    [onNodesChangeInternal],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeInternal>[0]) => {
      setHasUnsavedChanges(true);
      onEdgesChangeInternal(changes);
    },
    [onEdgesChangeInternal],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      setHasUnsavedChanges(true);
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    },
    [setEdges],
  );

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
  }, []);

  const handleDragStart = useCallback((event: DragEvent<HTMLElement>, item: PaletteNode) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!reactFlowWrapper.current || !reactFlowInstance) return;
      const raw = event.dataTransfer.getData('application/reactflow');
      if (!raw) return;
      const paletteNode = JSON.parse(raw) as PaletteNode;
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node<BuilderNodeData> = {
        id: `${paletteNode.key}-${Date.now()}`,
        type: 'default',
        position,
        data: {
          label: paletteNode.title,
          description: paletteNode.copy,
          icon: paletteNode.icon,
          category: paletteNode.type,
        },
      };

      setNodes((current) => current.concat(newNode));
      setSelectedNodeId(newNode.id);
      setHasUnsavedChanges(true);
    },
    [reactFlowInstance, setNodes],
  );

  const handleNodeClick = useCallback<NodeMouseHandler>((_, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedNodeData = selectedNode ? ensureNodeData(selectedNode.data) : null;

  const updateSelectedNodeData = useCallback(
    (changes: Partial<BuilderNodeData>) => {
      if (!selectedNodeId) return;
      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNodeId
            ? {
                ...node,
                data: {
                  ...ensureNodeData(node.data),
                  ...changes,
                },
              }
            : node,
        ),
      );
      setHasUnsavedChanges(true);
    },
    [selectedNodeId, setNodes],
  );

  const handleNodeLabelChange = useCallback(
    (value: string) => {
      updateSelectedNodeData({ label: value });
    },
    [updateSelectedNodeData],
  );

  const handleNodeDescriptionChange = useCallback(
    (value: string) => {
      updateSelectedNodeData({ description: value });
    },
    [updateSelectedNodeData],
  );

  const isBusy = loading || saving;

  return (
    <div
      className={`flex h-screen w-full overflow-hidden ${
        isDark
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white'
          : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900'
      }`}
    >
      <div className="pointer-events-none fixed inset-0 opacity-50">
        <div className="absolute left-1/3 top-0 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden">
        <header
          className={`flex items-center justify-between border-b px-6 py-4 backdrop-blur-sm ${
            isDark ? 'bg-slate-900/80 border-white/10 text-white' : 'bg-white/90 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={backHome}
              className={`rounded-xl p-2 transition ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-[220px] space-y-1">
              <input
                value={name}
                onChange={(e) => handleNameInput(e.target.value)}
                placeholder="Name your workflow"
                className={`w-full rounded-2xl border px-4 py-2 text-lg font-semibold outline-none transition ${
                  isDark
                    ? 'border-white/15 bg-white/5 text-white placeholder-white/40 focus:border-blue-400'
                    : 'border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-500'
                }`}
              />
              <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {statusBadge.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 rounded-lg border border-yellow-400/30 bg-yellow-500/10 px-3 py-1.5">
                <AlertCircle size={16} className="text-yellow-500" />
                <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-300">Unsaved changes</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isBusy}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isDark
                  ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                  : 'border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
            <button
              type="button"
              onClick={handleRunWorkflow}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-blue-600 hover:to-purple-700"
            >
              <Play size={16} />
              Run / Review
            </button>
          </div>
        </header>

        {(error || success) && (
          <div className="space-y-3 px-6 pt-4">
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
              <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                isDark ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
              >
                <CheckCircle2 size={16} />
                {success}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <aside
            className={`w-72 flex-shrink-0 overflow-y-auto border-r ${
              isDark ? 'bg-slate-900/40 border-white/10' : 'bg-white/70 border-slate-200'
            }`}
          >
            <div className="p-5">
              <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Nodes Palette
              </p>
              <div className="mt-4 space-y-3">
                {paletteNodes.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    draggable
                    onDragStart={(event) => handleDragStart(event, item)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:scale-[1.02] ${
                      isDark
                        ? 'border-white/10 bg-gradient-to-r from-slate-800 to-slate-700'
                        : 'border-slate-200 bg-gradient-to-r from-slate-100 to-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{item.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.copy}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="flex flex-1 flex-col overflow-hidden">
            <div
              className={`border-b px-4 py-3 text-sm font-semibold ${
                isDark ? 'bg-slate-900/40 border-white/10 text-slate-200' : 'bg-white/70 border-slate-200 text-slate-600'
              }`}
            >
              Workflow Canvas
            </div>
            <div className="flex-1 overflow-hidden">
              <div
                ref={reactFlowWrapper}
                className={`relative m-4 flex h-full min-h-[480px] flex-1 overflow-hidden rounded-[32px] border ${
                  isDark ? 'border-white/10 bg-slate-950/60 text-white' : 'border-slate-200 bg-white/90 text-slate-900'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                style={{
                  backgroundImage: `radial-gradient(circle, ${
                    isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                  } 1px, transparent 1px)`,
                  backgroundSize: '40px 40px',
                }}
              >
                {loading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/30">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <p className="text-sm opacity-80">Loading workflow graph...</p>
                  </div>
                )}
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onConnect={handleConnect}
                  onNodeClick={handleNodeClick}
                  onPaneClick={handlePaneClick}
                  onInit={handleInit}
                  fitView
                  fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 1.8 }}
                  defaultEdgeOptions={defaultEdgeOptions}
                  nodeTypes={defaultNodeTypes}
                  proOptions={{ hideAttribution: true }}
                  className="reactflow-subtle"
                >
                  <Background gap={32} color={isDark ? 'rgba(148,163,184,0.3)' : 'rgba(15,23,42,0.15)'} />
                  <Controls showInteractive={false} />
                  <MiniMap pannable zoomable />
                </ReactFlow>
              </div>
            </div>
          </main>

          <aside
            className={`w-96 flex-shrink-0 overflow-y-auto border-l ${
              isDark ? 'bg-slate-900/40 border-white/10' : 'bg-white/70 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Node Settings
                </p>
                <p className="text-sm font-medium opacity-70">
                  {workflow?.updated_at ? new Date(workflow.updated_at).toLocaleString() : 'Unsaved'}
                </p>
              </div>
              <Settings size={18} className={isDark ? 'text-slate-200' : 'text-slate-600'} />
            </div>
            {selectedNodeData ? (
              <div className="space-y-5 px-6 py-6">
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Label
                  </label>
                  <input
                    value={selectedNodeData.label}
                    onChange={(e) => handleNodeLabelChange(e.target.value)}
                    className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm outline-none ${
                      isDark ? 'border-white/15 bg-white/5 text-white focus:border-blue-400' : 'border-slate-200 bg-white focus:border-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Description
                  </label>
                  <textarea
                    value={selectedNodeData.description}
                    onChange={(e) => handleNodeDescriptionChange(e.target.value)}
                    className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm outline-none ${
                      isDark ? 'border-white/15 bg-white/5 text-white focus:border-blue-400' : 'border-slate-200 bg-white focus:border-blue-500'
                    }`}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium">
                  <span className="text-2xl">{selectedNodeData.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide opacity-75">Category</p>
                    <p>{selectedNodeData.category}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Grid3x3 size={32} className={isDark ? 'text-slate-600' : 'text-slate-400'} />
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Select a node to configure</p>
              </div>
            )}

            <div className="border-t px-6 py-6">
              <div className="space-y-4">
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Workflow Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value as WorkflowStatus)}
                    className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm outline-none ${
                      isDark ? 'border-white/15 bg-white/5 text-white focus:border-blue-400' : 'border-slate-200 bg-white focus:border-blue-500'
                    }`}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="error">Paused</option>
                  </select>
                </div>
                <div>
                  <label className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Notes
                  </label>
                  <textarea
                    placeholder="Document prompts, variables, or Supabase tables to sync."
                    className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm outline-none ${
                      isDark ? 'border-white/15 bg-white/5 text-white focus:border-blue-400' : 'border-slate-200 bg-white focus:border-blue-500'
                    }`}
                    rows={4}
                  />
                </div>
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
  const storage = window.localStorage;
  const direct = storage.getItem('auth_token');
  if (direct) return direct;

  const fallback = storage.getItem('access_token');
  if (fallback) return fallback;

  const supabaseRaw = storage.getItem('supabase.auth.token');
  if (supabaseRaw) {
    try {
      const parsed = JSON.parse(supabaseRaw);
      const token =
        parsed?.currentSession?.access_token ||
        parsed?.currentSession?.accessToken ||
        parsed?.access_token ||
        parsed?.accessToken;
      if (typeof token === 'string' && token.length > 0) {
        return token;
      }
    } catch {
      // ignore parse failures
    }
  }

  return null;
}
