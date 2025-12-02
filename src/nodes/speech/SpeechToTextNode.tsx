import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function SpeechToTextNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #0d9488', background: '#f0fdfa', minWidth: 170 }}>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="stt" />
      🗣️ Speech → Text
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default SpeechToTextNode;
