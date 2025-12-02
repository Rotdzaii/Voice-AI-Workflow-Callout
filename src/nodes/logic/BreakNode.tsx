import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function BreakNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 9999, border: '2px solid #6b7280', background: '#f3f4f6', minWidth: 120, textAlign: 'center' }}>
      <Handle type="target" position={Position.Top} id="in" />
      ⏹️ Break
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default BreakNode;
