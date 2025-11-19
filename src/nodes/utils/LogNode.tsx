import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function LogNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #374151', background: '#f3f4f6', minWidth: 140 }}>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      🪵 Log
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default LogNode;
