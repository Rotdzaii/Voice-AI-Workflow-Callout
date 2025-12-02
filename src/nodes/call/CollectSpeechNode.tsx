import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function CollectSpeechNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #9333ea', background: '#f5f3ff', minWidth: 170 }}>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="speech" />
      🎙️ Collect Speech
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default CollectSpeechNode;
