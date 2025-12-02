import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function WebhookNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #8b5cf6', background: '#f5f3ff', minWidth: 160 }}>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      📡 Webhook
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default WebhookNode;
