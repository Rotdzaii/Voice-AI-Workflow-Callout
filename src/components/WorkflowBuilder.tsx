import { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './WorkflowBuilder.css';
import type { Connection, Edge as RFEdge, Node as RFNode, EdgeChange, NodeChange } from 'reactflow';
import { useMachine } from '@xstate/react';
import { createWorkflowMachine, canAddEdge, selectors } from '../state/workflowMachine';
import SpeechToText from '../sim/SpeechToText';
import { analyze } from '../sim/nlu';
import { generateResponse, fillTemplate } from '../sim/response';
import { isTTSSupported, speak, cancelSpeak } from '../sim/tts';
import type { WorkflowContext } from '../state/workflowMachine';
import { NodeRegistry, nodeTypesMap } from '../nodes/registry';

const initialNodes: RFNode[] = [];
const initialEdges: RFEdge[] = [];

type StoredVersion = { id: string; name: string; createdAt: number; data: WorkflowContext; meta?: { workflowId?: string; workflowName?: string; version?: string; author?: string; time: number } };

function loadVersions(): StoredVersion[] {
  try {
    const raw = localStorage.getItem('wb_versions');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredVersion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type WorkflowDetails = { id: string; name?: string; version?: string; author?: string; timestamp?: number };

function loadWorkflowDetails(key: string): WorkflowDetails | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d && typeof d === 'object') return d as WorkflowDetails;
    return null;
  } catch {
    return null;
  }
}

function saveWorkflowDetails(key: string, d: WorkflowDetails) {
  try {
    localStorage.setItem(key, JSON.stringify(d));
  } catch {
    // ignore
  }
}

