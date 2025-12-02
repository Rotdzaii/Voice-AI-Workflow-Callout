import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function PlayAudioNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #2563eb', background: '#eff6ff', minWidth: 160 }}>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      ▶️ Play Audio
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default PlayAudioNode;
