import { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MarkerType,
  MiniMap,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './WorkflowBuilder.css';
import type { Connection, Edge as RFEdge, Node as RFNode, EdgeChange, NodeChange } from 'reactflow';
import { useMachine } from '@xstate/react';
import { createWorkflowMachine, canAddEdge, selectors } from '../state/workflowMachine';
// SpeechToText removed from simulation panel redesign; re-add later if needed
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
  const [shiftDown, setShiftDown] = useState(false);

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
    setEdges((eds: RFEdge[]) => addEdge({ ...connection, animated: true, type: shiftDown ? 'step' : 'smoothstep' }, eds));
  }, [setEdges, state.context, send, shiftDown]);

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
  const [simLog, setSimLog] = useState<Array<{ role: 'agent' | 'user' | 'system'; text: string; when: number }>>([]);
  const [simWorkflowVersion, setSimWorkflowVersion] = useState<string>('current');

      // Track Shift key to toggle straight/step connection lines on the fly
      useEffect(() => {
        const onDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftDown(true); };
        const onUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftDown(false); };
        document.addEventListener('keydown', onDown);
        document.addEventListener('keyup', onUp);
        return () => {
          document.removeEventListener('keydown', onDown);
          document.removeEventListener('keyup', onUp);
        };
      }, []);
  const [simIntent, setSimIntent] = useState<string>('');
  const [simLatencyMs, setSimLatencyMs] = useState<number>(0);
  const [simTimeLimitSec, setSimTimeLimitSec] = useState<number>(0);
  const [simActive, setSimActive] = useState<boolean>(false);
  const [simStartTs, setSimStartTs] = useState<number | null>(null);
  const [ttsEnabled, setTTSEnabled] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
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
  type PortDef = { name: string; type: string };
  type NodeTemplateFull = NodeTemplate & { tags?: string[]; inputs?: PortDef[]; outputs?: PortDef[]; schema?: any; defaults?: Record<string,string> };
  const [templates, setTemplates] = useState<NodeTemplateFull[]>(() => {
    try { const raw = localStorage.getItem(TPL_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [showTplModal, setShowTplModal] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplModel, setTplModel] = useState('');
  const [tplBase, setTplBase] = useState('');
  const [tplShape, setTplShape] = useState<string>('');
  const [tplLabel, setTplLabel] = useState('');
  const [tplTags, setTplTags] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const predefinedTags = useMemo(() => ['speech','logic','nlu','response','tts','condition','integration','api','db','utils','entry','end','fallback'], []);
  const [portsIn, setPortsIn] = useState<PortDef[]>([]);
  const [portsOut, setPortsOut] = useState<PortDef[]>([]);
  const [schemaText, setSchemaText] = useState<string>('# Code editor area');
  const [schemaValid, setSchemaValid] = useState<boolean | null>(null);
  const [schemaErrors, setSchemaErrors] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<Array<{ key: string; value: string }>>([]);

  const validateSchema = useCallback(() => {
    try {
      const parsed = JSON.parse(schemaText);
      if (typeof parsed !== 'object' || parsed === null) {
        setSchemaValid(false); setSchemaErrors(['Schema must be JSON object']); return;
      }
      setSchemaValid(true); setSchemaErrors([]);
    } catch (e: any) {
      setSchemaValid(false); setSchemaErrors([String(e.message || e)]);
    }
  }, [schemaText]);

  const resetTemplateForm = () => {
    setTplName(''); setTplModel(''); setTplBase(''); setTplShape(''); setTplLabel('');
    setTplTags([]); setTagDropdownOpen(false); setPortsIn([]); setPortsOut([]); setSchemaText('# Code editor area'); setSchemaValid(null); setSchemaErrors([]); setDefaults([]);
  };

  // Hover/active effects for right sidebar tab buttons
  type TabKey = 'node' | 'validate' | 'version' | 'deploy' | 'simulate' | 'io';
  const [hoverTab, setHoverTab] = useState<TabKey | null>(null);
  const [activeTabKey, setActiveTabKey] = useState<TabKey | null>(null);
  const tabBtnStyle = (key: TabKey) => {
    const isCurrent = rightTab === key;
    const isActivePress = activeTabKey === key;
    const isHover = hoverTab === key;
    const bg = isCurrent ? '#f3f4f6' : isActivePress ? '#f3f4f6' : isHover ? '#f9fafb' : 'white';
    const border = `2px solid ${isCurrent ? '#111827' : '#e5e7eb'}`;
    return {
      padding: '6px 10px',
      borderRadius: 8,
      border,
      background: bg,
      fontWeight: 600,
      transition: 'background-color .12s ease, border-color .12s ease',
      boxSizing: 'border-box' as const,
      whiteSpace: 'nowrap' as const,
      display: 'inline-flex',
      alignItems: 'center',
    } as const;
  };


  const getOutgoing = useCallback((ctx: WorkflowContext, id: string) => ctx.edges.filter(e => e.source === id), []);
  const getIncoming = useCallback((ctx: WorkflowContext, id: string) => ctx.edges.filter(e => e.target === id), []);
  const findStartNodeId = useCallback((ctx: WorkflowContext) => {
    const candidates = ctx.nodes.filter(n => getIncoming(ctx, n.id).length === 0);
    return candidates[0]?.id;
  }, [getIncoming]);

  const emitLog = useCallback((role: 'agent' | 'user' | 'system', text: string) => {
    const push = () => {
      const when = Date.now();
      setSimLog(prev => [...prev, { role, text, when }]);
      if (role === 'agent' && ttsEnabled) {
        const voice = ttsVoices.find(v => v.name === ttsVoiceName);
        speak(text, { voice });
      }
    };
    if (simLatencyMs > 0 && role === 'agent') {
      setTimeout(push, simLatencyMs);
    } else {
      push();
    }
  }, [ttsEnabled, ttsVoices, ttsVoiceName, simLatencyMs]);


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
      // time limit check
      if (simActive && simTimeLimitSec > 0 && simStartTs && Date.now() - simStartTs > simTimeLimitSec * 1000) {
        emitLog('system', '⏱️ Simulation time limit reached');
        setSimActive(false);
        setSimNodeId(undefined);
        break;
      }
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

  // (runPipeline + startFlow moved below after helper callbacks to avoid use-before-declare warnings)


  const routeFromCondition = useCallback((nodeId: string, nlu: { intent: string }) => {
    const outs = getOutgoing(state.context, nodeId);
    const edge =
      outs.find(e => e.sourceHandle === nlu.intent) ||
      outs.find(e => e.sourceHandle === 'yes') ||
      outs.find(e => e.sourceHandle === 'no') ||
      outs[0];
    return edge?.target;
  }, [getOutgoing, state.context]);

  // Pipeline for processing a simulated user message (repositioned below helpers)
  const runPipeline = useCallback((text: string) => {
    setSimText(text);
    const nlu = analyze(text, 'vi');
    if (simIntent.trim()) nlu.intent = simIntent.trim();
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
    if (simActive) {
      const resp = generateResponse(nlu, state.context.variables ?? {});
      emitLog('agent', resp);
    }
  }, [simIntent, simNodeId, state.context, emitLog, routeFromCondition, followGraphAutomatically, send, simActive, findStartNodeId]);

  // Start simulation flow
  const startFlow = useCallback(() => {
    setSimLog([]);
    if (ttsEnabled) cancelSpeak();
    setSimActive(true);
    const now = Date.now();
    setSimStartTs(now);
    const startId = findStartNodeId(state.context) ?? state.context.nodes[0]?.id;
    followGraphAutomatically(startId);
    if (simText.trim()) runPipeline(simText.trim());
  }, [findStartNodeId, followGraphAutomatically, state.context, ttsEnabled, simText, runPipeline]);

  // Register external run trigger (now after startFlow exists)
  useEffect(() => {
    if (!onRegisterRun) return;
    const run = () => { setRightTab('simulate'); startFlow(); };
    onRegisterRun(run);
  }, [onRegisterRun, startFlow]);


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

  

  

  // Import/Export UI state and helpers
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportVerId, setExportVerId] = useState<string>('current');
  const [importDragOver, setImportDragOver] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ fileName?: string; schemaVersion?: string; valid: boolean; errors: string[]; state: 'ready'|'importing'|'done'; data?: any }>({ valid: false, errors: [], state: 'ready' });

  const buildExportPayload = useCallback((verId: string) => {
    const payload = verId === 'current' ? state.context : (versions.find(v => v.id === verId)?.data ?? state.context);
    return { schemaVersion: 'v1.2.0', ...payload } as any;
  }, [state.context, versions]);

  const runExportJson = useCallback(() => {
    const payload = buildExportPayload(exportVerId);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = wfDetails?.name ? wfDetails.name.replace(/\s+/g,'_') : 'workflow';
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
  }, [buildExportPayload, exportVerId, wfDetails]);

  const previewImportFromFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const data = JSON.parse(text);
        const errors: string[] = [];
        const validNodes = Array.isArray(data.nodes);
        const validEdges = Array.isArray(data.edges);
        if (!validNodes) errors.push('Missing or invalid nodes array');
        if (!validEdges) errors.push('Missing or invalid edges array');
        const valid = validNodes && validEdges;
        setImportStatus({
          fileName: file.name,
          schemaVersion: String(data.schemaVersion || 'v1.2.0'),
          valid,
          errors,
          state: 'ready',
          data,
        });
        setImportModalOpen(true);
      } catch (e: any) {
        setImportStatus({ fileName: file.name, schemaVersion: undefined, valid: false, errors: ['Invalid JSON: ' + String(e?.message || e)], state: 'ready' });
        setImportModalOpen(true);
      }
    };
    reader.readAsText(file);
  }, []);

  // Global ESC handling to close overlays/dropdowns (robust across inputs/selects)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = (e as any).key || (e as any).code || '';
      if (k === 'Escape' || k === 'Esc') {
        e.preventDefault?.();
        setImportModalOpen(false);
        setExportModalOpen(false);
        setShowTplModal(false);
        setTagDropdownOpen(false);
        setExportOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
    };
  }, []);

  

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
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#111827', width: 16, height: 16 } as any,
    }));
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [setNodes, setEdges]);

  // Apply previously previewed import into the canvas and machine
  const importApply = useCallback(() => {
    if (!importStatus?.data) return;
    setImportStatus(s => ({ ...s, state: 'importing' }));
    const data = importStatus.data;
    try {
      send({ type: 'RESET' });
      for (const n of (data.nodes || [])) send({ type: 'ADD_NODE', node: n });
      for (const e of (data.edges || [])) if (canAddEdge({ ...state.context, nodes: data.nodes || [], edges: data.edges || [] }, e)) send({ type: 'ADD_EDGE', edge: e });
      if (data.variables && typeof data.variables === 'object') {
        for (const [k, v] of Object.entries<string>(data.variables)) send({ type: 'SET_VAR', key: k, value: v });
      }
      applyContextToCanvas({ ...state.context, ...data });
      setImportStatus(s => ({ ...s, state: 'done' }));
    } catch (e) {
      setImportStatus(s => ({ ...s, state: 'ready', errors: [...s.errors, 'Import failed: ' + String(e)] }));
    }
  }, [applyContextToCanvas, importStatus, send, state.context]);

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
  <>
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
          <button onClick={() => { resetTemplateForm(); setShowTplModal(true); }} className="wb-btn wb-row wb-items-center wb-gap-8 wb-shadow-sm wb-justify-center">
            <span className="wb-text-lg">＋</span> New Node Template
          </button>
          {templates.length > 0 && (
            <div className="wb-col">
              <div className="wb-muted-sm">Templates</div>
              {templates.map((t, idx) => (
                <div key={idx} className="wb-row-6">
                  <button onClick={() => {
                    addNode(t.baseType);
                    setTimeout(() => {
                      setNodes(prev => {
                        if (prev.length === 0) return prev;
                        const arr = [...prev];
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
                        arr[arr.length - 1] = { ...n, data: { ...(n.data || {}), label: t.label || (n.data as any)?.label, shape: t.shape, modelName: t.modelName, tags: t.tags, inputs: t.inputs, outputs: t.outputs, schema: t.schema, defaults: t.defaults }, style } as RFNode;
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
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed, color: '#111827', width: 16, height: 16 },
          style: { stroke: '#111827', strokeWidth: 1.5 },
        }}
        connectionLineType={shiftDown ? ConnectionLineType.Step : ConnectionLineType.Bezier}
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
          <div className="wb-tabs-strip" onWheel={(e)=>{ if (e.deltaY !== 0) { e.currentTarget.scrollLeft += e.deltaY; } }}>
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
              <div className="wb-sim-card">
                <div className="wb-sim-section-title">
                  <span>Test Parameters</span>
                  <span>{simActive ? '● Running' : ''}</span>
                </div>
                <div className="wb-sim-group">
                  <div>
                    <div className="wb-sim-label">Workflow Version</div>
                    <select className="wb-select" value={simWorkflowVersion} onChange={(e)=>setSimWorkflowVersion(e.target.value)}>
                      <option value="current">Current Canvas</option>
                      {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="wb-sim-label">Test Intent</div>
                    <input className="wb-select wb-sim-intent" placeholder="book_meeting" value={simIntent} onChange={(e)=>setSimIntent(e.target.value)} />
                  </div>
                  <div>
                    <div className="wb-sim-label">Simulated User Input</div>
                    <input className="wb-select wb-sim-user-text" placeholder="Tôi muốn đặt lịch họp sáng mai" value={simText} onChange={(e)=>setSimText(e.target.value)} />
                  </div>
                  <div>
                    <div className="wb-sim-label">Voice Option</div>
                    {isTTSSupported() ? (
                      <select value={ttsVoiceName} onChange={(e)=>setTTSVoiceName(e.target.value)} className="wb-select">
                        <option value="">Default</option>
                        {ttsVoices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                      </select>
                    ) : (
                      <div className="wb-muted-sm">TTS not supported</div>
                    )}
                    {isTTSSupported() && (
                      <label className="wb-row-6" style={{ marginTop:6 }}>
                        <input type="checkbox" checked={ttsEnabled} onChange={(e)=>setTTSEnabled(e.target.checked)} /> Enable TTS
                      </label>
                    )}
                  </div>
                  <div className="wb-sim-grid2">
                    <div>
                      <div className="wb-sim-label">Latency (ms)</div>
                      <input type="number" className="wb-select" value={simLatencyMs} onChange={(e)=>setSimLatencyMs(Number(e.target.value))} />
                    </div>
                    <div>
                      <div className="wb-sim-label">Time Limit (sec)</div>
                      <input type="number" className="wb-select" value={simTimeLimitSec} onChange={(e)=>setSimTimeLimitSec(Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="wb-row wb-gap-12">
                    <button className="wb-btn-strong wb-flex-1" onClick={() => { startFlow(); }}>Start</button>
                    <button className="wb-btn wb-flex-1" onClick={() => { setSimActive(false); setSimNodeId(undefined); emitLog('system','Simulation cleared'); setSimNLU(null); }}>Clear</button>
                  </div>
                </div>
              </div>
              <div className="wb-sim-card">
                <div className="wb-sim-section-title">Conversation Logs</div>
                <div className="wb-log" style={{ border:'1px solid #111827', borderRadius:12, padding:10 }}>
                  {simLog.length === 0 && <div className="wb-muted-sm">Chưa có hội thoại</div>}
                  {simLog.map((m,i)=>{
                    const timeStr = new Date(m.when).toLocaleTimeString();
                    return (
                      <div key={i} className="wb-mb-6">- [{timeStr}] {m.role === 'agent' ? 'AI' : m.role === 'user' ? 'User' : 'System'}: "{m.text}"</div>
                    );
                  })}
                </div>
                <div className="wb-export-wrapper">
                  <button className="wb-export-btn" onClick={() => setExportOpen(o=>!o)}>Export ▾</button>
                  {exportOpen && (
                    <div className="wb-export-panel">
                      <button className="wb-export-item" onClick={() => {
                        const stamp = new Date().toISOString().replace(/[:.-]/g,'').slice(0,15);
                        const header = 'timestamp,role,text';
                        const rows = simLog.map(m => {
                          const ts = new Date(m.when).toISOString();
                          const esc = (s: string) => '"' + s.replace(/"/g,'""').replace(/\n/g,'\\n') + '"';
                          return [esc(ts), esc(m.role), esc(m.text)].join(',');
                        });
                        const csv = [header, ...rows].join('\n');
                        const blob = new Blob([csv], { type:'text/csv' });
                        const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`simulation_log_${stamp}.csv`; a.click(); URL.revokeObjectURL(url);
                        setExportOpen(false);
                      }}>CSV</button>
                      <button className="wb-export-item" onClick={() => {
                        const stamp = new Date().toISOString().replace(/[:.-]/g,'').slice(0,15);
                        const json = JSON.stringify(simLog.map(m => ({ ...m, timestamp: new Date(m.when).toISOString() })), null, 2);
                        const blob = new Blob([json], { type:'application/json' });
                        const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`simulation_log_${stamp}.json`; a.click(); URL.revokeObjectURL(url);
                        setExportOpen(false);
                      }}>JSON</button>
                    </div>
                  )}
                </div>
                <div className="wb-sim-footer">
                  {simActive ? <span>Simulation running</span> : <span>Simulation {simLog.length>0 ? 'completed' : 'idle'}</span>}
                  {simStartTs && <span>— Duration: {((Date.now()-simStartTs)/1000).toFixed(1)}s</span>}
                  {simNLU && <span>— Intent: {simNLU.intent}</span>}
                </div>
              </div>
            </div>
          )}

          {rightTab === 'io' && (
            <div className="wb-col wb-gap-8">
              <div className="wb-title">Import / Export</div>

              {/* Export card */}
              <div className="wb-card-sm wb-col wb-gap-8">
                <div className="wb-row wb-justify-between">
                  <div className="wb-muted-sm">Export</div>
                  <div className="wb-opacity-60">▾</div>
                </div>
                <button className="wb-btn wb-fw-600" onClick={() => setExportModalOpen(true)}>Open Export</button>
              </div>

              {/* Import card with drop zone */}
              <div className="wb-card-sm wb-col wb-gap-8">
                <div className="wb-row wb-justify-between">
                  <div className="wb-muted-sm">Import</div>
                  <div className="wb-opacity-60">▾</div>
                </div>
                <div
                  className={`wb-dashed ${importDragOver ? 'wb-drop-active' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setImportDragOver(true); }}
                  onDragLeave={() => setImportDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setImportDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) previewImportFromFile(file);
                  }}
                >
                  <div className="wb-muted-sm">Upload .JSON here</div>
                </div>
                <label className="wb-inline-btn wb-self-start" style={{ marginTop: 4 }}>
                  Choose File
                  <input type="file" accept="application/json" className="wb-hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) previewImportFromFile(f); e.currentTarget.value=''; }} />
                </label>
              </div>
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
    {showTplModal && (
      <div className="wb-modal-overlay">
        <div className="wb-modal">
          <button
            className="wb-close-btn"
            onClick={() => setShowTplModal(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowTplModal(false); } }}
            aria-label="Close"
          >✕</button>
          <h3>Create Node Template</h3>
          <div className="wb-col">
            <div className="wb-modal-section-title">General Info</div>
            <input className="wb-select" placeholder="Node Name" value={tplName} onChange={e => setTplName(e.target.value)} />
            <input className="wb-select" placeholder="Model Name" value={tplModel} onChange={e => setTplModel(e.target.value)} />
            <select className="wb-select" value={tplBase} onChange={e => setTplBase(e.target.value)}>
              <option value="">Type...</option>
              {NodeRegistry.map(r => (<option key={r.type} value={r.type}>{r.title}</option>))}
            </select>
            <div className={`wb-tag-dropdown ${tagDropdownOpen ? 'open' : ''}`}>
              <button type="button" className="wb-tag-trigger" onClick={() => setTagDropdownOpen(o => !o)}>
                <span className="wb-tag-label">{tplTags.length === 0 ? 'Select tags...' : tplTags.join(', ')}</span>
              </button>
              {tagDropdownOpen && (
                <div className="wb-tag-panel">
                  {predefinedTags.map(tag => {
                    const selected = tplTags.includes(tag);
                    return (
                      <div
                        key={tag}
                        className={`wb-tag-option ${selected ? 'selected' : ''}`}
                        onClick={() => setTplTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                      >
                        <span className="wb-tag-dot" /> {tag}
                      </div>
                    );
                  })}
                  {tplTags.length > 0 && (
                    <div className="wb-tag-option" onClick={() => setTplTags([])}>Clear all</div>
                  )}
                </div>
              )}
            </div>
            {tplTags.length>0 && (
              <div className="wb-row wb-flex-wrap" style={{ flexWrap:'wrap', gap:6 }}>
                {tplTags.map(tag => (
                  <span key={tag} className="wb-tag-badge">{tag}<button className="wb-tag-remove" onClick={() => setTplTags(ts=>ts.filter(t=>t!==tag))}>×</button></span>
                ))}
              </div>
            )}
            <input className="wb-select" placeholder="Display Label (optional)" value={tplLabel} onChange={e=>setTplLabel(e.target.value)} />
            <select className="wb-select" value={tplShape} onChange={e=>setTplShape(e.target.value)}>
              <option value="">Shape (optional)</option>
              <option value="square">Square</option>
              <option value="rounded">Rounded</option>
              <option value="pill">Pill</option>
              <option value="circle">Circle</option>
              <option value="diamond">Diamond</option>
            </select>
          </div>
          <div className="wb-col">
            <div className="wb-modal-section-title">Ports Configuration</div>
            <div className="wb-muted-sm">Input Ports</div>
            {portsIn.map((p,i)=>(
              <div key={i} className="wb-port-row">
                <input className="wb-input" placeholder="name" value={p.name} onChange={e=>setPortsIn(arr=>arr.map((it,idx)=>idx===i?{...it,name:e.target.value}:it))} />
                <input className="wb-input" placeholder="type" value={p.type} onChange={e=>setPortsIn(arr=>arr.map((it,idx)=>idx===i?{...it,type:e.target.value}:it))} />
                <button className="wb-btn-icon" onClick={()=>setPortsIn(arr=>arr.filter((_,idx)=>idx!==i))}>×</button>
              </div>
            ))}
            <button className="wb-inline-btn" onClick={()=>setPortsIn(arr=>[...arr,{name:'',type:''}])}>+ Add Input Port</button>
            <div className="wb-muted-sm" style={{ marginTop:8 }}>Output Ports</div>
            {portsOut.map((p,i)=>(
              <div key={i} className="wb-port-row">
                <input className="wb-input" placeholder="name" value={p.name} onChange={e=>setPortsOut(arr=>arr.map((it,idx)=>idx===i?{...it,name:e.target.value}:it))} />
                <input className="wb-input" placeholder="type" value={p.type} onChange={e=>setPortsOut(arr=>arr.map((it,idx)=>idx===i?{...it,type:e.target.value}:it))} />
                <button className="wb-btn-icon" onClick={()=>setPortsOut(arr=>arr.filter((_,idx)=>idx!==i))}>×</button>
              </div>
            ))}
            <button className="wb-inline-btn" onClick={()=>setPortsOut(arr=>[...arr,{name:'',type:''}])}>+ Add Output Port</button>
          </div>
          <div className="wb-col">
            <div className="wb-modal-section-title">Props Schema (JSONSchema)</div>
            <textarea className="wb-code-area" value={schemaText} onChange={e=>setSchemaText(e.target.value)} />
            <div className="wb-modal-section-title">Default Values</div>
            {defaults.map((d,i)=>(
              <div key={i} className="wb-default-row">
                <input className="wb-input" placeholder="# Key" value={d.key} onChange={e=>setDefaults(arr=>arr.map((it,idx)=>idx===i?{...it,key:e.target.value}:it))} />
                <input className="wb-input" placeholder="# value pairs" value={d.value} onChange={e=>setDefaults(arr=>arr.map((it,idx)=>idx===i?{...it,value:e.target.value}:it))} />
                <button className="wb-btn-icon" onClick={()=>setDefaults(arr=>arr.filter((_,idx)=>idx!==i))}>×</button>
              </div>
            ))}
            <div className="wb-default-actions">
              <div className="wb-link-icon" title="Link key/value">⛓</div>
              <button className="wb-plus-btn" onClick={()=>setDefaults(arr=>[...arr,{key:'',value:''}])}>＋</button>
            </div>
            <div className="wb-default-actions" style={{ marginTop: 14 }}>
              <button className="wb-btn" onClick={validateSchema}>Validate Schema</button>
              <button className="wb-btn-strong" onClick={() => {
                if (!tplName || !tplBase) return;
                let parsed: any = undefined;
                if (schemaValid) {
                  try { parsed = JSON.parse(schemaText); } catch {}
                }
                const defaultsObj: Record<string,string> = {};
                for (const d of defaults) if (d.key.trim()) defaultsObj[d.key.trim()] = d.value;
                const next: NodeTemplateFull = { name: tplName, baseType: tplBase, label: tplLabel || undefined, modelName: tplModel || undefined, shape: tplShape || undefined, tags: tplTags, inputs: portsIn.filter(p=>p.name.trim()), outputs: portsOut.filter(p=>p.name.trim()), schema: parsed, defaults: defaultsObj };
                const list = [...templates, next];
                setTemplates(list);
                try { localStorage.setItem(TPL_KEY, JSON.stringify(list)); } catch {}
                setShowTplModal(false);
              }}>Save Template</button>
              <button className="wb-btn" onClick={() => { setShowTplModal(false); }}>Cancel</button>
            </div>
          </div>
          <div>
            {schemaValid === null && <div className="wb-muted-sm">Validate hiển thị trạng thái.</div>}
            {schemaValid === true && <div className="wb-status-good">Schema Valid ✓</div>}
            {schemaValid === false && (
              <div className="wb-status-bad">Error: {schemaErrors.join(', ')}</div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Export Modal */}
    {exportModalOpen && (
      <div className="wb-modal-overlay">
        <div className="wb-modal">
          <button
            className="wb-close-btn"
            onClick={() => setExportModalOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setExportModalOpen(false); } }}
            aria-label="Close"
          >✕</button>
          <h3>Export to JSON</h3>
          <div className="wb-col wb-gap-10">
            <div className="wb-muted-sm">Select Version</div>
            <select className="wb-select" value={exportVerId} onChange={(e)=>setExportVerId(e.target.value)}>
              <option value="current">Current Canvas</option>
              {versions.map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </select>
            <div className="wb-card-sm">
              <div>Variables <span className="wb-ml-8">✔</span></div>
              <div>Bindings <span className="wb-ml-8">✔</span></div>
              <div>Templates <span className="wb-ml-8">✔</span></div>
            </div>
            <button className="wb-btn-strong" onClick={runExportJson}>Export .json</button>
            <div className="wb-muted-sm">Exported schemaVersion: v1.2.0</div>
          </div>
        </div>
      </div>
    )}

    {/* Import Status Modal */}
    {importModalOpen && (
      <div className="wb-modal-overlay">
        <div className="wb-modal">
          <button
            className="wb-close-btn"
            onClick={() => setImportModalOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setImportModalOpen(false); } }}
            aria-label="Close"
          >✕</button>
          <h3>{importStatus.fileName || 'workflow.json'}</h3>
          <div className="wb-col wb-gap-8">
            <div>Detected schemaVersion: <span className="wb-fw-700">{importStatus.schemaVersion || '—'}</span></div>
            <div>Validation Result: {importStatus.valid ? '✅ Valid' : '❌ Invalid'}</div>
            <div>Errors: {importStatus.errors.length === 0 ? '(empty)' : ''}</div>
            {importStatus.errors.length > 0 && (
              <div className="wb-issues-panel">
                {importStatus.errors.map((e,i)=>(<div key={i} className="wb-issue-badge">{e}</div>))}
              </div>
            )}
            <button className="wb-btn-strong" onClick={importApply} disabled={!importStatus.valid || importStatus.state==='importing'}>
              {importStatus.state === 'done' ? 'Imported ✓' : importStatus.state === 'importing' ? 'Importing…' : 'Import Workflow'}
            </button>
            {importStatus.state === 'done' && <div className="wb-muted-sm">Imported Successfully ✓</div>}
          </div>
        </div>
      </div>
    )}
  </>
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

  // ESC closes dialing policy modal if open
  useEffect(() => {
    if (!policyOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPolicyOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [policyOpen]);

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

      {/* Dialing policy modal trigger */}
      <div>
        <button onClick={() => setPolicyOpen(true)} className="wb-accordion-btn">
          <span>Dialing policy</span><span>▾</span>
        </button>
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

      {/* Dialing policy modal */}
      {policyOpen && (
        <div className="wb-modal-overlay">
          <div className="wb-modal">
            <button
              className="wb-close-btn"
              onClick={() => setPolicyOpen(false)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setPolicyOpen(false); } }}
              aria-label="Close"
            >✕</button>
            <h3>Dialing Policy</h3>
            <div className="wb-col wb-gap-10">
              <div className="wb-field">
                <div className="wb-field-label">Max Concurrency</div>
                <input type="number" value={maxConcurrency} onChange={(e) => setMaxConcurrency(Number(e.target.value))} className="wb-select" />
                <div className="wb-help">Số cuộc gọi chạy song song. Ví dụ: 50.</div>
              </div>

              <div className="wb-grid-2">
                <div className="wb-field">
                  <div className="wb-field-label">Rate Limit (/min)</div>
                  <input type="number" value={rateLimit} onChange={(e) => setRateLimit(Number(e.target.value))} className="wb-select" />
                  <div className="wb-help">Số cuộc gọi bắt đầu mỗi phút. Ví dụ: 120 ≈ 2/s.</div>
                </div>
                <div className="wb-field">
                  <div className="wb-field-label">Delay (Retry Delay, s)</div>
                  <input type="number" value={retryDelay} onChange={(e) => setRetryDelay(Number(e.target.value))} className="wb-select" />
                  <div className="wb-help">Thời gian chờ giữa các lần retry. Ví dụ: 300 giây.</div>
                </div>
              </div>

              <div className="wb-grid-2">
                <div className="wb-field">
                  <div className="wb-field-label">Retries</div>
                  <input type="number" value={retries} onChange={(e) => setRetries(Number(e.target.value))} className="wb-select" />
                  <div className="wb-help">Số lần gọi lại tối đa khi thất bại. Ví dụ: 2.</div>
                </div>
                <div className="wb-field">
                  <div className="wb-field-label">Retry On</div>
                  <div className="wb-checkbox-group">
                    <label><input type="checkbox" checked={retryOn.noAnswer} onChange={(e) => setRetryOn(s => ({ ...s, noAnswer: e.target.checked }))} /> No answer</label>
                    <label><input type="checkbox" checked={retryOn.busy} onChange={(e) => setRetryOn(s => ({ ...s, busy: e.target.checked }))} /> Busy</label>
                    <label><input type="checkbox" checked={retryOn.failed} onChange={(e) => setRetryOn(s => ({ ...s, failed: e.target.checked }))} /> Failed</label>
                  </div>
                  <div className="wb-help">Chỉ định trạng thái được phép retry (theo CDR).</div>
                </div>
              </div>

              <div className="wb-grid-2">
                <div className="wb-field">
                  <div className="wb-field-label">Time Window</div>
                  <div className="wb-row wb-gap-8 wb-items-center">
                    <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="wb-select" />
                    <span>–</span>
                    <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="wb-select" />
                  </div>
                  <div className="wb-help">Khung giờ được phép gọi. Ví dụ: 09:00–18:00.</div>
                </div>
                <div className="wb-field">
                  <div className="wb-field-label">Caller ID</div>
                  <input value={callerId} onChange={(e) => setCallerId(e.target.value)} placeholder="e.g., +84xxxx" className="wb-select" />
                  <div className="wb-help">Số hiển thị khi gọi ra (DID/Tổng đài).</div>
                </div>
              </div>

              <div className="wb-grid-2">
                <div className="wb-field">
                  <div className="wb-field-label">Timezone</div>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="wb-select">
                    <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
                    <option value="Asia/Bangkok">Asia/Bangkok</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </select>
                  <div className="wb-help">Xác định múi giờ áp dụng Time Window.</div>
                </div>
                <div className="wb-field">
                  <label className="wb-row wb-gap-8 wb-items-center wb-field-label">
                    <input type="checkbox" checked={applyDnc} onChange={(e) => setApplyDnc(e.target.checked)} /> Apply Global DNC Filter
                  </label>
                  <div className="wb-help">Loại bỏ số trong danh sách Do Not Call.</div>
                </div>
              </div>

              <div className="wb-modal-actions">
                <button className="wb-btn-strong" onClick={() => setPolicyOpen(false)}>Save</button>
                <button className="wb-btn" onClick={() => setPolicyOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

