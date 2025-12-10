export type WorkflowStatus = 'active' | 'draft' | 'error';

export type WorkflowGraph = Record<string, unknown>[] | Record<string, unknown> | null;

export interface WorkflowRecord {
  id: string;
  name: string;
  nodes: WorkflowGraph;
  edges: WorkflowGraph;
  status: WorkflowStatus;
  updated_at: string;
  created_at?: string;
  description?: string | null;
}

export interface WorkflowUpsertPayload {
  name: string;
  nodes?: WorkflowGraph;
  edges?: WorkflowGraph;
  status?: WorkflowStatus;
}
