import { createMachine, assign } from 'xstate';
import type { ActorRefFrom } from 'xstate';

// Optional: Stately Inspector if installed and running in dev
let inspectorStarted = false;
try {
  if (import.meta.env?.DEV) {
    // Dynamically import to avoid affecting prod bundle
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { inspect } = await import('@statelyai/inspect');
    inspect({
      iframe: false,
    });
    inspectorStarted = true;
  }
} catch {
  // ignore if inspector not available
}

// Use string NodeType to support registry-based dynamic types (e.g., 'logic.condition', 'call.end').
export type NodeType = string;

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label?: string;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowContext {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId?: string;
  variables?: Record<string, string>;
}

export type WorkflowEvent =
  | { type: 'ADD_NODE'; node: WorkflowNode }
  | { type: 'UPDATE_NODE'; id: string; patch: Partial<WorkflowNode> }
  | { type: 'REMOVE_NODE'; id: string }
  | { type: 'ADD_EDGE'; edge: WorkflowEdge }
  | { type: 'REMOVE_EDGE'; id: string }
  | { type: 'SELECT_NODE'; id?: string }
  | { type: 'SET_VAR'; key: string; value: string }
  | { type: 'DELETE_VAR'; key: string }
  | { type: 'RESET' };

export const createWorkflowMachine = (initial?: Partial<WorkflowContext>) => {
  return createMachine({
    id: 'workflow',
    types: {} as {
      context: WorkflowContext;
      events: WorkflowEvent;
    },
    context: {
      nodes: [],
      edges: [],
      selectedNodeId: undefined,
      variables: {},
      ...initial,
    },
    initial: 'idle',
    states: {
      idle: {
        on: {
          ADD_NODE: {
            actions: assign(({ context, event }) => ({
              nodes: [...context.nodes, (event as Extract<WorkflowEvent, { type: 'ADD_NODE' }>).node],
            })),
          },
          UPDATE_NODE: {
            actions: assign(({ context, event }) => {
              const { id, patch } = event as Extract<WorkflowEvent, { type: 'UPDATE_NODE' }>;
              return {
                nodes: context.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
              };
            }),
          },
          REMOVE_NODE: {
            actions: assign(({ context, event }) => {
              const { id } = event as Extract<WorkflowEvent, { type: 'REMOVE_NODE' }>;
              return {
                nodes: context.nodes.filter((n) => n.id !== id),
                edges: context.edges.filter((e) => e.source !== id && e.target !== id),
                selectedNodeId: context.selectedNodeId === id ? undefined : context.selectedNodeId,
              };
            }),
          },
          ADD_EDGE: {
            actions: assign(({ context, event }) => ({
              edges: [...context.edges, (event as Extract<WorkflowEvent, { type: 'ADD_EDGE' }>).edge],
            })),
          },
          REMOVE_EDGE: {
            actions: assign(({ context, event }) => {
              const { id } = event as Extract<WorkflowEvent, { type: 'REMOVE_EDGE' }>;
              return {
                edges: context.edges.filter((e) => e.id !== id),
              };
            }),
          },
          SELECT_NODE: {
            actions: assign(({ event }) => ({
              selectedNodeId: (event as Extract<WorkflowEvent, { type: 'SELECT_NODE' }>).id,
            })),
          },
          SET_VAR: {
            actions: assign(({ context, event }) => {
              const { key, value } = event as Extract<WorkflowEvent, { type: 'SET_VAR' }>;
              return {
                variables: { ...(context.variables ?? {}), [key]: value },
              };
            }),
          },
          DELETE_VAR: {
            actions: assign(({ context, event }) => {
              const { key } = event as Extract<WorkflowEvent, { type: 'DELETE_VAR' }>;
              const next = { ...(context.variables ?? {}) };
              delete next[key];
              return { variables: next };
            }),
          },
          RESET: {
            actions: assign(() => ({ nodes: [], edges: [], selectedNodeId: undefined })),
          },
        },
      },
    },
  });
};

export type WorkflowMachine = ReturnType<typeof createWorkflowMachine>;
export type WorkflowActor = ActorRefFrom<WorkflowMachine>;

export const inspectorEnabled = inspectorStarted;

// -------- Selectors --------
export const selectors = {
  getSelectedNode(ctx: WorkflowContext) {
    return ctx.nodes.find((n) => n.id === ctx.selectedNodeId);
  },
  getNodeById: (ctx: WorkflowContext, id: string) => ctx.nodes.find((n) => n.id === id),
  hasEdge: (ctx: WorkflowContext, source: string, target: string, sourceHandle?: string, targetHandle?: string) =>
    ctx.edges.some((e) => e.source === source && e.target === target && e.sourceHandle === sourceHandle && e.targetHandle === targetHandle),
};

// -------- Guard helpers --------
export function canAddEdge(ctx: WorkflowContext, edge: WorkflowEdge) {
  if (edge.source === edge.target) return false; // prevent self-loop
  // prevent duplicate edge of same handles
  if (selectors.hasEdge(ctx, edge.source, edge.target, edge.sourceHandle, edge.targetHandle)) return false;
  // condition branch validation: allow any handle but ensure uniqueness per source
  const sourceNode = selectors.getNodeById(ctx, edge.source);
  if (sourceNode && (sourceNode.type === 'logic.condition' || sourceNode.type.endsWith('.condition'))) {
    const handle = edge.sourceHandle ?? '';
    // Require a handle when connecting from a condition
    if (!handle) return false;
    const exists = ctx.edges.some((e) => e.source === edge.source && e.sourceHandle === handle);
    if (exists) return false; // already has branch for this handle
  }
  // Terminal nodes cannot have outgoing edges (e.g., end/fallback/break)
  const srcNode = selectors.getNodeById(ctx, edge.source);
  const t = srcNode?.type ?? '';
  if (t === 'logic.fallback' || t === 'logic.break' || t === 'call.end' || t.endsWith('.end')) return false;
  return true;
}
