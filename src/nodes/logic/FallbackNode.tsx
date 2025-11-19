import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function FallbackNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px dashed #9ca3af', background: '#f9fafb', minWidth: 160 }}>
      <Handle type="target" position={Position.Top} id="in" />
      🧩 Fallback
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default FallbackNode;
