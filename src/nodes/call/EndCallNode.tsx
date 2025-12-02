import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function EndCallNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 9999, border: '2px solid #dc2626', background: '#fef2f2', minWidth: 140, textAlign: 'center' }}>
      <Handle type="target" position={Position.Top} id="in" />
      🔚 End Call
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default EndCallNode;
