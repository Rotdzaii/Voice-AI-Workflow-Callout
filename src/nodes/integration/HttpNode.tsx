import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function HttpNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #3b82f6', background: '#eff6ff', minWidth: 160 }}>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      🌐 HTTP Request
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default HttpNode;