export default function WorkflowBuilder({ workflowId, onRegisterRun }: { workflowId?: string; onRegisterRun?: (fn: () => void) => void }) {
  const nodeTypes = useMemo(() => nodeTypesMap(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [versions, setVersions] = useState<StoredVersion[]>(loadVersions());
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(undefined);

  // XState machine manages logical nodes/edges list
  const initialMachineContext = useMemo(() => ({ nodes: [], edges: [] }), []);
  const [state, send] = useMachine(useMemo(() => createWorkflowMachine(initialMachineContext), [initialMachineContext]));

  const onConnect = useCallback((connection: Connection) => {
    const newEdge = {
      id: `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
    };
    if (!canAddEdge(state.context, newEdge)) return;
    send({ type: 'ADD_EDGE', edge: newEdge });
    setEdges((eds: RFEdge[]) => addEdge({ ...connection, animated: true }, eds));
  }, [setEdges, state.context, send]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    for (const ch of changes) {
      if (ch.type === 'remove' && 'id' in ch) {
        const id = (ch as Extract<EdgeChange, { id: string }>).id;
        if (id) send({ type: 'REMOVE_EDGE', id });
      }
    }
  }, [onEdgesChange, send]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    for (const ch of changes) {
      if (ch.type === 'remove' && 'id' in ch) {
        const id = (ch as Extract<NodeChange, { id: string }>).id;
        if (id) send({ type: 'REMOVE_NODE', id });
      }
    }
  }, [onNodesChange, send]);

  const onNodeClick = useCallback((_: any, node: RFNode) => {
    send({ type: 'SELECT_NODE', id: node.id });
  }, [send]);

  const selectedNode = selectors.getSelectedNode(state.context);
  const [simText, setSimText] = useState('');
  const [simNLU, setSimNLU] = useState<{ intent: string; entities: Record<string, string>; sentiment: string } | null>(null);
  const [simNodeId, setSimNodeId] = useState<string | undefined>(undefined);
  const [simLog, setSimLog] = useState<Array<{ role: 'agent' | 'user' | 'system'; text: string }>>([]);
  const [ttsEnabled, setTTSEnabled] = useState(false);
  const [ttsVoices] = useState<SpeechSynthesisVoice[]>(() => (isTTSSupported() ? window.speechSynthesis.getVoices() : []));
  const [ttsVoiceName, setTTSVoiceName] = useState<string>('');
  const [rightTab, setRightTab] = useState<'node' | 'validate' | 'version' | 'simulate' | 'io' | 'deploy'>('node');
  const [issues, setIssues] = useState<string[]>([]);
  const [validatorOpen, setValidatorOpen] = useState<boolean>(true);
  const [catOpen, setCatOpen] = useState<{ startEnd: boolean; deadEnd: boolean; binding: boolean; schema: boolean }>({ startEnd: true, deadEnd: true, binding: true, schema: false });
  const toggleCatOpen = (k: keyof typeof catOpen) => setCatOpen(prev => ({ ...prev, [k]: !prev[k] }));
  const RIGHT_SIDEBAR_WIDTH = 300;
  const [nodeLabel, setNodeLabel] = useState<string>('');
  const [modelName, setModelName] = useState<string>('');
  type VarDef = { name: string; scope: 'local' | 'global'; vtype?: string };
  const [inVars, setInVars] = useState<VarDef[]>([]);
  const [outVars, setOutVars] = useState<VarDef[]>([]);
  const [addVarFor, setAddVarFor] = useState<'in' | 'out' | null>(null);
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState('string');
  const [newVarScope, setNewVarScope] = useState<VarDef['scope']>('local');
  const [selectedType, setSelectedType] = useState<string>('');
  const selectedRFNode = useMemo(() => nodes.find(n => n.id === selectedNode?.id), [nodes, selectedNode?.id]);
  useEffect(() => {
    setNodeLabel(selectedNode?.label ?? '');
    setSelectedType(selectedNode?.type ?? '');
    const d: any = selectedRFNode?.data || {};
    setModelName(d.modelName ?? '');
    const coerceVars = (v: any): VarDef[] => {
      if (Array.isArray(v)) {
        if (v.length > 0 && typeof v[0] === 'string') return (v as string[]).map((n) => ({ name: n, scope: 'local' }));
        return v as VarDef[];
      }
      return [];
    };
    setInVars(coerceVars(d.inputs));
    setOutVars(coerceVars(d.outputs));
  }, [selectedNode, selectedRFNode]);
  const CATS = useMemo(() => (['call','speech','logic','integration','utils'] as const), []);
  type Cat = typeof CATS[number];
  const [collapsed, setCollapsed] = useState<Record<Cat, boolean>>({ call: false, speech: false, logic: false, integration: false, utils: false });
  const toggleCat = useCallback((cat: Cat) => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] })), []);
  const [nodeSearch, setNodeSearch] = useState<string>('');
  const detailsKey = useMemo(() => `wb_details_${workflowId || 'current'}`, [workflowId]);
  const [wfDetails, setWfDetails] = useState<WorkflowDetails>(() => loadWorkflowDetails(detailsKey) || { id: workflowId || 'current', name: 'Untitled Workflow', version: '', author: '', timestamp: Date.now() });
  const [wfOpen, setWfOpen] = useState(false);
  useEffect(() => {
    const d = loadWorkflowDetails(detailsKey);
    if (d) setWfDetails(d);
    else setWfDetails({ id: workflowId || 'current', name: 'Untitled Workflow', version: '', author: '', timestamp: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsKey]);
  // Templates (local custom node presets)
  type NodeTemplate = { name: string; baseType: string; label?: string; modelName?: string; shape?: string };
  const TPL_KEY = 'wb_node_templates';
  const [templates, setTemplates] = useState<NodeTemplate[]>(() => {
    try { const raw = localStorage.getItem(TPL_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [showTplForm, setShowTplForm] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplBase, setTplBase] = useState('');
  const [tplLabel, setTplLabel] = useState('');
  const [tplShape, setTplShape] = useState<string>('');

  // Hover/active effects for right sidebar tab buttons
  type TabKey = 'node' | 'validate' | 'version' | 'deploy' | 'simulate' | 'io';
  const [hoverTab, setHoverTab] = useState<TabKey | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<TabKey | null>(null);
  const tabBtnStyle = (key: TabKey) => {
    const isCurrent = rightTab === key;
    const isActivePress = activeTabKey === key;
    const isHover = hoverTab === key;
    const bg = isCurrent ? '#f3f4f6' : isActivePress ? '#f3f4f6' : isHover ? '#f9fafb' : 'white';
    const border = isCurrent ? '2px solid #111827' : '1px solid #e5e7eb';
    return { padding: '6px 10px', borderRadius: 8, border, background: bg, fontWeight: 600, transition: 'background-color .12s ease, border-color .12s ease' } as const;
  };


  const getOutgoing = useCallback((ctx: WorkflowContext, id: string) => ctx.edges.filter(e => e.source === id), []);
  const getIncoming = useCallback((ctx: WorkflowContext, id: string) => ctx.edges.filter(e => e.target === id), []);
  const findStartNodeId = useCallback((ctx: WorkflowContext) => {
    const candidates = ctx.nodes.filter(n => getIncoming(ctx, n.id).length === 0);
    return candidates[0]?.id;
  }, [getIncoming]);

  const emitLog = useCallback((role: 'agent' | 'user' | 'system', text: string) => {
    setSimLog(prev => [...prev, { role, text }]);
    if (role === 'agent' && ttsEnabled) {
      const voice = ttsVoices.find(v => v.name === ttsVoiceName);
      speak(text, { voice });
    }
  }, [ttsEnabled, ttsVoices, ttsVoiceName]);

  const renderMessageFromNode = useCallback((node: { id: string; label?: string }) => {
    const tpl = node.label || '';
    const out = tpl ? fillTemplate(tpl, state.context.variables ?? {}) : tpl;
    if (out) emitLog('agent', out);
  }, [emitLog, state.context.variables]);

  const isCondition = (t: string) => t.includes('condition');
  const isTerminal = (t: string) => t.includes('end') || t === 'logic.break' || t === 'logic.fallback';

  const followGraphAutomatically = useCallback((startId: string | undefined) => {
    let currentId = startId;
    let safety = 0;
    while (currentId && safety < 20) {
      safety++;
      const node = state.context.nodes.find(n => n.id === currentId);
      if (!node) break;

      if (isTerminal(node.type)) {
        emitLog('system', node.type.includes('end') ? '🏁 End' : '⏹️ Stop');
        currentId = undefined;
        break;
      }

      if (isCondition(node.type)) {
        break; // wait for user input
      }

      // Generic step: emit label as agent text (if present) and continue
      renderMessageFromNode(node);
      const outs = getOutgoing(state.context, node.id);
      if (outs.length === 0) break;
      currentId = outs[0].target;
      if (currentId && isCondition(state.context.nodes.find(n => n.id === currentId)?.type || '')) break;
    }
    setSimNodeId(currentId);
  }, [state.context, getOutgoing, renderMessageFromNode, emitLog]);

  const startFlow = useCallback(() => {
    setSimLog([]);
    if (ttsEnabled) cancelSpeak();
    const startId = findStartNodeId(state.context) ?? state.context.nodes[0]?.id;
    followGraphAutomatically(startId);
  }, [findStartNodeId, followGraphAutomatically, state.context, ttsEnabled]);

  // Provide a run function to the parent header (after startFlow is defined)
  useEffect(() => {
    if (!onRegisterRun) return;
    const run = () => {
      setRightTab('simulate');
      startFlow();
    };
    onRegisterRun(run);
  }, [onRegisterRun, startFlow]);

  const routeFromCondition = useCallback((nodeId: string, nlu: { intent: string }) => {
    const outs = getOutgoing(state.context, nodeId);
    const edge =
      outs.find(e => e.sourceHandle === nlu.intent) ||
      outs.find(e => e.sourceHandle === 'yes') ||
      outs.find(e => e.sourceHandle === 'no') ||
      outs[0];
    return edge?.target;
  }, [getOutgoing, state.context]);

  const runPipeline = useCallback((text: string) => {
    setSimText(text);
    const nlu = analyze(text, 'vi');
    setSimNLU(nlu);
    for (const [k, v] of Object.entries(nlu.entities)) {
      if (typeof v === 'string') send({ type: 'SET_VAR', key: k, value: v });
    }
    emitLog('user', text);

    let currentId = simNodeId;
    if (!currentId) currentId = findStartNodeId(state.context) ?? state.context.nodes[0]?.id;
    const node = currentId ? state.context.nodes.find(n => n.id === currentId) : undefined;
    if (node && isCondition(node.type)) {
      const nextId = routeFromCondition(node.id, nlu);
      followGraphAutomatically(nextId);
      return;
    }
    const resp = generateResponse(nlu, state.context.variables ?? {});
    emitLog('agent', resp);
  }, [simNodeId, state.context, emitLog, routeFromCondition, followGraphAutomatically, send]);

  useEffect(() => {
    setNodes(prev => prev.map(n => {
      const isActive = simNodeId && n.id === simNodeId;
      const baseStyle = n.style || {};
      const style = isActive
        ? { ...baseStyle, outline: '3px solid #f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.25)' }
        : { ...baseStyle, outline: undefined, boxShadow: undefined };
      return { ...n, style } as RFNode;
    }));
  }, [simNodeId, setNodes]);

  useEffect(() => {
    setNodes(prev => prev.map(n => {
      if (!String(n.type).includes('condition')) return n;
      const handles = edges
        .filter(e => e.source === n.id && !!e.sourceHandle)
        .map(e => String(e.sourceHandle))
        .filter((v, i, a) => a.indexOf(v) === i);
      const intentHandles = handles.length > 0 ? handles : ['yes', 'no'];
      const data = { ...(n.data || {}), intentHandles };
      return { ...n, data } as RFNode;
    }));
  }, [edges, setNodes]);

  const addNode = useCallback((type: string) => {
    const id = `${type}-${Math.random().toString(36).slice(2, 8)}`;
    send({ type: 'ADD_NODE', node: { id, type, label: NodeRegistry.find(r => r.type === type)?.title ?? type, position: { x: 100, y: 100 } } });
    const rfNode: RFNode = { id, type: type as RFNode['type'], data: { label: NodeRegistry.find(r => r.type === type)?.title ?? type }, position: { x: 100, y: 100 } };
    setNodes(prev => [...prev, rfNode]);
  }, [send]);

  const onNodeDragStop = useCallback((_: any, node: RFNode) => {
    send({ type: 'UPDATE_NODE', id: node.id, patch: { position: node.position } });
  }, [send]);

  const exportJson = useCallback(() => {
    const json = JSON.stringify(state.context, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [state.context]);

  const importJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
          send({ type: 'RESET' });
          for (const n of data.nodes) send({ type: 'ADD_NODE', node: n });
          for (const e of data.edges) if (canAddEdge({ ...state.context, nodes: data.nodes, edges: data.edges }, e)) send({ type: 'ADD_EDGE', edge: e });
          if (data.variables && typeof data.variables === 'object') {
            for (const [k, v] of Object.entries<string>(data.variables)) send({ type: 'SET_VAR', key: k, value: v });
          }
          applyContextToCanvas({ ...state.context, ...data });
        }
      } catch {
        // ignore
      }
    };
    reader.readAsText(file);
  }, [send, state.context]);

  const applyContextToCanvas = useCallback((ctx: WorkflowContext) => {
    const rfNodes: RFNode[] = ctx.nodes.map((n) => ({
      id: n.id,
      type: n.type as RFNode['type'],
      data: { label: n.label },
      position: n.position ?? { x: 100, y: 100 },
    }));
    const rfEdges: RFEdge[] = ctx.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      animated: true,
    }));
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [setNodes, setEdges]);

  const saveVersion = useCallback(() => {
    const now = Date.now();
    const id = `v-${now}`;
    const name = wfDetails?.name || new Date(now).toLocaleString();
    const ver: StoredVersion = {
      id,
      name,
      createdAt: now,
      data: state.context,
      meta: {
        workflowId: wfDetails?.id,
        workflowName: wfDetails?.name,
        version: wfDetails?.version,
        author: wfDetails?.author,
        time: now,
      }
    };
    const list = [...versions, ver];
    localStorage.setItem('wb_versions', JSON.stringify(list));
    setVersions(list);
    setSelectedVersionId(id);
  }, [versions, state.context, wfDetails]);

  const loadSelectedVersion = useCallback(() => {
    const ver = versions.find((v) => v.id === selectedVersionId);
    if (!ver) return;
    const data = ver.data;
    send({ type: 'RESET' });
    for (const n of data.nodes) send({ type: 'ADD_NODE', node: n });
    for (const e of data.edges) if (canAddEdge(data, e)) send({ type: 'ADD_EDGE', edge: e });
    if (data.variables) {
      for (const [k, v] of Object.entries<string>(data.variables)) send({ type: 'SET_VAR', key: k, value: v });
    }
    applyContextToCanvas(data);
  }, [versions, selectedVersionId, send, applyContextToCanvas]);

  // Note: deleteSelectedVersion removed from UI; keep helper if needed later.

  return (
  <div className="wb-root">
      {/* Toolbox Sidebar */}
  <div className="wb-left">
        {/* Workflow Info (top of sidebar) - collapsed pill with chevron, expandable details */}
        <div>
          <div className="wb-row">
            <div className="wb-pill">
              <input value={wfDetails.name || ''} onChange={(e) => setWfDetails({ ...wfDetails, name: e.target.value })} placeholder="Workflow name..." className="wb-input-plain" />
              {/* Placeholder for a small icon if needed */}
            </div>
            <button title={wfOpen ? 'Collapse' : 'Expand'} onClick={() => setWfOpen(v => !v)} className="wb-btn-circle">{wfOpen ? '▲' : '▼'}</button>
          </div>
          {wfOpen && (
            <div className="wb-card wb-col wb-gap-6 wb-mt-8">
              <input value={wfDetails.id} onChange={(e) => setWfDetails({ ...wfDetails, id: e.target.value })} placeholder="ID..." className="wb-input" />
              <input value={wfDetails.version || ''} onChange={(e) => setWfDetails({ ...wfDetails, version: e.target.value })} placeholder="Version..." className="wb-input" />
              <input value={wfDetails.author || ''} onChange={(e) => setWfDetails({ ...wfDetails, author: e.target.value })} placeholder="Author..." className="wb-input" />
              <div className="wb-muted-sm">Timestamp</div>
              <div className="wb-mono-sm">{wfDetails.timestamp ? new Date(Number(wfDetails.timestamp)).toLocaleString() : '-'}</div>
              <div className="wb-row-6">
                <button onClick={() => { const next = { ...wfDetails, timestamp: Date.now() }; setWfDetails(next); saveWorkflowDetails(detailsKey, next); }} className="wb-btn wb-flex-1">Save</button>
                <button onClick={() => { const next = { ...wfDetails, timestamp: Date.now() }; setWfDetails(next); }} className="wb-btn">Now</button>
              </div>
            </div>
          )}
        </div>
        <div className="wb-row">
          <div className="wb-relative wb-flex-1">
            <input
              value={nodeSearch}
              onChange={(e) => setNodeSearch(e.target.value)}
              placeholder="Search nodes..."
              className="wb-select wb-pr-28"
            />
            {/* magnifying glass icon (inline SVG to avoid empty src warnings) */}
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" className="wb-search-icon">
              <path fill="#374151" d="M10 2a8 8 0 105.293 14.293l4.207 4.207 1.414-1.414-4.207-4.207A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4z"/>
            </svg>
          </div>
          {/* Removed workflow ID badge to avoid showing raw ids */}
        </div>
        {CATS.map(cat => (
          <div key={cat}>
            <div className="wb-row wb-justify-between wb-my-6">
              <div className="wb-muted-sm">{cat.toUpperCase()}</div>
              <button onClick={() => toggleCat(cat)} title={collapsed[cat] ? 'Expand' : 'Collapse'} className="wb-btn wb-px-6 wb-lh-20">
                {collapsed[cat] ? '▸' : '▾'}
              </button>
            </div>
            {!collapsed[cat] && (
              <div className="wb-grid-1">
                {NodeRegistry.filter(r => r.category === cat && (nodeSearch.trim() === '' || r.title.toLowerCase().includes(nodeSearch.toLowerCase()) || r.type.toLowerCase().includes(nodeSearch.toLowerCase()))).map(r => (
                  <button key={r.type} onClick={() => addNode(r.type)} className="wb-list-btn">
                    {r.title}
                  </button>
                ))}
                {NodeRegistry.filter(r => r.category === cat && (nodeSearch.trim() === '' || r.title.toLowerCase().includes(nodeSearch.toLowerCase()) || r.type.toLowerCase().includes(nodeSearch.toLowerCase()))).length === 0 && (
                  <div className="wb-muted-sm">No nodes</div>
                )}
              </div>
            )}
          </div>
        ))}
        {/* Shape selector (applies to selected node) */}
        <div className="wb-divider" />
        <div>
          <div className="wb-row wb-justify-between wb-my-6">
            <div className="wb-muted-sm">Shape</div>
          </div>
          <div className="wb-shape-grid">
            {[
              { key: 'square', title: 'Square' },
              { key: 'rounded', title: 'Rounded' },
              { key: 'pill', title: 'Pill' },
              { key: 'circle', title: 'Circle' },
              { key: 'diamond', title: 'Diamond' },
            ].map(s => (
              <button key={s.key} title={s.title} onClick={() => {
                if (!selectedNode) return;
                setNodes(prev => prev.map(n => {
                  if (n.id !== selectedNode.id) return n;
                  const style = (() => {
                    const base = { ...(n.style || {}), transform: undefined as any };
                    if (s.key === 'square') return { ...base, width: 120, height: 40, borderRadius: 4 };
                    if (s.key === 'rounded') return { ...base, width: 140, height: 44, borderRadius: 12 };
                    if (s.key === 'pill') return { ...base, width: 160, height: 44, borderRadius: 9999 };
                    if (s.key === 'circle') return { ...base, width: 80, height: 80, borderRadius: '50%' };
                    if (s.key === 'diamond') return { ...base, width: 80, height: 80, borderRadius: 8, transform: 'rotate(45deg)' };
                    return base;
                  })();
                  return { ...n, style, data: { ...(n.data || {}), shape: s.key } } as RFNode;
                }));
              }} className="wb-shape-btn" style={{ cursor: selectedNode ? 'pointer' : 'not-allowed', opacity: selectedNode ? 1 : .6 }}>
                {s.key === 'square' && <div className="wb-shape-square" />}
                {s.key === 'rounded' && <div className="wb-shape-rounded" />}
                {s.key === 'pill' && <div className="wb-shape-pill" />}
                {s.key === 'circle' && <div className="wb-shape-circle" />}
                {s.key === 'diamond' && <div className="wb-shape-diamond" />}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Node Templates */}
        <div className="wb-divider" />
        <div className="wb-col">
          <button onClick={() => setShowTplForm(v => !v)} className="wb-btn wb-row wb-items-center wb-gap-8 wb-shadow-sm wb-justify-center">
            <span className="wb-text-lg">＋</span> New Node Template
          </button>
          {showTplForm && (
            <div className="wb-card-sm wb-col wb-gap-6">
              <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Template name..." className="wb-select" />
              <select value={tplBase} onChange={(e) => setTplBase(e.target.value)} className="wb-select">
                <option value="">Base type...</option>
                {NodeRegistry.map(r => (<option key={r.type} value={r.type}>{r.title}</option>))}
              </select>
              <input value={tplLabel} onChange={(e) => setTplLabel(e.target.value)} placeholder="Default label (optional)" className="wb-select" />
              <select value={tplShape} onChange={(e) => setTplShape(e.target.value)} className="wb-select">
                <option value="">Shape (optional)</option>
                <option value="square">Square</option>
                <option value="rounded">Rounded</option>
                <option value="pill">Pill</option>
                <option value="circle">Circle</option>
                <option value="diamond">Diamond</option>
              </select>
              <div className="wb-row-6">
                <button onClick={() => { if (!tplName || !tplBase) return; const next = [...templates, { name: tplName, baseType: tplBase, label: tplLabel || undefined, shape: tplShape || undefined }]; setTemplates(next); try { localStorage.setItem(TPL_KEY, JSON.stringify(next)); } catch {} setTplName(''); setTplBase(''); setTplLabel(''); setTplShape(''); setShowTplForm(false); }} className="wb-btn wb-flex-1">Save</button>
                <button onClick={() => { setShowTplForm(false); setTplName(''); setTplBase(''); setTplLabel(''); setTplShape(''); }} className="wb-btn">Cancel</button>
              </div>
            </div>
          )}

          {templates.length > 0 && (
            <div className="wb-col">
              <div className="wb-muted-sm">Templates</div>
              {templates.map((t, idx) => (
                <div key={idx} className="wb-row-6">
                  <button onClick={() => {
                    addNode(t.baseType);
                    // apply template to the node we just added (last node by count)
                    setTimeout(() => {
                      setNodes(prev => {
                        const arr = [...prev];
                        if (arr.length === 0) return arr;
                        const n = arr[arr.length - 1];
                        const style = (() => {
                          const base = { ...(n.style || {}), transform: undefined as any };
                          if (t.shape === 'square') return { ...base, width: 120, height: 40, borderRadius: 4 };
                          if (t.shape === 'rounded') return { ...base, width: 140, height: 44, borderRadius: 12 };
                          if (t.shape === 'pill') return { ...base, width: 160, height: 44, borderRadius: 9999 };
                          if (t.shape === 'circle') return { ...base, width: 80, height: 80, borderRadius: '50%' };
                          if (t.shape === 'diamond') return { ...base, width: 80, height: 80, borderRadius: 8, transform: 'rotate(45deg)' };
                          return base;
                        })();
                        arr[arr.length - 1] = { ...n, data: { ...(n.data || {}), label: t.label || (n.data as any)?.label, shape: t.shape }, style } as RFNode;
                        return arr;
                      });
                    }, 0);
                  }} className="wb-list-btn wb-flex-1">
                    {t.name} <span className="wb-muted-sm">({t.baseType})</span>
                  </button>
                  <button title="Delete template" onClick={(e) => { e.stopPropagation(); const next = templates.filter((_, i) => i !== idx); setTemplates(next); try { localStorage.setItem(TPL_KEY, JSON.stringify(next)); } catch {} }} className="wb-btn-icon">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="wb-divider" />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={() => send({ type: 'SELECT_NODE', id: undefined })}
        nodeTypes={nodeTypes}
        fitView
      >
    <Controls style={{ left: 268 }} />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
  {/* MiniMap anchored near right sidebar */}
  <MiniMap pannable zoomable style={{ right: RIGHT_SIDEBAR_WIDTH + 8, bottom: 16, width: 200, height: 120 }} />
      </ReactFlow>

    {/* Right Sidebar with tabs */}
    <div className="wb-right" style={{ width: RIGHT_SIDEBAR_WIDTH }}>
        {/* Header row */}
      <div className="wb-row wb-justify-between wb-gap-8 wb-mb-4">
          <div className="wb-tabs-strip">
            <button
              onClick={() => setRightTab('node')}
              onMouseEnter={() => setHoverTab('node')}
              onMouseLeave={() => { setHoverTab(null); setActiveTabKey(null); }}
              onMouseDown={() => setActiveTabKey('node')}
              onMouseUp={() => setActiveTabKey(null)}
              style={tabBtnStyle('node')}
            >Node</button>
            <button
              onClick={() => setRightTab('validate')}
              onMouseEnter={() => setHoverTab('validate')}
              onMouseLeave={() => { setHoverTab(null); setActiveTabKey(null); }}
              onMouseDown={() => setActiveTabKey('validate')}
              onMouseUp={() => setActiveTabKey(null)}
              style={tabBtnStyle('validate')}
            >Validate</button>
            <button
              onClick={() => setRightTab('version')}
              onMouseEnter={() => setHoverTab('version')}
              onMouseLeave={() => { setHoverTab(null); setActiveTabKey(null); }}
              onMouseDown={() => setActiveTabKey('version')}
              onMouseUp={() => setActiveTabKey(null)}
              style={tabBtnStyle('version')}
            >Version</button>
            {/* Detail tab removed per new design */}
            <button
              onClick={() => setRightTab('deploy')}
              onMouseEnter={() => setHoverTab('deploy')}
              onMouseLeave={() => { setHoverTab(null); setActiveTabKey(null); }}
              onMouseDown={() => setActiveTabKey('deploy')}
              onMouseUp={() => setActiveTabKey(null)}
              style={tabBtnStyle('deploy')}
            >Deploy</button>
            <button
              onClick={() => setRightTab('simulate')}
              onMouseEnter={() => setHoverTab('simulate')}
              onMouseLeave={() => { setHoverTab(null); setActiveTabKey(null); }}
              onMouseDown={() => setActiveTabKey('simulate')}
              onMouseUp={() => setActiveTabKey(null)}
              style={tabBtnStyle('simulate')}
            >Simulation</button>
            <button
              onClick={() => setRightTab('io')}
              onMouseEnter={() => setHoverTab('io')}
              onMouseLeave={() => { setHoverTab(null); setActiveTabKey(null); }}
              onMouseDown={() => setActiveTabKey('io')}
              onMouseUp={() => setActiveTabKey(null)}
              style={tabBtnStyle('io')}
            >Import/Export</button>
          </div>
          <div />
        </div>
        <div className="wb-divider" />

  {/* Tab content */}
  <div className="wb-right-content">
          {rightTab === 'node' && (
            <div className="wb-col wb-gap-10">
              <div className="wb-row wb-justify-between">
                <div className="wb-title">Configure node</div>
                <div className="wb-muted-sm">▾</div>
              </div>
              {!selectedNode ? (
                <div className="wb-muted-sm">Chưa chọn node nào.</div>
              ) : (
                <>
                  {/* Node name */}
                  <div className="wb-card">
                    <input
                      value={nodeLabel}
                      onChange={(e) => setNodeLabel(e.target.value)}
                      placeholder="Node name...."
                      className="wb-select-lg"
                    />
                  </div>
                  {/* Model name */}
                  <div className="wb-card">
                    <input
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="Model name...."
                      className="wb-select-lg"
                    />
                  </div>
                  {/* Type select - full width like other inputs */}
                  <div className="wb-card">
                    <div className="wb-muted-sm wb-mb-6">Type</div>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="wb-select-lg"
                    >
                      {NodeRegistry.map((r) => (
                        <option key={r.type} value={r.type}>{r.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Input Variables */}
                  <div>
                    <div className="wb-row wb-justify-between wb-mb-6">
                      <div className="wb-title wb-text-title">Input Variables</div>
                      <button
                        onClick={() => { setAddVarFor('in'); setNewVarName(''); setNewVarType('string'); setNewVarScope('local'); }}
                        title="Add input"
                        className="wb-btn-circle"
                      >+
                      </button>
                    </div>
                    <div className="wb-card">
                      {inVars.length === 0 && (
                        <div className="wb-muted-sm">No inputs</div>
                      )}
                      {addVarFor === 'in' && (
                        <div className="wb-subcard wb-col wb-gap-6">
                          <div className="wb-title wb-text-title">Add variables</div>
                          <input value={newVarName} onChange={(e) => setNewVarName(e.target.value)} placeholder="Variable name" className="wb-input" />
                          <select value={newVarType} onChange={(e) => setNewVarType(e.target.value)} className="wb-select">
                            <option value="string">Type: String</option>
                            <option value="number">Type: Number</option>
                            <option value="boolean">Type: Boolean</option>
                            <option value="object">Type: Object</option>
                            <option value="array">Type: Array</option>
                          </select>
                          <select value={newVarScope} onChange={(e) => setNewVarScope(e.target.value as VarDef['scope'])} className="wb-select">
                            <option value="global">Scope: Workflow</option>
                            <option value="local">Scope: Node</option>
                          </select>
                          <div className="wb-row-6">
                            <button onClick={() => { if (!newVarName.trim()) return; setInVars(v => [...v, { name: newVarName.trim(), scope: newVarScope, vtype: newVarType }]); setAddVarFor(null); }} className="wb-btn wb-flex-1 wb-fw-600">Save</button>
                            <button onClick={() => setAddVarFor(null)} className="wb-btn">Cancel</button>
                          </div>
                        </div>
                      )}
                      {inVars.map((v, i) => (
                        <div key={i} className="wb-row-grid">
                          <input
                            value={v.name}
                            onChange={(e) => setInVars((arr) => arr.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it))}
                            className="wb-input"
                          />
                          <select
                            value={v.scope}
                            onChange={(e) => setInVars((arr) => arr.map((it, idx) => idx === i ? { ...it, scope: e.target.value as VarDef['scope'] } : it))}
                            className="wb-select"
                          >
                            <option value="global">Workflow</option>
                            <option value="local">Node</option>
                          </select>
                          <button aria-label="Delete input variable" onClick={() => setInVars((arr) => arr.filter((_, idx) => idx !== i))} className="wb-btn-icon wb-lh-28">×</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Output Variables */}
                  <div>
                    <div className="wb-row wb-justify-between wb-mt-8 wb-mb-6">
                      <div className="wb-title wb-text-title">Output Variables</div>
                      <button
                        onClick={() => { setAddVarFor('out'); setNewVarName(''); setNewVarType('string'); setNewVarScope('local'); }}
                        title="Add output"
                        className="wb-btn-circle"
                      >+
                      </button>
                    </div>
                    <div className="wb-card">
                      {outVars.length === 0 && (
                        <div className="wb-muted-sm">No outputs</div>
                      )}
                      {addVarFor === 'out' && (
                        <div className="wb-subcard wb-col wb-gap-6">
                          <div className="wb-title wb-text-title">Add variables</div>
                          <input value={newVarName} onChange={(e) => setNewVarName(e.target.value)} placeholder="Variable name" className="wb-input" />
                          <select value={newVarType} onChange={(e) => setNewVarType(e.target.value)} className="wb-select">
                            <option value="string">Type: String</option>
                            <option value="number">Type: Number</option>
                            <option value="boolean">Type: Boolean</option>
                            <option value="object">Type: Object</option>
                            <option value="array">Type: Array</option>
                          </select>
                          <select value={newVarScope} onChange={(e) => setNewVarScope(e.target.value as VarDef['scope'])} className="wb-select">
                            <option value="global">Scope: Workflow</option>
                            <option value="local">Scope: Node</option>
                          </select>
                          <div className="wb-row-6">
                            <button onClick={() => { if (!newVarName.trim()) return; setOutVars(v => [...v, { name: newVarName.trim(), scope: newVarScope, vtype: newVarType }]); setAddVarFor(null); }} className="wb-btn wb-flex-1 wb-fw-600">Save</button>
                            <button onClick={() => setAddVarFor(null)} className="wb-btn">Cancel</button>
                          </div>
                        </div>
                      )}
                      {outVars.map((v, i) => (
                        <div key={i} className="wb-row-grid">
                          <input
                            value={v.name}
                            onChange={(e) => setOutVars((arr) => arr.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it))}
                            className="wb-input"
                          />
                          <select
                            value={v.scope}
                            onChange={(e) => setOutVars((arr) => arr.map((it, idx) => idx === i ? { ...it, scope: e.target.value as VarDef['scope'] } : it))}
                            className="wb-select"
                          >
                            <option value="global">Workflow</option>
                            <option value="local">Node</option>
                          </select>
                          <button aria-label="Delete output variable" onClick={() => setOutVars((arr) => arr.filter((_, idx) => idx !== i))} className="wb-btn-icon wb-lh-28">×</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Apply Changes */}
                  <button
                    onClick={() => {
                      if (!selectedNode) return;
                      // Update logical node (machine) for label/type; store extended config in RF node data only
                      send({ type: 'UPDATE_NODE', id: selectedNode.id, patch: { label: nodeLabel, type: selectedType } });
                      setNodes((prev) => prev.map((n) => n.id === selectedNode.id ? { ...n, type: selectedType as RFNode['type'], data: { ...(n.data || {}), label: nodeLabel, modelName, inputs: inVars, outputs: outVars } } : n));
                    }}
                    className="wb-btn-strong"
                  >
                    Apply Changes
                  </button>
                </>
              )}

              {/* Removed duplicated Global Variables section as requested */}
            </div>
          )}

          {rightTab === 'validate' && (
            <div className="wb-col wb-gap-10">
              <div className="wb-title">Validate</div>
              <div className="wb-row-6">
                <button
                  onClick={() => {
                    const problems: string[] = [];
                    const ctx = state.context;
                    if (ctx.nodes.length === 0) problems.push('Chưa có node nào.');
                    const incoming = (id: string) => ctx.edges.filter(e => e.target === id).length;
                    const startNodes = ctx.nodes.filter(n => incoming(n.id) === 0);
                    if (startNodes.length === 0) problems.push('Không tìm thấy điểm bắt đầu (node không có incoming).');
                    const seen = new Set<string>();
                    for (const e of ctx.edges) {
                      if (e.source === e.target) problems.push(`Self-loop không hợp lệ tại edge ${e.id}`);
                      const key = `${e.source}:${e.sourceHandle || ''}>${e.target}:${e.targetHandle || ''}`;
                      if (seen.has(key)) problems.push(`Trùng cạnh từ ${e.source} đến ${e.target}${e.sourceHandle ? ` (nhánh ${e.sourceHandle})` : ''}`);
                      seen.add(key);
                    }
                    for (const n of ctx.nodes) {
                      const outs = ctx.edges.filter(e => e.source === n.id);
                      if (String(n.type).includes('condition')) {
                        const hs = new Set<string>();
                        for (const e of outs) {
                          const h = String(e.sourceHandle || '');
                          if (!h) problems.push(`Cạnh từ node điều kiện ${n.id} thiếu sourceHandle.`);
                          if (hs.has(h)) problems.push(`Nhánh điều kiện trùng nhau '${h}' tại node ${n.id}.`);
                          hs.add(h);
                        }
                      }
                      if (String(n.type).includes('end') || n.type === 'logic.break' || n.type === 'logic.fallback') {
                        if (outs.length > 0) problems.push(`Node kết thúc ${n.id} không được có cạnh đi ra.`);
                      }
                      if (!String(n.type).includes('end') && outs.length === 0) {
                        problems.push(`Dead-end tại node ${n.id} (không có cạnh đi ra).`);
                      }
                    }
                    const startIds = startNodes.map(n => n.id);
                    const visited = new Set<string>(startIds);
                    const q = [...startIds];
                    while (q.length) {
                      const cur = q.shift()!;
                      for (const e of ctx.edges.filter(e => e.source === cur)) {
                        if (!visited.has(e.target)) { visited.add(e.target); q.push(e.target); }
                      }
                    }
                    for (const n of ctx.nodes) {
                      if (!visited.has(n.id)) problems.push(`Node ${n.id} không thể tới được từ điểm bắt đầu.`);
                    }
                    setIssues(problems);
                  }}
                  className="wb-btn wb-fw-600"
                >Run</button>
                <button onClick={() => setIssues([])} className="wb-btn">Clear</button>
              </div>

              {/* Validator accordion */}
              <div>
                <button onClick={() => setValidatorOpen(v => !v)} className="wb-accordion-btn">
                  <span>Validator</span><span>{validatorOpen ? '▴' : '▾'}</span>
                </button>
                {validatorOpen && (
                  <div className="wb-col wb-gap-8 wb-mt-8">
                    {(() => {
                      const catOf = (m: string): 'startEnd'|'deadEnd'|'binding'|'schema' => {
                        if (m.includes('bắt đầu') || m.includes('kết thúc') || m.includes('Self-loop')) return 'startEnd';
                        if (m.includes('Dead-end') || m.includes('không thể tới được')) return 'deadEnd';
                        if (m.includes('Trùng cạnh') || m.includes('sourceHandle')) return 'binding';
                        return 'schema';
                      };
                      const grouped: Record<'startEnd'|'deadEnd'|'binding'|'schema', string[]> = { startEnd: [], deadEnd: [], binding: [], schema: [] };
                      for (const m of issues) grouped[catOf(m)].push(m);
                      const autoFixable = issues.filter(m => m.includes('Trùng cạnh') || m.includes('Self-loop') || m.includes('không được có cạnh đi ra')).length;
                      const Section = ({ title, k }: { title: string; k: keyof typeof grouped }) => (
                        <div>
                          <button onClick={() => toggleCatOpen(k)} className="wb-accordion-btn wb-shadow-xs wb-fw-600">
                            <span>{title}</span>
                            <span>{catOpen[k] ? '▴' : '▾'}</span>
                          </button>
                          {catOpen[k] && (
                            <div className="wb-issues-panel">
                              {grouped[k].length === 0 ? (
                                <div className="wb-muted-sm">No issues</div>
                              ) : (
                                <div className="wb-col">
                                  {grouped[k].map((m, i) => (
                                    <div key={i} className="wb-issue-badge">{m}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                      return (
                        <>
                          <Section title="Start/End" k="startEnd" />
                          <Section title="Dead-end" k="deadEnd" />
                          <Section title="Binding" k="binding" />
                          <Section title="Schema mismatch" k="schema" />
                          <div className="wb-mt-6 wb-text-title">{issues.length} issues found - {autoFixable} auto-fixable</div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {rightTab === 'version' && (
            <div className="wb-col wb-gap-10">
              <div className="wb-title">Version</div>
              <div className="wb-col wb-gap-8">
                <div className="wb-card-sm">
                  <div className="wb-row wb-justify-between">
                    <div className="wb-muted-sm">Select Version</div>
                    {/* chevron placeholder */}
                    <div className="wb-opacity-60">▾</div>
                  </div>
                  <div className="wb-mt-6">
                    <select value={selectedVersionId ?? ''} onChange={(e) => setSelectedVersionId(e.target.value || undefined)} size={Math.min(6, Math.max(3, versions.length || 3))} className="wb-select">
                      {versions.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="wb-row wb-gap-12">
                  <button onClick={saveVersion} className="wb-btn wb-flex-1 wb-fw-700">Commit</button>
                  <button onClick={loadSelectedVersion} disabled={!selectedVersionId} className="wb-btn wb-flex-1 wb-fw-700" style={{ opacity: selectedVersionId ? 1 : .6 }}>Rollback</button>
                </div>
                <div className="wb-muted-sm">
                  Khi nhấn Commit → hệ thống chụp snapshot JSON + metadata (version, author, time). Khi nhấn Rollback → lấy lại snapshot của version chọn, cập nhật workflow hiện tại.
                </div>
              </div>
            </div>
          )}

          {/* Detail tab content removed; use left sidebar Workflow pill to edit */}

          {rightTab === 'simulate' && (
            <div className="wb-col wb-gap-8">
              <div className="wb-title">Simulation</div>
              <div className="wb-row wb-gap-8 wb-items-center">
                <SpeechToText onResult={(r) => r.isFinal && runPipeline(r.transcript)} />
                <button onClick={startFlow} className="wb-btn">Start Flow</button>
                {isTTSSupported() && (
                  <label className="wb-row-6">
                    <input type="checkbox" checked={ttsEnabled} onChange={(e) => setTTSEnabled(e.target.checked)} /> TTS
                  </label>
                )}
              </div>
              {isTTSSupported() && (
                <div className="wb-row-6">
                  <select value={ttsVoiceName} onChange={(e) => setTTSVoiceName(e.target.value)} className="wb-select wb-flex-1">
                    <option value="">Default Voice</option>
                    {ttsVoices.map(v => (
                      <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                    ))}
                  </select>
                  <button onClick={() => cancelSpeak()} className="wb-btn">Stop TTS</button>
                </div>
              )}
              <div className="wb-row-6">
                <input value={simText} onChange={(e) => setSimText(e.target.value)} placeholder="Nhập câu nói..." className="wb-select wb-flex-1 wb-p-6" />
                <button onClick={() => runPipeline(simText)} className="wb-btn">Run</button>
              </div>
              {simNLU && (
                <div className="wb-muted-sm wb-text-title">
                  <div>Intent: <b>{simNLU?.intent}</b></div>
                  <div>Sentiment: <b>{simNLU?.sentiment}</b></div>
                  {Object.keys(simNLU?.entities ?? {}).length > 0 && (
                    <div>Entities: {(Object.entries(simNLU?.entities ?? {}).map(([k, v]) => `${k}=${v}`)).join(', ')}</div>
                  )}
                </div>
              )}
              <div className="wb-card-sm wb-log">
                {simLog.length === 0 && <div className="wb-muted-sm">Chưa có hội thoại</div>}
                {simLog.map((m, i) => (
                  <div key={i} className="wb-mb-6">
                    <b>{m.role === 'agent' ? 'Agent' : m.role === 'user' ? 'User' : 'System'}:</b> {m.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {rightTab === 'io' && (
            <div className="wb-col wb-gap-8">
              <div className="wb-title">Import / Export</div>
              <button onClick={exportJson} className="wb-btn wb-fw-600">Export JSON</button>
              <label className="wb-btn wb-cursor-pointer wb-fw-600">
                Import JSON
                <input type="file" accept="application/json" className="wb-hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJson(f);
                  e.currentTarget.value = '';
                }} />
              </label>
            </div>
          )}

          {rightTab === 'deploy' && (
            <DeployPanel context={state.context} versions={versions} selectedVersionId={selectedVersionId} onDeploy={(info) => {
              const listRaw = localStorage.getItem('wb_deployments');
              const list = listRaw ? JSON.parse(listRaw) : [];
              list.push(info);
              localStorage.setItem('wb_deployments', JSON.stringify(list));
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

// Note: VarEditor component removed (global variables UI no longer used here)

function DeployPanel({ context, versions, selectedVersionId, onDeploy }: { context: WorkflowContext; versions: { id: string; name: string; createdAt: number; data: WorkflowContext }[]; selectedVersionId?: string; onDeploy: (info: any) => void }) {
  const [env, setEnv] = useState<'dev' | 'staging' | 'prod'>('dev');
  const [verId, setVerId] = useState<string>(selectedVersionId ?? 'current');
  const [targetMode, setTargetMode] = useState<'upload' | 'campaign'>('upload');
  const [uploadedName, setUploadedName] = useState<string>('');
  const [targetCount, setTargetCount] = useState<number>(0);
  const [campaigns] = useState<string[]>(['BlackFri_Campaign_2025', 'BlackFri_Campaign_2024', 'BlackFri_Campaign_2022']);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('BlackFri_Campaign_2025');
  const [policyOpen, setPolicyOpen] = useState<boolean>(false);
  const [maxConcurrency, setMaxConcurrency] = useState<number>(50);
  const [rateLimit, setRateLimit] = useState<number>(120);
  const [retryDelay, setRetryDelay] = useState<number>(300);
  const [retries, setRetries] = useState<number>(2);
  const [retryOn, setRetryOn] = useState<{noAnswer: boolean; busy: boolean; failed: boolean}>({ noAnswer: true, busy: true, failed: true });
  const [timeStart, setTimeStart] = useState<string>('09:00');
  const [timeEnd, setTimeEnd] = useState<string>('18:00');
  const [callerId, setCallerId] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('Asia/Ho_Chi_Minh');
  const [applyDnc, setApplyDnc] = useState<boolean>(true);
  const [log, setLog] = useState<{ success?: boolean; message?: string; when?: number } | null>(null);

  useEffect(() => { setVerId(selectedVersionId ?? 'current'); }, [selectedVersionId]);

  function parseCsvAndCount(file: File) {
    setUploadedName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        // naive header handling: if first line has commas treat as header
        const count = lines.length > 0 ? (lines[0].includes(',') ? lines.length - 1 : lines.length) : 0;
        setTargetCount(Math.max(0, count));
      } catch {
        setTargetCount(0);
      }
    };
    reader.readAsText(file);
  }

  function handleBuild() {
    const msg = `Built package for ${verId === 'current' ? 'current' : verId} with ${targetCount} targets.`;
    setLog({ success: true, message: msg, when: Date.now() });
  }

  function handleActivate() {
    const payload = verId === 'current' ? context : (versions.find(v => v.id === verId)?.data ?? context);
    const info = {
      id: `deploy-${Date.now()}`,
      env,
      version: verId,
      time: Date.now(),
      nodes: payload.nodes.length,
      edges: payload.edges.length,
      targets: targetCount,
      policy: { maxConcurrency, rateLimit, retryDelay, retries, retryOn, timeStart, timeEnd, callerId, timezone, applyDnc }
    };
    onDeploy(info);
    setLog({ success: true, message: `Activated to ${env.toUpperCase()} at ${new Date(info.time).toLocaleString()}`, when: info.time });
  }

  return (
    <div className="wb-col wb-gap-10">
      <div className="wb-title">Deploy</div>

      {/* Select Target card */}
      <div className="wb-card-sm wb-col wb-gap-8">
        <div className="wb-row wb-justify-between">
          <div className="wb-muted-sm">Select Target</div>
          <div className="wb-opacity-60">▾</div>
        </div>
        {targetMode === 'upload' ? (
          <div className="wb-dashed">
            <div className="wb-mb-8">Upload .csv</div>
            <input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCsvAndCount(f); }} />
            {uploadedName && <div className="wb-muted-sm wb-mt-6 wb-text-title">{uploadedName} · {targetCount} targets</div>}
          </div>
        ) : (
          <div>
            <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} size={3} className="wb-select">
              {campaigns.map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
        )}
        <button onClick={() => setTargetMode(m => m === 'upload' ? 'campaign' : 'upload')} className="wb-btn wb-self-start">
          {targetMode === 'upload' ? 'Switch Campaign' : 'Switch Upload.csv'}
        </button>
      </div>

      {/* Dialing policy dropdown */}
      <div>
        <button onClick={() => setPolicyOpen(v => !v)} className="wb-accordion-btn">
          <span>Dialing policy</span><span>{policyOpen ? '▴' : '▾'}</span>
        </button>
        {policyOpen && (
          <div className="wb-card-sm wb-grid-1 wb-gap-8 wb-mt-8">
            <label>Max concurrency: <input type="number" value={maxConcurrency} onChange={(e) => setMaxConcurrency(Number(e.target.value))} className="wb-select wb-w-100 wb-ml-8" /></label>
            <div className="wb-row wb-gap-8 wb-items-center">
              <label>Rate limit: <input type="number" value={rateLimit} onChange={(e) => setRateLimit(Number(e.target.value))} className="wb-select wb-w-100 wb-ml-8" /></label>
              <label>Delay: <input type="number" value={retryDelay} onChange={(e) => setRetryDelay(Number(e.target.value))} className="wb-select wb-w-100 wb-ml-8" /></label>
            </div>
            <div className="wb-row wb-gap-8 wb-items-center">
              <label>Retries: <input type="number" value={retries} onChange={(e) => setRetries(Number(e.target.value))} className="wb-select wb-w-80 wb-ml-8" /></label>
              <div className="wb-row wb-gap-8 wb-items-center">
                <span>Retry on:</span>
                <label><input type="checkbox" checked={retryOn.noAnswer} onChange={(e) => setRetryOn(s => ({ ...s, noAnswer: e.target.checked }))} /> No answer</label>
                <label><input type="checkbox" checked={retryOn.busy} onChange={(e) => setRetryOn(s => ({ ...s, busy: e.target.checked }))} /> Busy</label>
                <label><input type="checkbox" checked={retryOn.failed} onChange={(e) => setRetryOn(s => ({ ...s, failed: e.target.checked }))} /> Failed</label>
              </div>
            </div>
            <div className="wb-row wb-gap-8 wb-items-center">
              <label>Time window: <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="wb-select wb-ml-8" /> – <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="wb-select" /></label>
            </div>
            <label>Caller ID: <input value={callerId} onChange={(e) => setCallerId(e.target.value)} placeholder="e.g., +84xxxx" className="wb-select wb-w-full wb-ml-8" /></label>
            <div className="wb-row wb-gap-8 wb-items-center">
              <label>Timezone: 
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="wb-select wb-ml-8">
                  <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
                  <option value="Asia/Bangkok">Asia/Bangkok</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                </select>
              </label>
            </div>
            <label className="wb-row wb-gap-8 wb-items-center">
              <input type="checkbox" checked={applyDnc} onChange={(e) => setApplyDnc(e.target.checked)} /> Apply Global DNC Filter
            </label>
          </div>
        )}
      </div>

      {/* Environment and version selection */}
      <div className="wb-grid-2">
        <select value={env} onChange={(e) => setEnv(e.target.value as any)} className="wb-select">
          <option value="dev">Dev</option>
          <option value="staging">Staging</option>
          <option value="prod">Prod</option>
        </select>
        <select value={verId} onChange={(e) => setVerId(e.target.value)} className="wb-select">
          <option value="current">Use current canvas</option>
          {versions.map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}
        </select>
      </div>

      {/* Build & Activate */}
      <div className="wb-row wb-gap-12">
        <button onClick={handleBuild} className="wb-btn wb-flex-1 wb-fw-700">Build</button>
        <button onClick={handleActivate} className="wb-btn wb-flex-1 wb-fw-700">Activate</button>
      </div>

      {/* Deployment Log */}
      <div className="wb-card-sm">
        <div className="wb-title wb-mb-6">Deployment Log</div>
        <div>Deployed Successfully: {log?.success ? 'Yes' : '—'}</div>
        <div>Target count: {targetCount}</div>
        <div>Status: {log?.message || '—'}</div>
      </div>
    </div>
  );
}
