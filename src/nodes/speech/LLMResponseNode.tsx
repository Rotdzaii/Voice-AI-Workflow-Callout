import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export function LLMResponseNode({ data }: NodeProps) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: '2px solid #7c3aed', background: '#f5f3ff', minWidth: 170 }}>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      🤖 LLM Response
      {data?.label && <div style={{ marginTop: 6, fontSize: 12 }}>{data.label}</div>}
    </div>
  );
}
export default LLMResponseNode;
