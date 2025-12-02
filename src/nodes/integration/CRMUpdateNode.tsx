import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function CRMUpdateNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #16a34a', background: '#f0fdf4', minWidth: 180 }}>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      🧾 CRM Update
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default CRMUpdateNode;
