import type { ComponentType } from 'react';
import type { NodeProps } from 'reactflow';

// Call
// Backend-wired nodes
import CallNode from '../components/nodes/CallNode';
import CallStartNode from '../components/nodes/CallStartNode';
import NLUNode from '../components/nodes/NLUNode';
import ConversationNode from '../components/nodes/ConversationNode';
import TelephonyNode from '../components/nodes/TelephonyNode';
import IntentsNode from '../components/nodes/IntentsNode';
import EntitiesNode from '../components/nodes/EntitiesNode';
import WorkflowNode from '../components/nodes/WorkflowNode';

// Speech
// Removed speech nodes (no direct backend API)

// Logic
// Keep minimal logic nodes if needed (removed for backend-only wiring)

// Integration
// Removed generic integration nodes (not mapped to backend API)

// Utils
// Removed utils log node

export type RegistryEntry = {
  type: string;
  title: string;
  component: ComponentType<NodeProps>;
  category: 'call' | 'speech' | 'logic' | 'integration' | 'utils';
};

export const NodeRegistry: RegistryEntry[] = [
  // Workflow
  { type: 'workflow.manage', title: 'Workflow', component: WorkflowNode as unknown as ComponentType<NodeProps>, category: 'integration' },

  // Call
  { type: 'call.start', title: 'Call Start', component: CallStartNode as unknown as ComponentType<NodeProps>, category: 'call' },
  { type: 'call.api', title: 'Call (Advanced)', component: CallNode as unknown as ComponentType<NodeProps>, category: 'call' },
  { type: 'telephony.originate', title: 'Telephony Originate', component: TelephonyNode as unknown as ComponentType<NodeProps>, category: 'call' },

  // NLU
  { type: 'nlu.parse', title: 'NLU Parse', component: NLUNode as unknown as ComponentType<NodeProps>, category: 'speech' },
  { type: 'conversation.next', title: 'Conversation Next', component: ConversationNode as unknown as ComponentType<NodeProps>, category: 'speech' },
  { type: 'conversation.agent', title: 'Conversation Agent', component: ConversationNode as unknown as ComponentType<NodeProps>, category: 'speech' },

  // Catalog
  { type: 'catalog.intents', title: 'Intents', component: IntentsNode as unknown as ComponentType<NodeProps>, category: 'integration' },
  { type: 'catalog.entities', title: 'Entities', component: EntitiesNode as unknown as ComponentType<NodeProps>, category: 'integration' },
];

export function nodeTypesMap() {
  return Object.fromEntries(NodeRegistry.map((r) => [r.type, r.component]));
}
