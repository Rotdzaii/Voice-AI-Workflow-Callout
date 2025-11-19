import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function TextToSpeechNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #a16207', background: '#fffbeb', minWidth: 170 }}>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="tts" />
      🔊 Text → Speech
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default TextToSpeechNode;
